import { NextRequest, NextResponse } from 'next/server';
import { TemplateService } from '@/lib/email/template-service';

type RouteContext = {
  params: { id: string };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const versions = await TemplateService.getTemplateVersions(params.id);

    return NextResponse.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    console.error('Error fetching template versions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch template versions',
      },
      { status: 500 }
    );
  }
}