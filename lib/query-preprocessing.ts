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

  /** Technical codes extracted from query (ALL matches, not just first) */
  extractedCodes: {
    /** UNS numbers (S31803, N08825, etc.) - ALL found in query */
    uns?: string[];
    /** ASTM standards (A790, A789, etc.) - ALL found in query */
    astm?: string[];
    /** API standards (5L, 5CT, etc.) - ALL found in query */
    api?: string[];
    /** Common grades (2205, 316L, etc.) - ALL found in query */
    grade?: string[];
    /** NACE references (MR0175, etc.) - ALL found in query */
    nace?: string[];
    /** Document section references (1.4, 5.5, 3.2.1, etc.) */
    sectionRef?: string[];
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
 * API standards — requires "API" prefix to avoid false positives on bare numbers
 * Examples: API 5L, API 5CT, API 6A, API 16C, API 5CRA, API-5CT
 */
const API_PATTERN = /\bAPI[\s-]+(?:SPEC(?:IFICATION)?\s+)?(\d{1,2}[A-Z]{1,4})\b/gi;

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
 * Section reference patterns
 * Explicit: "section 5.5", "clause 3.2", "paragraph 1.4"
 * Contextual: bare "1.4" or "5.5.3" when near section-related words
 */
const SECTION_EXPLICIT_PATTERN = /\b(?:section|clause|para(?:graph)?|subsection)\s*(\d+(?:\.\d+)+)/gi;
const SECTION_CONTEXT_WORDS = /\b(?:scope|about|says?|describes?|covers?|regarding|refers?\s+to|meaning\s+of|details?\s+of)\b/i;

/**
 * Property keywords that benefit from BM25
 * These often appear verbatim in spec tables
 */
const PROPERTY_KEYWORDS = [
  // Mechanical properties
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
  // Chemical elements (critical for composition queries)
  "nitrogen",
  "chromium",
  "molybdenum",
  "nickel",
  "carbon",
  "manganese",
  "phosphorus",
  "phosphorous",
  "sulfur",
  "silicon",
  "copper",
  "tungsten",
  "cobalt",
  "vanadium",
  "titanium",
  "niobium",
  "columbium",
  "aluminum",
  "boron",
  // Element symbols (for exact table matching)
  "cr",
  "mo",
  "ni",
  "mn",
  "si",
  "cu",
  "co",
  "ti",
  "nb",
  "al",
  // Heat treatment
  "temperature",
  "quenching",
  "cooling",
  // Additional technical terms
  "chemical",
  "composition",
  "requirements",
  "minimum",
  "maximum",
  "thickness",
  "tolerance",
  "permissible",
  // Plural forms (tables often use plural headings)
  "strengths",
  "temperatures",
  "tolerances",
  "properties",
  // Short forms common in tables
  "min",
  "max",
  "psi",
  // Test methods
  "flattening",
  "hydrostatic",
  "transverse",
  "longitudinal",
  // Spec section terms
  "scope",
  "marking",
  "supplementary",
  "inspection",
  "certification",
  "certificate",
  "dimensional",
  "dimensions",
];

/**
 * Domain-specific synonyms for query expansion
 * Expands technical terms to include related terms that may appear in specs
 * E.g., "yield" → "yield strength Ys 0.2% proof"
 */
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  // Mechanical properties
  yield: ["yield strength", "Ys", "0.2% proof", "offset yield"],
  tensile: ["tensile strength", "UTS", "ultimate tensile", "Rm"],
  hardness: ["HBW", "HRC", "Brinell", "Rockwell", "HV", "Vickers"],
  elongation: ["elongation at break", "El", "%El", "A%"],
  impact: ["Charpy", "impact test", "CVN", "notch toughness"],
  // Heat treatment terms
  annealing: ["solution anneal", "solution treatment", "heat treatment"],
  quench: ["quenching", "water quench", "rapid cooling"],
  // Document reference terms
  scope: ["coverage", "applicability", "specification covers"],
  requirements: ["shall", "must", "mandatory", "required"],
};

/**
 * Expand query with domain-specific synonyms
 * E.g., "minimum yield" → "minimum yield yield strength Ys 0.2% proof"
 */
