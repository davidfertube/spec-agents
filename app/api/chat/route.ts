import { NextRequest, NextResponse } from "next/server";
import { getDocumentById } from "@/lib/vectorstore";
import { searchWithFallback, type HybridSearchResult } from "@/lib/hybrid-search";
import { preprocessQuery, formatExtractedCodes } from "@/lib/query-preprocessing";
import { supabase } from "@/lib/supabase";
import { validateQuery } from "@/lib/validation";
import { withTimeout, TIMEOUTS } from "@/lib/timeout";
import { handleApiError, createValidationError, getErrorStatusCode } from "@/lib/errors";
import { getModelFallbackClient } from "@/lib/model-fallback";
import { generateVerifiedResponse } from "@/lib/verified-generation";

/**
 * Chat API Route - RAG-powered Q&A
 *
 * This endpoint:
 * 1. Validates the user query
 * 2. Searches for relevant document chunks
 * 3. Builds context from retrieved documents
 * 4. Generates a response with citations using Gemini
 *
 * Rate Limit Handling:
 * - Uses ModelFallbackClient for automatic model fallback
 * - If primary model (gemini-2.5-flash) is rate limited, falls back to alternatives
 * - Prevents API failures and avoids overage charges
 *
 * Security features:
 * - Input validation and sanitization
 * - Timeout protection on LLM calls
 * - Safe error handling (no internal details leaked)
 */

