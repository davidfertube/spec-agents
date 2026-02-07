/**
 * Document Mapper
 *
 * Maps specification codes (A789, A790, S32205, etc.) to document IDs.
 * Enables filtering search to specific documents when user mentions specs.
 *
 * This solves the A789/A790 confusion problem where:
 * - A789 (tubing) has S32205 yield = 70 ksi
 * - A790 (pipe) has S32205 yield = 65 ksi
 *
 * When user asks "What is S32205 yield per A790?", we now filter
 * to only search A790 documents.
 */

import { supabase } from "./supabase";

export interface DocumentMapping {
  documentId: number;
  filename: string;
  matchedCodes: string[];
}

// Cache for document mappings (refreshed periodically)
let documentCache: Map<string, number[]> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute - short TTL to pick up new uploads quickly

/**
 * Extract specification codes from a filename
 *
 * @example
 * extractCodesFromFilename("ASTM-A790-A790M-24.pdf") // ["A790"]
 * extractCodesFromFilename("897102004-ASTM-A790-A790M-24.pdf") // ["A790"]
 * extractCodesFromFilename("ASTM A789 Seamless & Welded Duplex Stainless Steel Tubing 2013.pdf") // ["A789"]
 */
function extractCodesFromFilename(filename: string): {
  astm: string[];
  uns: string[];
  api: string[];
} {
  const upper = filename.toUpperCase();

  // Extract ASTM A-series codes (A789, A790, A240, etc.)
  // Pattern matches: A789, A790, A240, A312, etc. (not followed by M which is metric indicator)
  const astmMatches = upper.match(/A\d{3,4}(?![M\d])/g) || [];
  const uniqueAstm = [...new Set(astmMatches)];

  // Extract UNS codes (S32205, N08825, etc.)
  const unsMatches = upper.match(/[SNCGHJKWRT]\d{5}/g) || [];
  const uniqueUns = [...new Set(unsMatches)];

  // Extract API spec codes (5CT, 6A, 16C, 5CRA) from filenames like
  // "API Spec 5CT Purchasing Guidelines.pdf" or "API Spec 6A Wellhead.pdf"
  const apiMatches: string[] = [];
  const apiContextMatch = upper.match(/(?:API|SPEC)\s+(\d{1,2}[A-Z]{1,4})\b/g);
  if (apiContextMatch) {
    for (const m of apiContextMatch) {
      const code = m.replace(/^(?:API|SPEC)\s+/i, '');
      if (/^\d{1,2}[A-Z]{1,3}$/.test(code)) {
        apiMatches.push(code);
      }
    }
  }
  const uniqueApi = [...new Set(apiMatches)];

  return { astm: uniqueAstm, uns: uniqueUns, api: uniqueApi };
}

/**
 * Extract specification codes from chunk content (broader matching than filename)
 * Used to catch documents with non-standard filenames like "Casing_and_Tubing_Specifications.pdf"
 */
function extractCodesFromContent(content: string): {
  astm: string[];
  api: string[];
} {
  const upper = content.toUpperCase();

  // ASTM A-series codes
  const astmMatches = upper.match(/\bA\d{3,4}(?![M\d])/g) || [];
  const uniqueAstm = [...new Set(astmMatches)];

  // API spec codes — require "API" or "SPEC" context to avoid false positives
  const apiMatches: string[] = [];
  const apiRegex = /(?:API|SPEC(?:IFICATION)?)\s+(\d{1,2}[A-Z]{1,4})\b/gi;
  let match;
  while ((match = apiRegex.exec(upper)) !== null) {
    const code = match[1];
    if (/^\d{1,2}[A-Z]{1,4}$/.test(code)) {
      apiMatches.push(code);
    }
  }
  const uniqueApi = [...new Set(apiMatches)];

  return { astm: uniqueAstm, api: uniqueApi };
}

/**
 * Refresh the document cache from database
 *
 * Builds a mapping from spec codes to document IDs.
 */