function expandQueryWithSynonyms(query: string): string {
  let expanded = query;
  const lowerQuery = query.toLowerCase();

  for (const [term, synonyms] of Object.entries(DOMAIN_SYNONYMS)) {
    if (lowerQuery.includes(term)) {
      // Add synonyms at the end of the query for vector search context
      expanded += ` ${synonyms.join(" ")}`;
    }
  }
  return expanded;
}

/**
 * Element name to symbol mapping for expanding queries
 * When a user asks about "nitrogen content", we also search for "N"
 */
const ELEMENT_EXPANSIONS: Record<string, string> = {
  nitrogen: "N",
  chromium: "Cr",
  molybdenum: "Mo",
  nickel: "Ni",
  carbon: "C",
  manganese: "Mn",
  phosphorus: "P",
  phosphorous: "P",
  sulfur: "S",
  silicon: "Si",
  copper: "Cu",
  tungsten: "W",
  cobalt: "Co",
  vanadium: "V",
  titanium: "Ti",
  niobium: "Nb",
  columbium: "Nb",
  aluminum: "Al",
  boron: "B",
  iron: "Fe",
};

/**
 * Expand element names in query to include their symbols
 * E.g., "nitrogen content" → "nitrogen N content"
 */
function expandElementNames(query: string): string {
  let expanded = query;
  for (const [name, symbol] of Object.entries(ELEMENT_EXPANSIONS)) {
    const regex = new RegExp(`\\b${name}\\b`, "gi");
    if (regex.test(query)) {
      // Add the symbol after the element name
      expanded = expanded.replace(regex, `${name} ${symbol}`);
    }
  }
  return expanded;
}

/**
 * Extract section references from query text
 * Handles both explicit ("section 5.5") and contextual ("what is 1.4 about") patterns
 */
