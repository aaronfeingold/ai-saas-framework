import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { EmailService } from '@/lib/email/service';
import { SendEmailRequestSchema } from '@/lib/email/types';

// Rate limiting (basic implementation - can be enhanced with Redis later)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // 10 emails per hour per IP
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userLimit = requestCounts.get(identifier);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize
    requestCounts.set(identifier, {
      count: 1,
      resetTime: now + RATE_WINDOW,
    });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count += 1;
  return true;
}

/**
 * POST /api/email/send
 * Send a single email using a template
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    
    // Validate the request data
    const validationResult = SendEmailRequestSchema.safeParse(body);
    
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

    // Send the email
    const result = await EmailService.sendEmail(validationResult.data);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send email',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully',
    });

  } catch (error) {
    console.error('Email API error:', error);
    
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
 * GET /api/email/send
 * Return API documentation and available templates
 */
export async function GET() {
  return NextResponse.json({
    name: 'Email Send API',
    version: '1.0.0',
    description: 'Send emails using predefined templates',
    endpoints: {
      'POST /api/email/send': {
        description: 'Send a single email',
        rateLimit: `${RATE_LIMIT} requests per hour`,
        parameters: {
          to: 'string (email) - Recipient email address',
          subject: 'string - Email subject line', 
          template: 'string - Template type (welcome, password-reset, notification)',
          variables: 'object (optional) - Template variables',
        },
      },
    },
    availableTemplates: [
      {
        name: 'welcome',
        description: 'Welcome email for new users',
        variables: {
          firstName: 'string - User first name',
          loginUrl: 'string - Login URL',
        },
      },
      {
        name: 'password-reset',
        description: 'Password reset email',
        variables: {
          firstName: 'string - User first name',
          resetUrl: 'string - Password reset URL',
          expiryHours: 'number - Hours until expiry (default: 24)',
        },
      },
      {
        name: 'notification',
        description: 'General notification email',
        variables: {
          title: 'string - Notification title',
          message: 'string - Notification message',
          actionUrl: 'string (optional) - Action button URL',
          actionText: 'string (optional) - Action button text',
        },
      },
    ],
    examples: {
      welcome: {
        to: 'user@example.com',
        subject: 'Welcome to AI SaaS Platform!',
        template: 'welcome',
        variables: {
          firstName: 'John',
          loginUrl: 'https://your-app.com/login',
        },
      },
      passwordReset: {
        to: 'user@example.com',
        subject: 'Reset Your Password',
        template: 'password-reset',
        variables: {
          firstName: 'John',
          resetUrl: 'https://your-app.com/reset-password?token=abc123',
          expiryHours: 24,
        },
      },
      notification: {
        to: 'user@example.com',
        subject: 'New Notification',
        template: 'notification',
        variables: {
          title: 'Account Update',
          message: 'Your account settings have been updated successfully.',
          actionUrl: 'https://your-app.com/settings',
          actionText: 'View Settings',
        },
      },
    },
  });
}