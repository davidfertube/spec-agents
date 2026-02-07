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
  analyzeQueryComplexity,
  timedOperation,
} from "./latency-optimizer";
import { evaluateRetrieval } from "./retrieval-evaluator";
import { validateCoverage } from "./coverage-validator";
import { getLangfuse } from "./langfuse";
import { withTimeout, TIMEOUTS } from "./timeout";

export interface MultiQueryRAGResult {
  chunks: HybridSearchResult[];
  decomposition: DecomposedQuery;
  searchMetadata: {
    totalCandidates: number;
    subqueryResults: number[];
    reranked: boolean;
    documentFilter: number[] | null;
  };
  /** Retrieval evaluation confidence (0-100) for downstream confidence scoring */
  evaluationConfidence: number;
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
 * Rerank candidates and select top K. Consolidates the pattern
 * used in initial ranking and retry paths.
 */
async function rerankAndSelect(
  query: string,
  candidates: HybridSearchResult[],
  topK: number,
  subqueries: string[]
): Promise<HybridSearchResult[]> {
  if (candidates.length > topK) {
    try {
      const ranked = await withTimeout(
        rerankChunks(query, candidates, topK, subqueries),
        TIMEOUTS.RERANKING,
        "Chunk reranking"
      );
      return ranked.map(r => r.chunk);
    } catch {
      return candidates.sort((a, b) => b.combined_score - a.combined_score).slice(0, topK);
    }
  }
  return candidates.sort((a, b) => b.combined_score - a.combined_score).slice(0, topK);
}

/**
 * Extract section-related keywords for ASTM convention-aware retry.
 * Maps common property queries to standard ASTM table/section references.
 */
function extractSectionKeywords(query: string): string[] {
  const keywords: string[] = [];
  const lower = query.toLowerCase();

  // Match explicit section/table references
  const sectionMatch = query.match(/(?:section|table|clause|annex|appendix)\s+\w+/gi);
  if (sectionMatch) {
    keywords.push(...sectionMatch);
  }

  // Map property queries to ASTM section conventions
  if (/heat\s*treat/i.test(lower)) keywords.push('heat treatment', 'Section 6');
  if (/mechanic/i.test(lower)) keywords.push('mechanical properties', 'tensile requirements');
  if (/chemic/i.test(lower)) keywords.push('chemical composition', 'chemical requirements');
  if (/hardness/i.test(lower)) keywords.push('hardness', 'mechanical requirements');
  if (/impact|charpy/i.test(lower)) keywords.push('impact test', 'supplementary requirements');
  if (/scope/i.test(lower)) keywords.push('scope', 'Section 1');

  return keywords;
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
  topK: number = 5,
  filterDocumentId?: number
): Promise<MultiQueryRAGResult> {
  const startTime = Date.now();
  console.log(`[Multi-Query RAG] Processing query: "${query}"`);

  // CACHE DISABLED: The RAG response cache was causing different queries to return
  // identical results. The cache was too aggressive in matching queries, leading to
  // cached chunks from Query A being returned for Query B. The embedding cache
  // (for Voyage AI API calls) is still active and provides sufficient optimization.
  // See: https://github.com/anthropics/specvault/issues/[issue-number]
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
  // If a specific document was uploaded, scope search to that document
  // Otherwise, fall back to spec-code-based filtering
  const documentIds = filterDocumentId
    ? [filterDocumentId]
    : await resolveSpecsToDocuments(processed.extractedCodes, query);

  if (documentIds) {
    const reason = filterDocumentId ? "uploaded document" : `ASTM codes: ${processed.extractedCodes.astm?.join(", ")}`;
    console.log(`[Multi-Query RAG] Document filter: [${documentIds.join(", ")}] for ${reason}`);
  }

  // Extract section references for section-aware search boosting
  const sectionRefs = processed.extractedCodes.sectionRef || null;
  if (sectionRefs) {
    console.log(`[Multi-Query RAG] Section refs detected: [${sectionRefs.join(", ")}]`);
  }

  // LangFuse tracing (opt-in)
  const langfuse = getLangfuse();
  const ragTrace = langfuse?.span({ name: "multi-query-rag-internal", input: { query, topK, documentIds } });

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
  const candidatesPerSubquery = Math.ceil(40 / decomposition.subqueries.length);

  const allResults = await Promise.all(
    decomposition.subqueries.map(async (subquery) => {
      // Pass document filter and section refs to ensure relevant search
      const results = await searchWithFallback(subquery, candidatesPerSubquery, documentIds, sectionRefs);
      console.log(`[Multi-Query RAG] Sub-query "${subquery}" returned ${results.length} results`);
      return results;
    })
  );

  // Step 3: Merge and deduplicate results
  let merged = mergeResults(allResults);
  console.log(`[Multi-Query RAG] Merged to ${merged.length} unique candidates`);

  // Step 3.5: Coverage validation (C4) — ensure all sub-queries have results
  if (decomposition.subqueries.length > 1) {
    const coverage = validateCoverage(decomposition, allResults);
    console.log(`[Multi-Query RAG] Coverage: ${Math.round(coverage.coverageRatio * 100)}% (${decomposition.subqueries.length - coverage.missingSubqueries.length}/${decomposition.subqueries.length} sub-queries)`);

    const subqueriesToBoost = [...coverage.missingSubqueries, ...coverage.thinSubqueries];
    if (subqueriesToBoost.length > 0) {
      console.log(`[Multi-Query RAG] Gap fill needed — missing: [${coverage.missingSubqueries.join(', ')}], thin: [${coverage.thinSubqueries.join(', ')}]`);
      try {
        const gapResults = await Promise.all(
          subqueriesToBoost.map(async (subquery) => {
            const results = await searchWithFallback(subquery, candidatesPerSubquery * 2, documentIds, sectionRefs);
            console.log(`[Multi-Query RAG] Gap fill for "${subquery}" returned ${results.length} results`);
            return results;
          })
        );
        merged = mergeResults([merged, ...gapResults]);
        console.log(`[Multi-Query RAG] After gap fill: ${merged.length} unique candidates`);
      } catch (gapError) {
        console.warn(`[Multi-Query RAG] Gap fill failed:`, gapError);
      }
    }
  }

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
      const rankedResults = await withTimeout(
        rerankChunks(query, merged, topK, decomposition.subqueries),
        TIMEOUTS.RERANKING,
        "Initial chunk reranking"
      );
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

  // P1: Cross-spec balanced retrieval
  // When comparing multiple documents (e.g., A789 vs A790), ensure each
  // document has at least 1 chunk in the final set. Without this, the
  // reranker may select all chunks from one document since they share
  // similar content, causing the LLM to miss data from the other spec.
  if (documentIds && documentIds.length >= 2) {
    const docChunkMap = new Map<number, HybridSearchResult[]>();
    for (const chunk of finalChunks) {
      const arr = docChunkMap.get(chunk.document_id) || [];
      arr.push(chunk);
      docChunkMap.set(chunk.document_id, arr);
    }

    const missingDocs = documentIds.filter(id => !docChunkMap.has(id));
    if (missingDocs.length > 0) {
      console.log(`[Multi-Query RAG] Cross-spec balance: ${missingDocs.length} doc(s) missing from final set — injecting best chunks`);
      for (const missingDocId of missingDocs) {
        // Find best chunk from merged candidates for this document
        const bestFromDoc = merged
          .filter(c => c.document_id === missingDocId)
          .sort((a, b) => b.combined_score - a.combined_score)[0];

        if (bestFromDoc) {
          // Replace the lowest-scoring chunk in finalChunks
          const lowestIdx = finalChunks.reduce((minIdx, chunk, idx, arr) =>
            chunk.combined_score < arr[minIdx].combined_score ? idx : minIdx, 0);
          console.log(`[Multi-Query RAG] Swapping chunk from doc ${finalChunks[lowestIdx].document_id} (score=${finalChunks[lowestIdx].combined_score.toFixed(3)}) with doc ${missingDocId} (score=${bestFromDoc.combined_score.toFixed(3)})`);
          finalChunks[lowestIdx] = bestFromDoc;
        }
      }
    }
  }

  // ========================================
  // Step 5: Evaluate retrieval quality and retry if needed (agentic loop)
  // ========================================
  const evaluation = await withTimeout(
    evaluateRetrieval(query, finalChunks),
    TIMEOUTS.RETRIEVAL_EVALUATION,
    "Retrieval evaluation"
  ).catch(() => ({
    isRelevant: true as const,
    confidence: 50,
    reason: "Evaluation timed out, proceeding with available chunks",
    suggestedRetryStrategy: undefined as string | undefined,
  }));
  console.log(`[Multi-Query RAG] Retrieval evaluation: confidence=${evaluation.confidence}, relevant=${evaluation.isRelevant}, reason="${evaluation.reason}"`);

  // Adaptive retry with strategy tracking — avoids repeating ineffective strategies
  const triedStrategies = new Set<string>();
  let bestConfidence = evaluation.confidence;
  const RETRY_STRATEGIES = ['section_lookup', 'broader_search', 'more_candidates'] as const;
  const MAX_RETRIES = 2;
  const MAX_RETRY_TIME_MS = 25000;

  if (!evaluation.isRelevant) {
    for (let retryAttempt = 0; retryAttempt < MAX_RETRIES; retryAttempt++) {
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_RETRY_TIME_MS) {
        console.log(`[Multi-Query RAG] Retry time budget exhausted (${elapsed}ms) — stopping`);
        break;
      }

      // Pick strategy: use evaluator suggestion if untried, otherwise pick next untried
      let strategy: string | undefined = evaluation.suggestedRetryStrategy;
      if (!strategy || triedStrategies.has(strategy)) {
        strategy = RETRY_STRATEGIES.find(s => !triedStrategies.has(s));
      }
      if (!strategy) {
        console.log(`[Multi-Query RAG] All retry strategies exhausted`);
        break;
      }

      triedStrategies.add(strategy);
      console.log(`[Multi-Query RAG] Retry attempt ${retryAttempt + 1} with strategy: ${strategy}`);

      try {
        let retryChunks: HybridSearchResult[];

        if (strategy === 'broader_search') {
          const retryCandidates = Math.ceil(60 / decomposition.subqueries.length);
          const retryResults = await Promise.all(
            decomposition.subqueries.map(async (subquery) => {
              return await searchWithFallback(subquery, retryCandidates, null, null);
            })
          );
          const retryMerged = mergeResults(retryResults);
          console.log(`[Multi-Query RAG] Broader retry: ${retryMerged.length} candidates (no filters)`);
          retryChunks = await rerankAndSelect(query, retryMerged, topK, decomposition.subqueries);
        } else if (strategy === 'section_lookup') {
          const sectionKeywords = extractSectionKeywords(query);
          const retryCandidates = Math.ceil(40 / decomposition.subqueries.length);
          const retryResults = await Promise.all(
            decomposition.subqueries.map(async (subquery) => {
              const augmented = sectionKeywords.length > 0
                ? `${subquery} ${sectionKeywords.join(' ')}`
                : subquery;
              return await searchWithFallback(augmented, retryCandidates, documentIds, sectionRefs || sectionKeywords);
            })
          );
          const retryMerged = mergeResults(retryResults);
          console.log(`[Multi-Query RAG] Section retry: ${retryMerged.length} candidates (augmented with: ${sectionKeywords.join(', ')})`);
          retryChunks = await rerankAndSelect(query, retryMerged, topK, decomposition.subqueries);
        } else {
          const retryCandidates = Math.ceil(80 / decomposition.subqueries.length);
          const retryResults = await Promise.all(
            decomposition.subqueries.map(async (subquery) => {
              return await searchWithFallback(subquery, retryCandidates, documentIds, sectionRefs);
            })
          );
          const retryMerged = mergeResults(retryResults);
          console.log(`[Multi-Query RAG] More candidates retry: ${retryMerged.length} candidates (2x)`);
          retryChunks = await rerankAndSelect(query, retryMerged, topK, decomposition.subqueries);
        }

        const retryEvaluation = await withTimeout(
          evaluateRetrieval(query, retryChunks),
          TIMEOUTS.RETRIEVAL_EVALUATION,
          "Retry retrieval evaluation"
        ).catch(() => ({
          isRelevant: true as const,
          confidence: bestConfidence,
          reason: "Retry evaluation timed out",
          suggestedRetryStrategy: undefined as string | undefined,
        }));
        console.log(`[Multi-Query RAG] Retry evaluation: confidence=${retryEvaluation.confidence}`);

        if (retryEvaluation.confidence > bestConfidence) {
          console.log(`[Multi-Query RAG] Retry improved confidence: ${bestConfidence} → ${retryEvaluation.confidence}`);
          finalChunks = retryChunks;
          bestConfidence = retryEvaluation.confidence;
        } else {
          console.log(`[Multi-Query RAG] Retry did not improve (${retryEvaluation.confidence} <= ${bestConfidence})`);
        }

        // If we've reached acceptable confidence, stop retrying
        if (bestConfidence >= 60) {
          console.log(`[Multi-Query RAG] Confidence sufficient (${bestConfidence}%) — stopping retries`);
          break;
        }
      } catch (retryError) {
        console.warn(`[Multi-Query RAG] Retry ${retryAttempt + 1} failed:`, retryError);
      }
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`[Multi-Query RAG] Total pipeline time: ${totalTime}ms`);

  ragTrace?.end({
    output: {
      chunkCount: finalChunks.length,
      totalCandidates: merged.length,
      reranked,
      evaluationConfidence: evaluation.confidence,
      totalTimeMs: totalTime,
    },
  });

  return {
    chunks: finalChunks,
    decomposition,
    searchMetadata: {
      totalCandidates: merged.length,
      subqueryResults: allResults.map(r => r.length),
      reranked,
      documentFilter: documentIds,
    },
    evaluationConfidence: evaluation.confidence,
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
