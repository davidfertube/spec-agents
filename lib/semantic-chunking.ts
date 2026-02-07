/**
 * Semantic Chunking for Technical Documents
 *
 * This module provides intelligent text chunking that:
 * - Preserves semantic boundaries (sections, tables, lists)
 * - Adds metadata (section titles, chunk types, code detection)
 * - Uses variable chunk sizes based on content type
 * - Keeps tables and lists intact
 */

export interface ChunkOptions {
  minChunkSize: number;
  maxChunkSize: number;
  targetChunkSize: number;
  overlapSize: number;
  preserveTables: boolean;
  preserveLists: boolean;
}

export interface EnhancedChunk {
  content: string;
  metadata: {
    page_number: number;
    section_title?: string;
    chunk_type: 'text' | 'table' | 'list' | 'heading';
    has_codes: boolean;
    confidence: number;
    parent_section?: string;
  };
  char_offset_start: number;
  char_offset_end: number;
}

interface DocumentStructure {
  sections: Section[];
  tables: Table[];
  lists: List[];
}

interface Section {
  title: string;
  level: number;
  startIndex: number;
  endIndex: number;
  pageNumber: number;
}

interface Table {
  content: string;
  startIndex: number;
  endIndex: number;
  pageNumber: number;
  title?: string;
  hasFootnotes: boolean;
}

interface List {
  content: string;
  startIndex: number;
  endIndex: number;
  pageNumber: number;
  type: 'bullet' | 'numbered';
}

/**
 * Detect if text contains technical codes (UNS, ASTM, API, NACE, etc.)
 */
function detectTechnicalCodes(text: string): boolean {
  const codePatterns = [
    /\bUNS\s+[A-Z]\d{5}\b/i,           // UNS codes (e.g., UNS S31803)
    /\bASTM\s+[A-Z]\d{2,4}\b/i,        // ASTM standards (e.g., ASTM A790)
    /\bAPI\s+\d+[A-Z]?\b/i,            // API standards (e.g., API 5L)
    /\bNACE\s+[A-Z]{2}\d{4}\b/i,       // NACE standards (e.g., NACE MR0175)
    /\b[A-Z]{2,4}\s*\d{3,4}[A-Z]?\b/,  // Generic codes (e.g., SA 240, EN 10088)
    /\b\d{3}[A-Z]?L?\b/,               // Steel grades (e.g., 316L, 2205)
  ];

  return codePatterns.some(pattern => pattern.test(text));
}

/**
 * ASTM-specific table header patterns
 * These patterns help identify technical specification tables from PDFs
 */
const ASTM_TABLE_PATTERNS = [
  // Table headers with numbers
  /TABLE\s+\d+\s+(?:Chemical|Mechanical|Heat Treatment|Tensile|Hardness)/i,
  /TABLE\s+X?\d+\.?\d*\s+/i,  // TABLE X1.1, TABLE 2, etc.
  /Chemical\s+Requirements/i,
  /Mechanical\s+(?:Properties|Requirements)/i,
  /Heat\s+Treatment\s+Requirements/i,
  /Tensile\s+(?:Strength\s+)?(?:and\s+)?(?:Hardness\s+)?Requirements/i,
  /Impact\s+Requirements/i,
  /Dimensions\s+of\s+(?:Welded|Seamless)/i,  // Pipe dimension tables
  // Column headers typical in ASTM specs
  /\bUNS\s+Designation\b/i,
  /\bGrade\b.*\bTensile\b.*\bYield\b/i,
  /\bElement\b.*\bGrade\b/i,
  /\bTemperature\b.*\b(?:°F|°C)\b/i,
  /\bSchedule\s+(?:5S|10S|40S|80S)\b/i,  // Pipe schedule headers
  // Chemical element patterns (rows with multiple numeric ranges)
  /(?:Carbon|Manganese|Chromium|Nickel|Molybdenum|Nitrogen|Silicon)/i,
];

/**
 * ASTM table footnote patterns (superscripts, notes at bottom)
 */
const TABLE_FOOTNOTE_PATTERNS = [
  /^[A-Z]\s+.{10,}/m,          // Single letter footnote: "A Common name..."
  /^Note\s*\d*:?\s+/im,         // "Note:" or "Note 1:"
  /^[ᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᵠᴿˢᵀᵁⱽᵂˣʸᶻ]\s+/m,  // Superscript footnotes
  /Maximum,?\s+unless/i,        // "Maximum, unless a range is indicated"
  /\.\.\.\s*(?:indicates|no\s+requirement)/i,  // Ellipsis explanations
];

/**
 * Detect if text contains table footnotes that should be kept with table
 */
