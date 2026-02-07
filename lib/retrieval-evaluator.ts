/**
 * Retrieval Quality Evaluator
 *
 * Uses a fast LLM call to judge whether retrieved chunks actually answer
 * the user's query. If confidence is low, suggests a retry strategy.
 *
 * This is the "evaluate" step in the agentic retrieve-evaluate-retry loop.
 */

import { getModelFallbackClient } from "./model-fallback";
import type { HybridSearchResult } from "./hybrid-search";

export type RetryStrategy = 'broader_search' | 'section_lookup' | 'more_candidates';

export interface EvaluationResult {
  /** Whether the chunks are relevant enough to answer the query */
  isRelevant: boolean;
  /** Confidence score 0-100 */
  confidence: number;
  /** Explanation of the evaluation */
  reason: string;
  /** Suggested retry strategy if confidence is low */
  suggestedRetryStrategy?: RetryStrategy;
}

/**
 * Evaluate whether retrieved chunks can answer the user's query.
 *
 * Uses a fast LLM call with a concise prompt for speed (~1-2s).
 * Chunks are truncated to 600 chars each to capture table headers + data rows.
 *
 * @param query - The user's original query
 * @param chunks - Retrieved chunks to evaluate
 * @returns Evaluation result with confidence score and optional retry strategy
 */
export async function evaluateRetrieval(
  query: string,
  chunks: HybridSearchResult[],
): Promise<EvaluationResult> {
  if (chunks.length === 0) {
    return {
      isRelevant: false,
      confidence: 0,
      reason: "No chunks retrieved",
      suggestedRetryStrategy: 'broader_search',
    };
  }

  const client = getModelFallbackClient();

  // Truncate chunks — 600 chars to capture table headers + data rows in ASTM specs
  const truncated = chunks.map((c, i) =>
    `[${i + 1}] (Section: ${c.section_title || 'unknown'}, Page ${c.page_number}): ${c.content.slice(0, 600)}`
  ).join('\n\n');

  const prompt = `You are a retrieval quality judge. Given a user query and retrieved document chunks, assess whether the chunks contain information to answer the query.

QUERY: "${query}"

RETRIEVED CHUNKS:
${truncated}

Respond with ONLY valid JSON (no markdown):
{
  "confidence": <0-100>,
  "reason": "<brief explanation>",
  "retry_strategy": "<null | 'broader_search' | 'section_lookup' | 'more_candidates'>"
}

Scoring guide:
- 80-100: Chunks directly answer the query with specific data
- 60-79: Chunks are relevant but may not fully answer
- 40-59: Chunks are tangentially related
- 0-39: Chunks don't address the query at all

IMPORTANT for technical specifications: If chunks contain tables with numerical values
related to the query topic (mechanical properties, chemical composition, dimensions),
score 70+ even if the exact grade or designation is not explicitly labeled in the
visible text. Specification tables often contain the answer in tabular format.

Set retry_strategy to suggest how to improve retrieval if confidence < 60:
- "section_lookup": Query asks about a specific section that wasn't found
- "broader_search": Query terms too narrow, need wider search
- "more_candidates": Right topic but best answer might be in lower-ranked results`;

  try {
    const { text } = await client.generateContent(prompt);

    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const result = JSON.parse(cleaned);
    const confidence = Math.min(100, Math.max(0, result.confidence || 0));

    return {
      isRelevant: confidence >= 60,
      confidence,
      reason: result.reason || "No reason provided",
      suggestedRetryStrategy: confidence < 60 ? (result.retry_strategy || 'broader_search') : undefined,
    };
  } catch (error) {
    console.warn("[Retrieval Evaluator] Evaluation failed, assuming relevant:", error);
    // On failure, assume chunks are good enough to avoid blocking the pipeline
    return {
      isRelevant: true,
      confidence: 50,
      reason: "Evaluation failed, proceeding with available chunks",
    };
  }
}
