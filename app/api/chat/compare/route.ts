import { NextRequest, NextResponse } from "next/server";
import { validateQuery } from "@/lib/validation";
import { withTimeout, TIMEOUTS } from "@/lib/timeout";
import { handleApiError, createValidationError, getErrorStatusCode } from "@/lib/errors";
import { getModelFallbackClient } from "@/lib/model-fallback";

/**
 * Compare Chat API Route - Generic LLM Response (No RAG)
 *
 * This endpoint simulates what a generic LLM (without RAG) would respond.
 * Used to demonstrate the value of Steel Agent's document-grounded responses
 * compared to generic LLM responses that may hallucinate or lack citations.
 *
 * The key difference from /api/chat:
 * - NO document context is provided
 * - NO citations are included
 * - Response is based purely on general training knowledge
 *
 * Rate Limit Handling:
 * - Uses ModelFallbackClient for automatic model fallback
 * - If primary model is rate limited, falls back to alternatives
 * - Prevents API failures and avoids overage charges
 *
 * Security features:
 * - Input validation and sanitization
 * - Timeout protection on LLM calls
 * - Safe error handling (no internal details leaked)
 */

export async function POST(request: NextRequest) {
  try {
    // ========================================
    // Step 1: Parse and Validate Input
    // ========================================
    const body = await request.json();
    const { query } = body;

    // Validate query using our validation utility
    const validation = validateQuery(query);
    if (!validation.isValid) {
      const error = createValidationError(validation.error || "Invalid query");
      return NextResponse.json(error, { status: getErrorStatusCode("VALIDATION_ERROR") });
    }

    // Use the cleaned, sanitized query
    const cleanedQuery = validation.cleanedQuery!;

    // ========================================
    // Step 2: Generate Generic LLM Response
    // ========================================
    // Use ModelFallbackClient for automatic fallback on rate limits
    const fallbackClient = getModelFallbackClient();

    // Generic LLM prompt - NO document context, just general knowledge
    // This demonstrates what you'd get from ChatGPT/Gemini without RAG
    const genericPrompt = `You are a helpful assistant answering questions about steel and materials engineering.

IMPORTANT: You do NOT have access to any specific documents. Answer based on general knowledge only.

USER QUESTION: ${cleanedQuery}

Provide a helpful answer based on your general training knowledge. You may mention typical values or standards, but note that you cannot verify these against specific documents.`;

    // Generate response with timeout protection and automatic model fallback
    // Primary: Claude Sonnet 4.5, falls back to Groq/Cerebras/OpenRouter
    const { text: responseText, modelUsed } = await withTimeout(
      fallbackClient.generateContent(genericPrompt),
      TIMEOUTS.LLM_GENERATION,
      "Generic LLM response generation"
    );

    console.log(`[Compare API] Model used: ${modelUsed}`);

    // ========================================
    // Step 3: Return Response (No Sources)
    // ========================================
    return NextResponse.json({
      response: responseText,
      // No sources - that's the point! This demonstrates the limitation
      sources: [],
      // Flag to indicate this is generic LLM (for UI differentiation)
      isGenericLLM: true,
    });

  } catch (error) {
    // Use our safe error handler - never leaks internal details
    const { response, status } = handleApiError(error, "Compare Chat API");
    return NextResponse.json(response, { status });
  }
}