function hasTableFootnotes(text: string): boolean {
  return TABLE_FOOTNOTE_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Detect if text contains ASTM-style technical data patterns
 */
function hasASTMTablePatterns(text: string): boolean {
  return ASTM_TABLE_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Detect if text has consistent numeric data columns (common in spec tables)
 * This catches tables that aren't clearly formatted but contain aligned data
 */
function hasNumericDataColumns(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 3) return false;

  // Check for lines with multiple numeric values or ranges
  const numericPattern = /\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?/g;
  let linesWithMultipleNumbers = 0;

  for (const line of lines) {
    const matches = line.match(numericPattern);
    if (matches && matches.length >= 2) {
      linesWithMultipleNumbers++;
    }
  }

  // If more than 50% of lines have multiple numbers, likely a data table
  return linesWithMultipleNumbers >= lines.length * 0.5;
}

/**
 * Detect if text is a table
 * Enhanced to detect ASTM specification tables from PDFs
 */
function isTable(text: string): boolean {
  // Tables typically have:
  // - Multiple pipe characters (|) in alignment
  // - Dashes for separators (----)
  // - Consistent column structure
  // - ASTM-specific table patterns

  const lines = text.split('\n').filter(l => l.trim().length > 0);

  if (lines.length < 2) return false;

  // Check for pipe-delimited tables
  const pipeLines = lines.filter(l => l.includes('|'));
  if (pipeLines.length >= 2) {
    // Check if there's a separator line with dashes
    const hasSeparator = lines.some(l => /^[\s|:-]+$/.test(l));
    if (hasSeparator) return true;
  }

  // Check for tab-delimited tables (less common but exists)
  const tabLines = lines.filter(l => l.split('\t').length >= 3);
  if (tabLines.length >= lines.length * 0.7) return true;

  // Check for ASTM-specific table patterns
  if (hasASTMTablePatterns(text)) return true;

  // Check for space-aligned numeric data (common in PDF-extracted tables)
  if (hasNumericDataColumns(text)) return true;

  return false;
}

/**
 * Detect if text is likely a table footnote section
 */
function isTableFootnote(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 1 || lines.length > 10) return false;

  // Check if most lines are footnotes
  const footnoteLines = lines.filter(line =>
    TABLE_FOOTNOTE_PATTERNS.some(pattern => pattern.test(line))
  );

  return footnoteLines.length >= lines.length * 0.5;
}

/**
 * Extract table title from text (e.g., "TABLE 2 Mechanical Requirements")
 */
function extractTableTitle(text: string): string | undefined {
  const match = text.match(/TABLE\s+X?\d+\.?\d*\s+[A-Z][^\n]{5,60}/i);
  return match ? match[0].trim() : undefined;
}

/**
 * Extract table header rows for prepending to split table chunks.
 * Returns the first few lines before data rows begin (title + column headers).
 */
function extractTableHeader(tableContent: string): string | null {
  const lines = tableContent.split('\n').filter(l => l.trim());
  if (lines.length < 3) return null;

  const headerLines: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    // Data rows start with UNS codes (S32205), ASTM grades, or numeric values
    const isDataRow = /^\s*(?:[SNCGHJKWRT]\d{5}|F\d{2}|[A-Z]\d{3,4}\b|\d+(?:\.\d+)?[%\s])/.test(line);
    if (isDataRow && headerLines.length > 0) break;
    headerLines.push(line);
  }

  return headerLines.length > 0 ? headerLines.join('\n') : null;
}

/**
 * Detect if text is a list
 */
function isList(text: string): { isList: boolean; type: 'bullet' | 'numbered' | null } {
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  if (lines.length < 2) return { isList: false, type: null };

  // Check for bullet lists
  const bulletPattern = /^\s*[-•*◦▪]\s+/;
  const bulletLines = lines.filter(l => bulletPattern.test(l));
  if (bulletLines.length >= lines.length * 0.6) {
    return { isList: true, type: 'bullet' };
  }

  // Check for numbered lists
  const numberedPattern = /^\s*\d+[\.)]\s+/;
  const numberedLines = lines.filter(l => numberedPattern.test(l));
  if (numberedLines.length >= lines.length * 0.6) {
    return { isList: true, type: 'numbered' };
  }

  return { isList: false, type: null };
}

/**
 * Extract section title from heading text
 */
function extractSectionTitle(text: string): string | undefined {
  // Look for heading patterns:
  // - "1. Introduction"
  // - "3.2 Mechanical Properties"
  // - "Section 4: Chemical Composition"

  const headingPatterns = [
    /^(\d+\.?\d*)\s+([A-Z][^\n]{3,50})$/m,      // "1.2 Title"
    /^(Section\s+\d+:?\s*)([A-Z][^\n]{3,50})$/mi, // "Section 3: Title"
    /^([A-Z][A-Z\s]{3,50})$/m,                   // "MECHANICAL PROPERTIES"
  ];

  for (const pattern of headingPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[match.length - 1].trim();
    }
  }

  return undefined;
}

