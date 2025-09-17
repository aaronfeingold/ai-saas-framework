import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { EmailDatabase } from '@/lib/email/database';

// Query parameters schema
const StatsQuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional(),
  template: z.enum(['welcome', 'password-reset', 'notification', 'payment-confirmation', 'system-update', 'marketing']).optional(),
});

/**
 * GET /api/email/stats
 * Get email statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    // Validate query parameters
    const validationResult = StatsQuerySchema.safeParse(queryParams);
    
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

    const { startDate, endDate, template } = validationResult.data;

    // Get email statistics from database
    const stats = await EmailDatabase.getEmailStats({
      startDate,
      endDate,
      template,
    });

    // Calculate additional metrics
    const successRate = stats.total > 0 ? ((stats.sent + stats.delivered) / stats.total * 100).toFixed(2) : '0.00';
    const failureRate = stats.total > 0 ? (stats.failed / stats.total * 100).toFixed(2) : '0.00';
    const deliveryRate = stats.sent > 0 ? (stats.delivered / stats.sent * 100).toFixed(2) : '0.00';

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          total: stats.total,
          sent: stats.sent,
          delivered: stats.delivered,
          failed: stats.failed,
          pending: stats.pending,
          bounced: stats.bounced,
        },
        metrics: {
          successRate: parseFloat(successRate),
          failureRate: parseFloat(failureRate),
          deliveryRate: parseFloat(deliveryRate),
        },
        filters: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          template,
        },
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Email stats API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve email statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}