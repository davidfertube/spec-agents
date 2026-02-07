/**
 * Backend Query Enhancement for RAG
 *
 * This module enhances user queries before they're sent to the retrieval system.
 * Users don't see these modifications - they're applied invisibly in the backend.
 *
 * Enhancement strategies:
 * 1. Document name extraction and boosting
 * 2. Technical term expansion
 * 3. Table/section hints
 * 4. Property-specific search terms
 */

export interface EnhancedQuery {
  /** Original user query */
  original: string;
  /** Enhanced query for search */
  enhanced: string;
  /** Detected document references */
  documentHints: string[];
  /** Enhancement strategies applied */
  strategiesApplied: string[];
}

/**
 * ASTM document metadata for search enhancement
 */
const DOCUMENT_METADATA: Record<string, {
  keywords: string[];
  tableHints: string[];
  productType: string;
}> = {
  "A789": {
    keywords: ["tubing", "tubes", "seamless", "welded", "ferritic", "austenitic", "duplex"],
    tableHints: ["Table 1 Chemical Requirements", "Table 2 Heat Treatment", "Table 4 Tensile", "Table 5 Dimensions"],
    productType: "tubing"
  },
  "A790": {
    keywords: ["pipe", "seamless", "welded", "ferritic", "austenitic", "duplex"],
    tableHints: ["Chemical Requirements", "Heat Treatment", "Tensile Requirements"],
    productType: "pipe"
  },
  "A872": {
    keywords: ["centrifugally cast", "cast pipe", "ferritic", "austenitic", "duplex"],
    tableHints: ["Table 1 Chemical", "Table 2 Heat Treatment", "Table 3 Tensile", "Table S7.1 Impact"],
    productType: "cast pipe"
  },
  "A312": {
    keywords: ["pipe", "seamless", "welded", "austenitic", "stainless"],
    tableHints: ["Chemical Requirements", "Tensile Requirements"],
    productType: "pipe"
  },
  "5CRA": {
    keywords: ["corrosion resistant", "alloy", "CRA", "oil", "gas", "casing", "tubing"],
    tableHints: ["Chemical Composition", "Mechanical Properties"],
    productType: "CRA tubulars"
  },
  "A1049": {
    keywords: ["forgings", "duplex", "pressure vessel", "ferritic", "austenitic"],
    tableHints: ["Table 1 Chemical", "Table 2 Mechanical", "Tension Test"],
    productType: "forgings"
  },
  "5CT": {
    keywords: ["casing", "tubing", "oil well", "gas well", "grade", "coupling"],
    tableHints: ["Table C.5 Tensile", "Table C.6 Chemical", "Table E.5", "yield strength", "tensile strength"],
    productType: "casing and tubing"
  },
  "6A": {
    keywords: ["wellhead", "christmas tree", "flange", "valve", "pressure rating", "PSL"],
    tableHints: ["Table 1 Rated Working Pressure", "Table 2 Bore Sizes", "Table B.2", "flange dimensions"],
    productType: "wellhead equipment"
  },
  "16C": {
    keywords: ["choke", "kill", "manifold", "valve", "pressure", "drilling"],
    tableHints: ["Material Requirements", "Working Pressure", "Test Pressure"],
    productType: "choke and kill equipment"
  }
};

/**
 * Property-specific search term mappings
 * When user asks about a property, add related search terms
 */
const PROPERTY_EXPANSIONS: Record<string, string[]> = {
  "nitrogen": ["N", "nitrogen content", "Chemical Requirements"],
  "chromium": ["Cr", "chromium content", "Chemical Requirements"],
  "molybdenum": ["Mo", "molybdenum content", "Chemical Requirements"],
  "nickel": ["Ni", "nickel content", "Chemical Requirements"],
  "carbon": ["C", "carbon content", "Chemical Requirements"],
  "yield": ["yield strength", "Tensile Requirements", "ksi", "MPa", "minimum"],
  "tensile": ["tensile strength", "Tensile Requirements", "ksi", "MPa", "minimum"],
  "hardness": ["HRC", "HBW", "Brinell", "Rockwell", "max"],
  "heat treatment": ["temperature", "quench", "solution", "annealing", "°F", "°C"],
  "elongation": ["elongation", "percent", "%", "Tensile Requirements"],
  "wall thickness": ["permissible variation", "tolerance", "Dimensions", "average wall", "minimum wall"],
  "charpy": ["impact", "ft-lbf", "Joules", "energy", "temperature"],
  "ferrite": ["ferrite content", "austenite", "phase", "microstructure"],
  "pressure": ["rated working pressure", "test pressure", "psi", "Working Pressure"],
  "flange": ["flange", "bore size", "dimensions", "Rated Working Pressure"],
  "casing": ["casing grade", "yield strength", "tensile strength", "Tensile Requirements"],
  "collapse": ["collapse resistance", "external pressure", "collapse strength"]
};

