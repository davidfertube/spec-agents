/**
 * Standards Knowledge Graph
 *
 * Contains PUBLIC KNOWLEDGE about steel standards relationships.
 * This is NOT copyrighted content - it's metadata about document relationships,
 * UNS designations, and common material properties.
 *
 * This enables cross-document reasoning without storing copyrighted content.
 */

// ============================================================================
// Types
// ============================================================================

export interface StandardInfo {
  /** Full standard name */
  name: string;
  /** Standard type (specification, test method, practice, etc.) */
  type: "pipe_specification" | "tubing_specification" | "plate_specification" |
        "test_method" | "practice" | "compliance_requirement" | "guide";
  /** Brief description (public knowledge) */
  description: string;
  /** UNS materials covered by this standard */
  materials: string[];
  /** Other standards this one references */
  references: string[];
  /** Related/companion standards */
  related: string[];
  /** Scope summary (public knowledge) */
  scope: string;
  /** Supersedes which standard (if any) */
  supersedes?: string;
  /** Year range of coverage */
  year_range?: string;
}

export interface MaterialInfo {
  /** UNS designation */
  uns: string;
  /** Common trade names/grades */
  trade_names: string[];
  /** Material family */
  family: "duplex" | "super_duplex" | "austenitic" | "ferritic" | "martensitic" | "nickel_alloy";
  /** Typical PREN range (calculated from nominal chemistry) */
  pren_range?: { min: number; max: number };
  /** Applicable specifications */
  specifications: string[];
  /** Typical applications */
  applications: string[];
}

export interface ComplianceRequirement {
  /** Standard that defines the requirement */
  standard: string;
  /** Requirement type */
  type: "hardness" | "heat_treatment" | "testing" | "chemistry" | "microstructure";
  /** Brief description */
  description: string;
  /** Material families this applies to */
  applies_to: string[];
  /** Key limits (public knowledge only) */
  key_limits?: Record<string, string | number>;
}

// ============================================================================
// Standards Database (Public Knowledge)
// ============================================================================

/**
 * ASTM standards commonly used for stainless steel
 *
 * NOTE: This contains only PUBLIC metadata, not copyrighted specification content.
 * Users must upload their own licensed copies for actual values.
 */
export const ASTM_STANDARDS: Record<string, StandardInfo> = {
  "A790": {
    name: "ASTM A790/A790M",
    type: "pipe_specification",
    description: "Seamless and Welded Ferritic/Austenitic Stainless Steel Pipe",
    materials: ["S31803", "S32205", "S32750", "S32760", "S32550", "S31260", "S32304"],
    references: ["A923", "A370", "E112", "A262", "A380", "A450"],
    related: ["A789", "A928"],
    scope: "Covers seamless and straight-seam welded ferritic/austenitic (duplex) stainless steel pipe intended for general corrosive service",
    year_range: "1985-present",
  },
  "A789": {
    name: "ASTM A789/A789M",
    type: "tubing_specification",
    description: "Seamless and Welded Ferritic/Austenitic Stainless Steel Tubing",
    materials: ["S31803", "S32205", "S32750", "S32760", "S32550", "S32304"],
    references: ["A923", "A370", "E112", "A262", "A380"],
    related: ["A790", "A928"],
    scope: "Covers seamless and welded ferritic/austenitic stainless steel tubing for general service",
    year_range: "1981-present",
  },
  "A240": {
    name: "ASTM A240/A240M",
    type: "plate_specification",
    description: "Chromium and Chromium-Nickel Stainless Steel Plate, Sheet, and Strip",
    materials: ["S30400", "S30403", "S31600", "S31603", "S31803", "S32205", "S32750", "S32760"],
    references: ["A370", "E112", "A262", "A380"],
    related: ["A480"],
    scope: "Covers chromium, chromium-nickel, and chromium-manganese-nickel stainless steel plate, sheet, and strip",
    year_range: "1941-present",
  },
  "A923": {
    name: "ASTM A923",
    type: "test_method",
    description: "Detecting Detrimental Intermetallic Phase in Duplex Austenitic/Ferritic Stainless Steels",
    materials: ["S31803", "S32205", "S32750", "S32760", "S32550"],
    references: ["A370", "E112", "E340"],
    related: ["A790", "A789"],
    scope: "Test methods for detecting detrimental amounts of sigma and chi phases in duplex stainless steels",
    year_range: "1994-present",
  },
  "A370": {
    name: "ASTM A370",
    type: "test_method",
    description: "Standard Test Methods and Definitions for Mechanical Testing of Steel Products",
    materials: [],
    references: ["E8", "E23", "E10", "E18"],
    related: [],
    scope: "Covers procedures and definitions for mechanical testing of steels",
    year_range: "1953-present",
  },
  "A312": {
    name: "ASTM A312/A312M",
    type: "pipe_specification",
    description: "Seamless, Welded, and Heavily Cold Worked Austenitic Stainless Steel Pipes",
    materials: ["S30400", "S30403", "S31600", "S31603", "S31700", "S32100", "S34700"],
    references: ["A370", "A262", "A380", "A450"],
    related: ["A269", "A213"],
    scope: "Covers seamless and welded austenitic stainless steel pipe for high-temperature and general corrosive service",
    year_range: "1940-present",
  },
};

