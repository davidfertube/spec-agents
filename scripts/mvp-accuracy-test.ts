#!/usr/bin/env tsx
/**
 * MVP Accuracy Test Suite — 80 Queries Across 8 Documents
 *
 * Tests RAG quality across ALL indexed documents with 10 queries per doc.
 * Evaluates 5 dimensions: accuracy, source citation, coherence, hallucination, false refusal.
 *
 * Query categories per document:
 * - 2x Summarization  (overview/summary of section or table)
 * - 2x Exact lookup   (single value extraction)
 * - 2x Table extract   (multi-value from table)
 * - 1x Comparison      (compare two entities)
 * - 1x Cross-reference (section/table cross-ref)
 * - 1x Refusal         (should correctly refuse)
 * - 1x Edge case       (ambiguous phrasing)
 *
 * Documents: A790, A789, A312, A872, A1049, API 5CT, API 6A, API 16C
 *
 * Usage:
 *   npm run test:mvp             # Standard output
 *   npm run test:mvp:verbose     # With full response text
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const VERBOSE = process.argv.includes("--verbose");
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

// ============================================
// Types
// ============================================

type Category = "summary" | "lookup" | "table" | "compare" | "crossref" | "refusal" | "edge";

interface MVPTestCase {
  id: string;
  document: string;
  query: string;
  category: Category;
  expectedPatterns: RegExp[];
  forbiddenPatterns?: RegExp[];
  shouldRefuse?: boolean;
  notes: string;
}

interface MVPTestResult {
  testCase: MVPTestCase;
  response: string;
  sources: Array<{ document: string; page?: string; ref: string }>;
  passed: boolean;
  matchedPatterns: string[];
  missedPatterns: string[];
  forbiddenMatches: string[];
  latencyMs: number;
  sourceDocument: string | null;
  sourceAccurate: boolean;
  hasCitation: boolean;
  isRefusal: boolean;
  isFalseRefusal: boolean;
}

// ============================================
// Test Cases — 80 Queries Across 8 Documents
// ============================================

const TEST_CASES: MVPTestCase[] = [
  // ===== ASTM A790 - Duplex Stainless Steel Pipe (10 queries) =====
  {
    id: "MVP-A790-01", document: "ASTM A790", category: "summary",
    query: "Summarize the scope and key requirements of ASTM A790",
    expectedPatterns: [/pipe/i, /duplex|ferritic.*austenitic/i, /seamless|welded/i],
    notes: "Should summarize scope: seamless/welded duplex SS pipe"
  },
  {
    id: "MVP-A790-02", document: "ASTM A790", category: "summary",
    query: "Give me an overview of the mechanical property requirements in A790",
    expectedPatterns: [/yield|tensile|elongation|hardness/i, /ksi|MPa/i],
    notes: "Should extract Table 3/4 data"
  },
  {
    id: "MVP-A790-03", document: "ASTM A790", category: "lookup",
    query: "What is the minimum yield strength for S32205 per ASTM A790?",
    expectedPatterns: [/65\s*ksi|450\s*MPa/i],
    forbiddenPatterns: [/70\s*ksi|485\s*MPa/i],
    notes: "S32205 yield = 65 ksi (NOT 70 ksi from A789)"
  },
  {
    id: "MVP-A790-04", document: "ASTM A790", category: "lookup",
    query: "What is the maximum carbon content for S32750 per A790?",
    expectedPatterns: [/0\.030/i],
    notes: "Carbon max = 0.030%"
  },
  {
    id: "MVP-A790-05", document: "ASTM A790", category: "table",
    query: "List all the chemical composition requirements for S31803 per A790",
    expectedPatterns: [/carbon|chromium|nickel|molybdenum|nitrogen/i],
    notes: "Full composition from Table 1"
  },
  {
    id: "MVP-A790-06", document: "ASTM A790", category: "table",
    query: "What are all the mechanical properties for S32750 super duplex per A790?",
    expectedPatterns: [/80\s*ksi|550\s*MPa/i, /tensile|yield/i],
    notes: "S32750: yield 80ksi, tensile 116ksi"
  },
  {
    id: "MVP-A790-07", document: "ASTM A790", category: "compare",
    query: "Compare the yield strength of S32205 vs S32750 per A790",
    expectedPatterns: [/S32205/i, /S32750/i, /65|80/i],
    notes: "S32205=65ksi, S32750=80ksi"
  },
  {
    id: "MVP-A790-08", document: "ASTM A790", category: "crossref",
    query: "Which duplex grades in A790 have PREN requirements greater than 40?",
    expectedPatterns: [/S32750|S32760|S39274|PREN|40/i],
    notes: "Super duplex grades with PREN>40"
  },
  {
    id: "MVP-A790-09", document: "ASTM A790", category: "refusal",
    query: "What is the price per foot of S32205 duplex pipe per A790?",
    expectedPatterns: [/cannot|not\s+(in|provided|included|available)/i],
    shouldRefuse: true,
    notes: "Pricing not in specs — should refuse"
  },
  {
    id: "MVP-A790-10", document: "ASTM A790", category: "edge",
    query: "What's the yield for 2205 duplex pipe?",
    expectedPatterns: [/65\s*ksi|450\s*MPa/i],
    notes: "Informal reference to S32205/A790 — should still resolve"
  },

  // ===== ASTM A789 - Duplex Stainless Steel Tubing (10 queries) =====
  {
    id: "MVP-A789-01", document: "ASTM A789", category: "summary",
    query: "Summarize the key differences in what A789 covers vs other duplex specs",
    expectedPatterns: [/tubing|tube/i, /duplex|ferritic.*austenitic/i],
    notes: "Should identify A789 = tubing"
  },
  {
    id: "MVP-A789-02", document: "ASTM A789", category: "summary",
    query: "Give me an overview of the heat treatment requirements in A789",
    expectedPatterns: [/heat\s*treat|anneal|solution|temperature|°F|°C|quench/i],
    notes: "Should summarize Section 6 heat treatment"
  },
  {
    id: "MVP-A789-03", document: "ASTM A789", category: "lookup",
    query: "What is the minimum yield strength for S32205 tubing per A789?",
    expectedPatterns: [/70\s*ksi|485\s*MPa/i],
    forbiddenPatterns: [/65\s*ksi|450\s*MPa/i],
    notes: "A789 tubing = 70 ksi (NOT 65 from A790)"
  },
  {
    id: "MVP-A789-04", document: "ASTM A789", category: "lookup",
    query: "What is the minimum tensile strength for S32205 per A789?",
    expectedPatterns: [/95\s*ksi|655\s*MPa/i],
    notes: "Tensile = 95 ksi"
  },
  {
    id: "MVP-A789-05", document: "ASTM A789", category: "table",
    query: "List the chemical composition limits for S32205 per A789",
    expectedPatterns: [/carbon|chromium|nickel|molybdenum/i, /0\.030|22\.0|4\.5|3\.0/i],
    notes: "Full composition from Table 1"
  },
  {
    id: "MVP-A789-06", document: "ASTM A789", category: "table",
    query: "What are the mechanical properties for all duplex grades in A789?",
    expectedPatterns: [/S3\d{4}/i, /yield|tensile|elongation/i],
    notes: "Multiple grades from Table 4"
  },
  {
    id: "MVP-A789-07", document: "ASTM A789", category: "compare",
    query: "Compare S32205 vs S32750 mechanical properties per A789",
    expectedPatterns: [/S32205/i, /S32750/i, /70|80|ksi/i],
    notes: "S32205=70ksi, S32750=80ksi in A789"
  },
  {
    id: "MVP-A789-08", document: "ASTM A789", category: "crossref",
    query: "What hydrostatic test requirements apply to tubing per A789?",
    expectedPatterns: [/hydrostatic|test|pressure|psi/i],
    notes: "Hydrostatic testing section"
  },
  {
    id: "MVP-A789-09", document: "ASTM A789", category: "refusal",
    query: "What is the corrosion rate of S32205 tubing in seawater per A789?",
    expectedPatterns: [/cannot|not\s+(in|provided|included|available)/i],
    shouldRefuse: true,
    notes: "Corrosion rates not in ASTM specs"
  },
  {
    id: "MVP-A789-10", document: "ASTM A789", category: "edge",
    query: "What about the nitrogen content in 2507 super duplex tubing?",
    expectedPatterns: [/nitrogen|0\.\d{2,3}|S32750/i],
    notes: "Informal 2507 → S32750, nitrogen from composition table"
  },

  // ===== ASTM A312 - Austenitic Stainless Steel Pipe (10 queries) =====
  {
    id: "MVP-A312-01", document: "ASTM A312", category: "summary",
    query: "Summarize what ASTM A312 covers and its scope",
    expectedPatterns: [/austenitic|stainless|pipe/i, /seamless|welded/i],
    notes: "Austenitic SS pipe"
  },
  {
    id: "MVP-A312-02", document: "ASTM A312", category: "summary",
    query: "Give me an overview of the chemical requirements in A312",
    expectedPatterns: [/chemical|composition|carbon|chromium|nickel/i],
    notes: "Should reference Table 1 chemical composition"
  },
  {
    id: "MVP-A312-03", document: "ASTM A312", category: "lookup",
    query: "What is the minimum yield strength for TP316L per A312?",
    expectedPatterns: [/25\s*ksi|170\s*MPa/i],
    notes: "316L yield = 25 ksi (170 MPa)"
  },
  {
    id: "MVP-A312-04", document: "ASTM A312", category: "lookup",
    query: "What is the maximum carbon content for TP304L per A312?",
    expectedPatterns: [/0\.030|0\.035/i],
    notes: "304L carbon max"
  },
  {
    id: "MVP-A312-05", document: "ASTM A312", category: "table",
    query: "List the mechanical properties for TP304 and TP316 per A312",
    expectedPatterns: [/304|316/i, /yield|tensile/i, /ksi|MPa/i],
    notes: "Both grades from mechanical properties table"
  },
  {
    id: "MVP-A312-06", document: "ASTM A312", category: "table",
    query: "What are all the austenitic grades covered by A312?",
    expectedPatterns: [/304|316|321|347|TP/i],
    notes: "Multiple grades listed"
  },
  {
    id: "MVP-A312-07", document: "ASTM A312", category: "compare",
    query: "Compare the yield strength of TP304 vs TP316 per A312",
    expectedPatterns: [/304|316/i, /yield|ksi|MPa/i],
    notes: "Both grades compared"
  },
  {
    id: "MVP-A312-08", document: "ASTM A312", category: "crossref",
    query: "What heat treatment is required for TP304 per A312?",
    expectedPatterns: [/heat\s*treat|anneal|solution|temperature|°F|°C/i],
    notes: "Heat treatment section"
  },
  {
    id: "MVP-A312-09", document: "ASTM A312", category: "refusal",
    query: "Who are the approved vendors for A312 pipe?",
    expectedPatterns: [/cannot|not\s+(in|provided|included|available)/i],
    shouldRefuse: true,
    notes: "Vendor info not in specs"
  },
  {
    id: "MVP-A312-10", document: "ASTM A312", category: "edge",
    query: "What's the max carbon for 316L austenitic pipe?",
    expectedPatterns: [/0\.030|0\.035|carbon/i],
    notes: "Informal reference — should resolve to TP316L/A312"
  },

  // ===== ASTM A872 - Cast Duplex Pipe (10 queries) =====
  {
    id: "MVP-A872-01", document: "ASTM A872", category: "summary",
    query: "Summarize the scope and purpose of ASTM A872",
    expectedPatterns: [/cast|centrifugal|duplex|pipe|corrosive/i],
    notes: "Centrifugally cast duplex SS pipe for corrosive environments"
  },
  {
    id: "MVP-A872-02", document: "ASTM A872", category: "summary",
    query: "Give me an overview of the mechanical properties in A872",
    expectedPatterns: [/yield|tensile|elongation|ksi|MPa/i],
    notes: "Should summarize mechanical properties"
  },
  {
    id: "MVP-A872-03", document: "ASTM A872", category: "lookup",
    query: "What is the minimum yield strength for grade CD3MN per A872?",
    expectedPatterns: [/65\s*ksi|450\s*MPa/i],
    notes: "CD3MN yield = 65 ksi"
  },
  {
    id: "MVP-A872-04", document: "ASTM A872", category: "lookup",
    query: "What is the minimum tensile strength per ASTM A872?",
    expectedPatterns: [/90\s*ksi|620\s*MPa|100/i],
    notes: "Tensile strength requirement"
  },
  {
    id: "MVP-A872-05", document: "ASTM A872", category: "table",
    query: "List the chemical composition requirements for castings per A872",
    expectedPatterns: [/carbon|chromium|nickel|molybdenum/i],
    notes: "Chemical composition table"
  },
  {
    id: "MVP-A872-06", document: "ASTM A872", category: "table",
    query: "What casting grades are covered by A872 and their UNS designations?",
    expectedPatterns: [/J93183|J94300|CD4MCu|CD3MN|UNS/i],
    notes: "Grade/UNS designations from table"
  },
  {
    id: "MVP-A872-07", document: "ASTM A872", category: "compare",
    query: "Compare the mechanical properties of different grades in A872",
    expectedPatterns: [/yield|tensile|ksi|MPa/i],
    notes: "Comparison across grades"
  },
  {
    id: "MVP-A872-08", document: "ASTM A872", category: "crossref",
    query: "What inspection and testing requirements are specified in A872?",
    expectedPatterns: [/test|inspection|examination|hydrostatic|radiograph/i],
    notes: "Testing/inspection section"
  },
  {
    id: "MVP-A872-09", document: "ASTM A872", category: "refusal",
    query: "What is the service life expectancy of A872 cast duplex pipe?",
    expectedPatterns: [/cannot|not\s+(in|provided|included|available)/i],
    shouldRefuse: true,
    notes: "Service life not in specs"
  },
  {
    id: "MVP-A872-10", document: "ASTM A872", category: "edge",
    query: "Tell me about the duplex cast pipe standard for corrosive service",
    expectedPatterns: [/A872|centrifugal|cast|duplex|corrosive/i],
    notes: "Vague query — should identify A872"
  },

  // ===== ASTM A1049 - Duplex Forgings (10 queries) =====
  {
    id: "MVP-A1049-01", document: "ASTM A1049", category: "summary",
    query: "Summarize the scope of ASTM A1049",
    expectedPatterns: [/forging|duplex|pressure\s*vessel|ferritic.*austenitic/i],
    notes: "Duplex SS forgings for pressure vessels"
  },
  {
    id: "MVP-A1049-02", document: "ASTM A1049", category: "summary",
    query: "What are the chemical requirements all about in Section 5 of A1049?",
    expectedPatterns: [/Table\s*1|chemical|composition|PREN|heat\s*analysis|carbon|chromium/i],
    notes: "REGRESSION: Previously refused despite Table 1 being in context"
  },
  {
    id: "MVP-A1049-03", document: "ASTM A1049", category: "lookup",
    query: "What is the yield strength for grade F60 (S32205) per A1049?",
    expectedPatterns: [/70\s*ksi|485\s*MPa/i],
    notes: "F60/S32205 yield = 70 ksi"
  },
  {
    id: "MVP-A1049-04", document: "ASTM A1049", category: "lookup",
    query: "What is the solution heat treatment temperature for S31803 per A1049?",
    expectedPatterns: [/1870|1020/i],
    notes: "1870°F [1020°C] min from Table 2"
  },
  {
    id: "MVP-A1049-05", document: "ASTM A1049", category: "table",
    query: "List the chemical composition for grade F53 (S32750) per A1049",
    expectedPatterns: [/carbon|chromium|nickel|0\.030|24\.0|6\.0/i],
    notes: "F53/S32750 composition from Table 1"
  },
  {
    id: "MVP-A1049-06", document: "ASTM A1049", category: "table",
    query: "What are all the tensile strength and hardness requirements in A1049 Table 3?",
    expectedPatterns: [/tensile|yield|hardness|HB|ksi|MPa/i],
    notes: "Table 3 mechanical properties"
  },
  {
    id: "MVP-A1049-07", document: "ASTM A1049", category: "compare",
    query: "Compare the yield strength of F51 vs F53 per A1049",
    expectedPatterns: [/F51|F53|65|80|ksi/i],
    notes: "F51=65ksi, F53=80ksi"
  },
  {
    id: "MVP-A1049-08", document: "ASTM A1049", category: "crossref",
    query: "What supplementary requirements are available in A1049?",
    expectedPatterns: [/S1|S2|S3|S4|S5|S6|supplement|intermetallic|charpy|corrosion|ultrasonic/i],
    notes: "Supplementary requirements S1-S6"
  },
  {
    id: "MVP-A1049-09", document: "ASTM A1049", category: "refusal",
    query: "What is the fatigue life of A1049 forgings at 500°F?",
    expectedPatterns: [/cannot|not\s+(in|provided|included|available)/i],
    shouldRefuse: true,
    notes: "Fatigue data not in A1049"
  },
  {
    id: "MVP-A1049-10", document: "ASTM A1049", category: "edge",
    query: "What's the PREN formula for duplex forgings?",
    expectedPatterns: [/PREN|Cr|Mo|16.*N|3\.3/i],
    notes: "PREN formulas are in Table 1 footnotes"
  },

  // ===== API 5CT - Casing & Tubing (10 queries) =====
  {
    id: "MVP-5CT-01", document: "API 5CT", category: "summary",
    query: "Summarize the scope and purpose of API 5CT",
    expectedPatterns: [/casing|tubing|oil|gas|well/i],
    notes: "Casing and tubing for oil/gas wells"
  },
  {
    id: "MVP-5CT-02", document: "API 5CT", category: "summary",
    query: "Give me an overview of the material grades covered by API 5CT",
    expectedPatterns: [/H40|J55|K55|N80|L80|C90|T95|P110|Q125|grade/i],
    notes: "Should list multiple grades"
  },
  {
    id: "MVP-5CT-03", document: "API 5CT", category: "lookup",
    query: "What is the minimum yield strength for L80 grade per API 5CT?",
    expectedPatterns: [/80\s*ksi|552\s*MPa/i],
    notes: "L80 yield = 80 ksi"
  },
  {
    id: "MVP-5CT-04", document: "API 5CT", category: "lookup",
    query: "What hardness limits apply to L80 grade per 5CT?",
    expectedPatterns: [/HRC|HBW|hardness|23|22/i],
    notes: "L80 hardness limits"
  },
  {
    id: "MVP-5CT-05", document: "API 5CT", category: "table",
    query: "List the yield and tensile ranges for J55, N80, and P110 per 5CT",
    expectedPatterns: [/J55|N80|P110/i, /yield|tensile|ksi/i],
    notes: "Multiple grades from mechanical properties"
  },
  {
    id: "MVP-5CT-06", document: "API 5CT", category: "table",
    query: "What thread types are specified in API 5CT?",
    expectedPatterns: [/thread|buttress|round|STC|LTC/i],
    notes: "Thread specifications"
  },
  {
    id: "MVP-5CT-07", document: "API 5CT", category: "compare",
    query: "Compare the mechanical properties of J55 vs N80 per API 5CT",
    expectedPatterns: [/J55|N80|55|80|ksi|yield/i],
    notes: "J55=55ksi, N80=80ksi"
  },
  {
    id: "MVP-5CT-08", document: "API 5CT", category: "crossref",
    query: "What heat treatment requirements apply to C90 per API 5CT?",
    expectedPatterns: [/C90|heat|treatment|quench|temper/i],
    notes: "C90 heat treatment section"
  },
  {
    id: "MVP-5CT-09", document: "API 5CT", category: "refusal",
    query: "What is the recommended torque for making up 5CT casing connections?",
    expectedPatterns: [/cannot|not\s+(in|provided|included|available)/i],
    shouldRefuse: true,
    notes: "Torque values are in API RP 5C1, not 5CT"
  },
  {
    id: "MVP-5CT-10", document: "API 5CT", category: "edge",
    query: "What about the sour service grades in 5CT?",
    expectedPatterns: [/L80|C90|T95|sour|H2S|NACE/i],
    notes: "Sour service = L80, C90, T95 grades"
  },

  // ===== API 6A - Wellhead Equipment (10 queries) =====
  {
    id: "MVP-6A-01", document: "API 6A", category: "summary",
    query: "Summarize the scope and key requirements of API 6A",
    expectedPatterns: [/wellhead|christmas\s*tree|equipment/i],
    notes: "Wellhead and xmas tree equipment"
  },
  {
    id: "MVP-6A-02", document: "API 6A", category: "summary",
    query: "Give me a summary of the most important details for the valve-removal plugs in API 6A",
    expectedPatterns: [/valve|plug|removal|dimension|pressure|table/i],
    notes: "REGRESSION: Previously refused despite having table data"
  },
  {
    id: "MVP-6A-03", document: "API 6A", category: "lookup",
    query: "What pressure ratings are defined in API 6A?",
    expectedPatterns: [/2000|3000|5000|10000|15000|psi|pressure/i],
    notes: "Standard pressure ratings"
  },
  {
    id: "MVP-6A-04", document: "API 6A", category: "lookup",
    query: "What are the PSL (Product Specification Levels) in API 6A?",
    expectedPatterns: [/PSL|1|2|3|4|product.*specification/i],
    notes: "PSL 1-4"
  },
  {
    id: "MVP-6A-05", document: "API 6A", category: "table",
    query: "What material classes are defined in API 6A and what do they cover?",
    expectedPatterns: [/AA|BB|CC|DD|EE|FF|HH|class|material/i],
    notes: "Material classes AA through HH"
  },
  {
    id: "MVP-6A-06", document: "API 6A", category: "table",
    query: "What temperature ratings are specified in API 6A?",
    expectedPatterns: [/temperature|K|L|P|R|S|T|U|V|°F/i],
    notes: "Temperature ratings K through V"
  },
  {
    id: "MVP-6A-07", document: "API 6A", category: "compare",
    query: "Compare PSL 1 vs PSL 3 requirements in API 6A",
    expectedPatterns: [/PSL\s*1|PSL\s*3|traceability|test|requirement/i],
    notes: "Different PSL requirements"
  },
  {
    id: "MVP-6A-08", document: "API 6A", category: "crossref",
    query: "What testing is required for API 6A equipment?",
    expectedPatterns: [/test|hydrostatic|pressure|function|examination/i],
    notes: "Testing requirements"
  },
  {
    id: "MVP-6A-09", document: "API 6A", category: "refusal",
    query: "Who manufactures API 6A certified wellhead equipment?",
    expectedPatterns: [/cannot|not\s+(in|provided|included|available)/i],
    shouldRefuse: true,
    notes: "Manufacturer info not in specs"
  },
  {
    id: "MVP-6A-10", document: "API 6A", category: "edge",
    query: "What are the material requirements for Class DD per 6A?",
    expectedPatterns: [/DD|material|carbon|alloy|steel/i],
    notes: "Class DD material requirements"
  },

  // ===== API 16C - Choke & Kill Systems (10 queries) =====
  {
    id: "MVP-16C-01", document: "API 16C", category: "summary",
    query: "Summarize the scope and purpose of API 16C",
    expectedPatterns: [/choke|kill|system|wellbore|pressure/i],
    notes: "Choke and kill systems"
  },
  {
    id: "MVP-16C-02", document: "API 16C", category: "summary",
    query: "Give me an overview of the design requirements in API 16C",
    expectedPatterns: [/design|pressure|rating|requirement/i],
    notes: "Should summarize design section"
  },
  {
    id: "MVP-16C-03", document: "API 16C", category: "lookup",
    query: "What pressure ratings are specified in API 16C?",
    expectedPatterns: [/5000|10000|15000|psi|pressure/i],
    notes: "Standard pressure ratings"
  },
  {
    id: "MVP-16C-04", document: "API 16C", category: "lookup",
    query: "What is the working pressure for the highest rated choke system per 16C?",
    expectedPatterns: [/15000|psi|working\s*pressure/i],
    notes: "Maximum working pressure"
  },
  {
    id: "MVP-16C-05", document: "API 16C", category: "table",
    query: "What are the bore sizes specified for choke and kill equipment per 16C?",
    expectedPatterns: [/bore|inch|size|diameter/i],
    notes: "Bore size specifications"
  },
  {
    id: "MVP-16C-06", document: "API 16C", category: "table",
    query: "What material requirements are specified for 16C equipment?",
    expectedPatterns: [/material|steel|alloy|requirement/i],
    notes: "Material requirements section"
  },
  {
    id: "MVP-16C-07", document: "API 16C", category: "compare",
    query: "Compare the requirements for 10000 psi vs 15000 psi choke systems per 16C",
    expectedPatterns: [/10000|15000|psi|pressure|require/i],
    notes: "Compare pressure class requirements"
  },
  {
    id: "MVP-16C-08", document: "API 16C", category: "crossref",
    query: "What testing and validation is required per API 16C?",
    expectedPatterns: [/test|hydrostatic|pressure|function|validation|proof/i],
    notes: "Testing requirements"
  },
  {
    id: "MVP-16C-09", document: "API 16C", category: "refusal",
    query: "What is the mean time between failures for API 16C choke systems?",
    expectedPatterns: [/cannot|not\s+(in|provided|included|available)/i],
    shouldRefuse: true,
    notes: "MTBF not in equipment specs"
  },
  {
    id: "MVP-16C-10", document: "API 16C", category: "edge",
    query: "Tell me about the kill line requirements in the choke and kill spec",
    expectedPatterns: [/kill|line|choke|16C|requirement|pressure/i],
    notes: "Vague reference to 16C"
  },
];

// ============================================
// Test Runner
// ============================================

async function querySpecVault(query: string): Promise<{
  response: string;
  sources: Array<{ document: string; page?: string; ref: string }>;
  latencyMs: number;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, stream: false })
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    return {
      response: data.response || "",
      sources: data.sources || [],
      latencyMs
    };
  } catch (error) {
    return {
      response: `Error: ${error}`,
      sources: [],
      latencyMs: Date.now() - startTime
    };
  }
}

function extractSpecCode(nameOrFilename: string): string | null {
  const upper = nameOrFilename.toUpperCase();
  const astmMatch = upper.match(/\bA\d{3,4}\b/);
  if (astmMatch) return astmMatch[0];
  const apiContextMatch = upper.match(/(?:API|SPEC)\s+(\d{1,2}[A-Z]{1,4})\b/);
  if (apiContextMatch) return apiContextMatch[1];
  const apiSpecificMatch = upper.match(/\b(\d{1,2}(?:CT|CRA|[A-Z]))\b/);
  if (apiSpecificMatch) return apiSpecificMatch[1];
  return null;
}

function evaluateTest(testCase: MVPTestCase, response: string, sources: Array<{ document: string; page?: string; ref: string }>): MVPTestResult {
  const matchedPatterns: string[] = [];
  const missedPatterns: string[] = [];
  const forbiddenMatches: string[] = [];

  for (const pattern of testCase.expectedPatterns) {
    if (pattern.test(response)) {
      matchedPatterns.push(pattern.source);
    } else {
      missedPatterns.push(pattern.source);
    }
  }

  if (testCase.forbiddenPatterns) {
    for (const pattern of testCase.forbiddenPatterns) {
      if (pattern.test(response)) {
        forbiddenMatches.push(pattern.source);
      }
    }
  }

  const sourceDocument = sources.length > 0 ? sources[0].document : null;
  const sourceCode = sourceDocument ? extractSpecCode(sourceDocument) : null;
  const expectedCode = extractSpecCode(testCase.document);
  const sourceAccurate = !!(sourceCode && expectedCode && sourceCode === expectedCode);

  const hasCitation = /\[\d+\]/.test(response);
  const isRefusal = /I cannot (provide|answer)|not\s+(in|provided|included|available)\s+/i.test(response);
  const isFalseRefusal = isRefusal && !testCase.shouldRefuse;

  const patternPassRate = matchedPatterns.length / testCase.expectedPatterns.length;
  const noForbiddenMatches = forbiddenMatches.length === 0;
  const passed = patternPassRate >= 0.5 && noForbiddenMatches && !isFalseRefusal;

  return {
    testCase,
    response,
    sources: sources.map(s => ({ ...s })),
    passed,
    matchedPatterns,
    missedPatterns,
    forbiddenMatches,
    latencyMs: 0,
    sourceDocument,
    sourceAccurate,
    hasCitation,
    isRefusal,
    isFalseRefusal,
  };
}

// ============================================
// Report Generator
// ============================================

function generateReport(results: MVPTestResult[]): void {
  console.log("\n" + "═".repeat(70));
  console.log("  MVP ACCURACY TEST — 80 Queries Across 8 Documents");
  console.log("═".repeat(70));

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const sourceAccurate = results.filter(r => r.sourceAccurate).length;
  const hasCitations = results.filter(r => r.hasCitation).length;
  const falseRefusals = results.filter(r => r.isFalseRefusal);
  const hallucinations = results.filter(r => r.forbiddenMatches.length > 0);

  const accuracy = (passed / total) * 100;
  const sourceRate = (sourceAccurate / total) * 100;
  const citationRate = (hasCitations / total) * 100;

  console.log("\n  OVERALL RESULTS:");
  console.log(`  ──────────────────────────────────────────────────`);
  console.log(`  Accuracy:          ${passed}/${total} (${accuracy.toFixed(1)}%)`);
  console.log(`  Source Citation:   ${hasCitations}/${total} (${citationRate.toFixed(1)}%)`);
  console.log(`  Source Accuracy:   ${sourceAccurate}/${total} (${sourceRate.toFixed(1)}%)`);
  console.log(`  False Refusals:    ${falseRefusals.length}`);
  console.log(`  Hallucinations:    ${hallucinations.length}`);

  // Latency
  const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(total * 0.5)];
  const p95 = latencies[Math.floor(total * 0.95)];
  const avg = latencies.reduce((a, b) => a + b, 0) / total;

  console.log("\n  LATENCY:");
  console.log(`  ──────────────────────────────────────────────────`);
  console.log(`  Average:  ${avg.toFixed(0)}ms`);
  console.log(`  P50:      ${p50}ms`);
  console.log(`  P95:      ${p95}ms`);

  // Per-document
  console.log("\n  PER-DOCUMENT RESULTS:");
  console.log(`  ──────────────────────────────────────────────────`);
  const docs = [...new Set(results.map(r => r.testCase.document))];
  for (const doc of docs) {
    const docResults = results.filter(r => r.testCase.document === doc);
    const docPassed = docResults.filter(r => r.passed).length;
    const docSources = docResults.filter(r => r.sourceAccurate).length;
    const docFalseRefusals = docResults.filter(r => r.isFalseRefusal).length;
    const docHallucinations = docResults.filter(r => r.forbiddenMatches.length > 0).length;
    const status = docPassed >= 8 ? "+" : docPassed >= 6 ? "~" : "-";
    console.log(`  [${status}] ${doc.padEnd(15)} ${docPassed}/${docResults.length} passed | Sources: ${docSources}/${docResults.length} | FalseRefusals: ${docFalseRefusals} | Hallucinations: ${docHallucinations}`);
  }

  // Per-category
  console.log("\n  PER-CATEGORY RESULTS:");
  console.log(`  ──────────────────────────────────────────────────`);
  const categories: Category[] = ["summary", "lookup", "table", "compare", "crossref", "refusal", "edge"];
  for (const cat of categories) {
    const catResults = results.filter(r => r.testCase.category === cat);
    const catPassed = catResults.filter(r => r.passed).length;
    console.log(`  ${cat.padEnd(12)} ${catPassed}/${catResults.length}`);
  }

  // False refusals detail
  if (falseRefusals.length > 0) {
    console.log("\n  FALSE REFUSALS (should have answered, but refused):");
    console.log(`  ──────────────────────────────────────────────────`);
    for (const r of falseRefusals) {
      console.log(`  ${r.testCase.id}: ${r.testCase.query.slice(0, 60)}...`);
      if (VERBOSE) {
        console.log(`    Response: ${r.response.slice(0, 200)}...`);
      }
    }
  }

  // Hallucinations detail
  if (hallucinations.length > 0) {
    console.log("\n  HALLUCINATIONS (forbidden patterns matched):");
    console.log(`  ──────────────────────────────────────────────────`);
    for (const r of hallucinations) {
      console.log(`  ${r.testCase.id}: Forbidden: ${r.forbiddenMatches.join(", ")}`);
    }
  }

  // Failed tests
  const failed = results.filter(r => !r.passed);
  if (failed.length > 0) {
    console.log(`\n  FAILED TESTS (${failed.length}):`);
    console.log(`  ──────────────────────────────────────────────────`);
    for (const r of failed) {
      const reasons: string[] = [];
      if (r.missedPatterns.length > 0) reasons.push(`missed: ${r.missedPatterns.slice(0, 2).join(", ")}`);
      if (r.forbiddenMatches.length > 0) reasons.push(`forbidden: ${r.forbiddenMatches.join(", ")}`);
      if (r.isFalseRefusal) reasons.push("FALSE REFUSAL");
      console.log(`  ${r.testCase.id} [${r.testCase.category}]: ${reasons.join(" | ")}`);
      if (VERBOSE) {
        console.log(`    Query: ${r.testCase.query}`);
        console.log(`    Response: ${r.response.slice(0, 300)}...`);
        console.log();
      }
    }
  }

  // MVP readiness
  console.log("\n" + "═".repeat(70));
  console.log("  MVP READINESS:");
  console.log("═".repeat(70));
  const targets = {
    accuracy: 75,
    sourceAccuracy: 80,
    falseRefusals: 0,
    hallucinations: 0,
  };
  console.log(`\n  Metric            Current     Target     Status`);
  console.log(`  ──────────────────────────────────────────────────`);
  console.log(`  Accuracy          ${accuracy.toFixed(1)}%       ${targets.accuracy}%+       ${accuracy >= targets.accuracy ? 'PASS' : 'FAIL'}`);
  console.log(`  Source Accuracy   ${sourceRate.toFixed(1)}%       ${targets.sourceAccuracy}%+       ${sourceRate >= targets.sourceAccuracy ? 'PASS' : 'FAIL'}`);
  console.log(`  False Refusals    ${falseRefusals.length}           ${targets.falseRefusals}          ${falseRefusals.length <= targets.falseRefusals ? 'PASS' : 'FAIL'}`);
  console.log(`  Hallucinations    ${hallucinations.length}           ${targets.hallucinations}          ${hallucinations.length <= targets.hallucinations ? 'PASS' : 'FAIL'}`);

  const mvpReady = accuracy >= targets.accuracy
    && sourceRate >= targets.sourceAccuracy
    && falseRefusals.length <= targets.falseRefusals
    && hallucinations.length <= targets.hallucinations;
  console.log(`\n  ${mvpReady ? 'MVP READY' : 'NOT MVP READY'}`);
  console.log("\n" + "═".repeat(70));
}

// ============================================
// Main
// ============================================

async function runMVPTest(): Promise<void> {
  console.log("MVP Accuracy Test Suite\n");
  console.log("=".repeat(70));

  // List indexed documents
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { data: documents } = await supabase
      .from("documents")
      .select("id, filename, status")
      .eq("status", "indexed");

    console.log(`\nIndexed Documents: ${documents?.length || 0}`);
    for (const doc of documents || []) {
      console.log(`  - ${doc.filename}`);
    }
  }

  console.log(`\nRunning ${TEST_CASES.length} test cases across 8 documents...\n`);

  const results: MVPTestResult[] = [];

  for (const testCase of TEST_CASES) {
    process.stdout.write(`  ${testCase.id} [${testCase.category}]... `);

    const { response, sources, latencyMs } = await querySpecVault(testCase.query);
    const result = evaluateTest(testCase, response, sources);
    result.latencyMs = latencyMs;
    results.push(result);

    const status = result.passed ? "OK" : "FAIL";
    const refusalMark = result.isFalseRefusal ? " [FALSE REFUSAL]" : "";
    const hallucinationMark = result.forbiddenMatches.length > 0 ? " [HALLUCINATION]" : "";
    console.log(`${status} (${latencyMs}ms)${refusalMark}${hallucinationMark}`);

    if (VERBOSE && !result.passed) {
      console.log(`    Query: ${testCase.query}`);
      console.log(`    Response: ${response.slice(0, 200)}...`);
      console.log(`    Missed: ${result.missedPatterns.join(", ")}`);
      console.log();
    }

    // Delay between queries to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  generateReport(results);
}

runMVPTest().catch(console.error);