export async function POST(request: NextRequest) {
  try {
    // ========================================
    // Step 1: Parse and Validate Input
    // ========================================
    const body = await request.json();
    const { query, verified = false } = body;

    // Validate query using our validation utility
    const validation = validateQuery(query);
    if (!validation.isValid) {
      const error = createValidationError(validation.error || "Invalid query");
      return NextResponse.json(error, { status: getErrorStatusCode("VALIDATION_ERROR") });
    }

    // Use the cleaned, sanitized query
    const cleanedQuery = validation.cleanedQuery!;

    // ========================================
    // Optional: Use Verified Generation Pipeline
    // ========================================
    // When verified=true, use the full zero-hallucination pipeline
    // with claim verification and guardrails
    if (verified) {
      console.log("[Chat API] Using verified generation pipeline");
      const result = await generateVerifiedResponse(cleanedQuery, {
        enable_verification: true,
        enable_knowledge_graph: true,
        min_confidence: 70,
      });

      return NextResponse.json({
        response: result.response,
        sources: result.sources,
        verification: result.verification,
        knowledge_insights: result.knowledge_insights,
      });
    }

    // ========================================
    // Step 2: Search for Relevant Documents (Hybrid Search)
    // ========================================
    // Preprocess query to extract technical codes (UNS, ASTM, grades)
    const processedQuery = preprocessQuery(cleanedQuery);

    // Log if technical codes were detected (helps with debugging)
    if (processedQuery.boostExactMatch) {
      console.log(
        `[Chat API] Technical codes detected: ${formatExtractedCodes(processedQuery.extractedCodes)}`
      );
    }

    let chunks: HybridSearchResult[] = [];
    try {
      // Use hybrid search (BM25 + Vector) for better accuracy on exact codes
      // Falls back to vector-only if hybrid search is not available
      chunks = await withTimeout(
        searchWithFallback(cleanedQuery, 5),
        TIMEOUTS.VECTOR_SEARCH,
        "Hybrid search"
      );

      // Log search performance for debugging
      if (chunks.length > 0 && processedQuery.boostExactMatch) {
        const topResult = chunks[0];
        console.log(
          `[Chat API] Top result scores - BM25: ${topResult.bm25_score.toFixed(3)}, Vector: ${topResult.vector_score.toFixed(3)}, Combined: ${topResult.combined_score.toFixed(3)}`
        );
      }
    } catch (searchError) {
      // Log but continue - we can still provide a response without documents
      console.warn("[Chat API] Search failed, continuing without context:", searchError);
      // Don't throw - we'll continue with empty chunks
    }

    // ========================================
    // Step 3: Build Document Context
    // ========================================
    const documentIds = [...new Set(chunks.map((c) => c.document_id))];
    const documents = await Promise.all(
      documentIds.map((id) => getDocumentById(id))
    );
    const docMap = new Map(
      documents.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => [d.id, d])
    );

    // Build context string from retrieved chunks
    // Include relevance indicator for BM25 matches (helps LLM understand which chunks have exact matches)
    const context = chunks.length > 0
      ? chunks
          .map((chunk, index) => {
            const doc = docMap.get(chunk.document_id);
            // Add relevance note for exact keyword matches (BM25 > 0)
            const relevanceNote = chunk.bm25_score > 0
              ? ` [HIGH RELEVANCE - exact keyword match]`
              : "";
            return `[${index + 1}] From "${doc?.filename || "Unknown"}" (Page ${chunk.page_number})${relevanceNote}:\n${chunk.content}`;
          })
          .join("\n\n---\n\n")
      : "No documents have been uploaded yet.";

    // ========================================
    // Step 4: Generate LLM Response
    // ========================================
    // Use ModelFallbackClient for automatic fallback on rate limits
    const fallbackClient = getModelFallbackClient();

    const systemPrompt = `You are a senior materials engineer specializing in steel specifications, NACE/ASTM/API standards, and O&G compliance.

CRITICAL RULES:
1. ONLY answer based on the provided document context. Do NOT use external knowledge for specific values.
2. ALWAYS cite sources using [1], [2], etc. - every fact needs a citation.
3. For numerical values (yield strength, hardness, PREN), quote EXACTLY as written in the source.
4. If the context doesn't contain the answer, say: "This information is not in the uploaded documents."
5. Never hallucinate specifications or compliance requirements.

RESPONSE FORMAT:
**Answer:** [Direct answer with citations]

**Details:** [Supporting technical details from documents]

**Sources:** [List which documents were used]

EXAMPLE:
Q: "What is the yield strength of 316L stainless steel?"
A: **Answer:** The minimum yield strength of 316L is 170 MPa (25 ksi) [1].
**Details:** Per ASTM A240, 316L has lower carbon content (<0.03%) which reduces yield strength compared to 316 [1].
**Sources:** [1] ASTM_A240_Stainless_Steel.pdf, Page 3`;

    const userPrompt = chunks.length > 0
      ? `RETRIEVED DOCUMENT CONTEXT:
${context}

---
USER QUESTION: ${cleanedQuery}

Instructions: Answer ONLY using the context above. Cite every fact with [1], [2], etc. If the answer isn't in the context, say so.`
      : `USER QUESTION: ${cleanedQuery}

NOTE: No documents have been uploaded to the knowledge base yet.

Please provide general guidance based on industry standards (ASTM, NACE, API), but clearly state:
1. This is general knowledge, not from uploaded documents
2. User should upload relevant specification PDFs for verified, citable answers
3. Do not provide specific numerical values without document sources`;

    // Generate response with timeout protection and automatic model fallback
    // If gemini-2.5-flash is rate limited, automatically tries fallback models
    const fullPrompt = systemPrompt + "\n\n" + userPrompt;

    const { text: responseText, modelUsed } = await withTimeout(
      fallbackClient.generateContent(fullPrompt, "gemini-2.5-flash"),
      TIMEOUTS.LLM_GENERATION,
      "LLM response generation"
    );

    // Log which model was used (helpful for monitoring rate limits)
    if (modelUsed !== "gemini-2.5-flash") {
      console.log(`[Chat API] Used fallback model: ${modelUsed}`);
    }

    // ========================================
    // Step 5: Build Sources Array with PDF Links
    // ========================================
    const sources = chunks.map((chunk, index) => {
      const doc = docMap.get(chunk.document_id);
      // Get public URL for the document to enable direct page navigation
      let documentUrl: string | undefined;
      if (doc?.storage_path) {
        const { data: urlData } = supabase.storage
          .from("documents")
          .getPublicUrl(doc.storage_path);
        // Append page anchor for direct navigation (works in most PDF viewers)
        documentUrl = `${urlData.publicUrl}#page=${chunk.page_number}`;
      }
      return {
        ref: `[${index + 1}]`,
        document: doc?.filename || "Unknown",
        page: String(chunk.page_number),
        content_preview: chunk.content.slice(0, 150) + "...",
        document_url: documentUrl,
      };
    });

    // ========================================
    // Step 6: Return Response
    // ========================================
    return NextResponse.json({
      response: responseText,
      sources,
    });

  } catch (error) {
    // Use our safe error handler - never leaks internal details
    const { response, status } = handleApiError(error, "Chat API");
    return NextResponse.json(response, { status });
  }
}
