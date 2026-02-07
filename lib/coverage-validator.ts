/**
 * Sub-Query Coverage Validator
 *
 * For comparison and multi-entity queries, verifies that all sub-queries
 * have relevant chunks in the merged result set. Identifies gaps where
 * a sub-query returned no results, enabling targeted re-search.
 *
 * Pure regex-based — no LLM calls. ~2ms latency.
 */

import type { HybridSearchResult } from "./hybrid-search";
import type { DecomposedQuery } from "./query-decomposition";

export interface CoverageResult {
  /** True if all sub-queries have at least 1 chunk */
  covered: boolean;
  /** Map of sub-query → chunk count */
  coverageMap: Record<string, number>;
  /** Sub-queries with 0 matching chunks */
  missingSubqueries: string[];
  /** Sub-queries with results but significantly fewer than others */
  thinSubqueries: string[];
  /** Fraction of sub-queries covered (0-1) */
  coverageRatio: number;
}

/**
 * Validate that all sub-queries contributed chunks to the merged result set.
 *
 * For comparison queries, also checks entity coverage — e.g., if comparing
 * A789 vs A790, both specs should be represented in the chunks.
 *
 * @param decomposition - Query decomposition with sub-queries and intent
 * @param allSubqueryResults - Per-sub-query result arrays from Promise.all
 * @returns Coverage result with gaps identified
 */
export function validateCoverage(
  decomposition: DecomposedQuery,
  allSubqueryResults: HybridSearchResult[][]
): CoverageResult {
  const coverageMap: Record<string, number> = {};
  const missingSubqueries: string[] = [];

  for (let i = 0; i < decomposition.subqueries.length; i++) {
    const subquery = decomposition.subqueries[i];
    const resultCount = allSubqueryResults[i]?.length ?? 0;
    coverageMap[subquery] = resultCount;

    if (resultCount === 0) {
      missingSubqueries.push(subquery);
    }
  }

  // Detect thin coverage: sub-queries with results but significantly fewer than others
  const thinSubqueries: string[] = [];
  const resultCounts = Object.values(coverageMap).filter(c => c > 0);
  if (resultCounts.length >= 2) {
    const maxCount = Math.max(...resultCounts);
    const thinThreshold = Math.max(3, Math.floor(maxCount * 0.2));
    for (const [subquery, count] of Object.entries(coverageMap)) {
      if (count > 0 && count < thinThreshold) {
        thinSubqueries.push(subquery);
      }
    }
  }

  const totalSubqueries = decomposition.subqueries.length;
  const coveredCount = totalSubqueries - missingSubqueries.length;
  const coverageRatio = totalSubqueries > 0 ? coveredCount / totalSubqueries : 1;

  return {
    covered: missingSubqueries.length === 0,
    coverageMap,
    missingSubqueries,
    thinSubqueries,
    coverageRatio,
  };
}

/**
 * For comparison queries, check that both entities are represented
 * in the chunk set by looking for ASTM/UNS codes.
 *
 * @param chunks - Merged chunk set
 * @param decomposition - Query decomposition
 * @returns Array of entity identifiers not found in any chunk
 */
export function findMissingEntities(
  chunks: HybridSearchResult[],
  decomposition: DecomposedQuery
): string[] {
  if (decomposition.intent !== 'compare' || decomposition.subqueries.length < 2) {
    return [];
  }

  // Extract entity identifiers from sub-queries
  const entities = new Set<string>();
  for (const sq of decomposition.subqueries) {
    // ASTM codes: A789, A790, A312, etc.
    const astmMatches = sq.match(/\bA\d{3,4}\b/gi);
    if (astmMatches) {
      astmMatches.forEach(m => entities.add(m.toUpperCase()));
    }
    // UNS codes: S32205, S32750, etc.
    const unsMatches = sq.match(/\bS\d{5}\b/gi);
    if (unsMatches) {
      unsMatches.forEach(m => entities.add(m.toUpperCase()));
    }
  }

  if (entities.size < 2) {
    return []; // Not a multi-entity comparison
  }

  // Check which entities appear in chunks
  const allContent = chunks.map(c => c.content.toUpperCase()).join(' ');
  const missing: string[] = [];

  for (const entity of entities) {
    if (!allContent.includes(entity)) {
      missing.push(entity);
    }
  }

  return missing;
}
