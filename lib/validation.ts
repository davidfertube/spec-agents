/**
 * Citation Validation & Structured Extraction
 * Ensures zero hallucinations by validating all claims against source documents
 */

// ============================================
// PDF File Validation
// ============================================

/**
 * Maximum PDF file size (50MB)
 * This prevents DoS attacks from extremely large uploads
 * and keeps processing times reasonable
 */
export const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB in bytes

/**
 * Validate that a file is actually a PDF by checking magic bytes
 *
 * PDF files start with: %PDF- (0x25 0x50 0x44 0x46 0x2D)
 *
 * This is a security measure - MIME types are client-controlled and can be spoofed.
 * Always validate file contents server-side using magic bytes.
 *
 * @param file - The file to validate
 * @returns Object with isValid flag and optional error message
 */
export async function validatePdfMagicBytes(file: File): Promise<{
  isValid: boolean;
  error?: string;
}> {
  try {
    // Read first 5 bytes of the file
    const buffer = await file.slice(0, 5).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
    const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2D]; // %PDF-

    // Check if the first 5 bytes match the PDF magic bytes
    const isPdf = PDF_MAGIC.every((byte, index) => bytes[index] === byte);

    if (!isPdf) {
      return {
        isValid: false,
        error: 'Invalid PDF file. The file does not appear to be a valid PDF document.',
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: 'Failed to read file. Please try again.',
    };
  }
}

// ============================================
// Query Input Validation
// ============================================

// Maximum query length (prevents DoS and excessive token usage)
const MAX_QUERY_LENGTH = 2000; // ~500 words
const MIN_QUERY_LENGTH = 3;    // Prevent empty/meaningless queries

/**
 * Validate and sanitize a user query
 *
 * This function:
 * 1. Type checks the input (must be string)
 * 2. Validates length (min 3, max 2000 characters)
 * 3. Sanitizes by removing control characters
 * 4. Normalizes whitespace
 *
 * @param query - The user query to validate
 * @returns Object with validation result, cleaned query, and optional error
 */
export function validateQuery(query: unknown): {
  isValid: boolean;
  cleanedQuery?: string;
  error?: string;
} {
  // Type check
  if (typeof query !== 'string') {
    return {
      isValid: false,
      error: 'Query must be a string',
    };
  }

  // Trim whitespace
  const trimmed = query.trim();

  // Length checks
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return {
      isValid: false,
      error: `Query too short. Please enter at least ${MIN_QUERY_LENGTH} characters.`,
    };
  }

  if (trimmed.length > MAX_QUERY_LENGTH) {
    return {
      isValid: false,
      error: `Query too long. Maximum ${MAX_QUERY_LENGTH} characters allowed.`,
    };
  }

  // Basic sanitization (remove control characters)
  const sanitized = trimmed
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
    .replace(/\s+/g, ' ');                             // Normalize whitespace

  return {
    isValid: true,
    cleanedQuery: sanitized,
  };
}

// ============================================
// Citation Validation
// ============================================

export interface ValidatedCitation {
  claim: string;
  sourceDocument: string;
  pageNumber: number;
  exactText: string;
  confidence: number;
  verified: boolean;
}

/**
 * Validate that every claim in the response has a verifiable citation
 */
export async function validateCitations(
  response: string,
  sources: Array<{ content: string; document_name: string; page_number: number }>
): Promise<{
  isValid: boolean;
  validatedCitations: ValidatedCitation[];
  unverifiedClaims: string[];
}> {
  // Extract claims from response (sentences with technical specifications)
  const claims = extractTechnicalClaims(response);

  const validatedCitations: ValidatedCitation[] = [];
  const unverifiedClaims: string[] = [];

  for (const claim of claims) {
    let verified = false;

    for (const source of sources) {
      // Check if claim exists in source with fuzzy matching
      const similarity = calculateSimilarity(claim, source.content);

      if (similarity > 0.85) {
        validatedCitations.push({
          claim,
          sourceDocument: source.document_name,
          pageNumber: source.page_number,
          exactText: extractMatchingText(claim, source.content),
          confidence: similarity,
          verified: true
        });
        verified = true;
        break;
      }
    }

    if (!verified) {
      unverifiedClaims.push(claim);
    }
  }

  return {
    isValid: unverifiedClaims.length === 0,
    validatedCitations,
    unverifiedClaims
  };
}

/**
 * Extract technical claims (specifications, requirements, values)
 */
function extractTechnicalClaims(text: string): string[] {
  const claims: string[] = [];

  // Pattern matching for technical specifications
  const patterns = [
    /(?:maximum|minimum|min|max|shall|must|required).*?(?:\d+|\w+ \d+)/gi,
    /UNS [A-Z]\d{5}/gi,
    /ASTM [A-Z]\d+/gi,
    /\d+(?:\.\d+)?%?\s*(?:HRC|HBW|ksi|MPa|°F|°C)/gi,
  ];

  const sentences = text.split(/[.!?]+/);

  for (const sentence of sentences) {
    for (const pattern of patterns) {
      if (pattern.test(sentence)) {
        claims.push(sentence.trim());
        break;
      }
    }
  }

  return claims;
}

/**
 * Calculate similarity between claim and source text
 */
function calculateSimilarity(claim: string, sourceText: string): number {
  const claimWords = claim.toLowerCase().split(/\s+/);
  const sourceWords = new Set(sourceText.toLowerCase().split(/\s+/));

  let matchCount = 0;
  for (const word of claimWords) {
    if (sourceWords.has(word) && word.length > 3) {
      matchCount++;
    }
  }

  return matchCount / claimWords.length;
}

/**
 * Extract the matching text segment from source
 */
function extractMatchingText(claim: string, sourceText: string): string {
  // Find the most similar 100-character window in source
  const claimWords = claim.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  let bestMatch = '';
  let bestScore = 0;

  for (let i = 0; i < sourceText.length - 100; i++) {
    const window = sourceText.substring(i, i + 100);
    const windowWords = new Set(window.toLowerCase().split(/\s+/));

    const score = claimWords.filter(w => windowWords.has(w)).length;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = window;
    }
  }

  return bestMatch;
}

/**
 * Structured data extraction for common queries
 */
export interface MaterialSpecification {
  grade: string;
  unsNumber: string;
  chemicalComposition: Record<string, string>;
  mechanicalProperties: {
    tensileStrength?: string;
    yieldStrength?: string;
    elongation?: string;
    hardness?: string;
  };
  heatTreatment?: {
    temperature: string;
    quenchMethod: string;
  };
  sourceDocument: string;
  pageNumbers: number[];
}

export async function extractStructuredData(
  query: string,
  sources: Array<{ content: string; document_name: string; page_number: number }>
): Promise<MaterialSpecification | null> {
  // Extract UNS number or grade from query
  const unsMatch = query.match(/UNS [A-Z]\d{5}/i);
  const gradeMatch = query.match(/(?:Grade |F)(\d{2,3}[A-Z]?)/i);

  if (!unsMatch && !gradeMatch) {
    return null;
  }

  // Search for specification in sources
  for (const source of sources) {
    const spec = parseSpecificationFromText(source.content, unsMatch?.[0], gradeMatch?.[0]);
    if (spec) {
      spec.sourceDocument = source.document_name;
      spec.pageNumbers = [source.page_number];
      return spec;
    }
  }

  return null;
}

function parseSpecificationFromText(
  text: string,
  unsNumber?: string,
  grade?: string
): MaterialSpecification | null {
  // This would implement parsing logic based on the document structure
  // For now, returning null as placeholder
  return null;
}
