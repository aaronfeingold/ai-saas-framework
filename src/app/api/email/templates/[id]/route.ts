import { NextRequest, NextResponse } from 'next/server';
import { TemplateService } from '@/lib/email/template-service';

type RouteContext = {
  params: { id: string };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const template = await TemplateService.getTemplate(params.id);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch template',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const data = await request.json();
    const template = await TemplateService.updateTemplate(params.id, data);

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error updating template:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update template',
      },
      { status }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await TemplateService.deleteTemplate(params.id);

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete template',
      },
      { status }
    );
  }
}