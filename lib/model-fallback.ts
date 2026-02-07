/**
 * Multi-Provider LLM Fallback System
 * ===================================
 *
 * Provides reliable LLM access by falling back across multiple providers:
 * 1. Anthropic Claude Sonnet 4.5 - Primary (best accuracy for technical RAG)
 * 2. Groq - Llama 3.3 70B (free tier fallback, ultra-fast)
 * 3. Cerebras - Llama 3.3 70B (free tier fallback)
 * 4. OpenRouter - Free models (last resort)
 *
 * Best models for steel specification RAG:
 * - Claude Sonnet 4.5: Best accuracy for technical documents, low hallucination
 * - Claude Haiku 4.5: Fast fallback for simpler queries
 * - Llama 3.3 70B: Best free option for technical accuracy
 */

import Groq from "groq-sdk";
import { sleep } from "@/lib/utils/sleep";
import { isRateLimitError } from "@/lib/utils/error-detection";
import { getLangfuse } from "@/lib/langfuse";

// ============================================
// Provider Configuration
// ============================================

interface ProviderConfig {
  name: string;
  baseUrl: string;
  envKey: string;
  models: string[];
  headers?: Record<string, string>;
  /** Estimated max input tokens — providers are skipped if prompt exceeds this */
  maxInputTokens?: number;
}

const PROVIDERS: ProviderConfig[] = [
  // Anthropic Claude - Primary provider (best technical accuracy)
  {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    envKey: "ANTHROPIC_API_KEY",
    models: ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001"],
    maxInputTokens: 100000, // 200K context window
  },
  // Fallback providers (free tiers — low TPM limits)
  {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    maxInputTokens: 4000, // 6000 TPM free tier — safety margin
  },
  {
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    envKey: "CEREBRAS_API_KEY",
    models: ["llama-3.3-70b", "llama-3.1-8b"],
    maxInputTokens: 4000,
  },
  {
    name: "SambaNova",
    baseUrl: "https://api.sambanova.ai/v1",
    envKey: "SAMBANOVA_API_KEY",
    models: ["Meta-Llama-3.3-70B-Instruct"],
    maxInputTokens: 4000,
  },
  {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    models: ["meta-llama/llama-3.3-70b-instruct", "meta-llama/llama-3.3-70b-instruct:free"],
    headers: { "HTTP-Referer": "https://steel-agents.com" },
    maxInputTokens: 12000, // Paid tier has higher limits
  },
];

// Export for reference
export const TEXT_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
] as const;

export const EMBEDDING_MODELS = ["voyage-3-lite"] as const;

export type TextModel = typeof TEXT_MODELS[number];
export type EmbeddingModel = typeof EMBEDDING_MODELS[number];

// ============================================
// Error Detection
// ============================================

// Re-export for backward compatibility
export { isRateLimitError } from "@/lib/utils/error-detection";

export function isModelNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("not found") || msg.includes("invalid model");
  }
  return false;
}

// ============================================
// OpenAI-Compatible Client
// ============================================

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletion {
  choices: Array<{ message: { content: string } }>;
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  extraHeaders?: Record<string, string>
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as ChatCompletion;
  return data.choices[0]?.message?.content || "";
}

// ============================================
// Prompt Truncation
// ============================================

/**
 * Truncate a prompt to fit within a character limit.
 * Preserves whole chunks by cutting at "\n\n---\n\n" boundaries.
 * Keeps the system prompt + first chunks, removes trailing chunks.
 */
function truncatePromptToFit(prompt: string, maxChars: number): string {
  if (prompt.length <= maxChars) return prompt;

  // Find chunk boundaries (separated by "\n\n---\n\n" in the context section)
  const separator = "\n\n---\n\n";
  const parts = prompt.split(separator);

  if (parts.length <= 1) {
    // No chunk boundaries found — hard truncate
    return prompt.slice(0, maxChars);
  }

  // Rebuild prompt keeping as many complete chunks as possible
  let result = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const candidate = result + separator + parts[i];
    if (candidate.length > maxChars) break;
    result = candidate;
  }

  return result;
}

// ============================================
// Multi-Provider Fallback Client
// ============================================

export interface ModelFallbackConfig {
  apiKey?: string; // Legacy - now uses env vars per provider
  maxRetries?: number;
  enableFallback?: boolean;
  logRetries?: boolean;
}