/**
 * API standards for oil & gas industry
 */
export const API_STANDARDS: Record<string, StandardInfo> = {
  "5L": {
    name: "API 5L",
    type: "pipe_specification",
    description: "Line Pipe",
    materials: [],
    references: [],
    related: ["5LC", "5LD"],
    scope: "Covers seamless and welded steel line pipe for pipeline transportation systems",
    year_range: "1926-present",
  },
  "5LC": {
    name: "API 5LC",
    type: "pipe_specification",
    description: "CRA Line Pipe",
    materials: ["S31803", "S32205", "S32750", "N08825", "N06625"],
    references: ["ASTM A790", "ASTM A789"],
    related: ["5L", "5LD"],
    scope: "Covers corrosion-resistant alloy seamless and welded line pipe",
    year_range: "1991-present",
  },
  "5CT": {
    name: "API 5CT",
    type: "pipe_specification",
    description: "Casing and Tubing",
    materials: [],
    references: [],
    related: [],
    scope: "Covers casing and tubing for oil and gas wells",
    year_range: "1928-present",
  },
};

/**
 * NACE/ISO standards for corrosion and sour service
 */
export const NACE_STANDARDS: Record<string, StandardInfo> = {
  "MR0175": {
    name: "NACE MR0175 / ISO 15156",
    type: "compliance_requirement",
    description: "Petroleum and natural gas industries — Materials for use in H₂S-containing environments in oil and gas production",
    materials: [],
    references: [],
    related: ["MR0103"],
    scope: "Gives requirements and recommendations for selection and qualification of metallic materials for service in equipment used in oil and gas production and natural gas treatment plants in H₂S-containing environments",
    year_range: "1975-present",
  },
  "MR0103": {
    name: "NACE MR0103 / ISO 17945",
    type: "compliance_requirement",
    description: "Petroleum, petrochemical and natural gas industries — Metallic materials resistant to sulfide stress cracking in corrosive petroleum refining environments",
    materials: [],
    references: [],
    related: ["MR0175"],
    scope: "Covers material requirements for resistance to sulfide stress cracking in refinery environments",
    year_range: "2003-present",
  },
};

// ============================================================================
// Materials Database (Public Knowledge)
// ============================================================================

/**
 * Common duplex and super duplex stainless steel grades
 *
 * NOTE: PREN ranges are calculated from nominal chemistry (public knowledge).
 * Actual values depend on specific heat chemistry from user's documents.
 */