/**
 * Parse document structure to identify sections, tables, and lists
 */
function parseDocumentStructure(pageTexts: string[]): DocumentStructure {
  const structure: DocumentStructure = {
    sections: [],
    tables: [],
    lists: [],
  };

  let charOffset = 0;

  for (let pageIndex = 0; pageIndex < pageTexts.length; pageIndex++) {
    const pageText = pageTexts[pageIndex];
    const pageNumber = pageIndex + 1;

    // Split into paragraphs
    const paragraphs = pageText.split(/\n\n+/);

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (trimmed.length === 0) continue;

      const startIndex = charOffset;
      const endIndex = charOffset + trimmed.length;

      // Check if it's a table
      if (isTable(trimmed)) {
        const tableTitle = extractTableTitle(trimmed);
        structure.tables.push({
          content: trimmed,
          startIndex,
          endIndex,
          pageNumber,
          title: tableTitle,
          hasFootnotes: hasTableFootnotes(trimmed),
        });
      }
      // Check if it's a table footnote section (and we have a preceding table)
      else if (isTableFootnote(trimmed) && structure.tables.length > 0) {
        // Append footnote to the most recent table on this page
        const lastTable = structure.tables[structure.tables.length - 1];
        if (lastTable.pageNumber === pageNumber) {
          lastTable.content += '\n\n' + trimmed;
          lastTable.endIndex = endIndex;
          lastTable.hasFootnotes = true;
        }
      }
      // Check if it's a list
      else {
        const listCheck = isList(trimmed);
        if (listCheck.isList && listCheck.type) {
          structure.lists.push({
            content: trimmed,
            startIndex,
            endIndex,
            pageNumber,
            type: listCheck.type,
          });
        }
        // Check if it's a heading/section (must be inside the else block)
        else if (trimmed.length < 100) {
          const sectionTitle = extractSectionTitle(trimmed);
          if (sectionTitle) {
            structure.sections.push({
              title: sectionTitle,
              level: 1, // Could be enhanced to detect heading levels
              startIndex,
              endIndex,
              pageNumber,
            });
          }
        }
      }

      charOffset = endIndex + 2; // +2 for paragraph breaks
    }
  }

  return structure;
}

/**
 * Chunk text with overlap, respecting boundaries
 */
function chunkTextWithOverlap(
  text: string,
  startOffset: number,
  chunkSize: number,
  overlapSize: number
): { content: string; start: number; end: number }[] {
  const chunks: { content: string; start: number; end: number }[] = [];
  let currentPos = 0;

  while (currentPos < text.length) {
    const end = Math.min(currentPos + chunkSize, text.length);
    const content = text.slice(currentPos, end).trim();

    if (content.length > 50) {
      chunks.push({
        content,
        start: startOffset + currentPos,
        end: startOffset + end,
      });
    }

    // Check if we're done
    if (end === text.length) break;

    // Move forward with overlap
    currentPos += (chunkSize - overlapSize);
  }

  return chunks;
}

/**
 * Main semantic chunking function for technical documents.
 *
 * Intelligently splits PDF pages into chunks while:
 * - Preserving tables and lists intact (no mid-table splits)
 * - Detecting section boundaries and titles
 * - Adding metadata (page numbers, chunk types, code detection)
 * - Maintaining character offsets for citation highlighting
 *
 * @param pageTexts - Array of text content from each PDF page
 * @param options - Chunking configuration (sizes, overlap, preservation flags)
 * @returns Array of enhanced chunks with metadata
 *
 * @example
 * const chunks = semanticChunk(pageTexts, {
 *   minChunkSize: 200,
 *   maxChunkSize: 2000,
 *   targetChunkSize: 1000,
 *   overlapSize: 100,
 *   preserveTables: true,
 *   preserveLists: true,
 * });
 */
