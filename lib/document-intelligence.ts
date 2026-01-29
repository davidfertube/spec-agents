/**
 * Document Intelligence for Zero Hallucination Pipeline
 *
 * Understands document structure before chunking. Detects document types,
 * extracts tables, and applies schema-aware processing.
 *
 * Key features:
 * - Document type detection (ASTM, API, NACE, MTR, etc.)
 * - Table extraction and preservation
 * - Schema-based processing for known document types
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Detected document type
 */
export type DocumentType =
  | "ASTM"
  | "API"
  | "NACE"
  | "ISO"
  | "MTR"
  | "DATASHEET"
  | "UNKNOWN";

/**
 * Document metadata extracted from filename and content
 */
export interface DocumentMetadata {
  /** Detected document type */
  type: DocumentType;
  /** Standard number if applicable (e.g., "A790", "5L", "MR0175") */
  standard?: string;
  /** Revision/year if found */
  revision?: string;
  /** Material grades mentioned (e.g., ["S31803", "S32750"]) */
  materials: string[];
  /** Confidence in detection (0-100) */
  confidence: number;
}

/**
 * Extracted document element
 */
export interface DocumentElement {
  /** Element type */
  type: "title" | "heading" | "paragraph" | "table" | "list" | "note";
  /** Text content */
  content: string;
  /** Page number in source document */
  page: number;
  /** Additional metadata */
  metadata: {
    /** For tables: table title or caption */
    table_title?: string;
    /** For tables: HTML representation if available */
    table_html?: string;
    /** For headings: heading level (1-6) */
    heading_level?: number;
    /** Section identifier if applicable */
    section?: string;
  };
}

/**
 * Structured chunk with type information
 */
export interface StructuredChunk {
  /** Chunk content */
  content: string;
  /** Page number */
  page_number: number;
  /** Element type */
  type: "table" | "narrative" | "heading" | "mixed";
  /** Associated metadata */
  metadata: {
    /** Table title if chunk is a table */
    table_title?: string;
    /** Section identifier */
    section?: string;
    /** Document type context */
    document_type?: DocumentType;
    /** Standard reference */
    standard?: string;
  };
}

// ============================================================================
// Document Type Detection
// ============================================================================

/**
 * Detection patterns for document types
 */
const DOCUMENT_PATTERNS = {
  ASTM: {
    filename: /ASTM[_\s-]?A?\d{3,4}/i,
    content: /ASTM\s+[A-Z]\d{3,4}|Standard\s+Specification\s+for/i,
    standard: /ASTM\s+([A-Z]\d{3,4})(?:[/-](\d{2,4}))?/i,
  },
  API: {
    filename: /API[_\s-]?\d{1,2}[A-Z]*/i,
    content: /API\s+\d{1,2}[A-Z]*|API\s+Spec(?:ification)?/i,
    standard: /API\s+(\d{1,2}[A-Z]*)(?:\s+(\d{2,4}))?/i,
  },
  NACE: {
    filename: /NACE[_\s-]?MR\d{4}|ISO[_\s-]?15156/i,
    content: /NACE\s+MR\d{4}|ISO\s+15156|sour\s+service/i,
    standard: /(?:NACE\s+)?(MR\d{4})(?:\/ISO\s*15156)?/i,
  },
  ISO: {
    filename: /ISO[_\s-]?\d{4,5}/i,
    content: /ISO\s+\d{4,5}/i,
    standard: /ISO\s+(\d{4,5})(?:-(\d+))?/i,
  },
  MTR: {
    filename: /MTR|Mill\s*Test|Material\s*Test/i,
    content: /Mill\s+Test\s+Report|Material\s+Test\s+Report|EN\s*10204|Heat\s+Number/i,
    standard: /EN\s*(10204)(?:\s+(\d\.\d))?/i,
  },
  DATASHEET: {
    filename: /datasheet|data\s*sheet|product\s*data/i,
    content: /Data\s+Sheet|Product\s+Information|Technical\s+Data/i,
    standard: null,
  },
};

/**
 * UNS number patterns for material detection
 */
const UNS_PATTERNS = {
  stainless: /\b(S\d{5})\b/gi, // S31803, S32750
  nickel: /\b(N\d{5})\b/gi, // N08825, N06625
  copper: /\b(C\d{5})\b/gi,
  titanium: /\b(R\d{5})\b/gi,
};

/**
 * Detect document type from filename and first page content
 *
 * @param filename - The document filename
 * @param firstPageContent - Text content from first page
 * @returns Document metadata with type and extracted info
 */
