/**
 * Extended Smoke Test — 10 Complex Material Engineer Queries
 *
 * Harder queries that test edge cases: cross-spec comparisons,
 * multi-part questions, table extraction, section lookups, and
 * questions that should be refused.
 *
 * Usage:
 *   npx tsx scripts/extended-smoke-test.ts
 *
 * Requires: dev server running on localhost:3000
 */

export {};

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const QUERY_TIMEOUT = 120_000;
const DELAY_BETWEEN_QUERIES = 5_000;

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
  category: string;
  query: string;
  expectDocPattern: RegExp;
  expectRefusal?: boolean;
  expectKeyword?: string;
}

const TEST_CASES: TestCase[] = [
  // Cross-spec comparison (hardest type)
  {
    id: "EXT-01",
    category: "Cross-Spec",
    query: "Compare the yield strength of S32205 between ASTM A789 tubing and ASTM A790 pipe. Which one has a higher minimum?",
    expectDocPattern: /a78[90]|a790/i,
    expectKeyword: "70",
  },
  // Multi-part extraction from a single table
  {
    id: "EXT-02",
    category: "Table Extract",
    query: "For S32750 super duplex per ASTM A789, list the yield strength, tensile strength, and elongation requirements from Table 3",
    expectDocPattern: /a789/i,
    expectKeyword: "80",
  },
  // Chemical composition lookup
  {
    id: "EXT-03",
    category: "Composition",
    query: "What are the chromium and molybdenum limits for S32205 per ASTM A790?",
    expectDocPattern: /a790/i,
    expectKeyword: "Cr",
  },
  // API spec - pressure rating table
  {
    id: "EXT-04",
    category: "API Pressure",
    query: "What are the rated working pressures for 2-1/16 inch flanges per API 6A?",
    expectDocPattern: /6a/i,
  },
  // Refusal query — pricing not in specs
  {
    id: "EXT-05",
    category: "Refusal",
    query: "What is the current market price per foot of ASTM A790 S32205 pipe?",
    expectDocPattern: /.*/,
    expectRefusal: true,
  },
  // Heat treatment requirements
  {
    id: "EXT-06",
    category: "Heat Treatment",
    query: "What solution annealing temperature is required for duplex stainless steel per ASTM A789?",
    expectDocPattern: /a789/i,
  },
  // API 5CT grade comparison
  {
    id: "EXT-07",
    category: "Grade Compare",
    query: "Compare the yield strength requirements of L80 and P110 casing grades per API 5CT",
    expectDocPattern: /5ct/i,
    expectKeyword: "80",
  },
  // Hardness requirements — tests HRC/HBW gotcha
  {
    id: "EXT-08",
    category: "Hardness",
    query: "What is the maximum hardness for S32205 duplex per ASTM A790?",
    expectDocPattern: /a790/i,
  },
  // API 16C - specific section lookup
  {
    id: "EXT-09",
    category: "Section Lookup",
    query: "What are the material requirements for choke manifold body per API 16C?",
    expectDocPattern: /16c/i,
  },
  // Forging spec — less common document
  {
    id: "EXT-10",
    category: "Forgings",
    query: "What are the tension test requirements for F51 forgings per ASTM A1049?",
    expectDocPattern: /a1049/i,
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

interface Result {
  id: string;
  category: string;
  pass: boolean;
  latencyMs: number;
  sources: number;
  confidence: number;
  correctDoc: boolean;
  issues: string[];
}

async function runExtendedTest(): Promise<void> {
  console.log("=".repeat(70));
  console.log("  SpecVault Extended Smoke Test");
  console.log("  10 complex material engineer queries");
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

  const results: Result[] = [];
  const total = TEST_CASES.length;

  for (let i = 0; i < total; i++) {
    const tc = TEST_CASES[i];
    process.stdout.write(`  [${i + 1}/${total}] ${tc.id} (${tc.category})... `);

    try {
      const { data, latencyMs } = await queryRAG(tc.query);
      const issues: string[] = [];

      if (data.error) issues.push(`API error: ${data.error}`);

      if (tc.expectRefusal) {
        // For refusal queries, we expect the system to refuse
        const refusePatterns = [
          /cannot (answer|provide)/i,
          /not (in|found|included|available)/i,
          /pricing|price|cost|vendor/i,
        ];
        const isRefusal = refusePatterns.some((p) => p.test(data.response || ""));
        if (!isRefusal) issues.push("Expected refusal but got answer");
      } else {
        // Normal query validation
        if (!data.response || data.response.length < 50) issues.push("Response too short");
        if (!data.sources || data.sources.length === 0) issues.push("No sources");
        if (!data.response?.match(/\[\d+\]/)) issues.push("No citation markers");
        if (!data.confidence) issues.push("No confidence scores");
        if (tc.expectKeyword && !data.response?.includes(tc.expectKeyword)) {
          issues.push(`Missing expected keyword: "${tc.expectKeyword}"`);
        }
      }

      const correctDoc = tc.expectRefusal
        ? true
        : (data.sources?.some((s) => tc.expectDocPattern.test(s.document)) ?? false);
      if (!correctDoc && !tc.expectRefusal && data.sources?.length > 0)
        issues.push("Wrong document cited");

      const pass = issues.length === 0;
      const confidence = data.confidence?.overall ?? 0;

      results.push({
        id: tc.id,
        category: tc.category,
        pass,
        latencyMs,
        sources: data.sources?.length ?? 0,
        confidence,
        correctDoc,
        issues,
      });

      const status = pass ? "OK" : "FAIL";
      const latencyStr = `${(latencyMs / 1000).toFixed(1)}s`;
      const confStr = confidence > 0 ? `${confidence}%` : "N/A";
      console.log(`${status} (${latencyStr}, ${data.sources?.length ?? 0} sources, ${confStr} confidence)`);

      if (!pass) {
        for (const issue of issues) {
          console.log(`    > ${issue}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`ERROR: ${msg.slice(0, 100)}`);
      results.push({
        id: tc.id,
        category: tc.category,
        pass: false,
        latencyMs: 0,
        sources: 0,
        confidence: 0,
        correctDoc: false,
        issues: [msg.slice(0, 200)],
      });
    }

    if (i < total - 1) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_QUERIES));
    }
  }

  // Summary
  const passed = results.filter((r) => r.pass).length;
  const activeResults = results.filter((r) => r.latencyMs > 0);
  const avgLatency = activeResults.reduce((s, r) => s + r.latencyMs, 0) / Math.max(activeResults.length, 1);
  const confResults = results.filter((r) => r.confidence > 0);
  const avgConfidence = confResults.reduce((s, r) => s + r.confidence, 0) / Math.max(confResults.length, 1);

  console.log();
  console.log("=".repeat(70));
  console.log("  EXTENDED TEST RESULTS");
  console.log("=".repeat(70));
  console.log();
  console.log(`  Pass Rate:        ${passed}/${total} (${((passed / total) * 100).toFixed(0)}%)`);
  console.log(`  Avg Latency:      ${(avgLatency / 1000).toFixed(1)}s`);
  console.log(`  Avg Confidence:   ${avgConfidence.toFixed(0)}%`);
  console.log(`  Correct Document: ${results.filter((r) => r.correctDoc).length}/${total}`);
  console.log();

  console.log("  ID       Category        Pass  Latency  Sources  Confidence");
  console.log("  " + "─".repeat(64));
  for (const r of results) {
    const pass = r.pass ? " OK " : "FAIL";
    const lat = r.latencyMs > 0 ? `${(r.latencyMs / 1000).toFixed(1)}s` : "N/A";
    const conf = r.confidence > 0 ? `${r.confidence}%` : "N/A";
    console.log(
      `  ${r.id.padEnd(8)} ${r.category.padEnd(15)} ${pass}  ${lat.padStart(7)}  ${String(r.sources).padStart(7)}  ${conf.padStart(10)}`
    );
  }

  console.log();
  if (passed === total) {
    console.log("  ALL QUERIES PASSED");
  } else {
    console.log(`  ${total - passed} QUERIES FAILED — Review issues above`);
  }
  console.log();
}

runExtendedTest().catch((err) => {
  console.error("Extended test crashed:", err);
  process.exit(1);
});
