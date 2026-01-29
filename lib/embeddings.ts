/**
 * Embedding Generation with Voyage AI
 * ====================================
 *
 * Uses Voyage AI for embeddings - 200M tokens FREE/month with 1000+ RPM
 * (vs Google's restrictive 100 RPM limit)
 *
 * Voyage AI Benefits:
 * - 200M tokens FREE per month
 * - 1000+ requests per minute (vs Google's 100)
 * - High quality embeddings (voyage-3-lite)
 * - 1024 dimensions (efficient storage)
 */

import { VoyageAIClient } from "voyageai";

// Initialize Voyage AI client
const voyageClient = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY,
});

// Voyage embedding model - good quality, 1024 dimensions
const EMBEDDING_MODEL = "voyage-3-lite";

// Retry configuration
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000;

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("rate limit") ||
      msg.includes("quota") ||
      msg.includes("429") ||
      msg.includes("too many")
    );
  }
  return false;
}

/**
 * Generate embedding for a single text
 *
 * @param text - The text to embed
 * @returns Vector embedding (array of 1024 numbers)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await voyageClient.embed({
        input: [text],
        model: EMBEDDING_MODEL,
      });

      return result.data?.[0]?.embedding || [];
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isRateLimitError(error) && attempt < MAX_RETRIES - 1) {
        const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
        console.warn(
          `[Embeddings] Rate limited, waiting ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error("Failed to generate embedding after retries");
}

/**
 * Generate embeddings for multiple texts (batch)
 *
 * Voyage AI supports batching up to 128 texts at once,
 * making document processing MUCH faster than single requests.
 *
 * @param texts - Array of texts to embed
 * @returns Array of vector embeddings
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 64; // Voyage supports up to 128, we use 64 for safety
  const embeddings: number[][] = [];
  const total = texts.length;

  console.log(`[Embeddings] Starting batch embedding of ${total} chunks...`);

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    let lastError: Error | null = null;
    let success = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await voyageClient.embed({
          input: batch,
          model: EMBEDDING_MODEL,
        });

        const batchEmbeddings = (result.data?.map((d) => d.embedding) || []).filter(
          (e): e is number[] => Array.isArray(e)
        );
        embeddings.push(...batchEmbeddings);
        success = true;

        // Progress logging
        const progress = Math.min(i + BATCH_SIZE, total);
        console.log(
          `[Embeddings] Progress: ${progress}/${total} chunks (${Math.round((progress / total) * 100)}%)`
        );

        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (isRateLimitError(error) && attempt < MAX_RETRIES - 1) {
          const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
          console.warn(
            `[Embeddings] Rate limited at batch ${Math.floor(i / BATCH_SIZE) + 1}, waiting ${delay}ms`
          );
          await sleep(delay);
          continue;
        }

        throw error;
      }
    }

    if (!success) {
      throw lastError || new Error(`Failed to embed batch at index ${i}`);
    }

    // Small delay between batches (Voyage is fast, but be respectful)
    if (i + BATCH_SIZE < texts.length) {
      await sleep(100);
    }
  }

  console.log(`[Embeddings] Completed batch embedding of ${total} chunks`);
  return embeddings;
}

/**
 * Generate embeddings in parallel (same as batch for Voyage AI)
 * Kept for API compatibility
 */
export async function generateEmbeddingsParallel(
  texts: string[],
  _batchSize?: number
): Promise<number[][]> {
  return generateEmbeddings(texts);
}
