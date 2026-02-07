/**
 * Re-Ranking for RAG Retrieval
 *
 * Two-tier reranking strategy:
 * 1. Primary: Voyage AI rerank-2 API (fast, accurate, ~200ms)
 * 2. Fallback: LLM-based scoring via ModelFallbackClient (5-15s)
 *
 * Voyage AI reranker is a dedicated cross-encoder model trained for
 * relevance scoring — much faster and more consistent than prompting
 * a general-purpose LLM to score chunks.
 */

import { getModelFallbackClient } from "./model-fallback";
import { HybridSearchResult } from "./hybrid-search";

export interface RankedChunk {
  chunk: HybridSearchResult;
  relevance_score: number;  // 0-10 normalized score
  relevance_reason: string;
}

/**
 * Re-rank search results using Voyage AI rerank-2 API
 * Falls back to LLM-based scoring if Voyage reranker is unavailable.
 *
 * @param query - The user's search query
 * @param chunks - Candidate chunks from hybrid search
 * @param topK - Number of top chunks to return (default: 5)
 * @param subQueries - Optional decomposed sub-queries for context
 * @returns Ranked chunks with relevance scores
 */
export async function rerankChunks(
  query: string,
  chunks: HybridSearchResult[],
  topK: number = 5,
  subQueries?: string[]
): Promise<RankedChunk[]> {
  // If we have fewer chunks than topK, just return them all
  if (chunks.length <= topK) {
    return chunks.map(chunk => ({
      chunk,
      relevance_score: 8,
      relevance_reason: "Only candidate from search",
    }));
  }

  // Try Voyage AI reranker first (fast, no LLM API cost)
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (voyageKey) {
    try {
      const result = await voyageRerank(query, chunks, topK, subQueries);
      console.log(`[Re-ranker] Voyage AI rerank-2: ${chunks.length} → top ${topK}`);
      return result;
    } catch (error) {
      console.warn(`[Re-ranker] Voyage AI failed, falling back to LLM:`, error instanceof Error ? error.message : error);
    }
  }

  // Fallback: LLM-based reranking
  return llmRerank(query, chunks, topK, subQueries);
}

// ============================================================================
// Voyage AI Reranker (Primary)
// ============================================================================

/**
 * Rerank using Voyage AI rerank-2 cross-encoder model.
 * ~200ms for 40 documents — 10-50x faster than LLM reranking.
 */
