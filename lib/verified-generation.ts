/**
 * Verified Generation Pipeline
 *
 * Orchestrates the complete zero-hallucination pipeline:
 * 1. Hybrid search for relevant documents
 * 2. Structured output generation
 * 3. Claim verification
 * 4. Guardrail enforcement
 *
 * This module ties together all phases of the zero-hallucination architecture.
 */

import { searchWithFallback, type HybridSearchResult } from "./hybrid-search";
import { preprocessQuery, formatExtractedCodes } from "./query-preprocessing";
import { resolveSpecsToDocuments } from "./document-mapper";
import {
  STRUCTURED_SYSTEM_PROMPT,
  buildStructuredUserPrompt,
  parseStructuredResponse,
  type StructuredResponse,
  type ParsedResponse,
} from "./structured-output";
import {
  verifyClaims,
  applyGuardrails,
  generateRefusalResponse,
  type VerificationResult,
  type SourceChunk,
} from "./claim-verification";
import { getDocumentById } from "./vectorstore";
import { getModelFallbackClient } from "./model-fallback";
import { withTimeout, TIMEOUTS } from "./timeout";
import { getMaterialInfo, getStandardsForMaterial, getPRENGuidance } from "./knowledge-graph/standards";

// ============================================================================
// Types
// ============================================================================

export interface VerifiedResponse {
  /** Final response text */
  response: string;
  /** Source citations */
  sources: Array<{
    ref: string;
    document: string;
    page: string;
    content_preview: string;
    document_url?: string;
  }>;
  /** Verification metadata */
  verification?: {
    confidence: number;
    claims_verified: number;
    claims_total: number;
    warnings: string[];
  };
  /** Knowledge graph insights (if applicable) */
  knowledge_insights?: string[];
  /** Model used for generation */
  model_used: string;
  /** Whether response was regenerated due to verification failure */
  was_regenerated: boolean;
}

export interface GenerationOptions {
  /** Maximum regeneration attempts */
  max_regenerations?: number;
  /** Enable verification (default: true) */
  enable_verification?: boolean;
  /** Include knowledge graph insights (default: true) */
  enable_knowledge_graph?: boolean;
  /** Minimum confidence threshold (default: 70) */
  min_confidence?: number;
}

// ============================================================================
// Main Pipeline
// ============================================================================

/**
 * Generate a verified response with full zero-hallucination pipeline
 *
 * @param query - User's question
 * @param options - Generation options
 * @returns Verified response with citations and metadata
 */
