import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { EmailDatabase } from '@/lib/email/database';

// Query parameters schema
const LogsQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
  status: z.enum(['pending', 'sent', 'delivered', 'bounced', 'failed']).optional(),
  template: z.enum(['welcome', 'password-reset', 'notification', 'payment-confirmation', 'system-update', 'marketing']).optional(),
  email: z.string().email().optional(),
});

/**
 * GET /api/email/logs
 * Retrieve email logs with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    // Validate query parameters
    const validationResult = LogsQuerySchema.safeParse(queryParams);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const { limit, offset, status, template, email } = validationResult.data;

    // Get email logs from database
    const result = await EmailDatabase.getEmailLogs({
      limit,
      offset,
      status,
      template,
      email,
    });

    return NextResponse.json({
      success: true,
      data: {
        logs: result.logs,
        pagination: {
          total: result.total,
          limit: limit || 50,
          offset: offset || 0,
          hasMore: (offset || 0) + (limit || 50) < result.total,
        },
      },
      filters: {
        status,
        template,
        email,
      },
    });

  } catch (error) {
    console.error('Email logs API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve email logs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}