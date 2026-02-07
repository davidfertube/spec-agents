/**
 * Production Smoke Test
 *
 * Sends 1 complex query per document (8 total) to verify the full RAG pipeline
 * works end-to-end with the primary LLM (Claude Sonnet 4.5).
 *
 * Usage:
 *   npx tsx scripts/production-smoke-test.ts
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
  content_preview?: string;
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
  document: string;
  query: string;
  expectDocPattern: RegExp;
}

const TEST_CASES: TestCase[] = [
  {
    id: "SMOKE-A790",
    document: "ASTM A790",
    query: "List all mechanical properties for S32205 duplex stainless steel pipe per ASTM A790 Table 3",
    expectDocPattern: /a790/i,
  },
  {
    id: "SMOKE-A789",
    document: "ASTM A789",
    query: "Compare the yield strength of S32205 and S31803 per ASTM A789",
    expectDocPattern: /a789/i,
  },
  {
    id: "SMOKE-A312",
    document: "ASTM A312",
    query: "What are the mechanical properties for TP304L austenitic stainless steel pipe per ASTM A312?",
    expectDocPattern: /a312/i,
  },
  {
    id: "SMOKE-A872",
    document: "ASTM A872",
    query: "What heat treatment is required for centrifugally cast duplex stainless steel pipe per ASTM A872?",
    expectDocPattern: /a872/i,
  },
  {
    id: "SMOKE-A1049",
    document: "ASTM A1049",
    query: "Compare the composition limits of F51 and F53 duplex stainless steel forgings per ASTM A1049",
    expectDocPattern: /a1049/i,
  },
  {
    id: "SMOKE-5CT",
    document: "API 5CT",
    query: "What are the yield and tensile strength ranges for P110 casing per API 5CT?",
    expectDocPattern: /5ct/i,
  },
  {
    id: "SMOKE-6A",
    document: "API 6A",
    query: "List the material requirements for PSL-3 wellhead equipment per API 6A",
    expectDocPattern: /6a/i,
  },
  {
    id: "SMOKE-16C",
    document: "API 16C",
    query: "What bore sizes and working pressures are specified for choke and kill equipment per API 16C?",
    expectDocPattern: /16c/i,
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
  document: string;
  pass: boolean;
  latencyMs: number;
  sources: number;
  confidence: number;
  correctDoc: boolean;
  issues: string[];
}

async function runSmokeTest(): Promise<void> {
  console.log("=".repeat(70));
  console.log("  SpecVault Production Smoke Test");
  console.log("  8 complex queries × Claude Sonnet 4.5");
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

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    process.stdout.write(`  [${i + 1}/8] ${tc.id} (${tc.document})... `);

    try {
      const { data, latencyMs } = await queryRAG(tc.query);
      const issues: string[] = [];

      // Validate response
      if (data.error) issues.push(`API error: ${data.error}`);
      if (!data.response || data.response.length < 50) issues.push("Response too short");
      if (!data.sources || data.sources.length === 0) issues.push("No sources");
      if (!data.response?.match(/\[\d+\]/)) issues.push("No citation markers");
      if (!data.confidence) issues.push("No confidence scores");

      // Validate correct document cited
      const correctDoc = data.sources?.some((s) => tc.expectDocPattern.test(s.document)) ?? false;
      if (!correctDoc && data.sources?.length > 0) issues.push("Wrong document cited");

      const pass = issues.length === 0;
      const confidence = data.confidence?.overall ?? 0;

      results.push({
        id: tc.id,
        document: tc.document,
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
          console.log(`    ⚠ ${issue}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`ERROR: ${msg.slice(0, 100)}`);
      results.push({
        id: tc.id,
        document: tc.document,
        pass: false,
        latencyMs: 0,
        sources: 0,
        confidence: 0,
        correctDoc: false,
        issues: [msg.slice(0, 200)],
      });
    }

    // Delay between queries
    if (i < TEST_CASES.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_QUERIES));
    }
  }

  // Summary
  const passed = results.filter((r) => r.pass).length;
  const avgLatency = results.filter((r) => r.latencyMs > 0).reduce((s, r) => s + r.latencyMs, 0) / Math.max(results.filter((r) => r.latencyMs > 0).length, 1);
  const avgConfidence = results.filter((r) => r.confidence > 0).reduce((s, r) => s + r.confidence, 0) / Math.max(results.filter((r) => r.confidence > 0).length, 1);

  console.log();
  console.log("=".repeat(70));
  console.log("  RESULTS");
  console.log("=".repeat(70));
  console.log();
  console.log(`  Pass Rate:        ${passed}/8 (${((passed / 8) * 100).toFixed(0)}%)`);
  console.log(`  Avg Latency:      ${(avgLatency / 1000).toFixed(1)}s`);
  console.log(`  Avg Confidence:   ${avgConfidence.toFixed(0)}%`);
  console.log(`  Correct Document: ${results.filter((r) => r.correctDoc).length}/8`);
  console.log();

  // Per-document table
  console.log("  Document       Pass  Latency  Sources  Confidence  Doc Match");
  console.log("  " + "─".repeat(64));
  for (const r of results) {
    const pass = r.pass ? " OK " : "FAIL";
    const lat = r.latencyMs > 0 ? `${(r.latencyMs / 1000).toFixed(1)}s` : "N/A";
    const conf = r.confidence > 0 ? `${r.confidence}%` : "N/A";
    const doc = r.correctDoc ? "Yes" : "No";
    console.log(
      `  ${r.document.padEnd(14)} ${pass}  ${lat.padStart(7)}  ${String(r.sources).padStart(7)}  ${conf.padStart(10)}  ${doc.padStart(9)}`
    );
  }

  console.log();
  if (passed === 8) {
    console.log("  ✓ ALL QUERIES PASSED — System is production ready");
  } else {
    console.log(`  ✗ ${8 - passed} QUERIES FAILED — Review issues above`);
  }
  console.log();
}

runSmokeTest().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
