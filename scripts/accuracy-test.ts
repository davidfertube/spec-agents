#!/usr/bin/env tsx
/**
 * 80-Query Accuracy Test Suite
 *
 * Tests RAG accuracy across 8 indexed documents with:
 * - 6 medium queries per doc (single property lookup)
 * - 4 complex queries per doc (comparisons, multi-step, calculations)
 *
 * Documents tested: A790, A789, A312, A872, 5CT, 6A, 16C, 5CRA
 * (A240 and A182 excluded - not in indexed document library)
 *
 * Targets:
 * - Answer Accuracy: 75%+
 * - Source Accuracy: 80%+
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// ============================================
// Test Case Interface
// ============================================

interface TestCase {
  id: string;
  document: string;
  query: string;
  difficulty: "medium" | "complex";
  expectedPatterns: RegExp[];
  forbiddenPatterns?: RegExp[];
  notes?: string;
}

interface TestResult {
  testCase: TestCase;
  response: string;
  sources: Array<{ document: string; page?: string }>;
  passed: boolean;
  matchedPatterns: string[];
  missedPatterns: string[];
  forbiddenMatches: string[];
  latencyMs: number;
  sourceDocument: string | null;
  sourceAccurate: boolean;
}

// ============================================
// Test Cases - 100 Queries Across 10 Documents
// ============================================

const TEST_CASES: TestCase[] = [
  // ===== ASTM A790 - Duplex Stainless Steel Pipe (10 queries) =====
  {
    id: "A790-01",
    document: "ASTM A790",
    query: "What is the minimum yield strength of S32205 duplex pipe per ASTM A790?",
    difficulty: "medium",
    expectedPatterns: [/65\s*ksi|450\s*MPa/i],
    notes: "S32205 yield = 65 ksi (450 MPa)"
  },
  {
    id: "A790-02",
    document: "ASTM A790",
    query: "What is the maximum carbon content for S32750 super duplex per A790?",
    difficulty: "medium",
    expectedPatterns: [/0\.030/i],
    notes: "Carbon max = 0.030%"
  },
  {
    id: "A790-03",
    document: "ASTM A790",
    query: "What is the minimum tensile strength for S31803 per ASTM A790?",
    difficulty: "medium",
    expectedPatterns: [/90\s*ksi|620\s*MPa/i],
    notes: "Tensile = 90 ksi (620 MPa)"
  },
  {
    id: "A790-04",
    document: "ASTM A790",
    query: "What is the heat treatment temperature for S32205 per A790?",
    difficulty: "medium",
    expectedPatterns: [/1870|1020|°F|°C/i],
    notes: "1870-2010°F (1020-1100°C)"
  },
  {
    id: "A790-05",
    document: "ASTM A790",
    query: "What is the maximum hardness for duplex pipe per A790?",
    difficulty: "medium",
    expectedPatterns: [/290\s*HBW?|30\s*HRC|hardness/i],
    notes: "290 HBW or 30 HRC"
  },
  {
    id: "A790-06",
    document: "ASTM A790",
    query: "What product does ASTM A790 cover - pipe or tubing?",
    difficulty: "medium",
    expectedPatterns: [/pipe/i],
    forbiddenPatterns: [/tubing|tube/i],
    notes: "A790 = pipe, A789 = tubing"
  },
  {
    id: "A790-07",
    document: "ASTM A790",
    query: "Compare the yield strength of S32205 vs S32750 per A790",
    difficulty: "complex",
    expectedPatterns: [/S32205/i, /S32750/i, /65|80|ksi|MPa/i],
    notes: "S32205=65ksi, S32750=80ksi"
  },
  {
    id: "A790-08",
    document: "ASTM A790",
    query: "What are ALL the chemical requirements for S31803 per A790?",
    difficulty: "complex",
    expectedPatterns: [/carbon|chromium|nickel|molybdenum|nitrogen/i],
    notes: "Full composition table"
  },
  {
    id: "A790-09",
    document: "ASTM A790",
    query: "Which duplex grades in A790 have PREN greater than 40?",
    difficulty: "complex",
    expectedPatterns: [/S32750|S32760|S39274|PREN|40/i],
    notes: "Super duplex grades have PREN>40"
  },
  {
    id: "A790-10",
    document: "ASTM A790",
    query: "What is the elongation requirement for S32205 per A790 and how does it compare to S32750?",
    difficulty: "complex",
    expectedPatterns: [/elongation|25|%/i],
    notes: "Both require 25% min elongation"
  },

  // ===== ASTM A789 - Duplex Stainless Steel Tubing (10 queries) =====
  {
    id: "A789-01",
    document: "ASTM A789",
    query: "What is the minimum yield strength of S32205 duplex tubing per ASTM A789?",
    difficulty: "medium",
    expectedPatterns: [/70\s*ksi|485\s*MPa/i],
    forbiddenPatterns: [/65\s*ksi|450\s*MPa/i],
    notes: "A789 tubing = 70 ksi (different from A790 pipe)"
  },
  {
    id: "A789-02",
    document: "ASTM A789",
    query: "What is the tensile strength for S32205 per ASTM A789?",
    difficulty: "medium",
    expectedPatterns: [/95\s*ksi|655\s*MPa/i],
    notes: "Tensile = 95 ksi (655 MPa)"
  },
  {
    id: "A789-03",
    document: "ASTM A789",
    query: "What product form does ASTM A789 cover?",
    difficulty: "medium",
    expectedPatterns: [/tubing|tube/i],
    notes: "A789 = tubing"
  },
  {
    id: "A789-04",
    document: "ASTM A789",
    query: "What is the required ferrite content for duplex tubing per A789?",
    difficulty: "medium",
    expectedPatterns: [/ferrite|30|70|%/i],
    notes: "30-70% ferrite typical"
  },
  {
    id: "A789-05",
    document: "ASTM A789",
    query: "What flattening test is required for A789 tubing?",
    difficulty: "medium",
    expectedPatterns: [/flattening|flatten|test/i],
    notes: "Flattening test requirements"
  },
  {
    id: "A789-06",
    document: "ASTM A789",
    query: "What is the hardness limit for S32750 per A789?",
    difficulty: "medium",
    expectedPatterns: [/310\s*HBW?|32\s*HRC|hardness/i],
    notes: "310 HBW or 32 HRC for super duplex"
  },
  {
    id: "A789-07",
    document: "ASTM A789",
    query: "Compare mechanical properties of S32205 tubing (A789) vs S32205 pipe (A790)",
    difficulty: "complex",
    expectedPatterns: [/70\s*ksi|65\s*ksi|485|450|MPa/i],
    notes: "Tubing=70ksi yield, Pipe=65ksi yield"
  },
  {
    id: "A789-08",
    document: "ASTM A789",
    query: "What are all the UNS designations covered by ASTM A789?",
    difficulty: "complex",
    expectedPatterns: [/S31803|S32205|S32304|S32750|S32760|UNS/i],
    notes: "Multiple duplex grades"
  },
  {
    id: "A789-09",
    document: "ASTM A789",
    query: "What test methods are used to verify ferrite content in A789?",
    difficulty: "complex",
    expectedPatterns: [/ferrite|magnetic|metallographic|point\s*count/i],
    notes: "Magnetic or metallographic methods"
  },
  {
    id: "A789-10",
    document: "ASTM A789",
    query: "What supplementary requirements are available for S31803 per A789?",
    difficulty: "complex",
    expectedPatterns: [/supplementary|S\d+|requirement/i],
    notes: "Supplementary requirements section"
  },

  // ===== ASTM A312 - Austenitic Stainless Steel Pipe (10 queries) =====
  {
    id: "A312-01",
    document: "ASTM A312",
    query: "What is the minimum tensile strength for TP304 per ASTM A312?",
    difficulty: "medium",
    expectedPatterns: [/75\s*ksi|515\s*MPa/i],
    notes: "TP304 tensile = 75 ksi (515 MPa)"
  },
  {
    id: "A312-02",
    document: "ASTM A312",
    query: "What is the maximum carbon content for TP316L per A312?",
    difficulty: "medium",
    expectedPatterns: [/0\.03|0\.030/i],
    notes: "L grades = 0.030% max carbon"
  },
  {
    id: "A312-03",
    document: "ASTM A312",
    query: "What is the yield strength for TP304L pipe per ASTM A312?",
    difficulty: "medium",
    expectedPatterns: [/25\s*ksi|170\s*MPa/i],
    notes: "TP304L yield = 25 ksi (170 MPa)"
  },
  {
    id: "A312-04",
    document: "ASTM A312",
    query: "What heat treatment is required for TP321 per A312?",
    difficulty: "medium",
    expectedPatterns: [/solution|anneal|1900|°F/i],
    notes: "Solution annealing required"
  },
  {
    id: "A312-05",
    document: "ASTM A312",
    query: "What are the hydrostatic test requirements per A312?",
    difficulty: "medium",
    expectedPatterns: [/hydrostatic|pressure|test|psi/i],
    notes: "Hydrostatic test section"
  },
  {
    id: "A312-06",
    document: "ASTM A312",
    query: "What is the minimum wall thickness tolerance for A312 pipe?",
    difficulty: "medium",
    expectedPatterns: [/tolerance|wall|thickness|%/i],
    notes: "Wall thickness tolerances"
  },
  {
    id: "A312-07",
    document: "ASTM A312",
    query: "Compare yield strength of TP304 vs TP316L per A312",
    difficulty: "complex",
    expectedPatterns: [/TP304|TP316L|30\s*ksi|25\s*ksi|205|170/i],
    notes: "TP304=30ksi, TP316L=25ksi"
  },
  {
    id: "A312-08",
    document: "ASTM A312",
    query: "What are ALL chemical requirements for TP347 per A312?",
    difficulty: "complex",
    expectedPatterns: [/carbon|chromium|nickel|columbium|niobium/i],
    notes: "Full composition for TP347"
  },
  {
    id: "A312-09",
    document: "ASTM A312",
    query: "What dimensions are available for NPS 4 Schedule 40S pipe per A312?",
    difficulty: "complex",
    expectedPatterns: [/4|NPS|schedule|40S|OD|wall/i],
    notes: "Dimensional table lookup"
  },
  {
    id: "A312-10",
    document: "ASTM A312",
    query: "Which grades in A312 are suitable for high-temperature service above 1000°F?",
    difficulty: "complex",
    expectedPatterns: [/TP304H|TP316H|TP321|TP347|high.*temp/i],
    notes: "H grades for high temp"
  },

  // ===== ASTM A872 - Centrifugally Cast Pipe (10 queries) =====
  {
    id: "A872-01",
    document: "ASTM A872",
    query: "What is the scope of ASTM A872?",
    difficulty: "medium",
    expectedPatterns: [/centrifugal|cast|pipe|steel/i],
    notes: "Centrifugally cast pipe"
  },
  {
    id: "A872-02",
    document: "ASTM A872",
    query: "What minimum tensile strength is required per A872?",
    difficulty: "medium",
    expectedPatterns: [/tensile|ksi|MPa|strength/i],
    notes: "Mechanical requirements"
  },
  {
    id: "A872-03",
    document: "ASTM A872",
    query: "What heat treatment is required for A872 pipe?",
    difficulty: "medium",
    expectedPatterns: [/heat|treatment|anneal|quench|temper/i],
    notes: "Heat treatment section"
  },
  {
    id: "A872-04",
    document: "ASTM A872",
    query: "What wall thickness tolerances apply to A872?",
    difficulty: "medium",
    expectedPatterns: [/tolerance|wall|thickness|%/i],
    notes: "Dimensional tolerances"
  },
  {
    id: "A872-05",
    document: "ASTM A872",
    query: "What inspection requirements are in A872?",
    difficulty: "medium",
    expectedPatterns: [/inspection|test|examination/i],
    notes: "Inspection section"
  },
  {
    id: "A872-06",
    document: "ASTM A872",
    query: "What grades are covered by ASTM A872?",
    difficulty: "medium",
    expectedPatterns: [/grade|class|type/i],
    notes: "Grade designations"
  },
  {
    id: "A872-07",
    document: "ASTM A872",
    query: "Compare A872 centrifugally cast pipe with A790 seamless/welded pipe",
    difficulty: "complex",
    expectedPatterns: [/centrifugal|cast|seamless|welded/i],
    notes: "Manufacturing method comparison"
  },
  {
    id: "A872-08",
    document: "ASTM A872",
    query: "What are the marking requirements for A872?",
    difficulty: "complex",
    expectedPatterns: [/marking|mark|identification|stencil/i],
    notes: "Marking requirements"
  },
  {
    id: "A872-09",
    document: "ASTM A872",
    query: "What chemical composition limits apply to A872?",
    difficulty: "complex",
    expectedPatterns: [/carbon|chromium|chemical|composition/i],
    notes: "Chemical requirements"
  },
  {
    id: "A872-10",
    document: "ASTM A872",
    query: "What supplementary requirements are available for A872?",
    difficulty: "complex",
    expectedPatterns: [/supplementary|S\d+|optional/i],
    notes: "Supplementary section"
  },

  // ===== API 5CT - Casing and Tubing (10 queries) =====
  {
    id: "5CT-01",
    document: "API 5CT",
    query: "What is the minimum yield strength for L80 casing per API 5CT?",
    difficulty: "medium",
    expectedPatterns: [/80\s*ksi|552\s*MPa|L80/i],
    notes: "L80 = 80 ksi yield"
  },
  {
    id: "5CT-02",
    document: "API 5CT",
    query: "What is the maximum yield strength for P110 per API 5CT?",
    difficulty: "medium",
    expectedPatterns: [/140\s*ksi|965\s*MPa|P110/i],
    notes: "P110 yield = 110-140 ksi"
  },
  {
    id: "5CT-03",
    document: "API 5CT",
    query: "What hardness limits apply to L80 grade per 5CT?",
    difficulty: "medium",
    expectedPatterns: [/HRC|HBW|hardness|23|22/i],
    notes: "L80 hardness limits"
  },
  {
    id: "5CT-04",
    document: "API 5CT",
    query: "What is the scope of API 5CT?",
    difficulty: "medium",
    expectedPatterns: [/casing|tubing|oil|gas|well/i],
    notes: "Oil/gas well tubulars"
  },
  {
    id: "5CT-05",
    document: "API 5CT",
    query: "What impact test requirements apply to J55 per 5CT?",
    difficulty: "medium",
    expectedPatterns: [/impact|charpy|CVN|joule|ft.*lb/i],
    notes: "Impact test requirements"
  },
  {
    id: "5CT-06",
    document: "API 5CT",
    query: "What thread types are specified in API 5CT?",
    difficulty: "medium",
    expectedPatterns: [/thread|buttress|round|STC|LTC/i],
    notes: "Thread specifications"
  },
  {
    id: "5CT-07",
    document: "API 5CT",
    query: "Compare mechanical properties of J55 vs N80 per API 5CT",
    difficulty: "complex",
    expectedPatterns: [/J55|N80|55\s*ksi|80\s*ksi|yield/i],
    notes: "J55=55ksi, N80=80ksi"
  },
  {
    id: "5CT-08",
    document: "API 5CT",
    query: "What are all the grades covered by API 5CT?",
    difficulty: "complex",
    expectedPatterns: [/H40|J55|K55|N80|L80|C90|T95|P110|Q125/i],
    notes: "Multiple grades"
  },
  {
    id: "5CT-09",
    document: "API 5CT",
    query: "What dimensional tolerances apply to 9-5/8 inch casing per 5CT?",
    difficulty: "complex",
    expectedPatterns: [/9.*5\/8|tolerance|OD|wall|drift/i],
    notes: "Dimensional requirements"
  },
  {
    id: "5CT-10",
    document: "API 5CT",
    query: "What are the heat treatment requirements for C90 per API 5CT?",
    difficulty: "complex",
    expectedPatterns: [/C90|heat|treatment|quench|temper/i],
    notes: "C90 heat treatment"
  },

  // ===== API 6A - Wellhead Equipment (10 queries) =====
  {
    id: "6A-01",
    document: "API 6A",
    query: "What is the scope of API 6A?",
    difficulty: "medium",
    expectedPatterns: [/wellhead|christmas tree|equipment/i],
    notes: "Wellhead and christmas tree equipment"
  },
  {
    id: "6A-02",
    document: "API 6A",
    query: "What pressure ratings are defined in API 6A?",
    difficulty: "medium",
    expectedPatterns: [/2000|3000|5000|10000|15000|psi|pressure/i],
    notes: "Standard pressure ratings"
  },
  {
    id: "6A-03",
    document: "API 6A",
    query: "What material classes are in API 6A?",
    difficulty: "medium",
    expectedPatterns: [/AA|BB|CC|DD|EE|FF|HH|class/i],
    notes: "Material classes AA through HH"
  },
  {
    id: "6A-04",
    document: "API 6A",
    query: "What temperature ratings are specified in API 6A?",
    difficulty: "medium",
    expectedPatterns: [/temperature|K|L|P|R|S|T|U|V|°F/i],
    notes: "Temperature ratings K through V"
  },
  {
    id: "6A-05",
    document: "API 6A",
    query: "What are the PSL (Product Specification Levels) in API 6A?",
    difficulty: "medium",
    expectedPatterns: [/PSL|1|2|3|4|product.*specification/i],
    notes: "PSL 1-4"
  },
  {
    id: "6A-06",
    document: "API 6A",
    query: "What testing is required for API 6A equipment?",
    difficulty: "medium",
    expectedPatterns: [/test|hydrostatic|pressure|function/i],
    notes: "Testing requirements"
  },
  {
    id: "6A-07",
    document: "API 6A",
    query: "Compare PSL 1 vs PSL 3 requirements in API 6A",
    difficulty: "complex",
    expectedPatterns: [/PSL.*1|PSL.*3|traceability|test/i],
    notes: "PSL comparison"
  },
  {
    id: "6A-08",
    document: "API 6A",
    query: "What are all the material requirements for Class DD per 6A?",
    difficulty: "complex",
    expectedPatterns: [/DD|material|carbon|alloy|steel/i],
    notes: "Class DD specifications"
  },
  {
    id: "6A-09",
    document: "API 6A",
    query: "What are the design validation requirements for API 6A?",
    difficulty: "complex",
    expectedPatterns: [/design|validation|qualification|test/i],
    notes: "Design validation"
  },
  {
    id: "6A-10",
    document: "API 6A",
    query: "What marking and identification is required for 6A equipment?",
    difficulty: "complex",
    expectedPatterns: [/marking|identification|nameplate|tag/i],
    notes: "Marking requirements"
  },

  // ===== API 16C - Choke and Kill Equipment (10 queries) =====
  {
    id: "16C-01",
    document: "API 16C",
    query: "What is the scope of API 16C?",
    difficulty: "medium",
    expectedPatterns: [/choke|kill|equipment|BOP|well.*control/i],
    notes: "Choke and kill system components"
  },
  {
    id: "16C-02",
    document: "API 16C",
    query: "What pressure ratings are covered in API 16C?",
    difficulty: "medium",
    expectedPatterns: [/5000|10000|15000|psi|pressure/i],
    notes: "Working pressure ratings"
  },
  {
    id: "16C-03",
    document: "API 16C",
    query: "What materials are acceptable per API 16C?",
    difficulty: "medium",
    expectedPatterns: [/material|steel|alloy|class/i],
    notes: "Material requirements"
  },
  {
    id: "16C-04",
    document: "API 16C",
    query: "What testing is required for chokes per 16C?",
    difficulty: "medium",
    expectedPatterns: [/test|pressure|function|qualification/i],
    notes: "Testing requirements"
  },
  {
    id: "16C-05",
    document: "API 16C",
    query: "What are the valve requirements in API 16C?",
    difficulty: "medium",
    expectedPatterns: [/valve|gate|ball|check/i],
    notes: "Valve specifications"
  },
  {
    id: "16C-06",
    document: "API 16C",
    query: "What flange connections are specified in 16C?",
    difficulty: "medium",
    expectedPatterns: [/flange|connection|API.*6A|6BX/i],
    notes: "Flange requirements"
  },
  {
    id: "16C-07",
    document: "API 16C",
    query: "Compare requirements for 10K vs 15K choke manifolds",
    difficulty: "complex",
    expectedPatterns: [/10.*000|15.*000|10K|15K|manifold/i],
    notes: "Pressure class comparison"
  },
  {
    id: "16C-08",
    document: "API 16C",
    query: "What are the design requirements for choke manifolds per 16C?",
    difficulty: "complex",
    expectedPatterns: [/design|manifold|calculation|factor/i],
    notes: "Design requirements"
  },
  {
    id: "16C-09",
    document: "API 16C",
    query: "What quality documentation is required for API 16C?",
    difficulty: "complex",
    expectedPatterns: [/quality|documentation|record|certificate/i],
    notes: "Documentation requirements"
  },
  {
    id: "16C-10",
    document: "API 16C",
    query: "What are the erosion considerations in API 16C?",
    difficulty: "complex",
    expectedPatterns: [/erosion|wear|flow|velocity/i],
    notes: "Erosion requirements"
  },

  // ===== API 5CRA - CRA Tubulars (10 queries) =====
  {
    id: "5CRA-01",
    document: "API 5CRA",
    query: "What is the scope of API 5CRA?",
    difficulty: "medium",
    expectedPatterns: [/corrosion.*resistant|CRA|tubular|alloy/i],
    notes: "CRA seamless/welded tubulars"
  },
  {
    id: "5CRA-02",
    document: "API 5CRA",
    query: "What alloy systems are covered in API 5CRA?",
    difficulty: "medium",
    expectedPatterns: [/13Cr|22Cr|25Cr|duplex|nickel|alloy/i],
    notes: "CRA alloy families"
  },
  {
    id: "5CRA-03",
    document: "API 5CRA",
    query: "What is the yield strength for 13Cr-L80 per 5CRA?",
    difficulty: "medium",
    expectedPatterns: [/80\s*ksi|552\s*MPa|13Cr.*L80/i],
    notes: "13Cr-L80 = 80-95 ksi"
  },
  {
    id: "5CRA-04",
    document: "API 5CRA",
    query: "What corrosion testing is required per 5CRA?",
    difficulty: "medium",
    expectedPatterns: [/corrosion|test|SSC|SCC|H2S/i],
    notes: "Corrosion test requirements"
  },
  {
    id: "5CRA-05",
    document: "API 5CRA",
    query: "What heat treatment is required for 22Cr duplex per 5CRA?",
    difficulty: "medium",
    expectedPatterns: [/heat|treatment|solution|anneal|22Cr/i],
    notes: "22Cr heat treatment"
  },
  {
    id: "5CRA-06",
    document: "API 5CRA",
    query: "What hardness limits apply to CRA tubulars per 5CRA?",
    difficulty: "medium",
    expectedPatterns: [/hardness|HRC|HBW|max/i],
    notes: "Hardness requirements"
  },
  {
    id: "5CRA-07",
    document: "API 5CRA",
    query: "Compare 13Cr vs 22Cr duplex mechanical properties per 5CRA",
    difficulty: "complex",
    expectedPatterns: [/13Cr|22Cr|yield|tensile|strength/i],
    notes: "Alloy comparison"
  },
  {
    id: "5CRA-08",
    document: "API 5CRA",
    query: "What are all the grades covered by API 5CRA?",
    difficulty: "complex",
    expectedPatterns: [/13Cr|22Cr|25Cr|028|825|625|grade/i],
    notes: "All CRA grades"
  },
  {
    id: "5CRA-09",
    document: "API 5CRA",
    query: "What pitting resistance requirements exist for duplex grades in 5CRA?",
    difficulty: "complex",
    expectedPatterns: [/PREN|pitting|resistance|corrosion/i],
    notes: "PREN requirements"
  },
  {
    id: "5CRA-10",
    document: "API 5CRA",
    query: "What supplementary requirements are available for 5CRA?",
    difficulty: "complex",
    expectedPatterns: [/supplementary|SR|optional|requirement/i],
    notes: "Supplementary requirements"
  },

  // NOTE: ASTM A240 and A182 removed - documents not uploaded to database
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
    const response = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
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

/**
 * Extract ASTM/API specification code from a filename or document name
 *
 * Examples:
 * - "877794297-A312-A312M-25.pdf" → "A312"
 * - "ASTM A790" → "A790"
 * - "API Spec 5CT Purchasing Guidelines 9th Edition 2012-04.pdf" → "5CT"
 * - "API Spec 6A Wellhead & Xmas Tree Equipment 20th Edition.pdf" → "6A"
 * - "API Spec 16C Choke & Kill Systems 1993.pdf" → "16C"
 * - "API 5CRA" → "5CRA"
 */
