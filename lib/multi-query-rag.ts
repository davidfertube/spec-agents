/**
 * Multi-Query RAG
 *
 * Implements agentic RAG with query decomposition and multi-hop retrieval.
 * Handles complex queries like comparisons and multi-entity questions.
 *
 * Document Filtering:
 * When user mentions specific ASTM specs (e.g., "per A790"), we filter
 * search to only those documents. This fixes the A789/A790 confusion
 * where S32205 has different yield strengths in each spec.
 *
 * Latency Optimizations (Target: P95 < 10s):
 * - Query result caching for repeat queries
 * - Fast path for simple lookup queries (skip decomposition/reranking)
 * - Parallel sub-query execution
 */

import { searchWithFallback, type HybridSearchResult } from "./hybrid-search";
import { rerankChunks } from "./reranker";
import { decomposeQuerySmart, type DecomposedQuery } from "./query-decomposition";
import { preprocessQuery } from "./query-preprocessing";
import { resolveSpecsToDocuments } from "./document-mapper";
import {
  cacheRAGResponse,
  analyzeQueryComplexity,
  timedOperation,
} from "./latency-optimizer";

export interface MultiQueryRAGResult {
  chunks: HybridSearchResult[];
  decomposition: DecomposedQuery;
  searchMetadata: {
    totalCandidates: number;
    subqueryResults: number[];
    reranked: boolean;
    documentFilter: number[] | null;
  };
}

/**
 * Merge results from multiple searches, deduplicating by chunk ID
 */
function mergeResults(results: HybridSearchResult[][]): HybridSearchResult[] {
  const seen = new Set<number>();
  const merged: HybridSearchResult[] = [];

  for (const resultSet of results) {
    for (const result of resultSet) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        merged.push(result);
      }
    }
  }

  return merged;
}

/**
 * Multi-query RAG with query decomposition
 *
 * Process:
 * 1. Decompose query into sub-queries (if needed)
 * 2. Execute sub-queries in parallel
 * 3. Merge and deduplicate results
 * 4. Re-rank against original query
 * 5. Return top K chunks
 *
 * @param query - The user's original query
 * @param topK - Number of top chunks to return (default: 5)
 * @returns Chunks and decomposition metadata
 */
