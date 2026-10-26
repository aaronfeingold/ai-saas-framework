import { NextResponse } from 'next/server';
import { TemplateService } from '@/lib/email/template-service';

export async function GET() {
  try {
    const stats = await TemplateService.getTemplateStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching template stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch template stats',
      },
      { status: 500 }
    );
  }
}