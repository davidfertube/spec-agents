/**
 * LangFuse Observability Client
 *
 * Opt-in tracing for the RAG pipeline. Set LANGFUSE_SECRET_KEY to enable.
 * When disabled (no env var), all functions return null — zero runtime cost.
 */

import { Langfuse } from "langfuse";

let langfuseClient: Langfuse | null = null;

export function getLangfuse(): Langfuse | null {
  if (!process.env.LANGFUSE_SECRET_KEY) return null;
  if (!langfuseClient) {
    langfuseClient = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY || "",
      baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
    });
  }
  return langfuseClient;
}

/**
 * Flush pending traces. Call at the end of each request.
 */
export async function flushLangfuse(): Promise<void> {
  if (langfuseClient) {
    await langfuseClient.flushAsync();
  }
}
