/**
 * Centralized Configuration Validation
 * ====================================
 *
 * This module validates all required environment variables at startup.
 * It follows the "fail fast" principle - if any required env var is missing,
 * the app crashes immediately with a clear error message.
 *
 * This is much better than discovering missing env vars at runtime when
 * a user tries to use a feature.
 */

/**
 * Helper function to validate and retrieve environment variables
 *
 * @param name - The name of the environment variable to retrieve
 * @param isPublic - Whether this is a public (NEXT_PUBLIC_*) variable
 * @returns The value of the environment variable
 * @throws Error if the environment variable is missing or empty
 */
function requireEnv(name: string, isPublic: boolean = false): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `Please add it to your .env.local file.\n` +
      `${isPublic ? 'This is a public variable (NEXT_PUBLIC_*).' : 'This is a server-side variable.'}`
    );
  }

  return value;
}

/**
 * Validate all required environment variables at module load time
 * This ensures we fail fast at startup, not at first API call
 *
 * All variables are validated when this module is imported
 */
export const CONFIG = {
  // Google AI (Gemini) - Required for LLM generation and embeddings
  GOOGLE_API_KEY: requireEnv('GOOGLE_API_KEY'),

  // Supabase - Required for database and vector storage
  SUPABASE_URL: requireEnv('NEXT_PUBLIC_SUPABASE_URL', true),
  SUPABASE_ANON_KEY: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', true),
} as const;

// Export type for autocomplete and type safety
export type Config = typeof CONFIG;

/**
 * Optional: Helper to check if we're in development mode
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Optional: Helper to check if we're in production mode
 */
export const isProduction = process.env.NODE_ENV === 'production';
