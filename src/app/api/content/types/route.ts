import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import { createContentType, getContentTypes } from '@/lib/content/queries';
import {
  ContentValidationError,
  createContentTypeSchema,
} from '@/lib/content/types';

// GET /api/content/types - Get all content types
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentTypes = await getContentTypes(session.user.id);

    return NextResponse.json({
      success: true,
      data: contentTypes,
    });
  } catch (error) {
    console.error('Error fetching content types:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/content/types - Create a new content type
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validationResult = createContentTypeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const contentType = await createContentType(
      validationResult.data,
      session.user.id
    );

    return NextResponse.json(
      {
        success: true,
        data: contentType,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating content type:', error);

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