async function voyageRerank(
  query: string,
  chunks: HybridSearchResult[],
  topK: number,
  subQueries?: string[]
): Promise<RankedChunk[]> {
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!voyageKey) throw new Error("VOYAGE_API_KEY not set");

  // Build the query — include sub-queries for context if decomposed
  const fullQuery = subQueries && subQueries.length > 1
    ? `${query}\n\nRelated aspects: ${subQueries.join('; ')}`
    : query;

  // Truncate chunks to 1000 chars each (Voyage has token limits)
  const documents = chunks.map(c => c.content.slice(0, 1000));

  const startTime = Date.now();
  const response = await fetch("https://api.voyageai.com/v1/rerank", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${voyageKey}`,
    },
    body: JSON.stringify({
      query: fullQuery,
      documents,
      model: "rerank-2",
      top_k: topK,
    }),
    signal: AbortSignal.timeout(10000), // 10s timeout
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Voyage rerank API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json() as {
    data: { index: number; relevance_score: number }[];
    model: string;
    usage: { total_tokens: number };
  };

  const elapsed = Date.now() - startTime;
  console.log(`[Re-ranker] Voyage rerank-2: ${elapsed}ms, ${data.usage?.total_tokens || '?'} tokens`);

  // Map Voyage scores (0-1) to our 0-10 scale and attach chunks
  return data.data.map(item => ({
    chunk: chunks[item.index],
    relevance_score: Math.round(item.relevance_score * 10 * 100) / 100, // 0-10 scale
    relevance_reason: `Voyage rerank score: ${item.relevance_score.toFixed(3)}`,
  }));
}

// ============================================================================
// LLM-Based Reranker (Fallback)
// ============================================================================

/**
 * Re-rank using LLM judgment (fallback when Voyage is unavailable)
 */
async function llmRerank(
  query: string,
  chunks: HybridSearchResult[],
  topK: number,
  subQueries?: string[]
): Promise<RankedChunk[]> {
  const client = getModelFallbackClient();

  // Truncate chunk content for faster processing
  const truncatedChunks = chunks.map((c, i) => ({
    id: i + 1,
    content: c.content.slice(0, 800),
  }));

  // Include sub-queries in the prompt when the query was decomposed
  const subQueryContext = subQueries && subQueries.length > 1
    ? `\n\nSUB-QUERIES (the original query was decomposed into these — score chunks relevant to ANY of them):\n${subQueries.map((sq, i) => `${i + 1}. "${sq}"`).join('\n')}`
    : '';

  // Batch scoring: Ask LLM to score all chunks at once
  const prompt = `You are a relevance judge for a technical document search system.

USER QUERY: "${query}"${subQueryContext}

CANDIDATE CHUNKS (${chunks.length} total):
${truncatedChunks.map(c => `[${c.id}] ${c.content}...`).join('\n\n---\n\n')}

TASK: For each chunk, assign a relevance score from 0-10 where:
- 10: Directly answers the query with exact values or specifications
- 7-9: Highly relevant context that helps answer the query
- 4-6: Somewhat relevant but not directly answering
- 0-3: Not relevant or off-topic

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "scores": [
    {"chunk_id": 1, "score": 8, "reason": "Contains yield strength value"},
    {"chunk_id": 2, "score": 3, "reason": "Different property, not relevant"},
    ...
  ]
}`;

  try {
    const { text } = await client.generateContent(prompt);

    // Clean up response - remove markdown code blocks if present
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    // Safe JSON parsing with explicit fallback
    let result;
    try {
      result = JSON.parse(cleanedText);
    } catch {
      console.warn("[Re-ranker] JSON parse failed for:", cleanedText.slice(0, 200));
      return chunks.slice(0, topK).map(chunk => ({
        chunk,
        relevance_score: 7,
        relevance_reason: "Fallback: JSON parse failed",
      }));
    }

    if (!result.scores || !Array.isArray(result.scores)) {
      console.warn("[Re-ranker] Invalid structure:", result);
      return chunks.slice(0, topK).map(chunk => ({
        chunk,
        relevance_score: 7,
        relevance_reason: "Fallback: invalid response structure",
      }));
    }

    // Map scores back to chunks
    const ranked = chunks.map((chunk, i) => {
      const scoreEntry = result.scores.find((s: { chunk_id: number }) => s.chunk_id === i + 1);
      return {
        chunk,
        relevance_score: scoreEntry?.score || 0,
        relevance_reason: scoreEntry?.reason || "No score provided",
      };
    });

    // Sort by relevance score (descending)
    ranked.sort((a, b) => b.relevance_score - a.relevance_score);

    // Filter out clearly irrelevant chunks (score < 4/10)
    const MIN_RELEVANCE_SCORE = 4;
    const filtered = ranked.filter(r => r.relevance_score >= MIN_RELEVANCE_SCORE);
    if (filtered.length > 0 && filtered.length < ranked.length) {
      console.log(`[Re-ranker] Filtered out ${ranked.length - filtered.length} chunks below relevance threshold (${MIN_RELEVANCE_SCORE}/10)`);
    }
    const candidates = filtered.length > 0 ? filtered : ranked;

    return candidates.slice(0, topK);
  } catch (error) {
    console.error("[Re-ranker] Failed to re-rank chunks:", error);
    console.warn("[Re-ranker] Using fallback: returning chunks in original search order");
    return chunks.slice(0, topK).map(chunk => ({
      chunk,
      relevance_score: 7,
      relevance_reason: "Fallback: re-ranking failed",
    }));
  }
}

/**
 * Re-rank with detailed logging (for debugging)
 */
export async function rerankChunksWithLogging(
  query: string,
  chunks: HybridSearchResult[],
  topK: number = 5
): Promise<RankedChunk[]> {
  console.log(`[Re-ranker] Starting re-ranking for query: "${query}"`);
  console.log(`[Re-ranker] Candidates: ${chunks.length}, Target: top ${topK}`);

  const startTime = Date.now();
  const ranked = await rerankChunks(query, chunks, topK);
  const elapsed = Date.now() - startTime;

  console.log(`[Re-ranker] Re-ranking completed in ${elapsed}ms`);
  console.log(`[Re-ranker] Top 5 scores:`, ranked.slice(0, 5).map(r => ({
    score: r.relevance_score,
    reason: r.relevance_reason,
    preview: r.chunk.content.slice(0, 80) + "...",
  })));

  return ranked;
}