function extractSpecCode(nameOrFilename: string): string | null {
  const upper = nameOrFilename.toUpperCase();

  // Match ASTM A-series codes: A789, A790, A312, A182, A240, A872, A1049
  const astmMatch = upper.match(/\bA\d{3,4}\b/);
  if (astmMatch) return astmMatch[0];

  // Match API codes - try context-aware match first (after "API" or "SPEC")
  // This avoids matching "9TH" from "9th Edition"
  const apiContextMatch = upper.match(/(?:API|SPEC)\s+(\d{1,2}[A-Z]{1,4})\b/);
  if (apiContextMatch) return apiContextMatch[1];

  // Fallback: Match known API spec patterns specifically
  // 5CT, 5CRA, 6A, 16C - digits followed by specific letter combinations
  const apiSpecificMatch = upper.match(/\b(\d{1,2}(?:CT|CRA|[A-Z]))\b/);
  if (apiSpecificMatch) return apiSpecificMatch[1];

  return null;
}

function evaluateTest(
  testCase: TestCase,
  response: string,
  sources: Array<{ document: string; page?: string; ref: string }>
): {
  passed: boolean;
  matchedPatterns: string[];
  missedPatterns: string[];
  forbiddenMatches: string[];
  sourceDocument: string | null;
  sourceAccurate: boolean;
} {
  const matchedPatterns: string[] = [];
  const missedPatterns: string[] = [];
  const forbiddenMatches: string[] = [];

  // Check expected patterns
  for (const pattern of testCase.expectedPatterns) {
    if (pattern.test(response)) {
      matchedPatterns.push(pattern.source);
    } else {
      missedPatterns.push(pattern.source);
    }
  }

  // Check forbidden patterns
  if (testCase.forbiddenPatterns) {
    for (const pattern of testCase.forbiddenPatterns) {
      if (pattern.test(response)) {
        forbiddenMatches.push(pattern.source);
      }
    }
  }

  // Check source accuracy by comparing extracted spec codes
  // This handles filename variations like "877794297-A312-A312M-25.pdf" vs "ASTM A312"
  const sourceDocument = sources.length > 0 ? sources[0].document : null;
  const sourceCode = sourceDocument ? extractSpecCode(sourceDocument) : null;
  const expectedCode = extractSpecCode(testCase.document);
  const sourceAccurate = !!(sourceCode && expectedCode && sourceCode === expectedCode);

  // Pass if at least 50% patterns matched and no forbidden patterns
  const patternPassRate = matchedPatterns.length / testCase.expectedPatterns.length;
  const noForbiddenMatches = forbiddenMatches.length === 0;
  const passed = patternPassRate >= 0.5 && noForbiddenMatches;

  return {
    passed,
    matchedPatterns,
    missedPatterns,
    forbiddenMatches,
    sourceDocument,
    sourceAccurate
  };
}

