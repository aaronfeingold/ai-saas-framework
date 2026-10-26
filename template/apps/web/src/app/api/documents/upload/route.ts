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
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/tiff',
    ];

    if (!allowedTypes.includes(file.type)) {
      return new NextResponse('File type not supported', { status: 400 });
    }

    // Validate file size (different limits for different types)
    const isImage = file.type.startsWith('image/');
    const maxSize = isImage ? 25 * 1024 * 1024 : 50 * 1024 * 1024; // 25MB for images, 50MB for documents
    if (file.size > maxSize) {
      const sizeLimitMB = isImage ? 25 : 50;
      return new NextResponse(
        `File too large. Maximum size: ${sizeLimitMB}MB`,
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const documentId = nanoid();
    const timestamp = Date.now();

    // Create unique file path based on file type
    const fileExtension = file.name.split('.').pop() || 'txt';
    const fileCategory = isImage ? 'images' : 'documents';
    const storagePath = `${fileCategory}/${user.id}/${documentId}_${timestamp}.${fileExtension}`;

    // Upload to Supabase Storage (using userfiles bucket for compatibility)
    const { error: uploadError } = await supabase.storage
      .from('userfiles')
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
      .from('userfiles')
      .getPublicUrl(storagePath);

    // Create document record in database
    const displayName = fileName || file.name;
    const { error: dbError } = await supabase
      .from('user_documents')
      .insert({
        id: documentId,
        user_id: user.id,
        title: displayName,
        file_type: isImage ? 'image' : 'document',
        content_type: file.type,
        file_size: file.size,
        file_url: urlData.publicUrl,
        filter_tags: `${displayName}_${timestamp}`,
        total_pages: isImage ? 1 : 0, // Images count as 1 page, documents will be updated during processing
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Clean up uploaded file
      await supabase.storage.from('userfiles').remove([storagePath]);
      return new NextResponse('Database error', { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documentId,
      url: urlData.publicUrl,
      fileName: displayName,
      fileType: isImage ? 'image' : 'document',
      contentType: file.type,
      fileSize: file.size,
      storagePath,
      message: `${isImage ? 'Image' : 'Document'} uploaded successfully`,
    });
  } catch (error) {
    console.error('Upload API error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