export const MATERIALS: Record<string, MaterialInfo> = {
  "S31803": {
    uns: "S31803",
    trade_names: ["2205", "Uranus 45N", "SAF 2205", "Alloy 2205"],
    family: "duplex",
    pren_range: { min: 32, max: 36 },
    specifications: ["ASTM A790", "ASTM A789", "ASTM A240", "ASTM A182", "ASTM A928"],
    applications: ["Chemical processing", "Oil & gas", "Pulp & paper", "Desalination"],
  },
  "S32205": {
    uns: "S32205",
    trade_names: ["2205 (modern)", "SAF 2205"],
    family: "duplex",
    pren_range: { min: 34, max: 38 },
    specifications: ["ASTM A790", "ASTM A789", "ASTM A240"],
    applications: ["Chemical processing", "Oil & gas", "Marine"],
  },
  "S32750": {
    uns: "S32750",
    trade_names: ["2507", "SAF 2507", "Ferralium 255"],
    family: "super_duplex",
    pren_range: { min: 40, max: 44 },
    specifications: ["ASTM A790", "ASTM A789", "ASTM A240", "ASTM A182"],
    applications: ["Offshore oil & gas", "Seawater systems", "Chemical processing"],
  },
  "S32760": {
    uns: "S32760",
    trade_names: ["Zeron 100"],
    family: "super_duplex",
    pren_range: { min: 40, max: 45 },
    specifications: ["ASTM A790", "ASTM A789", "ASTM A240"],
    applications: ["Offshore oil & gas", "Severe chloride environments"],
  },
  "S32304": {
    uns: "S32304",
    trade_names: ["2304", "SAF 2304", "Uranus 35N"],
    family: "duplex",
    pren_range: { min: 24, max: 28 },
    specifications: ["ASTM A790", "ASTM A789", "ASTM A240"],
    applications: ["Structural", "Storage tanks", "Bridges"],
  },
  "S30400": {
    uns: "S30400",
    trade_names: ["304", "18-8"],
    family: "austenitic",
    specifications: ["ASTM A312", "ASTM A240", "ASTM A269"],
    applications: ["Food processing", "Chemical processing", "General purpose"],
  },
  "S31600": {
    uns: "S31600",
    trade_names: ["316", "18-10-2"],
    family: "austenitic",
    specifications: ["ASTM A312", "ASTM A240", "ASTM A269"],
    applications: ["Marine", "Chemical processing", "Pharmaceutical"],
  },
  "S31603": {
    uns: "S31603",
    trade_names: ["316L"],
    family: "austenitic",
    specifications: ["ASTM A312", "ASTM A240", "ASTM A269"],
    applications: ["Welded structures", "Chemical processing", "Pharmaceutical"],
  },
  "N08825": {
    uns: "N08825",
    trade_names: ["Incoloy 825", "Alloy 825"],
    family: "nickel_alloy",
    specifications: ["ASTM B423", "ASTM B163", "ASTM B564"],
    applications: ["Sour gas", "Acid processing", "Nuclear"],
  },
  "N06625": {
    uns: "N06625",
    trade_names: ["Inconel 625", "Alloy 625"],
    family: "nickel_alloy",
    specifications: ["ASTM B443", "ASTM B444", "ASTM B446"],
    applications: ["Subsea", "Aerospace", "Severe corrosion"],
  },
};

// ============================================================================
// Compliance Requirements (Public Knowledge)
// ============================================================================

/**
 * Common compliance requirements from NACE and other standards
 *
 * NOTE: These are general guidelines. Specific limits depend on
 * environmental conditions and must be verified from user's documents.
 */
