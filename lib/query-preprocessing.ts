/**
 * Query preprocessing for hybrid search
 *
 * Extracts technical codes (UNS numbers, ASTM standards, grades) for exact
 * matching while preserving semantic query for vector search.
 *
 * This is critical for steel specifications where users often search for
 * exact codes like "S31803" or "A790" that pure vector search might miss.
 */

export interface ProcessedQuery {
  /** Original query string */
  original: string;

  /** Keywords extracted for BM25 boost */
  keywords: string[];

  /** Query for vector embedding (usually same as original) */
  semanticQuery: string;

  /** Technical codes extracted from query */
  extractedCodes: {
    /** UNS numbers (S31803, N08825, etc.) */
    uns?: string;
    /** ASTM standards (A790, A789, etc.) */
    astm?: string;
    /** API standards (5L, 5CT, etc.) */
    api?: string;
    /** Common grades (2205, 316L, etc.) */
    grade?: string;
    /** NACE references (MR0175, etc.) */
    nace?: string;
  };

  /** True if query contains technical codes that benefit from BM25 */
  boostExactMatch: boolean;
}

// ============================================================================
// Pattern Definitions for Technical Codes
// ============================================================================

/**
 * UNS (Unified Numbering System) patterns
 * Format: Letter + 5 digits
 * S = Stainless steels (S31803, S32750)
 * N = Nickel alloys (N08825, N06625)
 * C = Copper alloys
 * G = Carbon/alloy steels
 * H = AISI H-steels
 * J = Cast steels
 * K = Misc steels
 * W = Welding filler metals
 * R = Reactive metals (Ti, Zr)
 * T = Tool steels
 */
const UNS_PATTERN = /\b[SNCGHJKWRT]\d{5}\b/gi;

/**
 * ASTM A-series standards (ferrous metals)
 * Examples: A790, A789, A240, A106, A312
 * Also matches with year suffix: A790-14, A790/2014
 */
const ASTM_A_PATTERN = /\b(?:ASTM\s*)?A\d{3,4}(?:[/-]\d{2,4})?\b/gi;

/**
 * API standards
 * Examples: API 5L, API 5CT, API 6A
 */
const API_PATTERN = /\b(?:API\s+)?\d{1,2}[A-Z]{0,2}(?:T|L|CT)?\b/gi;

/**
 * Common duplex and stainless steel grades
 * Duplex: 2205, 2507, 2304, etc.
 * Austenitic: 304, 304L, 316, 316L, 317L, 321, 347
 * Martensitic: 410, 420
 * Ferritic: 430, 446
 */
const GRADE_PATTERN = /\b(?:2205|2507|2304|2101|316L?|304L?|317L?|321|347|410|420|430|446)\b/gi;

/**
 * NACE standards for sour service
 * Examples: NACE MR0175, MR0103, ISO 15156
 */
const NACE_PATTERN = /\b(?:NACE\s*)?MR\d{4}(?:\/ISO\s*\d+)?\b/gi;
const ISO_15156_PATTERN = /\bISO\s*15156(?:-\d+)?\b/gi;

/**
 * Property keywords that benefit from BM25
 * These often appear verbatim in spec tables
 */
const PROPERTY_KEYWORDS = [
  "yield",
  "tensile",
  "elongation",
  "hardness",
  "hrc",
  "hbw",
  "hvn",
  "pren",
  "charpy",
  "impact",
  "ksi",
  "mpa",
  "ferrite",
  "austenite",
  "annealing",
  "solution",
  "quench",
  "temper",
];

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Preprocess a query to extract technical codes and determine search strategy
 *
 * @param query - The user's search query
 * @returns Processed query with extracted codes and search strategy
 *
 * @example
 * preprocessQuery("What is the yield strength of UNS S31803?")
 * // Returns:
 * // {
 * //   original: "What is the yield strength of UNS S31803?",
 * //   keywords: ["S31803", "YIELD", "STRENGTH"],
 * //   extractedCodes: { uns: "S31803" },
 * //   boostExactMatch: true
 * // }
 */