export function detectDocumentType(
  filename: string,
  firstPageContent: string
): DocumentMetadata {
  const results: Array<{ type: DocumentType; score: number; match: RegExpMatchArray | null }> = [];

  // Check each document type pattern
  for (const [docType, patterns] of Object.entries(DOCUMENT_PATTERNS)) {
    let score = 0;
    let standardMatch: RegExpMatchArray | null = null;

    // Check filename
    if (patterns.filename.test(filename)) {
      score += 40;
    }

    // Check content
    if (patterns.content.test(firstPageContent)) {
      score += 40;
    }

    // Extract standard number
    if (patterns.standard) {
      standardMatch = firstPageContent.match(patterns.standard) || filename.match(patterns.standard);
      if (standardMatch) {
        score += 20;
      }
    }

    if (score > 0) {
      results.push({ type: docType as DocumentType, score, match: standardMatch });
    }
  }

  // Sort by score and get best match
  results.sort((a, b) => b.score - a.score);
  const best = results[0];

  // Extract materials (UNS numbers)
  const materials: string[] = [];
  for (const pattern of Object.values(UNS_PATTERNS)) {
    const matches = firstPageContent.match(pattern) || [];
    materials.push(...matches.map((m) => m.toUpperCase()));
  }

  // Also extract common grades
  const gradeMatches = firstPageContent.match(/\b(2205|2507|2304|316L?|304L?|317L?|321|347)\b/gi) || [];
  materials.push(...gradeMatches.map((m) => m.toUpperCase()));

  // Deduplicate materials
  const uniqueMaterials = [...new Set(materials)];

  if (!best || best.score < 20) {
    return {
      type: "UNKNOWN",
      materials: uniqueMaterials,
      confidence: 0,
    };
  }

  return {
    type: best.type,
    standard: best.match?.[1]?.toUpperCase(),
    revision: best.match?.[2],
    materials: uniqueMaterials,
    confidence: Math.min(100, best.score),
  };
}

// ============================================================================
// Table Detection and Extraction
// ============================================================================

/**
 * Table detection patterns
 */
const TABLE_PATTERNS = {
  // Table headers/captions
  tableStart: /^(?:Table\s+\d+|TABLE\s+\d+)[:\s—–-]+(.*)$/gim,
  // Common table column headers in steel specs
  columnHeaders: /(?:Grade|UNS|Tensile|Yield|Elongation|Hardness|Composition|Chemical|Mechanical)/i,
  // Table-like data rows (multiple values separated by tabs or spaces)
  dataRow: /^[\w\d./-]+(?:\s{2,}|\t)[\w\d./-]+(?:\s{2,}|\t)[\w\d./-]+/m,
};

/**
 * Detect if a text block is likely a table
 *
 * @param text - Text block to analyze
 * @returns Whether the text appears to be table content
 */
export function isLikelyTable(text: string): boolean {
  // Check for table caption
  if (TABLE_PATTERNS.tableStart.test(text)) {
    return true;
  }

  // Check for column headers
  const hasHeaders = TABLE_PATTERNS.columnHeaders.test(text);

  // Check for structured data (multiple columns)
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const structuredLines = lines.filter((l) => TABLE_PATTERNS.dataRow.test(l));

  // If >50% of lines look like data rows and has headers, it's likely a table
  if (hasHeaders && structuredLines.length > lines.length * 0.5) {
    return true;
  }

  // Check for tab-separated or multi-space-separated content
  const tabLines = lines.filter((l) => l.includes("\t") || /\s{3,}/.test(l));
  return tabLines.length > lines.length * 0.6;
}

/**
 * Extract table title from surrounding context
 *
 * @param text - Text that may contain a table
 * @param previousText - Text from previous chunk for context
 * @returns Extracted table title or undefined
 */
export function extractTableTitle(
  text: string,
  previousText?: string
): string | undefined {
  // Check within current text
  const match = text.match(TABLE_PATTERNS.tableStart);
  if (match) {
    return match[1]?.trim() || `Table ${match[0].match(/\d+/)?.[0]}`;
  }

  // Check previous text for table caption
  if (previousText) {
    const prevMatch = previousText.match(/Table\s+\d+[:\s—–-]+(.*)$/im);
    if (prevMatch) {
      return prevMatch[1]?.trim() || `Table ${prevMatch[0].match(/\d+/)?.[0]}`;
    }
  }

  return undefined;
}

// ============================================================================
// Structured Chunking
// ============================================================================

/**
 * Create structured chunks from document text
 *
 * Unlike naive chunking, this:
 * - Never splits tables
 * - Preserves table metadata
 * - Tags chunks with their type
 *
 * @param text - Full document text
 * @param metadata - Document metadata
 * @param options - Chunking options
 * @returns Array of structured chunks
 */
