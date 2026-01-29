/**
 * Claim Verification Engine
 *
 * Verifies factual claims against source documents to catch hallucinations.
 * Uses fuzzy matching for text and exact matching for numerical values.
 */

import type { Claim, StructuredResponse } from "./structured-output";
import { extractNumericalValues } from "./structured-output";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of verifying a single claim
 */
export interface ClaimVerificationResult {
  /** The original claim text */
  claim: string;
  /** Source reference from the claim */
  source_ref: string;
  /** Whether the claim was verified against the source */
  verified: boolean;
  /** Match score 0-100 for the exact quote */
  quote_match_score: number;
  /** Whether all numerical values were found in source */
  numbers_verified: boolean;
  /** Numbers found in the claim */
  claim_numbers: number[];
  /** Numbers found in the source */
  source_numbers: number[];
  /** The source text used for verification */
  source_text: string;
  /** Detailed discrepancy if verification failed */
  discrepancy?: string;
}

/**
 * Overall verification result for a response
 */
export interface VerificationResult {
  /** Individual claim verification results */
  claims: ClaimVerificationResult[];
  /** Overall verification statistics */
  stats: {
    total_claims: number;
    verified_claims: number;
    failed_claims: number;
    verification_rate: number;
    numbers_checked: number;
    numbers_verified: number;
  };
  /** Overall verification passed */
  passed: boolean;
  /** Confidence score 0-100 */
  confidence: number;
  /** Warning messages */
  warnings: string[];
}

/**
 * Source chunk for verification
 */
