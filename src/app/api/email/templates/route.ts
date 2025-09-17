import { NextRequest, NextResponse } from 'next/server';
import { TemplateService } from '@/lib/email/template-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const active = searchParams.get('active') ? searchParams.get('active') === 'true' : undefined;
    const includeSystem = searchParams.get('includeSystem') === 'true';

    const templates = await TemplateService.getTemplates({
      category,
      active,
      includeSystem,
    });

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch templates',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const template = await TemplateService.createTemplate(data);

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error creating template:', error);
    const status = error instanceof Error && error.message.includes('already exists') ? 409 : 500;
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create template',
      },
      { status }
    );
  }
}