async function runAccuracyTest(): Promise<void> {
  console.log("🧪 100-Query Accuracy Test Suite\n");
  console.log("=".repeat(70));

  // Check available documents
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { data: documents } = await supabase
      .from("documents")
      .select("id, filename, status")
      .eq("status", "indexed");

    console.log(`\n📚 Indexed Documents: ${documents?.length || 0}`);
    for (const doc of documents || []) {
      console.log(`  - ${doc.filename}`);
    }
  } else {
    console.log("\n⚠️  No Supabase connection - running tests against localhost:3000");
  }

  console.log(`\n🎯 Running ${TEST_CASES.length} test cases...\n`);

  const results: TestResult[] = [];
  const documentStats: Record<string, { total: number; passed: number; sourceAccurate: number }> = {};

  // Initialize stats per document
  for (const tc of TEST_CASES) {
    if (!documentStats[tc.document]) {
      documentStats[tc.document] = { total: 0, passed: 0, sourceAccurate: 0 };
    }
  }

  for (const testCase of TEST_CASES) {
    process.stdout.write(`  ${testCase.id}... `);

    const { response, sources, latencyMs } = await querySpecVault(testCase.query);
    const evaluation = evaluateTest(testCase, response, sources);

    const result: TestResult = {
      testCase,
      response,
      sources: sources.map(s => ({ document: s.document, page: s.page })),
      passed: evaluation.passed,
      matchedPatterns: evaluation.matchedPatterns,
      missedPatterns: evaluation.missedPatterns,
      forbiddenMatches: evaluation.forbiddenMatches,
      latencyMs,
      sourceDocument: evaluation.sourceDocument,
      sourceAccurate: evaluation.sourceAccurate
    };

    results.push(result);

    // Update stats
    documentStats[testCase.document].total++;
    if (evaluation.passed) {
      documentStats[testCase.document].passed++;
    }
    if (evaluation.sourceAccurate) {
      documentStats[testCase.document].sourceAccurate++;
    }

    // Print result
    const status = evaluation.passed ? "✅" : "❌";
    const sourceStatus = evaluation.sourceAccurate ? "📄" : "⚠️";
    console.log(`${status} ${sourceStatus} (${latencyMs}ms)`);

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  // Generate report
  generateReport(results, documentStats);
}

