import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  createSampleFestivalContent,
  getFestivalStats,
  initializeFestivalDomain,
} from '@/lib/content/festival-setup';

// GET /api/content/festival/setup - Get festival setup status
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getFestivalStats(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        is_initialized: stats.content_types >= 3, // event, venue, artist
      },
    });
  } catch (error) {
    console.error('Error getting festival setup status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/content/festival/setup - Initialize festival domain
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { include_sample_data = false } = body;

    // Initialize content types
    const contentTypes = await initializeFestivalDomain(session.user.id);

    let sampleData = null;
    if (include_sample_data) {
      sampleData = await createSampleFestivalContent(
        contentTypes,
        session.user.id
      );
    }

    const stats = await getFestivalStats(session.user.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          content_types: contentTypes,
          sample_data: sampleData,
          stats,
        },
        message: 'Festival domain initialized successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error initializing festival domain:', error);

    if (error.message?.includes('already exists')) {
      return NextResponse.json(
        {
          error: 'Festival domain already initialized',
          details: error.message,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