export function semanticChunk(
  pageTexts: string[],
  options: ChunkOptions
): EnhancedChunk[] {
  const {
    minChunkSize,
    maxChunkSize,
    targetChunkSize,
    overlapSize,
    preserveTables,
    preserveLists,
  } = options;

  const structure = parseDocumentStructure(pageTexts);
  const allChunks: EnhancedChunk[] = [];

  let currentSection: string | undefined = undefined;
  let charOffset = 0;

  for (let pageIndex = 0; pageIndex < pageTexts.length; pageIndex++) {
    const pageText = pageTexts[pageIndex];
    const pageNumber = pageIndex + 1;

    if (pageText.trim().length < 50) continue;

    // Find structures on this page
    const pageTables = structure.tables.filter(t => t.pageNumber === pageNumber);
    const pageLists = structure.lists.filter(l => l.pageNumber === pageNumber);
    const pageSections = structure.sections.filter(s => s.pageNumber === pageNumber);

    // Update current section if we find one
    if (pageSections.length > 0) {
      currentSection = pageSections[pageSections.length - 1].title;
    }

    // Handle tables (preserve intact)
    if (preserveTables && pageTables.length > 0) {
      for (const table of pageTables) {
        // Use table title as section_title if available, otherwise use current section
        const tableSectionTitle = table.title || currentSection;

        // Tables get extra budget to stay intact (reduces splits that lose context)
        const tableMaxSize = maxChunkSize + 1000;

        if (table.content.length <= tableMaxSize) {
          allChunks.push({
            content: table.content,
            metadata: {
              page_number: pageNumber,
              section_title: tableSectionTitle,
              chunk_type: 'table',
              has_codes: detectTechnicalCodes(table.content),
              confidence: table.hasFootnotes ? 0.98 : 0.95, // Higher confidence when footnotes preserved
              parent_section: currentSection,
            },
            char_offset_start: table.startIndex - charOffset,
            char_offset_end: table.endIndex - charOffset,
          });
        } else {
          // Table is too large: chunk it, but prepend header to each subsequent chunk
          // so data rows always have column labels for context
          const header = extractTableHeader(table.content);
          const headerPrefix = header ? header + '\n' : '';

          const tableChunks = chunkTextWithOverlap(
            table.content,
            table.startIndex - charOffset,
            targetChunkSize - headerPrefix.length, // Reserve space for header in size budget
            overlapSize
          );

          for (let idx = 0; idx < tableChunks.length; idx++) {
            // First chunk already has the header; prepend to subsequent chunks only
            const content = idx === 0
              ? tableChunks[idx].content
              : headerPrefix + tableChunks[idx].content;

            allChunks.push({
              content,
              metadata: {
                page_number: pageNumber,
                section_title: tableSectionTitle,
                chunk_type: 'table',
                has_codes: detectTechnicalCodes(content),
                confidence: 0.85,
                parent_section: currentSection,
              },
              char_offset_start: tableChunks[idx].start,
              char_offset_end: tableChunks[idx].end,
            });
          }
        }
      }
    }

    // Handle lists (preserve intact)
    if (preserveLists && pageLists.length > 0) {
      for (const list of pageLists) {
        if (list.content.length <= maxChunkSize) {
          allChunks.push({
            content: list.content,
            metadata: {
              page_number: pageNumber,
              section_title: currentSection,
              chunk_type: 'list',
              has_codes: detectTechnicalCodes(list.content),
              confidence: 0.90,
              parent_section: currentSection,
            },
            char_offset_start: list.startIndex - charOffset,
            char_offset_end: list.endIndex - charOffset,
          });
        } else {
          // List is too large, chunk it
          const listChunks = chunkTextWithOverlap(
            list.content,
            list.startIndex - charOffset,
            targetChunkSize,
            overlapSize
          );

          for (const chunk of listChunks) {
            allChunks.push({
              content: chunk.content,
              metadata: {
                page_number: pageNumber,
                section_title: currentSection,
                chunk_type: 'list',
                has_codes: detectTechnicalCodes(chunk.content),
                confidence: 0.80,
                parent_section: currentSection,
              },
              char_offset_start: chunk.start,
              char_offset_end: chunk.end,
            });
          }
        }
      }
    }

    // Handle regular text
    // Remove tables and lists from page text to avoid duplication
    let regularText = pageText;

    if (preserveTables) {
      for (const table of pageTables) {
        regularText = regularText.replace(table.content, '');
      }
    }

    if (preserveLists) {
      for (const list of pageLists) {
        regularText = regularText.replace(list.content, '');
      }
    }

    // Chunk the regular text
    if (regularText.trim().length >= minChunkSize) {
      const textChunks = chunkTextWithOverlap(
        regularText,
        charOffset,
        targetChunkSize,
        overlapSize
      );

      for (const chunk of textChunks) {
        // Determine if this is a heading
        const sectionTitle = extractSectionTitle(chunk.content);
        const isHeading = sectionTitle !== undefined && chunk.content.length < 150;

        allChunks.push({
          content: chunk.content,
          metadata: {
            page_number: pageNumber,
            section_title: sectionTitle || currentSection,
            chunk_type: isHeading ? 'heading' : 'text',
            has_codes: detectTechnicalCodes(chunk.content),
            confidence: 0.75,
            parent_section: currentSection,
          },
          char_offset_start: chunk.start,
          char_offset_end: chunk.end,
        });
      }
    }

    charOffset += pageText.length + 2; // +2 for page breaks
  }

  return allChunks;
}

/**
 * Default chunking options for technical documents
 */
export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  minChunkSize: 800,
  maxChunkSize: 2500,
  targetChunkSize: 1500,
  overlapSize: 200,
  preserveTables: true,
  preserveLists: true,
};