function generateReport(
  results: TestResult[],
  documentStats: Record<string, { total: number; passed: number; sourceAccurate: number }>
): void {
  console.log("\n" + "=".repeat(70));
  console.log("📊 ACCURACY TEST REPORT");
  console.log("=".repeat(70));

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const sourceAccurate = results.filter(r => r.sourceAccurate).length;

  // Overall accuracy
  const accuracy = (passed / total) * 100;
  const sourceAccuracy = (sourceAccurate / total) * 100;

  console.log("\n🎯 OVERALL RESULTS:");
  console.log(`   Total Tests:      ${total}`);
  console.log(`   Passed:           ${passed}/${total} (${accuracy.toFixed(1)}%)`);
  console.log(`   Source Accuracy:  ${sourceAccurate}/${total} (${sourceAccuracy.toFixed(1)}%)`);

  // By difficulty
  const mediumResults = results.filter(r => r.testCase.difficulty === "medium");
  const complexResults = results.filter(r => r.testCase.difficulty === "complex");
  const mediumPassed = mediumResults.filter(r => r.passed).length;
  const complexPassed = complexResults.filter(r => r.passed).length;

  console.log("\n📈 BY DIFFICULTY:");
  console.log(`   Medium:  ${mediumPassed}/${mediumResults.length} (${((mediumPassed/mediumResults.length)*100).toFixed(1)}%)`);
  console.log(`   Complex: ${complexPassed}/${complexResults.length} (${((complexPassed/complexResults.length)*100).toFixed(1)}%)`);

  // By document
  console.log("\n📁 BY DOCUMENT:");
  for (const [doc, stats] of Object.entries(documentStats)) {
    const docAccuracy = (stats.passed / stats.total) * 100;
    const docSourceAccuracy = (stats.sourceAccurate / stats.total) * 100;
    const status = docAccuracy >= 70 ? "✅" : docAccuracy >= 50 ? "⚠️" : "❌";
    console.log(`   ${status} ${doc.padEnd(15)} ${stats.passed}/${stats.total} (${docAccuracy.toFixed(0)}%) | Source: ${docSourceAccuracy.toFixed(0)}%`);
  }

  // Latency stats
  const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(total * 0.5)];
  const p95 = latencies[Math.floor(total * 0.95)];
  const avg = latencies.reduce((a, b) => a + b, 0) / total;

  console.log("\n⏱️  LATENCY:");
  console.log(`   Average: ${avg.toFixed(0)}ms`);
  console.log(`   P50:     ${p50}ms`);
  console.log(`   P95:     ${p95}ms`);

  // Failed tests
  const failed = results.filter(r => !r.passed);
  if (failed.length > 0 && failed.length <= 20) {
    console.log("\n❌ FAILED TESTS:");
    for (const r of failed) {
      console.log(`   ${r.testCase.id}: ${r.testCase.query.slice(0, 50)}...`);
      if (r.missedPatterns.length > 0) {
        console.log(`      Missed: ${r.missedPatterns.slice(0, 2).join(", ")}`);
      }
      if (r.forbiddenMatches.length > 0) {
        console.log(`      Forbidden: ${r.forbiddenMatches.join(", ")}`);
      }
    }
  }

  // Source accuracy issues
  const sourceIssues = results.filter(r => !r.sourceAccurate);
  if (sourceIssues.length > 0 && sourceIssues.length <= 10) {
    console.log("\n⚠️  SOURCE ACCURACY ISSUES:");
    for (const r of sourceIssues.slice(0, 10)) {
      console.log(`   ${r.testCase.id}: Expected ${r.testCase.document}, got ${r.sourceDocument || "none"}`);
    }
  }

  // MVP readiness
  console.log("\n" + "=".repeat(70));
  console.log("🚀 MVP READINESS:");
  console.log("=".repeat(70));

  const targetAccuracy = 75;
  const targetSourceAccuracy = 80;
  const targetP95 = 10000;

  console.log(`\n   Metric            Current     Target     Status`);
  console.log(`   ──────────────────────────────────────────────────`);
  console.log(`   Accuracy          ${accuracy.toFixed(1)}%       ${targetAccuracy}%       ${accuracy >= targetAccuracy ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Source Accuracy   ${sourceAccuracy.toFixed(1)}%       ${targetSourceAccuracy}%       ${sourceAccuracy >= targetSourceAccuracy ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   P95 Latency       ${p95}ms     <${targetP95}ms   ${p95 < targetP95 ? '✅ PASS' : '❌ FAIL'}`);

  const mvpReady = accuracy >= targetAccuracy && p95 < targetP95;
  console.log(`\n   ${mvpReady ? '✅ MVP READY' : '❌ NOT MVP READY'}`);

  console.log("\n" + "=".repeat(70));
}

// Run the test
runAccuracyTest().catch(console.error);
