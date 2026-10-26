import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { EmailService } from '@/lib/email/service';
import { BulkEmailRequestSchema } from '@/lib/email/types';

// Enhanced rate limiting for bulk operations
const bulkRequestCounts = new Map<string, { count: number; resetTime: number }>();
const BULK_RATE_LIMIT = 3; // 3 bulk operations per day per IP
const BULK_RATE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_BULK_SIZE = 100; // Maximum recipients per bulk operation

function checkBulkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userLimit = bulkRequestCounts.get(identifier);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize
    bulkRequestCounts.set(identifier, {
      count: 1,
      resetTime: now + BULK_RATE_WINDOW,
    });
    return true;
  }

  if (userLimit.count >= BULK_RATE_LIMIT) {
    return false;
  }

  userLimit.count += 1;
  return true;
}

/**
 * POST /api/email/bulk
 * Send bulk emails using a template
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Check bulk rate limit
    if (!checkBulkRateLimit(clientIp)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bulk email rate limit exceeded. Please try again in 24 hours.',
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    
    // Validate the request data
    const validationResult = BulkEmailRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // Check recipient count limit
    if (validationResult.data.recipients.length > MAX_BULK_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many recipients. Maximum ${MAX_BULK_SIZE} recipients per bulk operation.`,
        },
        { status: 400 }
      );
    }

    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'Email service is not configured',
        },
        { status: 500 }
      );
    }

    // Send the bulk emails
    const result = await EmailService.sendBulkEmail(validationResult.data);

    return NextResponse.json({
      success: result.success,
      totalSent: result.totalSent,
      totalFailed: result.totalFailed,
      results: result.results,
      message: `Bulk email operation completed. ${result.totalSent} sent, ${result.totalFailed} failed.`,
    });

  } catch (error) {
    console.error('Bulk email API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/email/bulk
 * Return bulk email API documentation
 */
export async function GET() {
  return NextResponse.json({
    name: 'Bulk Email API',
    version: '1.0.0',
    description: 'Send bulk emails to multiple recipients using predefined templates',
    endpoints: {
      'POST /api/email/bulk': {
        description: 'Send emails to multiple recipients',
        rateLimit: `${BULK_RATE_LIMIT} requests per 24 hours`,
        maxRecipients: MAX_BULK_SIZE,
        parameters: {
          recipients: 'string[] - Array of recipient email addresses',
          subject: 'string - Email subject line',
          template: 'string - Template type (welcome, password-reset, notification)',
          variables: 'object (optional) - Template variables',
        },
      },
    },
    limitations: {
      maxRecipientsPerRequest: MAX_BULK_SIZE,
      dailyRateLimit: BULK_RATE_LIMIT,
      batchSize: 50, // Resend batch size limit
    },
    examples: {
      notification: {
        recipients: [
          'user1@example.com',
          'user2@example.com',
          'user3@example.com',
        ],
        subject: 'Important System Update',
        template: 'notification',
        variables: {
          title: 'System Maintenance',
          message: 'We will be performing scheduled maintenance tonight from 2-4 AM EST.',
          actionUrl: 'https://your-app.com/status',
          actionText: 'View Status',
        },
      },
      welcome: {
        recipients: [
          'newuser1@example.com',
          'newuser2@example.com',
        ],
        subject: 'Welcome to AI SaaS Platform!',
        template: 'welcome',
        variables: {
          firstName: 'New User',
          loginUrl: 'https://your-app.com/login',
        },
      },
    },
  });
}