export function createStructuredChunks(
  text: string,
  metadata: DocumentMetadata,
  options: {
    chunkSize?: number;
    overlap?: number;
    pageBreakPattern?: RegExp;
  } = {}
): StructuredChunk[] {
  const { chunkSize = 1000, overlap = 200, pageBreakPattern = /\f|\[PAGE\s*\d+\]/g } = options;

  const chunks: StructuredChunk[] = [];

  // Split by pages if page breaks exist
  const pages = text.split(pageBreakPattern);

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const pageText = pages[pageIndex];
    const pageNumber = pageIndex + 1;

    // Split page into logical sections (tables vs narrative)
    const sections = splitIntoSections(pageText);

    for (const section of sections) {
      if (section.isTable) {
        // Never split tables - treat as single chunk
        chunks.push({
          content: section.content,
          page_number: pageNumber,
          type: "table",
          metadata: {
            table_title: extractTableTitle(section.content),
            document_type: metadata.type,
            standard: metadata.standard,
          },
        });
      } else {
        // Chunk narrative text with overlap
        const textChunks = chunkNarrativeText(section.content, chunkSize, overlap);
        for (const tc of textChunks) {
          chunks.push({
            content: tc,
            page_number: pageNumber,
            type: "narrative",
            metadata: {
              document_type: metadata.type,
              standard: metadata.standard,
            },
          });
        }
      }
    }
  }

  return chunks;
}

/**
 * Split text into table and narrative sections
 */
function splitIntoSections(text: string): Array<{ content: string; isTable: boolean }> {
  const sections: Array<{ content: string; isTable: boolean }> = [];

  // Simple approach: split by double newlines and classify each section
  const blocks = text.split(/\n{2,}/);
  let currentNarrative = "";
  let currentTable = "";

  for (const block of blocks) {
    const isTable = isLikelyTable(block);

    if (isTable) {
      // Flush narrative if any
      if (currentNarrative.trim()) {
        sections.push({ content: currentNarrative.trim(), isTable: false });
        currentNarrative = "";
      }
      // Add to current table or start new one
      currentTable += (currentTable ? "\n\n" : "") + block;
    } else {
      // Flush table if any
      if (currentTable.trim()) {
        sections.push({ content: currentTable.trim(), isTable: true });
        currentTable = "";
      }
      currentNarrative += (currentNarrative ? "\n\n" : "") + block;
    }
  }

  // Flush remaining content
  if (currentNarrative.trim()) {
    sections.push({ content: currentNarrative.trim(), isTable: false });
  }
  if (currentTable.trim()) {
    sections.push({ content: currentTable.trim(), isTable: true });
  }

  return sections;
}

/**
 * Chunk narrative text with overlap
 */
function chunkNarrativeText(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  if (text.length <= chunkSize) {
    return text.trim() ? [text.trim()] : [];
  }

  const chunks: string[] = [];
  const stepSize = chunkSize - overlap;
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    start += stepSize;
  }

  return chunks;
}

// ============================================================================
// Unstructured.io Integration (Optional Enhancement)
// ============================================================================

/**
 * Configuration for Unstructured.io API
 */
export interface UnstructuredConfig {
  apiKey: string;
  apiUrl?: string;
}

/**
 * Process document with Unstructured.io for enhanced table extraction
 *
 * This is an optional enhancement that provides better table extraction
 * than our regex-based approach.
 *
 * @param pdfBuffer - PDF file buffer
 * @param config - Unstructured.io configuration
 * @returns Array of document elements
 */
export async function processWithUnstructured(
  pdfBuffer: ArrayBuffer,
  config: UnstructuredConfig
): Promise<DocumentElement[]> {
  const apiUrl = config.apiUrl || "https://api.unstructured.io/general/v0/general";

  // Create form data with the PDF
  const formData = new FormData();
  formData.append("files", new Blob([pdfBuffer], { type: "application/pdf" }), "document.pdf");
  formData.append("strategy", "hi_res"); // Best for tables
  formData.append("hi_res_model_name", "yolox"); // Table detection model
  formData.append("pdf_infer_table_structure", "true");

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "unstructured-api-key": config.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Unstructured API error: ${response.status}`);
    }

    const elements = await response.json() as Array<{
      type: string;
      text: string;
      metadata?: {
        page_number?: number;
        table_as_html?: string;
        parent_id?: string;
      };
    }>;

    // Convert to our element format
    return elements.map((el) => ({
      type: mapUnstructuredType(el.type),
      content: el.text,
      page: el.metadata?.page_number || 1,
      metadata: {
        table_html: el.metadata?.table_as_html,
      },
    }));
  } catch (error) {
    console.error("[Document Intelligence] Unstructured.io processing failed:", error);
    throw error;
  }
}

/**
 * Map Unstructured.io element types to our types
 */
function mapUnstructuredType(
  type: string
): DocumentElement["type"] {
  const typeMap: Record<string, DocumentElement["type"]> = {
    Title: "title",
    Header: "heading",
    NarrativeText: "paragraph",
    Table: "table",
    ListItem: "list",
    FigureCaption: "note",
    Footer: "note",
  };
  return typeMap[type] || "paragraph";
}

/**
 * Check if Unstructured.io is configured and available
 */
export function isUnstructuredAvailable(): boolean {
  return !!process.env.UNSTRUCTURED_API_KEY;
}

/**
 * Get Unstructured configuration from environment
 */
export function getUnstructuredConfig(): UnstructuredConfig | null {
  const apiKey = process.env.UNSTRUCTURED_API_KEY;
  if (!apiKey) return null;

  return {
    apiKey,
    apiUrl: process.env.UNSTRUCTURED_API_URL,
  };
}
