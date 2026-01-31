/**
 * Query Decomposition for Agentic RAG
 *
 * Breaks complex queries into simpler sub-queries for better retrieval.
 * Handles comparison queries, multi-hop reasoning, and list queries.
 */

import { getModelFallbackClient } from "./model-fallback";

export type QueryIntent = 'lookup' | 'compare' | 'list' | 'explain' | 'verify';

export interface DecomposedQuery {
  original: string;
  intent: QueryIntent;
  subqueries: string[];
  requires_aggregation: boolean;
  reasoning?: string;
}

/**
 * Decompose complex queries into simpler sub-queries
 *
 * Examples:
 * - "Compare 316L and 2205 yield strength"
 *   → ["316L yield strength", "2205 duplex yield strength"]
 *
 * - "List all steels with PREN > 40"
 *   → ["PREN values for all steels", "steels with high corrosion resistance"]
 *
 * - "What is 316L yield strength?"
 *   → ["316L yield strength"] (no decomposition needed)
 */
export async function decomposeQuery(query: string): Promise<DecomposedQuery> {
  const client = getModelFallbackClient();

  const prompt = `You are a query planner for a technical document search system.

USER QUERY: "${query}"

TASK: Analyze this query and determine:
1. Intent (lookup, compare, list, explain, verify)
2. If it needs to be broken into sub-queries
3. What sub-queries would be needed

Intent definitions:
- lookup: Simple fact retrieval (e.g., "What is X?")
- compare: Comparing multiple items (e.g., "Compare A vs B")
- list: Listing items matching criteria (e.g., "List all X with property Y")
- explain: Understanding concepts (e.g., "Explain how X works")
- verify: Checking if statement is true (e.g., "Is X compliant with Y?")

Examples:
Q: "What is 316L yield strength?"
→ Intent: lookup, Sub-queries: ["316L yield strength"], Aggregation: false

Q: "Compare 316L and 2205 duplex"
→ Intent: compare, Sub-queries: ["316L properties", "2205 duplex properties"], Aggregation: true

Q: "List steels for high temperature"
→ Intent: list, Sub-queries: ["high temperature steel applications", "steel temperature ratings"], Aggregation: true

Q: "What is the difference between ASTM A240 and A790?"
→ Intent: compare, Sub-queries: ["ASTM A240 specifications", "ASTM A790 specifications"], Aggregation: true

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "intent": "lookup|compare|list|explain|verify",
  "subqueries": ["query1", "query2", ...],
  "requires_aggregation": true|false,
  "reasoning": "Brief explanation of decomposition strategy"
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
      console.warn("[Query Decomposition] JSON parse failed for:", cleanedText.slice(0, 200));
      // Return safe fallback instead of throwing
      return {
        original: query,
        intent: 'lookup' as QueryIntent,
        subqueries: [query],
        requires_aggregation: false,
        reasoning: "Fallback: JSON parse failed",
      };
    }

    // Validate result structure
    if (!result.intent || !result.subqueries || !Array.isArray(result.subqueries)) {
      console.warn("[Query Decomposition] Invalid structure:", result);
      return {
        original: query,
        intent: 'lookup' as QueryIntent,
        subqueries: [query],
        requires_aggregation: false,
        reasoning: "Fallback: invalid response structure",
      };
    }

    return {
      original: query,
      intent: result.intent as QueryIntent,
      subqueries: result.subqueries,
      requires_aggregation: result.requires_aggregation ?? false,
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error("[Query Decomposition] Failed to decompose query:", error);

    // Fallback: treat as simple lookup
    console.warn("[Query Decomposition] Using fallback: treating as simple lookup");
    return {
      original: query,
      intent: 'lookup',
      subqueries: [query],
      requires_aggregation: false,
      reasoning: "Fallback: decomposition failed",
    };
  }
}

/**
 * Check if query needs decomposition (heuristic check before calling LLM)
 *
 * This saves an LLM call for simple queries.
 */
export function needsDecomposition(query: string): boolean {
  const lowercaseQuery = query.toLowerCase();

  // Keywords that suggest complex queries
  const compareKeywords = ['compare', 'difference', 'vs', 'versus', 'better', 'worse'];
  const listKeywords = ['list', 'all', 'which', 'what are'];
  const multiEntityPattern = /\band\b|\bor\b/i;

  // Check for comparison keywords
  if (compareKeywords.some(kw => lowercaseQuery.includes(kw))) {
    return true;
  }

  // Check for list keywords
  if (listKeywords.some(kw => lowercaseQuery.includes(kw))) {
    return true;
  }

  // Check for multiple entities (e.g., "316L and 2205")
  if (multiEntityPattern.test(query)) {
    return true;
  }

  // Simple queries don't need decomposition
  return false;
}

/**
 * Decompose query with fast path for simple queries
 */
export async function decomposeQuerySmart(query: string): Promise<DecomposedQuery> {
  // Fast path: if query is simple, skip LLM call
  if (!needsDecomposition(query)) {
    return {
      original: query,
      intent: 'lookup',
      subqueries: [query],
      requires_aggregation: false,
      reasoning: "Simple lookup query, no decomposition needed",
    };
  }

  // Complex query: use LLM decomposition
  return decomposeQuery(query);
}