export interface SourceChunk {
  ref: string;
  content: string;
  document?: string;
  page?: number;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Verify all claims in a structured response against source documents
 *
 * @param response - The structured LLM response
 * @param sources - Source chunks used for the response
 * @returns Verification result with details for each claim
 */
export function verifyClaims(
  response: StructuredResponse,
  sources: SourceChunk[]
): VerificationResult {
  const results: ClaimVerificationResult[] = [];
  const warnings: string[] = [];

  // Build source lookup map
  const sourceMap = new Map<string, SourceChunk>();
  sources.forEach((s, i) => {
    // Handle both [1] and [1] formats
    sourceMap.set(`[${i + 1}]`, s);
    sourceMap.set(s.ref, s);
  });

  // Verify each claim
  for (const claim of response.claims) {
    const result = verifyClaimAgainstSource(claim, sourceMap);
    results.push(result);
  }

  // Calculate statistics
  const verifiedClaims = results.filter((r) => r.verified);
  const failedClaims = results.filter((r) => !r.verified);
  const totalNumbers = results.reduce((sum, r) => sum + r.claim_numbers.length, 0);
  const verifiedNumbers = results.reduce(
    (sum, r) => sum + (r.numbers_verified ? r.claim_numbers.length : 0),
    0
  );

  // Generate warnings
  if (failedClaims.length > 0) {
    const numericalFails = failedClaims.filter((r) => r.claim_numbers.length > 0);
    if (numericalFails.length > 0) {
      warnings.push(
        `${numericalFails.length} claims with numerical values could not be verified`
      );
    }
  }

  // Check for low confidence claims
  const lowConfidenceClaims = response.claims.filter((c) => c.confidence === "low");
  if (lowConfidenceClaims.length > 0) {
    warnings.push(`${lowConfidenceClaims.length} claims have low confidence`);
  }

  // Calculate overall confidence
  const verificationRate =
    results.length > 0 ? (verifiedClaims.length / results.length) * 100 : 100;
  const numberVerificationRate =
    totalNumbers > 0 ? (verifiedNumbers / totalNumbers) * 100 : 100;

  // Weighted confidence: 60% claim verification, 40% number verification
  const confidence = verificationRate * 0.6 + numberVerificationRate * 0.4;

  return {
    claims: results,
    stats: {
      total_claims: results.length,
      verified_claims: verifiedClaims.length,
      failed_claims: failedClaims.length,
      verification_rate: verificationRate,
      numbers_checked: totalNumbers,
      numbers_verified: verifiedNumbers,
    },
    passed: confidence >= 70 && failedClaims.filter((r) => r.claim_numbers.length > 0).length === 0,
    confidence: Math.round(confidence),
    warnings,
  };
}

/**
 * Verify a single claim against its source
 */
function verifyClaimAgainstSource(
  claim: Claim,
  sourceMap: Map<string, SourceChunk>
): ClaimVerificationResult {
  // Find the source chunk
  const source = sourceMap.get(claim.source_ref);

  if (!source) {
    return {
      claim: claim.claim,
      source_ref: claim.source_ref,
      verified: false,
      quote_match_score: 0,
      numbers_verified: false,
      claim_numbers: extractNumbersFromText(claim.claim),
      source_numbers: [],
      source_text: "",
      discrepancy: `Source reference ${claim.source_ref} not found`,
    };
  }

  // Calculate quote match score
  const quoteMatchScore = claim.exact_quote
    ? fuzzyMatch(claim.exact_quote, source.content)
    : 0;

  // Extract and verify numerical values
  const claimNumbers = extractNumbersFromText(claim.claim);
  const sourceNumbers = extractNumbersFromText(source.content);
  const numbersVerified = verifyNumbers(claimNumbers, sourceNumbers);

  // Determine verification status
  const verified =
    (quoteMatchScore >= 60 || claim.exact_quote.length === 0) &&
    (claimNumbers.length === 0 || numbersVerified);

  // Build discrepancy message if verification failed
  let discrepancy: string | undefined;
  if (!verified) {
    const issues: string[] = [];
    if (quoteMatchScore < 60 && claim.exact_quote.length > 0) {
      issues.push(`Quote match score ${quoteMatchScore}% below threshold (60%)`);
    }
    if (claimNumbers.length > 0 && !numbersVerified) {
      const missing = claimNumbers.filter(
        (n) => !sourceNumbers.some((sn) => Math.abs(n - sn) < 0.01)
      );
      issues.push(`Numbers not found in source: ${missing.join(", ")}`);
    }
    discrepancy = issues.join("; ");
  }

  return {
    claim: claim.claim,
    source_ref: claim.source_ref,
    verified,
    quote_match_score: quoteMatchScore,
    numbers_verified: numbersVerified,
    claim_numbers: claimNumbers,
    source_numbers: sourceNumbers,
    source_text: source.content.substring(0, 300),
    discrepancy,
  };
}

// ============================================================================
// Verification Utilities
// ============================================================================

/**
 * Extract numerical values from text as array of numbers
 */
function extractNumbersFromText(text: string): number[] {
  const extracted = extractNumericalValues(text);
  return extracted.map((e) => e.value);
}

/**
 * Verify that all claim numbers exist in source numbers
 *
 * Allows for small float differences (0.01 tolerance)
 */
function verifyNumbers(claimNumbers: number[], sourceNumbers: number[]): boolean {
  if (claimNumbers.length === 0) return true;

  return claimNumbers.every((claimNum) =>
    sourceNumbers.some((sourceNum) => Math.abs(claimNum - sourceNum) < 0.01)
  );
}

/**
 * Fuzzy match two strings and return similarity score (0-100)
 *
 * Uses Levenshtein distance normalized by string length
 */
export function fuzzyMatch(needle: string, haystack: string): number {
  // Normalize strings
  const normalizedNeedle = normalizeText(needle);
  const normalizedHaystack = normalizeText(haystack);

  // Check if needle is contained in haystack (best case)
  if (normalizedHaystack.includes(normalizedNeedle)) {
    return 100;
  }

  // For longer strings, use word-based matching
  if (normalizedNeedle.length > 50) {
    return wordBasedMatch(normalizedNeedle, normalizedHaystack);
  }

  // For shorter strings, use character-based Levenshtein
  const distance = levenshteinDistance(normalizedNeedle, normalizedHaystack);

  // Calculate score relative to needle length (since haystack may be much longer)
  const score = 100 - (distance / normalizedNeedle.length) * 100;
  return Math.max(0, Math.round(score));
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Word-based matching for longer strings
 */
function wordBasedMatch(needle: string, haystack: string): number {
  const needleWords = new Set(needle.split(/\s+/).filter((w) => w.length > 2));
  const haystackWords = new Set(haystack.split(/\s+/));

  let matchCount = 0;
  for (const word of needleWords) {
    if (haystackWords.has(word)) {
      matchCount++;
    }
  }

  return Math.round((matchCount / needleWords.size) * 100);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  // Limit comparison to avoid performance issues
  const s1 = a.substring(0, 200);
  const s2 = b.substring(0, 200);

  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[s1.length][s2.length];
}

// ============================================================================
// Guardrails
// ============================================================================

/**
 * Guardrail action based on verification result
 */
export type GuardrailAction = "return" | "regenerate" | "refuse";

/**
 * Apply guardrails to verification result
 *
 * Determines whether to return the response, regenerate, or refuse
 */
export function applyGuardrails(
  verification: VerificationResult,
  response: StructuredResponse
): {
  action: GuardrailAction;
  reason: string;
} {
  // If no claims and no documents, refuse to make up answers
  if (
    verification.stats.total_claims === 0 &&
    response.source_type === "documents"
  ) {
    return {
      action: "refuse",
      reason: "No verifiable claims found in response",
    };
  }

  // Critical: Numerical claims that failed verification
  const numericalFailures = verification.claims.filter(
    (c) => !c.verified && c.claim_numbers.length > 0
  );

  if (numericalFailures.length > 0) {
    // If more than half of numerical claims failed, refuse
    const totalNumerical = verification.claims.filter(
      (c) => c.claim_numbers.length > 0
    ).length;
    if (numericalFailures.length > totalNumerical / 2) {
      return {
        action: "refuse",
        reason: `${numericalFailures.length} of ${totalNumerical} numerical claims could not be verified`,
      };
    }
    // Otherwise try to regenerate
    return {
      action: "regenerate",
      reason: `${numericalFailures.length} numerical claims failed verification`,
    };
  }

  // High confidence - return
  if (verification.confidence >= 90) {
    return {
      action: "return",
      reason: "High confidence response",
    };
  }

  // Acceptable confidence with warnings - return
  if (verification.confidence >= 70) {
    return {
      action: "return",
      reason: "Acceptable confidence with warnings",
    };
  }

  // Low confidence - try to regenerate
  if (verification.confidence >= 50) {
    return {
      action: "regenerate",
      reason: `Confidence ${verification.confidence}% below threshold (70%)`,
    };
  }

  // Very low confidence - refuse
  return {
    action: "refuse",
    reason: `Confidence ${verification.confidence}% too low`,
  };
}

/**
 * Generate a refusal response when verification fails
 */
export function generateRefusalResponse(
  query: string,
  documentsSearched: string[],
  reason: string
): string {
  return `I could not find verified information to answer this question in the uploaded documents.

**What I searched:**
"${query}"

**Documents checked:**
${documentsSearched.length > 0 ? documentsSearched.map((d) => `- ${d}`).join("\n") : "- No documents uploaded"}

**Reason:**
${reason}

**Possible issues:**
1. The specific information may not be in these documents
2. The question may require a different specification
3. The question may need multiple documents that reference each other

**Recommendation:**
Please verify you've uploaded the correct specification PDF, or rephrase your question to be more specific about what you're looking for.`;
}
