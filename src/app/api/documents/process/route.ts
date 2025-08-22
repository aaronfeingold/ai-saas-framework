import { NextRequest, NextResponse } from 'next/server';

import { anthropic } from '@ai-sdk/anthropic';
import { embed, generateObject } from 'ai';
import { nanoid } from 'nanoid';
import { voyage } from 'voyage-ai-provider';
import { z } from 'zod';

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

// Enhanced text extraction supporting both documents and images
async function extractTextFromFile(
  url: string,
  fileName: string,
  fileType: 'document' | 'image'
): Promise<{ pages: Array<{ pageNumber: number; text: string }> }> {
  try {
    const fileExtension = fileName.split('.').pop()?.toLowerCase();

    if (fileType === 'image') {
      // Process image with OCR using Anthropic Claude Vision
      const extractedText = await extractTextFromImage(url);
      return {
        pages: [
          {
            pageNumber: 1,
            text: extractedText,
          },
        ],
      };
    }

    if (fileExtension === 'txt' || fileExtension === 'md') {
      // For text files, fetch and process them directly
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

    if (fileExtension === 'pdf') {
      // Process PDF with LlamaIndex Cloud
      return await extractTextFromPDF(url, fileName);
    }

    // For other document formats, return mock data
    return {
      pages: [
        {
          pageNumber: 1,
          text: `This is extracted content from ${fileName}. Processing for this file type is not yet implemented.`,
        },
      ],
    };
  } catch (error) {
    console.error('Text extraction error:', error);
    throw new Error('Failed to extract text from document');
  }
}

// PDF text extraction using LlamaIndex Cloud
async function extractTextFromPDF(
  url: string,
  fileName: string
): Promise<{ pages: Array<{ pageNumber: number; text: string }> }> {
  try {
    // Check for LlamaIndex Cloud API key
    if (!process.env.LLAMA_CLOUD_API_KEY) {
      throw new Error('LLAMA_CLOUD_API_KEY is not configured');
    }

    // Fetch the PDF file from the URL
    const fileResponse = await fetch(url);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${fileResponse.statusText}`);
    }

    const fileBlob = await fileResponse.blob();
    const formData = new FormData();
    formData.append('file', fileBlob, fileName);

    // Upload PDF to LlamaIndex Cloud for processing
    const uploadResponse = await fetch(
      'https://api.cloud.llamaindex.ai/api/v1/parsing/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
          Accept: 'application/json',
        },
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error(
        `Failed to upload PDF to LlamaIndex: ${uploadResponse.statusText}`
      );
    }

    const uploadResult = await uploadResponse.json();
    const jobId = uploadResult.id;

    // Poll for completion (with timeout)
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(
        `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
            Accept: 'application/json',
          },
        }
      );

      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();

        if (statusResult.status === 'SUCCESS') {
          // Get the markdown result
          const markdownResponse = await fetch(
            `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result/markdown`,
            {
              headers: {
                Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
                Accept: 'application/json',
              },
            }
          );

          if (!markdownResponse.ok) {
            throw new Error(
              `Failed to get markdown result: ${markdownResponse.statusText}`
            );
          }

          const responseJson = await markdownResponse.json();
          const markdownContent = responseJson.markdown as string;

          // Split into pages using LlamaIndex's page separator
          const pages = markdownContent
            .split('\n---\n')
            .map((page, index) => ({
              pageNumber: index + 1,
              text: page.trim(),
            }))
            .filter((page) => page.text !== '');

          return { pages };
        } else if (statusResult.status === 'ERROR') {
          throw new Error('PDF processing failed in LlamaIndex Cloud');
        }
        // Continue polling if status is PENDING
      }

      attempts++;
    }

    throw new Error('PDF processing timeout after 5 minutes');
  } catch (error) {
    console.error('PDF processing error:', error);
    throw new Error('Failed to process PDF with LlamaIndex Cloud');
  }
}

// OCR and image analysis using Anthropic Claude Vision
async function extractTextFromImage(imageUrl: string): Promise<string> {
  try {
    // Fetch the image to convert to base64
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    // Use Anthropic Claude Vision for OCR and content analysis
    const result = await generateObject({
      model: anthropic('claude-3-5-sonnet-20241022'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this image and extract all visible text. Also provide a detailed description of the image content, including any charts, diagrams, or visual elements. Return the results in a structured format.',
            },
            {
              type: 'image',
              image: `data:${mimeType};base64,${base64}`,
            },
          ],
        },
      ],
      schema: z.object({
        extracted_text: z
          .string()
          .describe('All text content found in the image through OCR'),
        image_description: z
          .string()
          .describe(
            'Detailed description of the image content, layout, and visual elements'
          ),
        content_type: z
          .string()
          .describe(
            'Type of content (e.g., document, chart, diagram, photo, screenshot)'
          ),
        key_elements: z
          .array(z.string())
          .describe('List of key visual elements or components in the image'),
      }),
    });

    // Combine OCR text and image description for comprehensive content
    const combinedText = [
      result.object.extracted_text,
      `Image Description: ${result.object.image_description}`,
      `Content Type: ${result.object.content_type}`,
      `Key Elements: ${result.object.key_elements.join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    return combinedText;
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error('Failed to process image with OCR');
  }
}

// Generate AI metadata for the document or image
async function generateDocumentMetadata(
  text: string,
  fileName: string,
  fileType: 'document' | 'image'
) {
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

  // Generate appropriate title and description based on file type
  const baseTitle = fileName.replace(/\.[^/.]+$/, ''); // Remove extension

  if (fileType === 'image') {
    return {
      ai_title: baseTitle,
      ai_description: `Image with ${words} words extracted via OCR and ${sentences} descriptive sentences`,
      ai_maintopics: topics,
      ai_keyentities: entities,
    };
  }

  return {
    ai_title: baseTitle,
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

    // Update processing status to 'processing'
    await supabase
      .from('user_documents')
      .update({
        processing_status: 'processing',
      })
      .eq('id', documentId);

    try {
      // Extract text from document or image
      const { pages } = await extractTextFromFile(
        url,
        fileName,
        document.file_type as 'document' | 'image'
      );

      if (pages.length === 0) {
        throw new Error('No content extracted from document');
      }

      // Combine all text for metadata generation
      const fullText = pages.map((page) => page.text).join(' ');

      // Generate AI metadata
      const metadata = await generateDocumentMetadata(
        fullText,
        fileName,
        document.file_type as 'document' | 'image'
      );

      // Update document with metadata, page count, and extracted text
      const { error: updateError } = await supabase
        .from('user_documents')
        .update({
          total_pages: pages.length,
          extracted_text: fullText,
          processing_status: 'completed',
          processed_at: new Date().toISOString(),
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
    } catch (processingError) {
      console.error('Document processing error:', processingError);

      // Update document status to 'failed'
      await supabase
        .from('user_documents')
        .update({
          processing_status: 'failed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      throw processingError;
    }
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
