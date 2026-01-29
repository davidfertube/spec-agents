import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateEmbeddings } from "@/lib/embeddings";
import { storeChunks } from "@/lib/vectorstore";
import { extractText } from "unpdf";
import { handleApiError, createValidationError, createEmbeddingError, getErrorStatusCode } from "@/lib/errors";
import { extractTextWithOCR, shouldAttemptOCR } from "@/lib/ocr";

/**
 * Document Processing API Route
 *
 * This endpoint processes uploaded PDFs:
 * 1. Retrieves document from database
 * 2. Downloads PDF from storage
 * 3. Extracts text from PDF
 * 4. Chunks text with overlap for better context
 * 5. Generates embeddings for each chunk
 * 6. Stores chunks with embeddings in vector database
 *
 * Security features:
 * - Document ID validation
 * - Safe error handling (no internal details leaked)
 * - Infinite loop prevention in chunking
 */

// ============================================
// Text Chunking Function
// ============================================

/**
 * Split text into overlapping chunks for embedding
 *
 * This function includes safety checks to prevent infinite loops
 * and handles edge cases properly.
 *
 * @param text - The text to chunk
 * @param chunkSize - Size of each chunk in characters (min: 100)
 * @param overlap - Overlap between chunks (must be < chunkSize)
 * @returns Array of text chunks
 * @throws Error if parameters are invalid
 */
function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  // ========================================
  // Parameter Validation - CRITICAL: Prevents infinite loop
  // ========================================
  if (chunkSize < 100) {
    throw new Error(`chunkSize must be at least 100 characters, got ${chunkSize}`);
  }

  if (overlap < 0) {
    throw new Error(`overlap cannot be negative, got ${overlap}`);
  }

  if (overlap >= chunkSize) {
    throw new Error(
      `overlap (${overlap}) must be less than chunkSize (${chunkSize}). ` +
      `This would cause an infinite loop.`
    );
  }

  // ========================================
  // Handle Edge Cases
  // ========================================
  // Empty or very short text
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Text shorter than chunk size - return as single chunk
  if (text.length <= chunkSize) {
    return [text.trim()];
  }

  // ========================================
  // Chunk the Text with Overlap
  // ========================================
  const chunks: string[] = [];
  let start = 0;

  // Calculate step size once (how far to advance each iteration)
  // This is guaranteed positive due to validation above
  const stepSize = chunkSize - overlap;

  // Safety counter to prevent infinite loops in edge cases
  const maxIterations = Math.ceil(text.length / stepSize) + 10;
  let iterations = 0;

  while (start < text.length) {
    // Safety check: prevent infinite loops
    iterations++;
    if (iterations > maxIterations) {
      console.error(`[chunkText] Safety limit reached after ${iterations} iterations`);
      break;
    }

    // Get the end position for this chunk
    const end = Math.min(start + chunkSize, text.length);

    // Extract and trim the chunk
    const chunk = text.slice(start, end).trim();

    // Only add non-empty chunks with meaningful content
    if (chunk.length > 50) {
      chunks.push(chunk);
    }

    // Check if we've reached the end
    if (end === text.length) {
      break;
    }

    // Advance by stepSize (guaranteed positive)
    start += stepSize;

    // Safety check: ensure we're making progress
    if (start <= 0) {
      console.error(`[chunkText] Start position went negative, aborting`);
      break;
    }
  }

  return chunks;
}

// ============================================
// API Route Handler
// ============================================

