import { NextRequest, NextResponse } from 'next/server';

import { nanoid } from 'nanoid';

import { getSession } from '@/lib/auth/server/supabase';
import { createServerSupabaseClient } from '@/lib/server/server';

export const dynamic = 'force-dynamic';

// POST /api/documents/upload - Upload a document to Supabase Storage
export async function POST(req: NextRequest) {
  const user = await getSession();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;

    if (!file) {
      return new NextResponse('No file provided', { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ];

    if (!allowedTypes.includes(file.type)) {
      return new NextResponse('File type not supported', { status: 400 });
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return new NextResponse('File too large', { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const documentId = nanoid();
    const timestamp = Date.now();

    // Create unique file path
    const fileExtension = fileName.split('.').pop() || 'txt';
    const storagePath = `documents/${user.id}/${documentId}_${timestamp}.${fileExtension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new NextResponse('Upload failed', { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    // Create document record in database
    const { error: dbError } = await supabase
      .from('user_documents')
      .insert({
        id: documentId,
        user_id: user.id,
        title: fileName,
        filter_tags: `${fileName}_${timestamp}`,
        total_pages: 0, // Will be updated during processing
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Clean up uploaded file
      await supabase.storage.from('documents').remove([storagePath]);
      return new NextResponse('Database error', { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documentId,
      url: urlData.publicUrl,
      fileName,
      storagePath,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Upload API error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
