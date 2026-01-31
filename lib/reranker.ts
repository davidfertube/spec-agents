/**
 * Re-Ranking for RAG Retrieval
 *
 * This module re-ranks search results using LLM judgment for better precision.
 * Takes top 20 candidates from hybrid search and re-ranks to top 5 most relevant.
 */

import { getModelFallbackClient } from "./model-fallback";
import { HybridSearchResult } from "./hybrid-search";

export interface RankedChunk {
  chunk: HybridSearchResult;
  relevance_score: number;  // 0-10 LLM-assigned score
  relevance_reason: string;  // Why this chunk is relevant
}

/**
 * Re-rank search results using LLM judgment
 *
 * This is cheaper and more flexible than training a cross-encoder model.
 * Uses Gemini Flash (fast and cheap) to score each chunk.
 *
 * @param query - The user's search query
 * @param chunks - Candidate chunks from hybrid search
 * @param topK - Number of top chunks to return (default: 5)
 * @returns Ranked chunks with relevance scores
 */
export async function rerankChunks(
  query: string,
  chunks: HybridSearchResult[],
  topK: number = 5
): Promise<RankedChunk[]> {
  // If we have fewer chunks than topK, just return them all
  if (chunks.length <= topK) {
    return chunks.map(chunk => ({
      chunk,
      relevance_score: 8, // Assume high relevance if search returned few results
      relevance_reason: "Only candidate from search",
    }));
  }

  const client = getModelFallbackClient();

  // Truncate chunk content for faster processing
  const truncatedChunks = chunks.map((c, i) => ({
    id: i + 1,
    content: c.content.slice(0, 400), // First 400 chars should be enough for relevance judgment
  }));

  // Batch scoring: Ask LLM to score all chunks at once
  const prompt = `You are a relevance judge for a technical document search system.

USER QUERY: "${query}"

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
    const { text } = await client.generateContent(prompt, "gemini-2.5-flash");

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
      // Return fallback instead of throwing
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

    // Return top K
    return ranked.slice(0, topK);
  } catch (error) {
    console.error("[Re-ranker] Failed to re-rank chunks:", error);

    // Fallback: return chunks in original order (from hybrid search)
    console.warn("[Re-ranker] Using fallback: returning chunks in original search order");
    return chunks.slice(0, topK).map(chunk => ({
      chunk,
      relevance_score: 7, // Assume decent relevance if hybrid search returned them
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
