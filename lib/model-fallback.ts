/**
 * Multi-Provider LLM Fallback System
 * ===================================
 *
 * Provides reliable LLM access by falling back across multiple free providers:
 * 1. Groq - 14,400 requests/day, ultra-fast (primary)
 * 2. Cerebras - 1M tokens/day, very fast
 * 3. Together AI - $25 free credits
 * 4. OpenRouter - 50-1000 requests/day, many free models
 *
 * Best models for steel specification RAG:
 * - Llama 3.1/3.3 70B: Best free option for technical accuracy
 * - Requires: accurate numerical extraction, citation following, no hallucination
 */

import Groq from "groq-sdk";

// ============================================
// Provider Configuration
// ============================================

interface ProviderConfig {
  name: string;
  baseUrl: string;
  envKey: string;
  models: string[];
  headers?: Record<string, string>;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  },
  {
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    envKey: "CEREBRAS_API_KEY",
    models: ["llama-3.3-70b", "llama-3.1-8b"],
  },
  {
    name: "Together",
    baseUrl: "https://api.together.xyz/v1",
    envKey: "TOGETHER_API_KEY",
    models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "meta-llama/Llama-3.1-8B-Instruct-Turbo"],
  },
  {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    models: ["meta-llama/llama-3.3-70b-instruct:free", "mistralai/mistral-7b-instruct:free"],
    headers: { "HTTP-Referer": "https://steel-agents.com" },
  },
];

// Export for reference
export const TEXT_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
] as const;

export const EMBEDDING_MODELS = ["voyage-3-lite"] as const;

export type TextModel = typeof TEXT_MODELS[number];
export type EmbeddingModel = typeof EMBEDDING_MODELS[number];

// ============================================
// Error Detection
// ============================================

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("rate limit") || msg.includes("quota") ||
           msg.includes("429") || msg.includes("too many") ||
           msg.includes("resource exhausted");
  }
  return false;
}

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

  async generateContent(
    prompt: string,
    _preferredModel?: string
  ): Promise<{ text: string; modelUsed: string }> {
    let lastError: Error | null = null;

    // Try each provider in order
    for (const provider of this.availableProviders) {
      const apiKey = process.env[provider.envKey]!;

      // Try each model for this provider
      for (const model of provider.models) {
        try {
          if (this.logRetries && (provider !== this.availableProviders[0] || model !== provider.models[0])) {
            console.log(`[ModelFallback] Trying ${provider.name}/${model}`);
          }

          let text: string;

          // Use Groq SDK for Groq (better error handling)
          if (provider.name === "Groq" && this.groq) {
            const completion = await this.groq.chat.completions.create({
              model,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.3,
              max_tokens: 2048,
            });
            text = completion.choices[0]?.message?.content || "";
          } else {
            // Use OpenAI-compatible API for others
            text = await callOpenAICompatible(
              provider.baseUrl,
              apiKey,
              model,
              [{ role: "user", content: prompt }],
              provider.headers
            );
          }

          if (this.logRetries && provider !== this.availableProviders[0]) {
            console.log(`[ModelFallback] Success with ${provider.name}/${model}`);
          }

          return { text, modelUsed: `${provider.name}/${model}` };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (this.logRetries) {
            console.warn(`[ModelFallback] ${provider.name}/${model} failed: ${lastError.message.slice(0, 100)}`);
          }

          // If rate limited or model error, try next
          if (isRateLimitError(error) || isModelNotFoundError(error)) {
            await sleep(300);
            continue;
          }

          // For other errors on this model, try next model
          if (!this.enableFallback) throw error;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * FREE TIER (Recommended order):
 * 1. Llama 3.3 70B (Groq/Cerebras) - Best accuracy for technical docs
 * 2. Llama 3.1 70B - Excellent numerical extraction
 * 3. Mixtral 8x7B - Good balance of speed/quality
 *
 * PAID (If budget allows):
 * 1. Claude Opus 4.5 - Best overall for technical accuracy
 * 2. GPT-4o - Strong reasoning, good citations
 * 3. Claude Sonnet 4 - Good balance cost/quality
 *
 * For this steel RAG task, Llama 3.3 70B is recommended because:
 * - Accurate numerical value extraction (yield strength, PREN, etc.)
 * - Good at following citation instructions
 * - Low hallucination rate on technical content
 * - Available free on multiple providers
 */
