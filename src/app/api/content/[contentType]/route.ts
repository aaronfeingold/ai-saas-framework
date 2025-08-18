import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  createContent,
  getContentTypeBySlug,
  getContents,
} from '@/lib/content/queries';
import {
  ContentTypeNotFoundError,
  ContentValidationError,
  contentFilterSchema,
  createContentSchema,
} from '@/lib/content/types';

// GET /api/content/[contentType] - Get content items for a content type
export async function GET(
  request: NextRequest,
  { params }: { params: { contentType: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get content type by slug
    const contentType = await getContentTypeBySlug(params.contentType);
    if (!contentType) {
      return NextResponse.json(
        { error: 'Content type not found' },
        { status: 404 }
      );
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const filter = {
      content_type_id: contentType.id,
      status: searchParams.get('status') as
        | 'draft'
        | 'published'
        | 'archived'
        | 'pending_review'
        | null,
      search: searchParams.get('search'),
      featured:
        searchParams.get('featured') === 'true'
          ? true
          : searchParams.get('featured') === 'false'
            ? false
            : undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean),
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sort_by: searchParams.get('sort_by'),
      sort_direction:
        (searchParams.get('sort_direction') as 'asc' | 'desc') || 'desc',
    };

    // Validate filter parameters
    const validationResult = contentFilterSchema.safeParse(filter);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid filter parameters',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const result = await getContents(validationResult.data);

    return NextResponse.json({
      success: true,
      data: result.contents,
      pagination: {
        total: result.total,
        limit: filter.limit,
        offset: filter.offset,
        has_more: result.total > filter.offset + filter.limit,
      },
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

// POST /api/content/[contentType] - Create new content
export async function POST(
  request: NextRequest,
  { params }: { params: { contentType: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get content type by slug
    const contentType = await getContentTypeBySlug(params.contentType);
    if (!contentType) {
      return NextResponse.json(
        { error: 'Content type not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate request body structure
    const validationResult = createContentSchema.safeParse({
      ...body,
      content_type_id: contentType.id,
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

    const content = await createContent(
      contentType.id,
      validationResult.data,
      session.user.id
    );

    return NextResponse.json(
      {
        success: true,
        data: content,
        content_type: contentType,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating content:', error);

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
