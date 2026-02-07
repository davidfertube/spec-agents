/**
 * Citation validation utilities for RAG system tests.
 *
 * Extracted from citation-accuracy.test.ts to prevent import side effects
 * when other test files need these validators.
 */

export interface Source {
  ref: string;
  document: string;
  page: string;
  content_preview?: string;
  document_url?: string;
  char_offset_start?: number;
  char_offset_end?: number;
}

export interface CitationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a single source/citation
 */
export function validateCitation(source: Source): CitationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check ref format [1], [2], etc.
  if (!source.ref || !/^\[\d+\]$/.test(source.ref)) {
    errors.push(`Invalid ref format: "${source.ref}" (expected [1], [2], etc.)`);
  }

  // Check document name
  if (!source.document || source.document.length === 0) {
    errors.push('Missing document name');
  } else if (!source.document.toLowerCase().includes('.pdf')) {
    warnings.push(`Document name may not be a PDF: "${source.document}"`);
  }

  // Check page number
  const pageNum = parseInt(source.page);
  if (isNaN(pageNum) || pageNum < 1) {
    errors.push(`Invalid page number: "${source.page}" (expected positive integer)`);
  } else if (pageNum > 100) {
    warnings.push(`Unusually high page number: ${pageNum}`);
  }

  // Check character offsets for PDF highlighting
  if (source.char_offset_start === undefined) {
    warnings.push('Missing char_offset_start (PDF highlighting may not work)');
  }
  if (source.char_offset_end === undefined) {
    warnings.push('Missing char_offset_end (PDF highlighting may not work)');
  }
  if (
    source.char_offset_start !== undefined &&
    source.char_offset_end !== undefined
  ) {
    if (source.char_offset_start < 0) {
      errors.push(`Invalid char_offset_start: ${source.char_offset_start} (must be >= 0)`);
    }
    if (source.char_offset_end <= source.char_offset_start) {
      errors.push(
        `Invalid offset range: start=${source.char_offset_start}, end=${source.char_offset_end}`
      );
    }
  }

  // Check document URL
  if (!source.document_url) {
    warnings.push('Missing document_url (PDF viewer link may not work)');
  } else if (!source.document_url.startsWith('http')) {
    errors.push(`Invalid document URL: "${source.document_url}"`);
  }

  // Check content preview
  if (!source.content_preview || source.content_preview.length < 10) {
    warnings.push('Content preview is missing or too short');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate all citations in a response
 */
export function validateAllCitations(sources: Source[]): {
  allValid: boolean;
  validCount: number;
  totalCount: number;
  results: Array<{ ref: string; result: CitationValidationResult }>;
} {
  const results = sources.map(source => ({
    ref: source.ref,
    result: validateCitation(source),
  }));

  const validCount = results.filter(r => r.result.valid).length;

  return {
    allValid: validCount === sources.length,
    validCount,
    totalCount: sources.length,
    results,
  };
}

/**
 * Check if citations in response text match provided sources
 */
export function validateCitationConsistency(
  response: string,
  sources: Source[]
): {
  consistent: boolean;
  citationsInText: string[];
  citationsInSources: string[];
  missingInSources: string[];
  unusedSources: string[];
} {
  // Extract citation refs from response text
  const citationPattern = /\[(\d+)\]/g;
  const citationsInText: string[] = [];
  let match;
  while ((match = citationPattern.exec(response)) !== null) {
    const ref = `[${match[1]}]`;
    if (!citationsInText.includes(ref)) {
      citationsInText.push(ref);
    }
  }

  const citationsInSources = sources.map(s => s.ref);

  // Find citations mentioned in text but not in sources
  const missingInSources = citationsInText.filter(c => !citationsInSources.includes(c));

  // Find sources not mentioned in text
  const unusedSources = citationsInSources.filter(c => !citationsInText.includes(c));

  return {
    consistent: missingInSources.length === 0 && unusedSources.length === 0,
    citationsInText,
    citationsInSources,
    missingInSources,
    unusedSources,
  };
}