export async function multiQueryRAG(
  query: string,
  topK: number = 5
): Promise<MultiQueryRAGResult> {
  const startTime = Date.now();
  console.log(`[Multi-Query RAG] Processing query: "${query}"`);

  // CACHE DISABLED: The RAG response cache was causing different queries to return
  // identical results. The cache was too aggressive in matching queries, leading to
  // cached chunks from Query A being returned for Query B. The embedding cache
  // (for Voyage AI API calls) is still active and provides sufficient optimization.
  // See: https://github.com/anthropics/spec-agents/issues/[issue-number]
  //
  // const cachedChunks = getCachedRAGResponse(query);
  // if (cachedChunks) {
  //   return {
  //     chunks: cachedChunks.slice(0, topK),
  //     decomposition: {
  //       original: query,
  //       intent: 'lookup',
  //       subqueries: [query],
  //       requires_aggregation: false,
  //       reasoning: 'Cached response',
  //     },
  //     searchMetadata: {
  //       totalCandidates: cachedChunks.length,
  //       subqueryResults: [cachedChunks.length],
  //       reranked: false,
  //       documentFilter: null,
  //     },
  //   };
  // }

  // OPTIMIZATION: Analyze complexity for fast path decisions
  const complexity = analyzeQueryComplexity(query);
  console.log(`[Multi-Query RAG] Complexity: ${complexity.complexity}, estimated ${complexity.estimatedLatencyMs}ms`);

  // Step 0: Extract spec codes and resolve to document IDs for filtering
  // This is CRITICAL for fixing A789/A790 confusion
  // Pass full query to catch "per A790" patterns that preprocessing might miss
  const processed = preprocessQuery(query);
  const documentIds = await resolveSpecsToDocuments(processed.extractedCodes, query);

  if (documentIds) {
    console.log(`[Multi-Query RAG] Document filter: [${documentIds.join(", ")}] for ASTM codes: ${processed.extractedCodes.astm?.join(", ")}`);
  }

  // Step 1: Decompose query (skip for simple queries)
  let decomposition: DecomposedQuery;
  if (complexity.skipDecomposition) {
    decomposition = {
      original: query,
      intent: 'lookup',
      subqueries: [query],
      requires_aggregation: false,
      reasoning: 'Fast path: simple query',
    };
    console.log(`[Multi-Query RAG] Fast path: skipping decomposition`);
  } else {
    decomposition = await timedOperation('query_decomposition', () => decomposeQuerySmart(query));
  }

  console.log(`[Multi-Query RAG] Intent: ${decomposition.intent}`);
  console.log(`[Multi-Query RAG] Sub-queries: ${decomposition.subqueries.length}`);

  if (decomposition.subqueries.length > 1) {
    console.log(`[Multi-Query RAG] Decomposed into:`, decomposition.subqueries);
  }

  // Step 2: Execute sub-queries in parallel
  // Get more candidates per sub-query for better coverage
  // Increased from 20 to 30 for better recall on technical queries
  const candidatesPerSubquery = Math.ceil(30 / decomposition.subqueries.length);

  const allResults = await Promise.all(
    decomposition.subqueries.map(async (subquery) => {
      // Pass document filter to ensure we only search relevant specs
      const results = await searchWithFallback(subquery, candidatesPerSubquery, documentIds);
      console.log(`[Multi-Query RAG] Sub-query "${subquery}" returned ${results.length} results`);
      return results;
    })
  );

  // Step 3: Merge and deduplicate results
  const merged = mergeResults(allResults);
  console.log(`[Multi-Query RAG] Merged to ${merged.length} unique candidates`);

  // Step 4: Re-rank against ORIGINAL query
  // This ensures the final results are most relevant to what user actually asked

  // RERANKING ENABLED: User allows 90s max latency for better accuracy
  // Re-ranking adds 5-15s of latency but improves accuracy by +10-15%
  // Using Gemini Flash (free tier) for cost-effective reranking
  const shouldRerank = true;

  let finalChunks: HybridSearchResult[];
  let reranked = false;

  if (shouldRerank && merged.length > topK) {
    try {
      console.log(`[Multi-Query RAG] Re-ranking ${merged.length} candidates for ${decomposition.intent} query`);
      const rankedResults = await rerankChunks(query, merged, topK);
      finalChunks = rankedResults.map(r => r.chunk);
      reranked = true;
      console.log(`[Multi-Query RAG] Re-ranking complete, selected top ${topK}`);
    } catch (error) {
      console.warn(`[Multi-Query RAG] Re-ranking failed, falling back to hybrid score:`, error);
      // Fallback to hybrid search ordering
      finalChunks = merged
        .sort((a, b) => b.combined_score - a.combined_score)
        .slice(0, topK);
    }
  } else {
    // Sort by combined_score from hybrid search and take top K
    finalChunks = merged
      .sort((a, b) => b.combined_score - a.combined_score)
      .slice(0, topK);
  }

  if (!reranked && merged.length > topK) {
    console.log(`[Multi-Query RAG] Selected top ${topK} from ${merged.length} candidates by hybrid score`);
  } else if (!reranked) {
    console.log(`[Multi-Query RAG] Returning all ${finalChunks.length} candidates`);
  }

  // OPTIMIZATION: Cache the response for repeat queries
  cacheRAGResponse(query, finalChunks);

  const totalTime = Date.now() - startTime;
  console.log(`[Multi-Query RAG] Total pipeline time: ${totalTime}ms`);

  return {
    chunks: finalChunks,
    decomposition,
    searchMetadata: {
      totalCandidates: merged.length,
      subqueryResults: allResults.map(r => r.length),
      reranked,
      documentFilter: documentIds,
    },
  };
}

/**
 * Simple wrapper that returns just the chunks (for backwards compatibility)
 */
export async function multiQueryRAGSimple(
  query: string,
  topK: number = 5
): Promise<HybridSearchResult[]> {
  const result = await multiQueryRAG(query, topK);
  return result.chunks;
}