export async function POST(request: NextRequest) {
  // Store documentId for status updates in error handlers
  let documentId: number | undefined;

  try {
    // ========================================
    // Step 1: Parse and Validate Input
    // ========================================
    const body = await request.json();
    documentId = body.documentId;

    if (!documentId || typeof documentId !== "number") {
      const error = createValidationError("Valid document ID is required.");
      return NextResponse.json(error, { status: getErrorStatusCode("VALIDATION_ERROR") });
    }

    // ========================================
    // Step 2: Retrieve Document from Database
    // ========================================
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      console.error("[Process API] Document not found:", documentId);
      const error = createValidationError("Document not found. It may have been deleted.");
      return NextResponse.json(error, { status: getErrorStatusCode("NOT_FOUND") });
    }

    // ========================================
    // Step 3: Update Status to Processing
    // ========================================
    await supabase
      .from("documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    // ========================================
    // Step 4: Download PDF from Storage
    // ========================================
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      console.error("[Process API] Failed to download document:", downloadError);
      await updateDocumentStatus(documentId, "error");
      const { response, status } = handleApiError(downloadError, "Document Download");
      return NextResponse.json(response, { status });
    }

    // ========================================
    // Step 5: Extract Text from PDF
    // ========================================
    const arrayBuffer = await fileData.arrayBuffer();
    let { text } = await extractText(arrayBuffer, { mergePages: true });

    // If unpdf couldn't extract text, try OCR with Gemini Vision
    if (shouldAttemptOCR(text || "", fileData.size)) {
      console.log("[Process API] No text from unpdf, attempting OCR...");
      try {
        text = await extractTextWithOCR(arrayBuffer);
        console.log(`[Process API] OCR extracted ${text.length} characters`);
      } catch (ocrError) {
        console.error("[Process API] OCR failed:", ocrError);
        await updateDocumentStatus(documentId, "error");
        const error = createValidationError(
          "Could not extract text from PDF. The document may be corrupted or in an unsupported format."
        );
        return NextResponse.json(error, { status: getErrorStatusCode("VALIDATION_ERROR") });
      }
    }

    if (!text || text.trim().length === 0) {
      console.error("[Process API] No text extracted from document:", documentId);
      await updateDocumentStatus(documentId, "error");
      const error = createValidationError(
        "Could not extract text from PDF. The document appears to be empty or corrupted."
      );
      return NextResponse.json(error, { status: getErrorStatusCode("VALIDATION_ERROR") });
    }

    // ========================================
    // Step 6: Chunk the Text
    // ========================================
    const textChunks = chunkText(text);

    if (textChunks.length === 0) {
      console.error("[Process API] No valid chunks generated from document:", documentId);
      await updateDocumentStatus(documentId, "error");
      const error = createValidationError(
        "Document has insufficient text content to process."
      );
      return NextResponse.json(error, { status: getErrorStatusCode("VALIDATION_ERROR") });
    }

    console.log(`[Process API] Generated ${textChunks.length} chunks for document ${documentId}`);

    // ========================================
    // Step 7: Generate Embeddings
    // ========================================
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(textChunks);
    } catch (embeddingError) {
      console.error("[Process API] Embedding generation failed:", embeddingError);
      await updateDocumentStatus(documentId, "error");
      const error = createEmbeddingError(embeddingError);
      return NextResponse.json(error, { status: getErrorStatusCode(error.code) });
    }

    // Verify embeddings count matches chunks
    if (embeddings.length !== textChunks.length) {
      console.error(
        `[Process API] Embedding count mismatch: ${embeddings.length} embeddings for ${textChunks.length} chunks`
      );
      await updateDocumentStatus(documentId, "error");
      const error = createValidationError("Failed to generate embeddings for all chunks.");
      return NextResponse.json(error, { status: getErrorStatusCode("INTERNAL_ERROR") });
    }

    // ========================================
    // Step 8: Store Chunks with Embeddings
    // ========================================
    const chunks = textChunks.map((content, index) => ({
      document_id: documentId!,
      content,
      // Rough page estimate: assume ~3 chunks per page
      page_number: Math.floor(index / 3) + 1,
      embedding: embeddings[index],
    }));

    try {
      await storeChunks(chunks);
    } catch (storageError) {
      console.error("[Process API] Chunk storage failed:", storageError);
      await updateDocumentStatus(documentId, "error");
      const error = createValidationError("Failed to save document data. Please try uploading again.");
      return NextResponse.json(error, { status: getErrorStatusCode("INTERNAL_ERROR") });
    }

    // ========================================
    // Step 9: Update Status to Indexed
    // ========================================
    await updateDocumentStatus(documentId, "indexed");

    console.log(`[Process API] Successfully processed document ${documentId}: ${chunks.length} chunks`);

    // ========================================
    // Step 10: Return Success Response
    // ========================================
    return NextResponse.json({
      success: true,
      chunks: chunks.length,
      message: `Successfully processed ${chunks.length} chunks from document`,
    });

  } catch (error) {
    console.error("[Process API] Unexpected error:", error);

    // Try to update document status to error
    if (documentId) {
      try {
        await updateDocumentStatus(documentId, "error");
      } catch (statusError) {
        console.error("[Process API] Failed to update error status:", statusError);
      }
    }

    // Use safe error handler - never leaks internal details
    const { response, status } = handleApiError(error, "Document Processing");
    return NextResponse.json(response, { status });
  }
}

/**
 * Helper function to update document status
 * Centralizes status updates for cleaner error handling
 */
async function updateDocumentStatus(
  documentId: number,
  status: "pending" | "processing" | "indexed" | "error"
): Promise<void> {
  await supabase
    .from("documents")
    .update({ status })
    .eq("id", documentId);
}
