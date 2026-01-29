/**
 * Query Embedding Cache
 * =====================
 *
 * Caches query embeddings to reduce API calls and avoid rate limits.
 * This allows users to:
 * 1. Run multiple queries without hitting rate limits
 * 2. Get instant responses for repeated/similar queries
 *
 * Cache Strategy:
 * - Normalize queries (lowercase, trim, collapse whitespace)
 * - Hash normalized query for cache key
 * - TTL of 1 hour (embeddings don't change)
 * - Max 1000 entries to prevent memory bloat
 */

import crypto from "crypto";
import { generateEmbedding } from "./embeddings";

interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

// In-memory cache (replace with Redis for production scale)
const cache = new Map<string, CacheEntry>();

// Cache configuration
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 1000;

/**
 * Create a normalized hash of the query for cache lookup
 */
function hashQuery(query: string): string {
  // Normalize: lowercase, trim, collapse whitespace
  const normalized = query.toLowerCase().trim().replace(/\s+/g, " ");
  return crypto.createHash("md5").update(normalized).digest("hex");
}

/**
 * Remove oldest entries when cache exceeds max size
 */
function pruneCache(): void {
  if (cache.size <= MAX_CACHE_SIZE) return;

  // Sort by timestamp (oldest first)
  const entries = [...cache.entries()].sort(
    (a, b) => a[1].timestamp - b[1].timestamp
  );

  // Remove oldest 100 entries
  const toDelete = entries.slice(0, cache.size - MAX_CACHE_SIZE + 100);
  toDelete.forEach(([key]) => cache.delete(key));

  console.log(`[EmbeddingCache] Pruned ${toDelete.length} old entries`);
}

/**
 * Get embedding for a query, using cache if available
 *
 * @param query - The search query
 * @returns Vector embedding for the query
 */
export async function getCachedQueryEmbedding(query: string): Promise<number[]> {
  const key = hashQuery(query);
  const cached = cache.get(key);

  // Return cached if valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(
      `[EmbeddingCache] HIT for query: "${query.slice(0, 50)}${query.length > 50 ? "..." : ""}"`
    );
    return cached.embedding;
  }

  // Generate new embedding
  console.log(
    `[EmbeddingCache] MISS - generating embedding for: "${query.slice(0, 50)}${query.length > 50 ? "..." : ""}"`
  );

  const embedding = await generateEmbedding(query);

  // Store in cache
  cache.set(key, { embedding, timestamp: Date.now() });
  pruneCache();

  return embedding;
}

/**
 * Clear the entire cache (useful for testing)
 */
export function clearEmbeddingCache(): void {
  cache.clear();
  console.log("[EmbeddingCache] Cache cleared");
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  hitRate?: string;
} {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}

/**
 * Check if a query is cached (without generating if not)
 */
export function isQueryCached(query: string): boolean {
  const key = hashQuery(query);
  const cached = cache.get(key);
  return !!(cached && Date.now() - cached.timestamp < CACHE_TTL);
}
