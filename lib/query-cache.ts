/**
 * RAG Query Response Cache
 *
 * In-memory LRU cache for RAG query results. Caches the full response
 * (text + sources + confidence) so repeated identical queries skip
 * the entire pipeline — ~0ms instead of 30-90s.
 *
 * Design decisions:
 * - In-memory (not Redis) — sufficient for single Vercel instance
 * - Short TTL (5 min) — specs don't change but fresh queries get fresh results
 * - Normalized key — "What is yield?" and "what is yield?" hit same cache entry
 * - Max 200 entries — ~2MB memory at 10KB avg response size
 */

interface CachedResponse {
  response: string;
  sources: unknown[];
  confidence: {
    overall: number;
    retrieval: number;
    grounding: number;
    coherence: number;
  };
  cachedAt: number;
}

const cache = new Map<string, CachedResponse>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 200;

/**
 * Normalize a query string for cache key lookup.
 * Strips whitespace, lowercases, removes trailing punctuation.
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[?.!]+$/, "");
}

/**
 * Look up a cached response for a query.
 * Returns null if not found or expired.
 */
export function getCachedResponse(query: string): CachedResponse | null {
  const key = normalizeQuery(query);
  const entry = cache.get(key);

  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.cachedAt > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  console.log(`[Query Cache] HIT for "${query.slice(0, 60)}..." (age: ${Math.round((Date.now() - entry.cachedAt) / 1000)}s)`);
  return entry;
}

/**
 * Store a response in the cache.
 */
export function setCachedResponse(
  query: string,
  response: string,
  sources: unknown[],
  confidence: CachedResponse["confidence"]
): void {
  const key = normalizeQuery(query);

  // Evict oldest entries if at capacity
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const toEvict = oldest.slice(0, Math.ceil(MAX_CACHE_SIZE * 0.2)); // Evict 20%
    for (const [evictKey] of toEvict) {
      cache.delete(evictKey);
    }
    console.log(`[Query Cache] Evicted ${toEvict.length} oldest entries`);
  }

  cache.set(key, {
    response,
    sources,
    confidence,
    cachedAt: Date.now(),
  });

  console.log(`[Query Cache] STORED "${query.slice(0, 60)}..." (cache size: ${cache.size})`);
}

/**
 * Get cache stats for debugging.
 */
export function getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return { size: cache.size, maxSize: MAX_CACHE_SIZE, ttlMs: CACHE_TTL };
}