export async function generateVerifiedResponse(
  query: string,
  options: GenerationOptions = {}
): Promise<VerifiedResponse> {
  const {
    max_regenerations = 2,
    enable_verification = true,
    enable_knowledge_graph = true,
    min_confidence = 70,
  } = options;

  // Step 1: Preprocess query and search
  const processedQuery = preprocessQuery(query);
  console.log(
    `[Verified Generation] Query processed: ${formatExtractedCodes(processedQuery.extractedCodes)}`
  );

  // Get knowledge graph insights if applicable
  const knowledgeInsights: string[] = [];
  if (enable_knowledge_graph && processedQuery.extractedCodes.uns) {
    // Handle array of UNS codes (extractedCodes.uns is now string[])
    for (const uns of processedQuery.extractedCodes.uns) {
      const insights = getKnowledgeInsights(uns);
      knowledgeInsights.push(...insights);
    }
  }

  // Step 2: Resolve document filter from ASTM codes
  const documentFilter = await resolveSpecsToDocuments(processedQuery.extractedCodes);
  if (documentFilter) {
    console.log(`[Verified Generation] Document filter: [${documentFilter.join(", ")}]`);
  }

  // Step 3: Hybrid search with document filter
  let chunks: HybridSearchResult[] = [];
  try {
    chunks = await withTimeout(
      searchWithFallback(query, 5, documentFilter),
      TIMEOUTS.VECTOR_SEARCH,
      "Hybrid search"
    );
    console.log(`[Verified Generation] Found ${chunks.length} relevant chunks`);
  } catch (error) {
    console.warn("[Verified Generation] Search failed:", error);
  }

  // Step 3: Build context and document map
  const documentIds = [...new Set(chunks.map((c) => c.document_id))];
  const documents = await Promise.all(documentIds.map((id) => getDocumentById(id)));
  const docMap = new Map(
    documents.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => [d.id, d])
  );

  const context = chunks.length > 0
    ? chunks
        .map((chunk, index) => {
          const doc = docMap.get(chunk.document_id);
          const relevanceNote = chunk.bm25_score > 0 ? " [EXACT MATCH]" : "";
          return `[${index + 1}] From "${doc?.filename || "Unknown"}" (Page ${chunk.page_number})${relevanceNote}:\n${chunk.content}`;
        })
        .join("\n\n---\n\n")
    : "";

  // Build sources for verification
  const sourceChunks: SourceChunk[] = chunks.map((chunk, index) => ({
    ref: `[${index + 1}]`,
    content: chunk.content,
    document: docMap.get(chunk.document_id)?.filename,
    page: chunk.page_number,
  }));

  // Step 4: Generate and verify (with regeneration loop)
  let attempts = 0;
  let finalResponse: ParsedResponse | null = null;
  let finalVerification: VerificationResult | null = null;
  let wasRegenerated = false;

  const fallbackClient = getModelFallbackClient();

  while (attempts <= max_regenerations) {
    attempts++;
    console.log(`[Verified Generation] Generation attempt ${attempts}`);

    // Generate response
    const userPrompt = buildStructuredUserPrompt(context, query, chunks.length > 0);

    // Add knowledge insights to context if available
    let enhancedPrompt = STRUCTURED_SYSTEM_PROMPT;
    if (knowledgeInsights.length > 0) {
      enhancedPrompt += `\n\nKNOWLEDGE BASE (general industry knowledge - cite only if relevant):\n${knowledgeInsights.join("\n")}`;
    }

    const { text, modelUsed } = await withTimeout(
      fallbackClient.generateContent(enhancedPrompt + "\n\n" + userPrompt),
      TIMEOUTS.LLM_GENERATION,
      "LLM generation"
    );

    // Parse structured response
    const parsed = parseStructuredResponse(text);
    console.log(
      `[Verified Generation] Parsed ${parsed.structured.claims.length} claims, parse success: ${parsed.parseSuccess}`
    );

    // Skip verification if disabled or parsing failed
    if (!enable_verification || !parsed.parseSuccess) {
      return buildFinalResponse(
        parsed.structured,
        chunks,
        docMap,
        null,
        knowledgeInsights,
        modelUsed,
        wasRegenerated
      );
    }

    // Verify claims
    const verification = verifyClaims(parsed.structured, sourceChunks);
    console.log(
      `[Verified Generation] Verification: ${verification.confidence}% confidence, ${verification.stats.verified_claims}/${verification.stats.total_claims} claims verified`
    );

    // Apply guardrails
    const guardrail = applyGuardrails(verification, parsed.structured);
    console.log(`[Verified Generation] Guardrail action: ${guardrail.action} (${guardrail.reason})`);

    if (guardrail.action === "return" && verification.confidence >= min_confidence) {
      finalResponse = parsed;
      finalVerification = verification;
      break;
    }

    if (guardrail.action === "refuse") {
      // Generate refusal response
      const documentNames = chunks.map((c) => docMap.get(c.document_id)?.filename || "Unknown");
      const refusalText = generateRefusalResponse(query, [...new Set(documentNames)], guardrail.reason);

      return {
        response: refusalText,
        sources: [],
        verification: {
          confidence: 0,
          claims_verified: 0,
          claims_total: verification.stats.total_claims,
          warnings: [...verification.warnings, guardrail.reason],
        },
        knowledge_insights: knowledgeInsights,
        model_used: modelUsed,
        was_regenerated: wasRegenerated,
      };
    }

    // If regenerate action and more attempts left, continue loop
    if (attempts <= max_regenerations) {
      wasRegenerated = true;
      console.log(`[Verified Generation] Regenerating due to: ${guardrail.reason}`);
    } else {
      // Use last response even if not perfect
      finalResponse = parsed;
      finalVerification = verification;
    }
  }

  if (!finalResponse) {
    throw new Error("Failed to generate response after maximum attempts");
  }

  return buildFinalResponse(
    finalResponse.structured,
    chunks,
    docMap,
    finalVerification,
    knowledgeInsights,
    "claude-sonnet-4-5",
    wasRegenerated
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build the final response object
 */
function buildFinalResponse(
  structured: StructuredResponse,
  chunks: HybridSearchResult[],
  docMap: Map<number, { id: number; filename: string; storage_path?: string }>,
  verification: VerificationResult | null,
  knowledgeInsights: string[],
  modelUsed: string,
  wasRegenerated: boolean
): VerifiedResponse {
  // Build sources array
  const sources = chunks.map((chunk, index) => {
    const doc = docMap.get(chunk.document_id);
    return {
      ref: `[${index + 1}]`,
      document: doc?.filename || "Unknown",
      page: String(chunk.page_number),
      content_preview: chunk.content.slice(0, 150) + "...",
      document_url: doc?.storage_path ? buildDocumentUrl(doc.storage_path, chunk.page_number) : undefined,
    };
  });

  return {
    response: structured.answer,
    sources,
    verification: verification
      ? {
          confidence: verification.confidence,
          claims_verified: verification.stats.verified_claims,
          claims_total: verification.stats.total_claims,
          warnings: verification.warnings,
        }
      : undefined,
    knowledge_insights: knowledgeInsights.length > 0 ? knowledgeInsights : undefined,
    model_used: modelUsed,
    was_regenerated: wasRegenerated,
  };
}

/**
 * Build document URL with page anchor
 */
function buildDocumentUrl(storagePath: string, page: number): string {
  // This would normally use Supabase storage URL
  // For now, return a placeholder that the API route will fill in
  return `STORAGE:${storagePath}#page=${page}`;
}

/**
 * Get knowledge graph insights for a material
 */
function getKnowledgeInsights(uns: string): string[] {
  const insights: string[] = [];

  const material = getMaterialInfo(uns);
  if (material) {
    insights.push(
      `${uns} (${material.trade_names.join(", ")}): ${material.family} grade, ` +
      `applicable to ${material.applications.slice(0, 3).join(", ")}`
    );

    const pren = getPRENGuidance(uns);
    if (pren) {
      insights.push(pren);
    }
  }

  const standards = getStandardsForMaterial(uns);
  if (standards.length > 0) {
    insights.push(
      `Covered by: ${standards.map((s) => s.name).join(", ")}`
    );
  }

  return insights;
}

// ============================================================================
// Simplified API for Chat Route
// ============================================================================

/**
 * Simple wrapper for chat API route
 *
 * Handles errors gracefully and returns a consistent format
 */
export async function generateChatResponse(
  query: string
): Promise<{ response: string; sources: VerifiedResponse["sources"]; modelUsed: string }> {
  try {
    const result = await generateVerifiedResponse(query, {
      enable_verification: true,
      enable_knowledge_graph: true,
    });

    return {
      response: result.response,
      sources: result.sources,
      modelUsed: result.model_used,
    };
  } catch (error) {
    console.error("[Chat Response] Generation failed:", error);

    // Return error response
    return {
      response: "I encountered an error processing your question. Please try again.",
      sources: [],
      modelUsed: "error",
    };
  }
}