export function preprocessQuery(query: string): ProcessedQuery {
  const original = query.trim();
  const upperQuery = original.toUpperCase();

  // Extract all technical codes
  const unsMatches = original.match(UNS_PATTERN) || [];
  const astmMatches = original.match(ASTM_A_PATTERN) || [];
  const apiMatches = original.match(API_PATTERN) || [];
  const gradeMatches = original.match(GRADE_PATTERN) || [];
  const naceMatches = [
    ...(original.match(NACE_PATTERN) || []),
    ...(original.match(ISO_15156_PATTERN) || []),
  ];

  // Determine if we should boost exact matches
  // Any technical code warrants BM25 boosting
  const hasExactCodes =
    unsMatches.length > 0 ||
    astmMatches.length > 0 ||
    gradeMatches.length > 0 ||
    naceMatches.length > 0;

  // Check for property keywords
  const hasPropertyKeywords = PROPERTY_KEYWORDS.some((keyword) =>
    upperQuery.includes(keyword.toUpperCase())
  );

  // Build keywords list for BM25
  const keywords = [
    ...unsMatches,
    ...astmMatches,
    ...apiMatches,
    ...gradeMatches,
    ...naceMatches,
    ...extractSignificantKeywords(original),
  ]
    .map((k) => k.toUpperCase().trim())
    .filter((k) => k.length > 1);

  // Deduplicate keywords
  const uniqueKeywords = [...new Set(keywords)];

  return {
    original,
    keywords: uniqueKeywords,
    semanticQuery: original,
    extractedCodes: {
      uns: unsMatches[0]?.toUpperCase(),
      astm: astmMatches[0]?.toUpperCase(),
      api: apiMatches[0]?.toUpperCase(),
      grade: gradeMatches[0]?.toUpperCase(),
      nace: naceMatches[0]?.toUpperCase(),
    },
    boostExactMatch: hasExactCodes || hasPropertyKeywords,
  };
}

/**
 * Determine optimal search weights based on query characteristics
 *
 * @param query - Processed query
 * @returns Weights for BM25 and vector search
 *
 * Strategy:
 * - Queries with exact codes (UNS, ASTM) → Equal weight (0.5/0.5)
 * - Semantic queries without codes → Favor vector (0.3/0.7)
 */
export function getSearchWeights(query: ProcessedQuery): {
  bm25Weight: number;
  vectorWeight: number;
} {
  // Count how many code types were found
  const codeCount = [
    query.extractedCodes.uns,
    query.extractedCodes.astm,
    query.extractedCodes.api,
    query.extractedCodes.grade,
    query.extractedCodes.nace,
  ].filter(Boolean).length;

  if (codeCount >= 2) {
    // Multiple codes → Heavy BM25 weight
    return { bm25Weight: 0.6, vectorWeight: 0.4 };
  }

  if (codeCount === 1 || query.boostExactMatch) {
    // Single code or property keywords → Balanced
    return { bm25Weight: 0.5, vectorWeight: 0.5 };
  }

  // Pure semantic query → Favor vector
  return { bm25Weight: 0.3, vectorWeight: 0.7 };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Stop words to filter from keyword extraction
 * These are common words that don't help with search relevance
 */
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "need",
  "what",
  "which",
  "who",
  "when",
  "where",
  "why",
  "how",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "and",
  "or",
  "but",
  "not",
  "if",
  "as",
  "so",
  "than",
  "then",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "again",
  "further",
  "once",
  "here",
  "there",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "only",
  "own",
  "same",
  "too",
  "very",
  "just",
  "also",
]);

/**
 * Extract significant keywords from query text
 * Filters out stop words and keeps technical terms
 *
 * @param query - The query text
 * @returns Array of significant keywords
 */
function extractSignificantKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ") // Keep hyphens for compound terms
    .split(/\s+/)
    .filter((word) => {
      // Skip short words
      if (word.length < 3) return false;
      // Skip stop words
      if (STOP_WORDS.has(word)) return false;
      // Keep the word
      return true;
    });
}

/**
 * Format extracted codes for logging/debugging
 *
 * @param codes - Extracted codes object
 * @returns Human-readable string of found codes
 */
export function formatExtractedCodes(
  codes: ProcessedQuery["extractedCodes"]
): string {
  const parts: string[] = [];
  if (codes.uns) parts.push(`UNS: ${codes.uns}`);
  if (codes.astm) parts.push(`ASTM: ${codes.astm}`);
  if (codes.api) parts.push(`API: ${codes.api}`);
  if (codes.grade) parts.push(`Grade: ${codes.grade}`);
  if (codes.nace) parts.push(`NACE: ${codes.nace}`);
  return parts.length > 0 ? parts.join(", ") : "none";
}
