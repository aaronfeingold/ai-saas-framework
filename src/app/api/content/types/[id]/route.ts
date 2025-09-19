import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  deleteContentType,
  getContentTypeById,
  updateContentType,
} from '@/lib/content/queries';
import {
  ContentTypeNotFoundError,
  ContentValidationError,
  updateContentTypeSchema,
} from '@/lib/content/types';

// GET /api/content/types/[id] - Get a specific content type
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = await getContentTypeById(params.id);

    if (!contentType) {
      return NextResponse.json(
        { error: 'Content type not found' },
        { status: 404 }
      );
    }

    // Check ownership (unless it's a system content type)
    if (!contentType.is_system && contentType.created_by !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: contentType,
    });
  } catch (error) {
    console.error('Error fetching content type:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/content/types/[id] - Update a content type
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validationResult = updateContentTypeSchema.safeParse({
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

    const contentType = await updateContentType(
      params.id,
      validationResult.data,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: contentType,
    });
  } catch (error) {
    console.error('Error updating content type:', error);

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

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/content/types/[id] - Delete a content type
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteContentType(params.id, session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Content type deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting content type:', error);

    if (error instanceof ContentTypeNotFoundError) {
      return NextResponse.json(
        { error: 'Content type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