async function refreshDocumentCache(): Promise<void> {
  console.log("[Document Mapper] Refreshing document cache...");

  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, filename")
    .eq("status", "indexed");

  if (error) {
    console.error("[Document Mapper] Failed to fetch documents:", error);
    return;
  }

  if (!documents || documents.length === 0) {
    console.log("[Document Mapper] No indexed documents found");
    documentCache = new Map();
    cacheTimestamp = Date.now();
    return;
  }

  documentCache = new Map();

  for (const doc of documents) {
    const { astm, uns, api } = extractCodesFromFilename(doc.filename);

    // Map ASTM codes to document IDs
    for (const code of astm) {
      const existing = documentCache.get(code) || [];
      if (!existing.includes(doc.id)) {
        existing.push(doc.id);
        documentCache.set(code, existing);
      }
    }

    // Map UNS codes to document IDs
    for (const code of uns) {
      const existing = documentCache.get(code) || [];
      if (!existing.includes(doc.id)) {
        existing.push(doc.id);
        documentCache.set(code, existing);
      }
    }

    // Map API spec codes to document IDs
    for (const code of api) {
      const existing = documentCache.get(code) || [];
      if (!existing.includes(doc.id)) {
        existing.push(doc.id);
        documentCache.set(code, existing);
      }
    }

    console.log(
      `[Document Mapper] Document ${doc.id} (${doc.filename}): ASTM=[${astm.join(", ")}], UNS=[${uns.join(", ")}], API=[${api.join(", ")}]`
    );
  }

  // Phase 2: Extract codes from first 5 chunks per document
  // This catches documents with non-standard filenames (e.g., "Casing_and_Tubing_Specifications.pdf")
  for (const doc of documents) {
    const { data: sampleChunks } = await supabase
      .from("chunks")
      .select("content")
      .eq("document_id", doc.id)
      .limit(5);

    if (sampleChunks && sampleChunks.length > 0) {
      const combined = sampleChunks.map(c => c.content).join(" ");
      const contentCodes = extractCodesFromContent(combined);

      const addedCodes: string[] = [];
      for (const code of [...contentCodes.astm, ...contentCodes.api]) {
        const existing = documentCache.get(code) || [];
        if (!existing.includes(doc.id)) {
          existing.push(doc.id);
          documentCache.set(code, existing);
          addedCodes.push(code);
        }
      }

      if (addedCodes.length > 0) {
        console.log(
          `[Document Mapper] Document ${doc.id} content-extracted codes: [${addedCodes.join(", ")}]`
        );
      }
    }
  }

  cacheTimestamp = Date.now();
  console.log(
    `[Document Mapper] Cached ${documentCache.size} code-to-document mappings from ${documents.length} documents`
  );
}

/**
 * Get document IDs for a specific spec code
 *
 * @param code - Specification code (e.g., "A790", "S32205")
 * @returns Array of document IDs that contain this spec, or empty array
 */
export async function getDocumentIdsForCode(code: string): Promise<number[]> {
  // Refresh cache if stale
  if (!documentCache || Date.now() - cacheTimestamp > CACHE_TTL) {
    await refreshDocumentCache();
  }

  if (!documentCache) {
    return [];
  }

  return documentCache.get(code.toUpperCase()) || [];
}

/**
 * Resolve specification codes to document IDs for filtering
 *
 * Given extracted codes from a query, returns document IDs that should
 * be searched. Returns null if no filtering should be applied.
 *
 * @param codes - Extracted codes from query preprocessing
 * @returns Array of document IDs to filter to, or null for no filter
 *
 * @example
 * // User asks about A790
 * resolveSpecsToDocuments({ astm: ["A790"] })
 * // Returns [5] (ID of A790 document)
 *
 * @example
 * // User compares A789 vs A790
 * resolveSpecsToDocuments({ astm: ["A789", "A790"] })
 * // Returns [4, 5] (IDs of both documents)
 *
 * @example
 * // User asks about S32205 without specifying which spec
 * resolveSpecsToDocuments({ uns: ["S32205"] })
 * // Returns null (don't filter - search all docs)
 */
/**
 * Normalize ASTM code for lookup
 * Strips "ASTM " prefix and converts to uppercase for consistent matching
 * "ASTM A790" → "A790", "A790" → "A790", "astm a789" → "A789"
 */
function normalizeAstmCode(code: string): string {
  return code
    .replace(/^astm\s*/i, '') // Remove "ASTM " prefix (case insensitive)
    .replace(/[-/]\d{2,4}$/, '') // Remove year suffix (A790-14 → A790)
    .toUpperCase();
}

