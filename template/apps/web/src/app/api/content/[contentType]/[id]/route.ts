import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  deleteContent,
  getContentById,
  getContentTypeBySlug,
  updateContent,
} from '@/lib/content/queries';
import {
  ContentNotFoundError,
  ContentTypeNotFoundError,
  ContentValidationError,
  updateContentSchema,
} from '@/lib/content/types';

// GET /api/content/[contentType]/[id] - Get a specific content item
export async function GET(
  request: NextRequest,
  { params }: { params: { contentType: string; id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get content type for context
    const contentType = await getContentTypeBySlug(params.contentType);
    if (!contentType) {
      return NextResponse.json(
        { error: 'Content type not found' },
        { status: 404 }
      );
    }

    const content = await getContentById(params.id);

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Check ownership (unless content is published and user has read access)
    if (
      content.created_by !== session.user.id &&
      content.status !== 'published'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: content,
      content_type: contentType,
    });
  } catch (error) {
    console.error('Error fetching content:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/content/[contentType]/[id] - Update content
export async function PUT(
  request: NextRequest,
  { params }: { params: { contentType: string; id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get content type for validation
    const contentType = await getContentTypeBySlug(params.contentType);
    if (!contentType) {
      return NextResponse.json(
        { error: 'Content type not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validationResult = updateContentSchema.safeParse({
      ...body,
      id: params.id,
    });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const content = await updateContent(
      params.id,
      validationResult.data,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: content,
      content_type: contentType,
    });
  } catch (error) {
    console.error('Error updating content:', error);

    if (error instanceof ContentNotFoundError) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    if (error instanceof ContentTypeNotFoundError) {
      return NextResponse.json(
        { error: 'Content type not found' },
        { status: 404 }
      );
    }

    if (error instanceof ContentValidationError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: [{ field: error.field, message: error.message }],
        },
        { status: 400 }
      );
    }

    if (error.message?.includes('Validation failed')) {
      return NextResponse.json(
        {
          error: 'Content validation failed',
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/content/[contentType]/[id] - Delete content
export async function DELETE(
  request: NextRequest,
  { params }: { params: { contentType: string; id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteContent(params.id, session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Content deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting content:', error);

    if (error instanceof ContentNotFoundError) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
