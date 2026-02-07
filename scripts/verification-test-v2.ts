/**
 * Post-D7/D8 Verification Test — 5 New Complex Queries
 *
 * Tests the full D1–D8 improvement suite:
 * - D7: Voyage AI reranker (faster, more accurate)
 * - D8: Query cache (0ms repeat queries)
 * - D2+D6: Dynamic topK (8 for API, 5 for ASTM)
 * - D3+D5: Partial refusal detection + data-first responses
 * - D4: Section-aware metadata for API specs
 *
 * Usage:
 *   npx tsx scripts/verification-test-v2.ts
 *
 * Requires: dev server running on localhost:3000
 */

export {};

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const QUERY_TIMEOUT = 180_000;
const DELAY_BETWEEN_QUERIES = 3_000;

interface Source {
  ref: string;
  document: string;
  page: string;
}

interface RAGResponse {
  response: string;
  sources: Source[];
  confidence?: {
    overall: number;
    retrieval: number;
    grounding: number;
    coherence: number;
  };
  error?: string;
}

interface TestCase {
  id: string;
  targets: string;
  query: string;
  validate: (data: RAGResponse) => { pass: boolean; issues: string[]; notes: string[] };
}

const TEST_CASES: TestCase[] = [
  // V2-01: API 6A pressure ratings (tests D2 dynamic topK + D4 section hints + D5 partial refusal)
  {
    id: "V2-01",
    targets: "D2+D4+D5",
    query: "What are the rated working pressures and corresponding test pressures for API 6A wellhead equipment?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (resp.length < 150) issues.push("Response too short");
      const has6A = data.sources?.some(s => /6a/i.test(s.document));
      if (!has6A) issues.push("No API 6A document cited");
      if (!resp.match(/\[\d+\]/)) issues.push("No citation markers");

      // Must not be a full refusal
      const isFullRefusal = /^I cannot (provide|answer)/i.test(resp);
      if (isFullRefusal) issues.push("Full refusal on API 6A pressure data");

      // Check for pressure values
      if (/\d{1,3},?\d{3}\s*psi/i.test(resp)) notes.push("Pressure values found");
      if (data.sources && data.sources.length >= 2) notes.push(`${data.sources.length} source pages`);
      if (data.confidence?.overall) notes.push(`Confidence: ${data.confidence.overall}%`);

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // V2-02: Cross-spec S32750 super duplex (tests D7 reranker quality + P1 balanced retrieval)
  {
    id: "V2-02",
    targets: "D7+P1",
    query: "What are the mechanical property requirements for S32750 super duplex stainless steel per ASTM A789?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (resp.length < 100) issues.push("Response too short");
      const hasA789 = data.sources?.some(s => /a789/i.test(s.document));
      if (!hasA789) issues.push("No A789 document cited");

      // Should have yield strength for S32750 (80 ksi / 550 MPa)
      if (/80\s*ksi|550\s*MPa/i.test(resp)) notes.push("S32750 yield value (80 ksi) found");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");

      const isRefusal = /I cannot (provide|answer|find)/i.test(resp);
      if (isRefusal) issues.push("False refusal on S32750 mechanical properties");

      if (data.confidence?.overall) notes.push(`Confidence: ${data.confidence.overall}%`);

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // V2-03: API 5CT with casing grades (tests D2 dynamic topK + P2 grade detection)
  {
    id: "V2-03",
    targets: "D2+P2",
    query: "What are the chemical composition requirements for L80 casing per API 5CT?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (resp.length < 80) issues.push("Response too short");
      const has5CT = data.sources?.some(s => /5ct/i.test(s.document));
      if (!has5CT) issues.push("No API 5CT document cited");

      // Should not fully refuse
      const isFullRefusal = /^I cannot (provide|answer)/i.test(resp);
      if (isFullRefusal) issues.push("Full refusal on L80 chemical composition");

      // Look for chemistry indicators
      if (/carbon|C\b|manganese|Mn|phosph|sulfu?r/i.test(resp)) notes.push("Chemical elements mentioned");
      if (/L80/i.test(resp)) notes.push("L80 grade referenced");
      if (data.confidence?.overall) notes.push(`Confidence: ${data.confidence.overall}%`);

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // V2-04: Heat treatment with temperature (tests D3 refusal softening + D4 section hints)
  {
    id: "V2-04",
    targets: "D3+D4",
    query: "What are the heat treatment requirements and annealing temperatures for duplex stainless steel per ASTM A789?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (resp.length < 100) issues.push("Response too short");
      const hasA789 = data.sources?.some(s => /a789/i.test(s.document));
      if (!hasA789) issues.push("No A789 document cited");

      // Should not fully refuse
      const isFullRefusal = /^I cannot (provide|answer)/i.test(resp);
      if (isFullRefusal) issues.push("Full refusal on heat treatment data");

      // Temperature values
      if (/\d{3,4}\s*°[FC]|\d{3,4}\s*degrees/i.test(resp)) notes.push("Temperature values found");
      if (/anneal|solution|quench/i.test(resp)) notes.push("Heat treatment terms present");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");
      if (data.confidence?.overall) notes.push(`Confidence: ${data.confidence.overall}%`);

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // V2-05: Hardness requirements multi-spec (tests D7 reranker + overall pipeline)
  {
    id: "V2-05",
    targets: "D7+Overall",
    query: "What is the maximum hardness requirement for S32205 duplex stainless steel per ASTM A790, and what test scale is specified?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (resp.length < 80) issues.push("Response too short");
      const hasA790 = data.sources?.some(s => /a790/i.test(s.document));
      if (!hasA790) issues.push("No A790 document cited");

      const isRefusal = /I cannot (provide|answer|find)/i.test(resp);
      if (isRefusal) issues.push("False refusal on hardness requirements");

      // Should mention HBW or HRC values
      if (/HBW|HRC|Brinell|Rockwell|hardness/i.test(resp)) notes.push("Hardness scale mentioned");
      if (/\d{2,3}\s*(?:HBW|HRC)/i.test(resp)) notes.push("Hardness value found");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");
      if (data.confidence?.overall) notes.push(`Confidence: ${data.confidence.overall}%`);

      return { pass: issues.length === 0, issues, notes };
    },
  },
];

async function queryRAG(query: string): Promise<{ data: RAGResponse; latencyMs: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT);

  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, stream: false }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as RAGResponse;
    return { data, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}

async function runVerification(): Promise<void> {
  console.log("=".repeat(70));
  console.log("  SpecVault Verification Test v2 — Post D7/D8 Implementation");
  console.log("  5 complex queries targeting D1–D8 improvements");
  console.log("=".repeat(70));
  console.log();

  // Check server
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok && res.status !== 405) throw new Error(`Status ${res.status}`);
  } catch {
    console.error(`Server not available at ${BASE_URL}. Start with: npm run dev`);
    process.exit(1);
  }

  const results: { id: string; targets: string; pass: boolean; latencyMs: number; confidence: number; issues: string[]; notes: string[] }[] = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`  [${i + 1}/${TEST_CASES.length}] ${tc.id} (${tc.targets})`);
    console.log(`  Query: "${tc.query.slice(0, 80)}..."`);
    console.log();

    try {
      const { data, latencyMs } = await queryRAG(tc.query);
      const { pass, issues, notes } = tc.validate(data);

      const preview = (data.response || "").replace(/\n/g, " ").slice(0, 250);
      console.log(`  Response: ${preview}...`);
      console.log(`  Sources:  ${data.sources?.map(s => `${s.ref} ${s.document} p.${s.page}`).join(" | ") || "none"}`);
      console.log(`  Confidence: overall=${data.confidence?.overall}% retrieval=${data.confidence?.retrieval}% grounding=${data.confidence?.grounding}% coherence=${data.confidence?.coherence}%`);
      console.log(`  Latency:  ${(latencyMs / 1000).toFixed(1)}s`);
      console.log(`  Result:   ${pass ? "PASS" : "FAIL"}`);

      if (issues.length > 0) {
        for (const issue of issues) console.log(`    ISSUE: ${issue}`);
      }
      if (notes.length > 0) {
        for (const note of notes) console.log(`    NOTE:  ${note}`);
      }

      results.push({ id: tc.id, targets: tc.targets, pass, latencyMs, confidence: data.confidence?.overall ?? 0, issues, notes });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ERROR: ${msg.slice(0, 150)}`);
      results.push({ id: tc.id, targets: tc.targets, pass: false, latencyMs: 0, confidence: 0, issues: [msg.slice(0, 200)], notes: [] });
    }

    console.log();
    console.log("  " + "-".repeat(66));
    console.log();

    if (i < TEST_CASES.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_QUERIES));
    }
  }

  // Summary
  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  const activeResults = results.filter(r => r.latencyMs > 0);
  const avgLatency = activeResults.reduce((s, r) => s + r.latencyMs, 0) / Math.max(activeResults.length, 1);
  const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / Math.max(results.length, 1);

  console.log("=".repeat(70));
  console.log("  VERIFICATION v2 RESULTS");
  console.log("=".repeat(70));
  console.log();
  console.log(`  Pass Rate:       ${passed}/${total} (${((passed / total) * 100).toFixed(0)}%)`);
  console.log(`  Avg Latency:     ${(avgLatency / 1000).toFixed(1)}s`);
  console.log(`  Avg Confidence:  ${avgConfidence.toFixed(0)}%`);
  console.log();

  console.log("  ID      Targets       Pass  Latency  Confidence");
  console.log("  " + "\u2500".repeat(56));
  for (const r of results) {
    const pass = r.pass ? " OK " : "FAIL";
    const lat = r.latencyMs > 0 ? `${(r.latencyMs / 1000).toFixed(1)}s` : "N/A";
    const conf = r.confidence > 0 ? `${r.confidence}%` : "N/A";
    console.log(`  ${r.id.padEnd(8)} ${r.targets.padEnd(13)} ${pass}  ${lat.padStart(7)}  ${conf.padStart(10)}`);
  }
  console.log();

  if (passed === total) {
    console.log("  ALL 5 VERIFICATION v2 QUERIES PASSED");
  } else {
    console.log(`  ${total - passed} QUERIES FAILED`);
  }
  console.log();
}

runVerification().catch((err) => {
  console.error("Verification test crashed:", err);
  process.exit(1);
});
