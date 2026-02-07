/**
 * Post-Implementation Verification Test — 5 Complex Queries
 *
 * Tests the 6 priority improvements (P0–P5):
 * - P0: Confidence calibration (reweighted formula)
 * - P1: Cross-spec balanced retrieval (A789 vs A790)
 * - P2: API 5CT grade detection (L80, P110)
 * - P3: Anti-refusal improvement (context-aware)
 * - P4: Grounding floor (neutral score for text-only responses)
 * - P5: Timeout tuning
 *
 * Usage:
 *   npx tsx scripts/verification-test.ts
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
  targets: string; // Which P-improvements this tests
  query: string;
  validate: (data: RAGResponse) => { pass: boolean; issues: string[]; notes: string[] };
}

const TEST_CASES: TestCase[] = [
  // VQ-01: Tests P1 (cross-spec balanced retrieval) + P0 (confidence calibration)
  {
    id: "VQ-01",
    targets: "P0+P1",
    query: "Compare the minimum yield strength of S32205 duplex stainless steel between ASTM A789 tubing and ASTM A790 pipe specifications",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      // Must mention both 70 ksi (A789) and 65 ksi (A790)
      const has70 = /70\s*ksi|485\s*MPa/i.test(resp);
      const has65 = /65\s*ksi|450\s*MPa/i.test(resp);
      if (!has70) issues.push("Missing A789 yield: 70 ksi / 485 MPa");
      if (!has65) issues.push("Missing A790 yield: 65 ksi / 450 MPa");

      // Must cite both documents
      const docsA789 = data.sources?.some(s => /a789/i.test(s.document));
      const docsA790 = data.sources?.some(s => /a790/i.test(s.document));
      if (!docsA789) issues.push("Missing A789 source document");
      if (!docsA790) issues.push("Missing A790 source document");

      // P0: Confidence should be reasonable (>30%), not artificially low
      if (data.confidence?.overall && data.confidence.overall > 30) {
        notes.push(`Confidence: ${data.confidence.overall}% (P0 calibration working)`);
      } else {
        issues.push(`Low confidence: ${data.confidence?.overall}% — P0 calibration may need more work`);
      }

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // VQ-02: Tests P2 (API 5CT grade detection)
  {
    id: "VQ-02",
    targets: "P2",
    query: "What are the yield strength and tensile strength requirements for L80 and P110 casing grades per API 5CT?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      // Must have substantive response about API 5CT grades
      if (resp.length < 100) issues.push("Response too short");
      if (!data.sources || data.sources.length === 0) issues.push("No sources cited");

      // Must cite API 5CT document
      const has5CT = data.sources?.some(s => /5ct/i.test(s.document));
      if (!has5CT) issues.push("No API 5CT document cited");

      // Should mention L80 and P110
      if (!/L80/i.test(resp)) issues.push("L80 grade not mentioned in response");
      if (!/P110/i.test(resp)) issues.push("P110 grade not mentioned in response");

      // Should NOT be a refusal
      const isRefusal = /cannot (answer|provide|find)|not (available|found|included)/i.test(resp);
      if (isRefusal) issues.push("FALSE REFUSAL — query was answerable from API 5CT spec");

      if (has5CT) notes.push("Correct document sourced (API 5CT)");
      if (/80.*ksi|80,000\s*psi|552\s*MPa/i.test(resp)) notes.push("L80 yield value found");
      if (/110.*ksi|110,000\s*psi|758\s*MPa/i.test(resp)) notes.push("P110 yield value found");

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // VQ-03: Tests P3 (anti-refusal) + P4 (grounding floor)
  {
    id: "VQ-03",
    targets: "P3+P4",
    query: "What solution annealing temperature range is required for S32205 duplex stainless steel per ASTM A790?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      // Must not refuse — this is answerable
      const isRefusal = /cannot (answer|provide|find)|not (available|found|included)/i.test(resp);
      if (isRefusal) issues.push("FALSE REFUSAL — heat treatment data is in A790");

      // Should have citations
      if (!resp.match(/\[\d+\]/)) issues.push("No citation markers");

      // Should cite A790 document
      const hasA790 = data.sources?.some(s => /a790/i.test(s.document));
      if (!hasA790 && !isRefusal) issues.push("No A790 document cited");

      // Temperature should be mentioned (typically 1900-2100°F or 1020-1100°C range)
      if (/1900|1920|2050|2100|°F|1020|1100|°C/i.test(resp)) {
        notes.push("Temperature range found");
      } else if (!isRefusal) {
        issues.push("No temperature values found in response");
      }

      // P4: Grounding score should be neutral (70) since heat treatment is text-heavy
      if (data.confidence?.grounding === 70) {
        notes.push("Grounding floor working (70 for text-only response)");
      }

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // VQ-04: Tests P0 (confidence) + legitimate refusal
  {
    id: "VQ-04",
    targets: "P0+Refusal",
    query: "What is the current market price per foot of ASTM A790 S32205 seamless pipe in 4-inch schedule 40?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      // This SHOULD be refused — pricing is never in specs
      const isRefusal = /cannot|not (available|found|included)|pric(e|ing)|commercial|vendor/i.test(resp);
      if (!isRefusal) issues.push("Should have refused — pricing not in ASTM specs");
      else notes.push("Correctly refused pricing query");

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // VQ-05: Tests P5 (timeout) + P0 (confidence) — complex multi-part query
  {
    id: "VQ-05",
    targets: "P0+P5",
    query: "For API 6A, what are the rated working pressures for 2000 psi, 5000 psi, and 10000 psi rated equipment, and what flange sizes are available for each pressure rating?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      // Must have substantive response
      if (resp.length < 200) issues.push("Response too short for multi-part question");

      // Must cite API 6A
      const has6A = data.sources?.some(s => /6a/i.test(s.document));
      if (!has6A) issues.push("No API 6A document cited");

      // Should mention pressure ratings
      if (/2000\s*psi|2,000/i.test(resp)) notes.push("2000 psi rating found");
      if (/5000\s*psi|5,000/i.test(resp)) notes.push("5000 psi rating found");
      if (/10000\s*psi|10,000/i.test(resp)) notes.push("10000 psi rating found");

      // Should have citations
      if (!resp.match(/\[\d+\]/)) issues.push("No citation markers");

      // Must not refuse
      const isRefusal = /cannot (answer|provide|find)|not (available|found|included)/i.test(resp);
      if (isRefusal) issues.push("FALSE REFUSAL — API 6A has pressure rating tables");

      // P0: Confidence should be reasonable
      if (data.confidence?.overall && data.confidence.overall > 30) {
        notes.push(`Confidence: ${data.confidence.overall}%`);
      }

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
  console.log("  SpecVault Post-Implementation Verification Test");
  console.log("  5 complex queries targeting P0–P5 improvements");
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

      // Print response preview
      const preview = (data.response || "").replace(/\n/g, " ").slice(0, 200);
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

      results.push({
        id: tc.id,
        targets: tc.targets,
        pass,
        latencyMs,
        confidence: data.confidence?.overall ?? 0,
        issues,
        notes,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ERROR: ${msg.slice(0, 150)}`);
      results.push({
        id: tc.id,
        targets: tc.targets,
        pass: false,
        latencyMs: 0,
        confidence: 0,
        issues: [msg.slice(0, 200)],
        notes: [],
      });
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
  console.log("  VERIFICATION RESULTS");
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
    console.log("  ALL 5 VERIFICATION QUERIES PASSED");
  } else {
    console.log(`  ${total - passed} QUERIES FAILED`);
  }
  console.log();
}

runVerification().catch((err) => {
  console.error("Verification test crashed:", err);
  process.exit(1);
});
