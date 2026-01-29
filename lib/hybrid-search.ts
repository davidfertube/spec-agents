/**
 * Hybrid Search for Steel Agents
 *
 * Combines BM25 (keyword-based) and vector (semantic) search to achieve
 * better accuracy for technical queries with exact codes like UNS numbers.
 *
 * Key benefits:
 * - BM25 catches exact code matches (S31803, A790) that vector might miss
 * - Vector search handles semantic similarity for natural language queries
 * - Fusion combines strengths of both approaches
 */

import { supabase } from "./supabase";
import { generateEmbedding } from "./embeddings";
import {
  preprocessQuery,
  getSearchWeights,
  formatExtractedCodes,
  type ProcessedQuery,
} from "./query-preprocessing";

// ============================================================================
// Types
// ============================================================================

/**
 * Result from hybrid search including both BM25 and vector scores
 */
export interface HybridSearchResult {
  /** Chunk ID in database */
  id: number;
  /** Parent document ID */
  document_id: number;
  /** Chunk text content */
  content: string;
  /** Page number in source PDF */
  page_number: number;
  /** BM25 (keyword) score (0-1) */
  bm25_score: number;
  /** Vector similarity score (0-1) */
  vector_score: number;
  /** Combined weighted score */
  combined_score: number;
}

/**
 * Search metadata for debugging and logging
 */
export interface SearchMetadata {
  query: ProcessedQuery;
  weights: { bm25Weight: number; vectorWeight: number };
  totalResults: number;
  searchTimeMs: number;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Perform hybrid search combining BM25 and vector similarity
 *
 * @param query - The user's search query
 * @param matchCount - Maximum number of results to return (default: 5)
 * @returns Array of search results sorted by combined score
 *
 * @example
 * const results = await hybridSearchChunks("UNS S31803 yield strength");
 * // Returns chunks matching "S31803" with high BM25 score
 */
export async function hybridSearchChunks(
  query: string,
  matchCount: number = 5
): Promise<HybridSearchResult[]> {
  const startTime = Date.now();

  // Step 1: Preprocess query to extract codes and determine strategy
  const processed = preprocessQuery(query);
  const weights = getSearchWeights(processed);

  // Log search strategy for debugging
  if (processed.boostExactMatch) {
    console.log(
      `[Hybrid Search] Exact code query detected: ${formatExtractedCodes(processed.extractedCodes)}`
    );
    console.log(
      `[Hybrid Search] Using weights: BM25=${weights.bm25Weight}, Vector=${weights.vectorWeight}`
    );
  }

  // Step 2: Generate embedding for vector search
  const embedding = await generateEmbedding(query);

  // Step 3: Call hybrid search function in Supabase
  const { data, error } = await supabase.rpc("hybrid_search_chunks", {
    query_text: query,
    query_embedding: embedding,
    match_count: matchCount,
    bm25_weight: weights.bm25Weight,
    vector_weight: weights.vectorWeight,
  });

  if (error) {
    console.error("[Hybrid Search] Error:", error);
    throw new Error(`Hybrid search failed: ${error.message}`);
  }

  const results = (data || []) as HybridSearchResult[];

  // Log results summary
  const searchTimeMs = Date.now() - startTime;
  console.log(
    `[Hybrid Search] Found ${results.length} results in ${searchTimeMs}ms`
  );

  if (results.length > 0 && processed.boostExactMatch) {
    // Log BM25 vs vector score breakdown for debugging
    const topResult = results[0];
    console.log(
      `[Hybrid Search] Top result scores: BM25=${topResult.bm25_score.toFixed(3)}, Vector=${topResult.vector_score.toFixed(3)}, Combined=${topResult.combined_score.toFixed(3)}`
    );
  }

  return results;
}

/**
 * Search with automatic fallback to vector-only search
 *
 * If hybrid search fails (e.g., migration not applied yet), falls back
 * to the existing vector search implementation.
 *
 * @param query - The user's search query
 * @param matchCount - Maximum number of results to return (default: 5)
 * @returns Array of search results
 */
export async function searchWithFallback(
  query: string,
  matchCount: number = 5
): Promise<HybridSearchResult[]> {
  try {
    return await hybridSearchChunks(query, matchCount);
  } catch (error) {
    console.warn(
      "[Hybrid Search] Falling back to vector-only search:",
      error instanceof Error ? error.message : "Unknown error"
    );

    // Import and use existing vector search as fallback
    const { searchSimilarChunks } = await import("./vectorstore");
    const results = await searchSimilarChunks(query, matchCount, 0.5);

    // Convert to hybrid format for consistent interface
    return results.map((r) => ({
      id: r.id,
      document_id: r.document_id,
      content: r.content,
      page_number: r.page_number,
      bm25_score: 0,
      vector_score: r.similarity,
      combined_score: r.similarity,
    }));
  }
}

/**
 * Perform BM25-only search for debugging or specific use cases
 *
 * Useful for testing exact keyword matching without vector influence.
 *
 * @param query - The search query
 * @param matchCount - Maximum results
 * @returns Results with only BM25 scores
 */
export async function bm25OnlySearch(
  query: string,
  matchCount: number = 10
): Promise<Omit<HybridSearchResult, "vector_score" | "combined_score">[]> {
  const { data, error } = await supabase.rpc("bm25_search_chunks", {
    query_text: query,
    match_count: matchCount,
  });

  if (error) {
    console.error("[BM25 Search] Error:", error);
    throw new Error(`BM25 search failed: ${error.message}`);
  }

  return (data || []).map(
    (r: { id: number; document_id: number; content: string; page_number: number; score: number }) => ({
      id: r.id,
      document_id: r.document_id,
      content: r.content,
      page_number: r.page_number,
      bm25_score: r.score,
    })
  );
}

/**
 * Search with full metadata for analytics and debugging
 *
 * @param query - The search query
 * @param matchCount - Maximum results
 * @returns Results and metadata about the search
 */
export async function searchWithMetadata(
  query: string,
  matchCount: number = 5
): Promise<{ results: HybridSearchResult[]; metadata: SearchMetadata }> {
  const startTime = Date.now();

  const processed = preprocessQuery(query);
  const weights = getSearchWeights(processed);
  const results = await hybridSearchChunks(query, matchCount);

  return {
    results,
    metadata: {
      query: processed,
      weights,
      totalResults: results.length,
      searchTimeMs: Date.now() - startTime,
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if hybrid search is available (migration applied)
 *
 * @returns true if hybrid_search_chunks function exists in Supabase
 */
export async function isHybridSearchAvailable(): Promise<boolean> {
  try {
    // Try calling with empty embedding - will fail if function doesn't exist
    // We use a minimal call that will execute but return no results
    const embedding = new Array(3072).fill(0);
    const { error } = await supabase.rpc("hybrid_search_chunks", {
      query_text: "test",
      query_embedding: embedding,
      match_count: 1,
      bm25_weight: 0.3,
      vector_weight: 0.7,
    });

    // If no error, function exists
    return !error;
  } catch {
    return false;
  }
}

/**
 * Get search strategy description for debugging
 *
 * @param query - Processed query
 * @returns Human-readable strategy description
 */
export function describeSearchStrategy(query: ProcessedQuery): string {
  const weights = getSearchWeights(query);
  const codes = formatExtractedCodes(query.extractedCodes);

  if (codes === "none") {
    return `Semantic search (BM25: ${weights.bm25Weight * 100}%, Vector: ${weights.vectorWeight * 100}%)`;
  }

  return `Hybrid search for [${codes}] (BM25: ${weights.bm25Weight * 100}%, Vector: ${weights.vectorWeight * 100}%)`;
}
