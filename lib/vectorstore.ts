import { supabase } from "./supabase";
import { getCachedQueryEmbedding } from "./embedding-cache";

export interface Chunk {
  id?: number;
  document_id: number;
  content: string;
  page_number?: number;
  /** Starting character position within the page for citation highlighting */
  char_offset_start?: number;
  /** Ending character position within the page for citation highlighting */
  char_offset_end?: number;
  embedding?: number[];
}

export interface SearchResult {
  id: number;
  document_id: number;
  content: string;
  page_number: number;
  similarity: number;
  /** Starting character position within the page for citation highlighting */
  char_offset_start?: number;
  /** Ending character position within the page for citation highlighting */
  char_offset_end?: number;
}

/**
 * Extended search result that includes hybrid search scores.
 * Used by the hybrid search module for BM25 + vector fusion.
 */
export interface HybridSearchResult extends SearchResult {
  /** BM25 (keyword) score from full-text search */
  bm25_score: number;
  /** Vector similarity score */
  vector_score: number;
  /** Combined weighted score */
  combined_score: number;
}

// Re-export hybrid search types for convenience
export type { HybridSearchResult as HybridResult } from "./hybrid-search";

export async function storeChunks(chunks: Chunk[]): Promise<void> {
  const { error } = await supabase.from("chunks").insert(chunks);

  if (error) {
    console.error("Error storing chunks:", error);
    throw new Error("Failed to store chunks");
  }
}

export async function searchSimilarChunks(
  query: string,
  matchCount: number = 5,
  matchThreshold: number = 0.7
): Promise<SearchResult[]> {
  // Use cached embedding for repeat queries
  const embedding = await getCachedQueryEmbedding(query);

  const { data, error } = await supabase.rpc("search_chunks", {
    query_embedding: embedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    console.error("Error searching chunks:", error);
    throw new Error("Failed to search chunks");
  }

  return data || [];
}

export async function getDocumentById(id: number) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching document:", error);
    return null;
  }

  return data;
}