function extractSectionRefs(query: string): string[] {
  const refs = new Set<string>();

  // Explicit: "section 5.5", "clause 3.2.1"
  let match;
  const explicitPattern = new RegExp(SECTION_EXPLICIT_PATTERN.source, 'gi');
  while ((match = explicitPattern.exec(query)) !== null) {
    refs.add(match[1]);
  }

  // Contextual: bare dotted numbers like "1.4" or "5.5.3" near section-related words
  if (SECTION_CONTEXT_WORDS.test(query)) {
    const bareNumberPattern = /\b(\d+\.\d+(?:\.\d+)*)\b/g;
    while ((match = bareNumberPattern.exec(query)) !== null) {
      const num = match[1];
      // Skip version-like numbers (e.g., years 2014, 2024) and pure decimals
      // Section refs have at least one dot and first part is small (1-99)
      const firstPart = parseInt(num.split('.')[0]);
      if (firstPart < 100 && !refs.has(num)) {
        refs.add(num);
      }
    }
  }

  return refs.size > 0 ? [...refs] : [];
}

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
  // Expand element names to include symbols (e.g., "nitrogen" → "nitrogen N")
  let expandedQuery = expandElementNames(original);
  // Expand with domain synonyms (e.g., "yield" → "yield yield strength Ys 0.2% proof")
  expandedQuery = expandQueryWithSynonyms(expandedQuery);
  const upperQuery = original.toUpperCase();

  // Extract all technical codes
  const unsMatches = original.match(UNS_PATTERN) || [];
  const astmMatches = original.match(ASTM_A_PATTERN) || [];

  // API_PATTERN uses capture groups — extract the code without "API" prefix
  const apiMatches: string[] = [];
  const apiRegex = /\bAPI[\s-]+(?:SPEC(?:IFICATION)?\s+)?(\d{1,2}[A-Z]{1,4})\b/gi;
  let apiMatch;
  while ((apiMatch = apiRegex.exec(original)) !== null) {
    apiMatches.push(apiMatch[1]);
  }

  const gradeMatches = original.match(GRADE_PATTERN) || [];
  const naceMatches = [
    ...(original.match(NACE_PATTERN) || []),
    ...(original.match(ISO_15156_PATTERN) || []),
  ];
  const sectionRefs = extractSectionRefs(original);

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

  // Deduplicate and uppercase all extracted codes
  const uniqueUns = unsMatches.length > 0
    ? [...new Set(unsMatches.map(m => m.toUpperCase()))]
    : undefined;
  const uniqueAstm = astmMatches.length > 0
    ? [...new Set(astmMatches.map(m => m.toUpperCase()))]
    : undefined;
  const uniqueApi = apiMatches.length > 0
    ? [...new Set(apiMatches.map(m => m.toUpperCase()))]
    : undefined;
  const uniqueGrade = gradeMatches.length > 0
    ? [...new Set(gradeMatches.map(m => m.toUpperCase()))]
    : undefined;
  const uniqueNace = naceMatches.length > 0
    ? [...new Set(naceMatches.map(m => m.toUpperCase()))]
    : undefined;

  return {
    original,
    keywords: uniqueKeywords,
    semanticQuery: expandedQuery, // Use expanded query with element symbols
    extractedCodes: {
      uns: uniqueUns,
      astm: uniqueAstm,
      api: uniqueApi,
      grade: uniqueGrade,
      nace: uniqueNace,
      sectionRef: sectionRefs.length > 0 ? sectionRefs : undefined,
    },
    boostExactMatch: hasExactCodes || hasPropertyKeywords || sectionRefs.length > 0,
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
  // Count how many code types were found (each array counts as 1 type)
  const codeCount = [
    query.extractedCodes.uns?.length ?? 0,
    query.extractedCodes.astm?.length ?? 0,
    query.extractedCodes.api?.length ?? 0,
    query.extractedCodes.grade?.length ?? 0,
    query.extractedCodes.nace?.length ?? 0,
  ].filter(count => count > 0).length;

  // Also count total individual codes for weighting
  const totalCodes =
    (query.extractedCodes.uns?.length ?? 0) +
    (query.extractedCodes.astm?.length ?? 0) +
    (query.extractedCodes.api?.length ?? 0) +
    (query.extractedCodes.grade?.length ?? 0) +
    (query.extractedCodes.nace?.length ?? 0);

  // Section references → Strong BM25 to match "5.5" literally in chunk text
  if (query.extractedCodes.sectionRef?.length) {
    return { bm25Weight: 0.7, vectorWeight: 0.3 };
  }

  if (codeCount >= 2) {
    // Multiple codes → Heavy BM25 weight
    return { bm25Weight: 0.7, vectorWeight: 0.3 };
  }

  if (codeCount === 1) {
    // Single code → Strong BM25 for exact matching
    return { bm25Weight: 0.6, vectorWeight: 0.4 };
  }

  if (query.boostExactMatch) {
    // Property/element keywords → Moderate BM25 boost
    return { bm25Weight: 0.55, vectorWeight: 0.45 };
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
  if (codes.uns?.length) parts.push(`UNS: ${codes.uns.join(", ")}`);
  if (codes.astm?.length) parts.push(`ASTM: ${codes.astm.join(", ")}`);
  if (codes.api?.length) parts.push(`API: ${codes.api.join(", ")}`);
  if (codes.grade?.length) parts.push(`Grade: ${codes.grade.join(", ")}`);
  if (codes.nace?.length) parts.push(`NACE: ${codes.nace.join(", ")}`);
  if (codes.sectionRef?.length) parts.push(`Section: ${codes.sectionRef.join(", ")}`);
  return parts.length > 0 ? parts.join(", ") : "none";
}

/**
 * Get the primary ASTM code from extracted codes (first one)
 * Used for backwards compatibility where only one code is needed
 */
export function getPrimaryAstmCode(
  codes: ProcessedQuery["extractedCodes"]
): string | undefined {
  return codes.astm?.[0];
}

/**
 * Check if query mentions a specific specification
 * Used for document filtering
 */
export function mentionsSpec(
  codes: ProcessedQuery["extractedCodes"],
  spec: string
): boolean {
  const upperSpec = spec.toUpperCase();
  return codes.astm?.some(a => a.includes(upperSpec)) ?? false;
}
