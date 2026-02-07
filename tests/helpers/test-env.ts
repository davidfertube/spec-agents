/**
 * Shared test environment detection helpers.
 *
 * Tests use these to auto-detect whether required services are available.
 * If not, the test early-returns (vitest counts as "passed", not "skipped").
 */

/** Check if a server is reachable at the given URL. */
export async function isServerAvailable(
  url = 'http://localhost:3000'
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    });
    // HEAD may not be supported; 405 still means server is up
    return res.ok || res.status === 405;
  } catch {
    return false;
  }
}

/** Check if any LLM API key is configured in the environment. */
export function hasLLMKeys(): boolean {
  return !!(
    process.env.ANTHROPIC_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.CEREBRAS_API_KEY ||
    process.env.SAMBANOVA_API_KEY ||
    process.env.OPENROUTER_API_KEY
  );
}
