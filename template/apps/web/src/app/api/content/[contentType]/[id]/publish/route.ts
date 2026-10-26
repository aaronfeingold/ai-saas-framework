import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  getContentTypeBySlug,
  publishContent,
  unpublishContent,
} from '@/lib/content/queries';
import {
  ContentNotFoundError,
  ContentTypeNotFoundError,
} from '@/lib/content/types';

// POST /api/content/[contentType]/[id]/publish - Publish content
export async function POST(
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

    const content = await publishContent(params.id, session.user.id);

    return NextResponse.json({
      success: true,
      data: content,
      content_type: contentType,
      message: 'Content published successfully',
    });
  } catch (error) {
    console.error('Error publishing content:', error);

    if (error instanceof ContentNotFoundError) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

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

// DELETE /api/content/[contentType]/[id]/publish - Unpublish content
export async function DELETE(
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

    const content = await unpublishContent(params.id, session.user.id);

    return NextResponse.json({
      success: true,
      data: content,
      content_type: contentType,
      message: 'Content unpublished successfully',
    });
  } catch (error) {
    console.error('Error unpublishing content:', error);

    if (error instanceof ContentNotFoundError) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

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