export class ModelFallbackClient {
  private groq: Groq | null = null;
  private maxRetries: number;
  private enableFallback: boolean;
  private logRetries: boolean;
  private availableProviders: ProviderConfig[] = [];

  constructor(config: ModelFallbackConfig = {}) {
    this.maxRetries = config.maxRetries ?? 3;
    this.enableFallback = config.enableFallback ?? true;
    this.logRetries = config.logRetries ?? true;

    // Initialize available providers based on env vars
    for (const provider of PROVIDERS) {
      const apiKey = process.env[provider.envKey];
      if (apiKey) {
        this.availableProviders.push(provider);
        if (provider.name === "Groq") {
          this.groq = new Groq({ apiKey });
        }
      }
    }

    if (this.availableProviders.length === 0) {
      throw new Error(
        "No LLM API keys configured. Set at least one of: GROQ_API_KEY, CEREBRAS_API_KEY, TOGETHER_API_KEY, or OPENROUTER_API_KEY"
      );
    }

    if (this.logRetries) {
      console.log(`[ModelFallback] Available providers: ${this.availableProviders.map(p => p.name).join(", ")}`);
    }
  }

  /**
   * Try a single provider/model combination with the given prompt.
   * Returns the response text or throws on failure.
   */
  private async tryProvider(
    provider: ProviderConfig,
    model: string,
    prompt: string,
  ): Promise<string> {
    const apiKey = process.env[provider.envKey]!;

    if (provider.name === "Groq" && this.groq) {
      const completion = await this.groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2048,
      });
      return completion.choices[0]?.message?.content || "";
    } else if (provider.name === "Anthropic") {
      const response = await fetch(`${provider.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          temperature: 0.3,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as { content: Array<{ text: string }> };
      return data.content[0]?.text || "";
    } else {
      return await callOpenAICompatible(
        provider.baseUrl,
        apiKey,
        model,
        [{ role: "user", content: prompt }],
        provider.headers
      );
    }
  }

  async generateContent(
    prompt: string,
    _preferredModel?: string
  ): Promise<{ text: string; modelUsed: string }> {
    let lastError: Error | null = null;
    const estimatedTokens = Math.ceil(prompt.length / 4);
    let skippedDueToSize = 0;

    // Try each provider in order
    for (const provider of this.availableProviders) {
      // Skip providers that can't handle the prompt size
      if (provider.maxInputTokens && estimatedTokens > provider.maxInputTokens) {
        if (this.logRetries) {
          console.log(`[ModelFallback] Skipping ${provider.name} (est. ${estimatedTokens} tokens > limit ${provider.maxInputTokens})`);
        }
        lastError = new Error(`Prompt too large for ${provider.name} (est. ${estimatedTokens} > ${provider.maxInputTokens})`);
        skippedDueToSize++;
        continue;
      }

      // Try each model for this provider
      for (const model of provider.models) {
        try {
          if (this.logRetries && (provider !== this.availableProviders[0] || model !== provider.models[0])) {
            console.log(`[ModelFallback] Trying ${provider.name}/${model}`);
          }

          const text = await this.tryProvider(provider, model, prompt);

          if (this.logRetries && provider !== this.availableProviders[0]) {
            console.log(`[ModelFallback] Success with ${provider.name}/${model}`);
          }

          // Strip <think>...</think> tags from qwen/reasoning models
          const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

          // LangFuse generation tracking (opt-in)
          try {
            getLangfuse()?.generation({
              name: "llm-call",
              model: `${provider.name}/${model}`,
              input: prompt.slice(0, 200),
              output: cleanText.slice(0, 200),
              metadata: { provider: provider.name, fullModel: model },
            });
          } catch { /* tracing should never block generation */ }

          return { text: cleanText, modelUsed: `${provider.name}/${model}` };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (this.logRetries) {
            console.warn(`[ModelFallback] ${provider.name}/${model} failed: ${lastError.message.slice(0, 100)}`);
          }

          // If rate limited, use progressive backoff then try next
          if (isRateLimitError(error)) {
            const providerIdx = this.availableProviders.indexOf(provider);
            const modelIdx = provider.models.indexOf(model);
            const backoffMs = Math.min(500 * Math.pow(2, providerIdx + modelIdx), 4000);
            if (this.logRetries) {
              console.log(`[ModelFallback] Rate limited on ${provider.name}/${model}, backing off ${backoffMs}ms`);
            }
            await sleep(backoffMs);
            continue;
          }
          // Model not found — skip immediately, no backoff needed
          if (isModelNotFoundError(error)) {
            continue;
          }

          // For other errors on this model, try next model
          if (!this.enableFallback) throw error;
        }
      }
    }

    // If providers were skipped due to prompt size, retry with truncated prompt
    if (skippedDueToSize > 0) {
      const truncatedPrompt = truncatePromptToFit(prompt, 4000 * 4); // ~4000 tokens
      if (truncatedPrompt.length < prompt.length) {
        if (this.logRetries) {
          console.log(`[ModelFallback] Retrying ${skippedDueToSize} skipped providers with truncated prompt (${prompt.length} → ${truncatedPrompt.length} chars)`);
        }

        for (const provider of this.availableProviders) {
          // Only retry providers that were skipped
          if (!provider.maxInputTokens || estimatedTokens <= provider.maxInputTokens) continue;

          for (const model of provider.models) {
            try {
              if (this.logRetries) {
                console.log(`[ModelFallback] Trying ${provider.name}/${model} (truncated)`);
              }
              const text = await this.tryProvider(provider, model, truncatedPrompt);
              const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

              if (this.logRetries) {
                console.log(`[ModelFallback] Success with ${provider.name}/${model} (truncated)`);
              }
              return { text: cleanText, modelUsed: `${provider.name}/${model}` };
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error));
              if (this.logRetries) {
                console.warn(`[ModelFallback] ${provider.name}/${model} (truncated) failed: ${lastError.message.slice(0, 100)}`);
              }
              if (isRateLimitError(error)) {
                await sleep(500);
                continue;
              }
              if (isModelNotFoundError(error)) continue;
              if (!this.enableFallback) throw error;
            }
          }
        }
      }
    }

    throw new Error(`All providers failed. Last error: ${lastError?.message || "Unknown"}`);
  }

  async generateContentWithRetry(
    prompt: string,
    modelName?: string
  ): Promise<string> {
    const result = await this.generateContent(prompt, modelName);
    return result.text;
  }
}

// ============================================
// Embedding Rate Limiter
// ============================================

export class EmbeddingRateLimiter {
  private lastRequestTime: number = 0;
  private minDelayMs: number;

  constructor(requestsPerMinute: number = 80) {
    this.minDelayMs = Math.ceil(60000 / requestsPerMinute);
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await sleep(this.minDelayMs - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  reset(): void {
    this.lastRequestTime = 0;
  }
}

// ============================================
// Singleton Instances
// ============================================

let modelFallbackClient: ModelFallbackClient | null = null;
let embeddingRateLimiter: EmbeddingRateLimiter | null = null;

export function getModelFallbackClient(): ModelFallbackClient {
  if (!modelFallbackClient) {
    modelFallbackClient = new ModelFallbackClient({
      maxRetries: 3,
      enableFallback: true,
      logRetries: process.env.NODE_ENV !== "production",
    });
  }
  return modelFallbackClient;
}

export function getEmbeddingRateLimiter(): EmbeddingRateLimiter {
  if (!embeddingRateLimiter) {
    embeddingRateLimiter = new EmbeddingRateLimiter(80);
  }
  return embeddingRateLimiter;
}

// ============================================
// Model Recommendations
// ============================================

/**
 * Best models for steel specification RAG tasks:
 *
 * PRIMARY (Current):
 * 1. Claude Sonnet 4.5 - Best accuracy for technical docs, excellent citation following
 * 2. Claude Haiku 4.5 - Fast fallback, good for simpler queries
 *
 * FREE TIER FALLBACKS:
 * 1. Llama 3.3 70B (Groq/Cerebras) - Best free option for technical accuracy
 * 2. Llama 3.1 8B - Fast but less accurate, emergency fallback
 *
 * Claude Sonnet 4.5 is recommended for steel RAG because:
 * - Superior numerical value extraction (yield strength, PREN, etc.)
 * - Excellent at following citation instructions
 * - Very low hallucination rate on technical content
 * - Better table interpretation and data extraction from context
 */