export const COMPLIANCE_REQUIREMENTS: ComplianceRequirement[] = [
  {
    standard: "NACE MR0175 / ISO 15156",
    type: "hardness",
    description: "Maximum hardness limits for H₂S service",
    applies_to: ["duplex", "super_duplex", "austenitic"],
    key_limits: {
      duplex_typical: "28-32 HRC depending on environment",
      austenitic_typical: "22 HRC",
      note: "Actual limits depend on H₂S partial pressure, temperature, and chloride content",
    },
  },
  {
    standard: "NACE MR0175 / ISO 15156",
    type: "heat_treatment",
    description: "Solution annealing requirements",
    applies_to: ["duplex", "super_duplex"],
    key_limits: {
      condition: "Solution annealed and water quenched",
      note: "Must be in solution-annealed condition for sour service",
    },
  },
  {
    standard: "ASTM A923",
    type: "testing",
    description: "Detection of detrimental intermetallic phases",
    applies_to: ["duplex", "super_duplex"],
    key_limits: {
      methods: "Method A (sodium hydroxide etch), Method B (Charpy impact), Method C (ferric chloride corrosion)",
      note: "Required to verify absence of sigma/chi phases",
    },
  },
  {
    standard: "General",
    type: "microstructure",
    description: "Ferrite-austenite balance",
    applies_to: ["duplex", "super_duplex"],
    key_limits: {
      ferrite_range: "40-60%",
      ideal: "50/50 balance",
      note: "Typically specified as 35-65% ferrite acceptable range",
    },
  },
];

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all standards for a given material
 */
export function getStandardsForMaterial(uns: string): StandardInfo[] {
  const results: StandardInfo[] = [];
  const allStandards = { ...ASTM_STANDARDS, ...API_STANDARDS, ...NACE_STANDARDS };

  for (const standard of Object.values(allStandards)) {
    if (standard.materials.includes(uns.toUpperCase())) {
      results.push(standard);
    }
  }

  return results;
}

/**
 * Get material info by UNS number or trade name
 */
export function getMaterialInfo(identifier: string): MaterialInfo | undefined {
  const upper = identifier.toUpperCase();

  // Direct UNS lookup
  if (MATERIALS[upper]) {
    return MATERIALS[upper];
  }

  // Trade name lookup
  for (const material of Object.values(MATERIALS)) {
    if (material.trade_names.some((n) => n.toUpperCase() === upper)) {
      return material;
    }
  }

  return undefined;
}

/**
 * Get compliance requirements for a material family
 */
export function getComplianceRequirements(family: MaterialInfo["family"]): ComplianceRequirement[] {
  return COMPLIANCE_REQUIREMENTS.filter((r) => r.applies_to.includes(family));
}

/**
 * Get related standards for a given standard
 */
export function getRelatedStandards(standardKey: string): StandardInfo[] {
  const allStandards = { ...ASTM_STANDARDS, ...API_STANDARDS, ...NACE_STANDARDS };
  const standard = allStandards[standardKey.toUpperCase()];

  if (!standard) return [];

  const related: StandardInfo[] = [];
  for (const relKey of [...standard.related, ...standard.references]) {
    const relStandard = allStandards[relKey.replace(/^ASTM\s*/i, "").toUpperCase()];
    if (relStandard) {
      related.push(relStandard);
    }
  }

  return related;
}

/**
 * Get PREN guidance for a material
 */
export function getPRENGuidance(uns: string): string | undefined {
  const material = MATERIALS[uns.toUpperCase()];
  if (!material || !material.pren_range) return undefined;

  const { min, max } = material.pren_range;
  return `Typical PREN range for ${uns}: ${min}-${max} (based on nominal chemistry). ` +
         `PREN = %Cr + (3.3 × %Mo) + (16 × %N). ` +
         `Actual value depends on specific heat chemistry from your documents.`;
}

/**
 * Check if a material is covered by a specific standard
 */
export function isMaterialCoveredByStandard(uns: string, standardKey: string): boolean {
  const allStandards = { ...ASTM_STANDARDS, ...API_STANDARDS };
  const standard = allStandards[standardKey.toUpperCase()];

  if (!standard) return false;
  return standard.materials.includes(uns.toUpperCase());
}
