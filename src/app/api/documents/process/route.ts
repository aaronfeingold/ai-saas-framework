import { NextRequest, NextResponse } from 'next/server';

import { embed } from 'ai';
import { nanoid } from 'nanoid';
import { voyage } from 'voyage-ai-provider';

import { getSession } from '@/lib/auth/server/supabase';
import { createServerSupabaseClient } from '@/lib/server/server';

export const dynamic = 'force-dynamic';

// Embedding model for documents
const embeddingModel = voyage.textEmbeddingModel('voyage-3-large', {
  inputType: 'document',
  truncation: false,
  outputDimension: 1024,
  outputDtype: 'int8',
});

// Simple text extraction (placeholder for LlamaIndex integration)
async function extractTextFromFile(
  url: string,
  fileName: string
): Promise<{ pages: Array<{ pageNumber: number; text: string }> }> {
  // This is a placeholder implementation
  // In production, you would integrate with LlamaIndex Cloud or similar service

  try {
    // For now, return mock data based on file type
    const fileExtension = fileName.split('.').pop()?.toLowerCase();

    if (fileExtension === 'txt' || fileExtension === 'md') {
      // For text files, we could actually fetch and process them
      const response = await fetch(url);
      const text = await response.text();

      // Split into chunks (simulating pages)
      const chunkSize = 1000;
      const pages = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        pages.push({
          pageNumber: Math.floor(i / chunkSize) + 1,
          text: text.slice(i, i + chunkSize),
        });
      }

      return { pages };
    }

    // For PDF and other formats, return mock data
    // In production, integrate with a service like LlamaIndex Cloud
    return {
      pages: [
        {
          pageNumber: 1,
          text: `This is extracted content from ${fileName}. In a production environment, this would be processed using LlamaIndex Cloud or similar document processing service.`,
        },
      ],
    };
  } catch (error) {
    console.error('Text extraction error:', error);
    throw new Error('Failed to extract text from document');
  }
}

// Generate AI metadata for the document
async function generateDocumentMetadata(text: string, fileName: string) {
  // This is a simplified version - in production you'd use a more sophisticated approach
  const words = text.split(/\s+/).length;
  const sentences = text.split(/[.!?]+/).length;

  // Extract potential topics (simple keyword extraction)
  const topics =
    text
      .toLowerCase()
      .match(/\b\w{4,}\b/g)
      ?.filter((word, index, arr) => arr.indexOf(word) === index)
      ?.slice(0, 5) || [];

  // Extract potential entities (capitalized words)
  const entities =
    text
      .match(/\b[A-Z][a-z]+\b/g)
      ?.filter((word, index, arr) => arr.indexOf(word) === index)
      ?.slice(0, 5) || [];

  return {
    ai_title: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
    ai_description: `Document with ${words} words and ${sentences} sentences`,
    ai_maintopics: topics,
    ai_keyentities: entities,
  };
}

// POST /api/documents/process - Process uploaded document
export async function POST(req: NextRequest) {
  const user = await getSession();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { documentId, fileName, url } = await req.json();

    if (!documentId || !fileName || !url) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Verify document belongs to user
    const { data: document, error: docError } = await supabase
      .from('user_documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return new NextResponse('Document not found', { status: 404 });
    }

    // Extract text from document
    const { pages } = await extractTextFromFile(url, fileName);

    if (pages.length === 0) {
      throw new Error('No content extracted from document');
    }

    // Combine all text for metadata generation
    const fullText = pages.map((page) => page.text).join(' ');

    // Generate AI metadata
    const metadata = await generateDocumentMetadata(fullText, fileName);

    // Update document with metadata and page count
    const { error: updateError } = await supabase
      .from('user_documents')
      .update({
        total_pages: pages.length,
        ...metadata,
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Document update error:', updateError);
      throw new Error('Failed to update document metadata');
    }

    // Process embeddings for each page
    const vectorPromises = pages.map(async (page) => {
      try {
        // Generate embedding for the page text
        const { embedding } = await embed({
          model: embeddingModel,
          value: page.text,
        });

        // Insert vector embedding
        const { error: vectorError } = await supabase
          .from('user_documents_vec')
          .insert({
            id: nanoid(),
            document_id: documentId,
            page_number: page.pageNumber,
            text_content: page.text,
            embedding: JSON.stringify(embedding),
          });

        if (vectorError) {
          console.error('Vector insert error:', vectorError);
          throw vectorError;
        }

        return { success: true, page: page.pageNumber };
      } catch (error) {
        console.error(`Error processing page ${page.pageNumber}:`, error);
        return { success: false, page: page.pageNumber, error };
      }
    });

    const vectorResults = await Promise.all(vectorPromises);
    const successfulPages = vectorResults.filter((r) => r.success).length;
    const failedPages = vectorResults.filter((r) => !r.success);

    if (failedPages.length > 0) {
      console.warn(
        `Failed to process ${failedPages.length} pages:`,
        failedPages
      );
    }

    return NextResponse.json({
      success: true,
      documentId,
      pages_processed: successfulPages,
      total_pages: pages.length,
      failed_pages: failedPages.length,
      metadata,
      message: `Document processed successfully. ${successfulPages}/${pages.length} pages indexed.`,
    });
  } catch (error) {
    console.error('Document processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      },
      { status: 500 }
    );
  }
}