export async function resolveSpecsToDocuments(
  codes: {
    astm?: string[];
    uns?: string[];
    grade?: string[];
  },
  fullQuery?: string
): Promise<number[] | null> {
  // Refresh cache if stale
  if (!documentCache || Date.now() - cacheTimestamp > CACHE_TTL) {
    await refreshDocumentCache();
  }

  if (!documentCache) {
    console.warn("[Document Mapper] Cache unavailable, skipping filter");
    return null;
  }

  // PRIORITY: Check full query for explicit "per/according to/in AXXX" patterns
  // This catches cases where the query says "per A790" but preprocessing didn't extract it
  let rawAstmCodes = codes.astm || [];

  if (fullQuery && rawAstmCodes.length === 0) {
    // Look for patterns like "per A790", "according to A790", "in A790", "ASTM A790"
    const perPattern = /\b(?:per|according\s+to|in|from|spec|specification|under|about|of|ASTM)\s+(A\d{3,4})\b/i;
    const match = fullQuery.match(perPattern);

    if (match) {
      const extractedCode = match[1].toUpperCase();
      console.log(`[Document Mapper] Found "${match[0]}" pattern in query, extracting: ${extractedCode}`);
      rawAstmCodes = [extractedCode];
    }

    // Also catch "A789 tubing" or "A790 pipe" where spec code comes first
    if (rawAstmCodes.length === 0) {
      const codeFirstPattern = /\b(A\d{3,4})\s+(?:pipe|tubing|tube|plate|sheet|bar|cast|specification|spec|standard)\b/i;
      const codeFirstMatch = fullQuery.match(codeFirstPattern);
      if (codeFirstMatch) {
        const extractedCode = codeFirstMatch[1].toUpperCase();
        console.log(`[Document Mapper] Found code-first pattern "${codeFirstMatch[0]}" in query, extracting: ${extractedCode}`);
        rawAstmCodes = [extractedCode];
      }
    }
  }

  // Also check for API specifications in the query (e.g., "API 5CT", "API 6A", "API-5CRA")
  if (fullQuery && rawAstmCodes.length === 0) {
    const apiPattern = /\bAPI[\s-]+(?:SPEC(?:IFICATION)?\s+)?(\d{1,2}[A-Z]{1,4})\b/i;
    const apiMatch = fullQuery.match(apiPattern);
    if (apiMatch) {
      const apiCode = apiMatch[1].toUpperCase();
      const ids = documentCache.get(apiCode);
      if (ids && ids.length > 0) {
        console.log(`[Document Mapper] Found API code "${apiCode}" in query, filtering to docs: [${ids.join(", ")}]`);
        return ids;
      }
    }
  }

  // IMPORTANT: Only filter if ASTM codes are specified
  // UNS codes (S32205) appear in BOTH A789 and A790, so don't filter on UNS alone
  // This ensures "S32205 yield per A790" filters to A790, but
  // "S32205 yield" searches all documents

  if (rawAstmCodes.length === 0) {
    // No ASTM code specified - don't filter
    // This is intentional: if user just asks about S32205 without specifying
    // which spec, we search all documents
    console.log(
      "[Document Mapper] No ASTM codes in query, searching all documents"
    );
    return null;
  }

  // Normalize codes: "ASTM A790" → "A790", "A790-24" → "A790"
  const astmCodes = rawAstmCodes.map(normalizeAstmCode);
  console.log(`[Document Mapper] Normalized ASTM codes: [${astmCodes.join(", ")}] from [${rawAstmCodes.join(", ")}]`);

  // Collect document IDs that match ANY of the ASTM codes
  const documentIds = new Set<number>();

  for (const code of astmCodes) {
    const ids = documentCache.get(code);
    if (ids) {
      ids.forEach((id) => documentIds.add(id));
      console.log(`[Document Mapper] Code ${code} → documents: [${ids.join(", ")}]`);
    } else {
      console.warn(`[Document Mapper] No documents found for code: ${code}`);
    }
  }

  if (documentIds.size === 0) {
    // No documents found for any of the codes
    // This could mean the document hasn't been uploaded yet
    console.warn(
      `[Document Mapper] No documents found for ASTM codes: ${astmCodes.join(", ")}`
    );
    return null; // Fall back to searching all documents
  }

  const result = Array.from(documentIds);
  console.log(
    `[Document Mapper] Filtering to ${result.length} documents for ASTM codes: ${astmCodes.join(", ")}`
  );

  return result;
}

/**
 * Force refresh the document cache
 * Call this after uploading new documents
 */
export async function invalidateDocumentCache(): Promise<void> {
  console.log("[Document Mapper] Cache invalidated, will refresh on next query");
  documentCache = null;
  cacheTimestamp = 0;
}

/**
 * Get all cached document mappings (for debugging)
 */
export async function getDocumentMappings(): Promise<
  Map<string, number[]> | null
> {
  if (!documentCache || Date.now() - cacheTimestamp > CACHE_TTL) {
    await refreshDocumentCache();
  }
  return documentCache;
}