/**
 * Extract ASTM document references from query
 */
function extractDocumentReferences(query: string): string[] {
  const refs: string[] = [];
  const upperQuery = query.toUpperCase();

  // Check for ASTM A-series references
  const astmPattern = /A\s*(\d{3,4})/gi;
  let match;
  while ((match = astmPattern.exec(query)) !== null) {
    refs.push(`A${match[1]}`);
  }

  // Check for API references (5CT, 6A, 16C, 5CRA)
  const apiPattern = /API[\s-]+(?:SPEC(?:IFICATION)?\s+)?(\d{1,2}[A-Z]{1,4})\b/gi;
  let apiMatch;
  while ((apiMatch = apiPattern.exec(query)) !== null) {
    refs.push(apiMatch[1].toUpperCase());
  }
  if (upperQuery.includes("5CRA") && !refs.includes("5CRA")) {
    refs.push("5CRA");
  }

  return [...new Set(refs)];
}

/**
 * Extract property keywords from query
 */
function extractPropertyKeywords(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const properties: string[] = [];

  for (const [property, _expansions] of Object.entries(PROPERTY_EXPANSIONS)) {
    if (lowerQuery.includes(property)) {
      properties.push(property);
    }
  }

  return properties;
}

/**
 * Enhance a user query for better retrieval
 *
 * @param query - Original user query
 * @returns Enhanced query object
 */
export function enhanceQuery(query: string): EnhancedQuery {
  const strategiesApplied: string[] = [];
  let enhanced = query;

  // Strategy 1: Extract and boost document references
  const documentRefs = extractDocumentReferences(query);
  const documentHints: string[] = [];

  for (const ref of documentRefs) {
    const metadata = DOCUMENT_METADATA[ref];
    if (metadata) {
      documentHints.push(ref);
      // Add product type to query if not already present
      if (!query.toLowerCase().includes(metadata.productType)) {
        enhanced += ` ${metadata.productType}`;
        strategiesApplied.push(`added_product_type:${metadata.productType}`);
      }
    }
  }

  // Strategy 2: Expand property keywords
  const properties = extractPropertyKeywords(query);
  for (const property of properties) {
    const expansions = PROPERTY_EXPANSIONS[property];
    if (expansions) {
      // Add the most relevant expansion (table hint)
      const tableHint = expansions.find(e => e.includes("Requirements") || e.includes("Dimensions"));
      if (tableHint && !query.includes(tableHint)) {
        enhanced += ` ${tableHint}`;
        strategiesApplied.push(`property_expansion:${property}`);
      }
    }
  }

  // Strategy 3: Add table hints for specific document
  if (documentRefs.length === 1) {
    const metadata = DOCUMENT_METADATA[documentRefs[0]];
    if (metadata && properties.length > 0) {
      // Find the most relevant table for the property
      for (const property of properties) {
        const relevantTable = metadata.tableHints.find(t =>
          t.toLowerCase().includes(property) ||
          (property.includes("nitrogen") && t.includes("Chemical")) ||
          (property.includes("yield") && t.includes("Tensile")) ||
          (property.includes("heat") && t.includes("Heat"))
        );
        if (relevantTable && !enhanced.includes(relevantTable)) {
          enhanced += ` ${relevantTable}`;
          strategiesApplied.push(`table_hint:${relevantTable}`);
        }
      }
    }
  }

  return {
    original: query,
    enhanced: enhanced.trim(),
    documentHints,
    strategiesApplied
  };
}

/**
 * Check if query enhancement would help
 * Returns true if the query contains technical references that can be enhanced
 */
export function shouldEnhanceQuery(query: string): boolean {
  // Has document reference
  const hasDocRef = extractDocumentReferences(query).length > 0;

  // Has property keyword
  const hasProperty = extractPropertyKeywords(query).length > 0;

  // Has UNS code
  const hasUNS = /\b[SNCGHJKWRT]\d{5}\b/i.test(query);

  return hasDocRef || hasProperty || hasUNS;
}

/**
 * Get search hints based on detected document
 * These hints can be used to filter or boost certain chunks
 */
export function getDocumentSearchHints(documentRef: string): string[] {
  const metadata = DOCUMENT_METADATA[documentRef];
  return metadata ? [...metadata.keywords, ...metadata.tableHints] : [];
}
