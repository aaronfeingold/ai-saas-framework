import { NextRequest, NextResponse } from 'next/server';
import { EmailQueue } from '@/lib/email/queue';

export async function GET(request: NextRequest) {
  try {
    const stats = await EmailQueue.getQueueStats();
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get queue stats' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'process':
        await EmailQueue.processQueue();
        return NextResponse.json({
          success: true,
          message: 'Queue processing initiated',
        });

      case 'retry-failed':
        const retriedCount = await EmailQueue.retryFailedEmails();
        return NextResponse.json({
          success: true,
          message: `${retriedCount} failed emails queued for retry`,
          retriedCount,
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing queue action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process queue action' 
      },
      { status: 500 }
    );
  }
}