/**
 * MVP 10-Query Accuracy Test
 *
 * Budget-friendly accuracy validation covering all major document types
 * and key failure modes. Uses 10 queries instead of 80 to stay within
 * API credit limits.
 *
 * Coverage:
 * - 2x ASTM A789 (tubing)
 * - 2x ASTM A790 (pipe)
 * - 1x A312 (stainless steel pipe)
 * - 1x A872 (centrifugally cast)
 * - 1x A1049 (forgings)
 * - 1x API 6A (wellhead equipment)
 * - 1x API 5CT (purchasing guidelines — known limitation)
 * - 1x Cross-spec comparison
 *
 * Usage:
 *   npx tsx scripts/mvp-10-query-test.ts
 *
 * Requires: dev server running on localhost:3000
 */

export {};

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const QUERY_TIMEOUT = 180_000;
const DELAY_BETWEEN_QUERIES = 2_000;

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
  spec: string;
  query: string;
  validate: (data: RAGResponse) => { pass: boolean; issues: string[]; notes: string[] };
}

const TEST_CASES: TestCase[] = [
  // Q01: A789 — yield strength for S32205 (should be 70 ksi)
  {
    id: "Q01",
    spec: "A789",
    query: "What is the minimum yield strength for S32205 duplex stainless steel per ASTM A789?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (/I cannot/i.test(resp)) issues.push("False refusal");
      const hasA789 = data.sources?.some(s => /a789/i.test(s.document));
      if (!hasA789) issues.push("No A789 source");
      if (/70\s*ksi|485\s*MPa/i.test(resp)) notes.push("Correct: 70 ksi");
      else issues.push("Missing 70 ksi yield value");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // Q02: A789 — chemical composition
  {
    id: "Q02",
    spec: "A789",
    query: "What are the chemical composition limits for S31803 duplex stainless steel per ASTM A789?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (/I cannot/i.test(resp)) issues.push("False refusal");
      const hasA789 = data.sources?.some(s => /a789/i.test(s.document));
      if (!hasA789) issues.push("No A789 source");
      if (/chromium|Cr|nickel|Ni|nitrogen|molybdenum/i.test(resp)) notes.push("Elements mentioned");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // Q03: A790 — yield strength for S32205 (should be 65 ksi)
  {
    id: "Q03",
    spec: "A790",
    query: "What is the minimum yield strength for S32205 duplex stainless steel per ASTM A790?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (/I cannot/i.test(resp)) issues.push("False refusal");
      const hasA790 = data.sources?.some(s => /a790/i.test(s.document));
      if (!hasA790) issues.push("No A790 source");
      if (/65\s*ksi|450\s*MPa/i.test(resp)) notes.push("Correct: 65 ksi");
      else issues.push("Missing 65 ksi yield value");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // Q04: A790 — heat treatment
  {
    id: "Q04",
    spec: "A790",
    query: "What are the heat treatment requirements for duplex stainless steel per ASTM A790?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (/I cannot/i.test(resp)) issues.push("False refusal");
      const hasA790 = data.sources?.some(s => /a790/i.test(s.document));
      if (!hasA790) issues.push("No A790 source");
      if (/anneal|solution|quench|heat treat/i.test(resp)) notes.push("Heat treatment terms present");
      if (/\d{3,4}\s*°[FC]/i.test(resp)) notes.push("Temperature values found");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // Q05: A312 — austenitic stainless
  {
    id: "Q05",
    spec: "A312",
    query: "What is the minimum tensile strength for TP304 stainless steel pipe per ASTM A312?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (/I cannot/i.test(resp)) issues.push("False refusal");
      const hasA312 = data.sources?.some(s => /a312/i.test(s.document));
      if (!hasA312) issues.push("No A312 source");
      if (/75\s*ksi|515\s*MPa/i.test(resp)) notes.push("Correct: 75 ksi tensile");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // Q06: A872 — centrifugally cast
  {
    id: "Q06",
    spec: "A872",
    query: "What grades of duplex stainless steel are covered by ASTM A872 for centrifugally cast pipe?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (/I cannot/i.test(resp)) issues.push("False refusal");
      const hasA872 = data.sources?.some(s => /a872/i.test(s.document));
      if (!hasA872) issues.push("No A872 source");
      if (resp.length > 80) notes.push("Substantive response");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // Q07: A1049 — forgings
  {
    id: "Q07",
    spec: "A1049",
    query: "What are the mechanical property requirements for duplex stainless steel forgings per ASTM A1049?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (/I cannot/i.test(resp)) issues.push("False refusal");
      const hasA1049 = data.sources?.some(s => /a1049/i.test(s.document));
      if (!hasA1049) issues.push("No A1049 source");
      if (/yield|tensile|elongation/i.test(resp)) notes.push("Mechanical properties discussed");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // Q08: API 6A — pressure ratings
  {
    id: "Q08",
    spec: "API 6A",
    query: "What are the rated working pressures for API 6A wellhead equipment?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (/I cannot/i.test(resp)) issues.push("False refusal");
      const has6A = data.sources?.some(s => /6a/i.test(s.document));
      if (!has6A) issues.push("No API 6A source");
      if (/\d{1,3},?\d{3}\s*psi/i.test(resp)) notes.push("Pressure values found");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // Q09: API 5CT — known limitation (purchasing guide only)
  {
    id: "Q09",
    spec: "API 5CT*",
    query: "What information does the API 5CT purchasing guidelines document cover?",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      // This is the purchasing guide, not the full spec — we ask a fair question
      if (/I cannot/i.test(resp)) issues.push("False refusal on purchasing guide content");
      if (resp.length > 80) notes.push("Substantive response");
      if (/purchas|guid|casing|tubing|order/i.test(resp)) notes.push("Purchasing content discussed");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");

      return { pass: issues.length === 0, issues, notes };
    },
  },

  // Q10: Cross-spec comparison — the critical test
  {
    id: "Q10",
    spec: "A789+A790",
    query: "Compare the minimum yield strength of S32205 between ASTM A789 and ASTM A790.",
    validate: (data) => {
      const issues: string[] = [];
      const notes: string[] = [];
      const resp = data.response || "";

      if (/I cannot/i.test(resp)) issues.push("False refusal");

      const has70 = /70\s*ksi|485\s*MPa/i.test(resp);
      const has65 = /65\s*ksi|450\s*MPa/i.test(resp);
      if (!has70) issues.push("Missing A789 yield: 70 ksi");
      if (!has65) issues.push("Missing A790 yield: 65 ksi");

      const docsA789 = data.sources?.some(s => /a789/i.test(s.document));
      const docsA790 = data.sources?.some(s => /a790/i.test(s.document));
      if (!docsA789) issues.push("Missing A789 source");
      if (!docsA790) issues.push("Missing A790 source");

      if (has70 && has65) notes.push("Both values correct!");
      if (/\[\d+\]/.test(resp)) notes.push("Citations present");

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

async function runTest(): Promise<void> {
  console.log("=".repeat(70));
  console.log("  SpecVault MVP 10-Query Accuracy Test");
  console.log("  Budget-friendly validation across all document types");
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

  const results: { id: string; spec: string; pass: boolean; latencyMs: number; confidence: number; issues: string[]; notes: string[] }[] = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`  [${i + 1}/${TEST_CASES.length}] ${tc.id} (${tc.spec})`);
    console.log(`  Query: "${tc.query.slice(0, 90)}${tc.query.length > 90 ? '...' : ''}"`);
    console.log();

    try {
      const { data, latencyMs } = await queryRAG(tc.query);
      const { pass, issues, notes } = tc.validate(data);

      const preview = (data.response || "").replace(/\n/g, " ").slice(0, 200);
      console.log(`  Response: ${preview}...`);
      console.log(`  Sources:  ${data.sources?.map(s => `${s.ref} ${s.document} p.${s.page}`).join(" | ") || "none"}`);
      console.log(`  Confidence: ${data.confidence?.overall || 'N/A'}% (R:${data.confidence?.retrieval || '?'}% G:${data.confidence?.grounding || '?'}% C:${data.confidence?.coherence || '?'}%)`);
      console.log(`  Latency:  ${(latencyMs / 1000).toFixed(1)}s`);
      console.log(`  Result:   ${pass ? "PASS" : "FAIL"}`);

      if (issues.length > 0) for (const issue of issues) console.log(`    ISSUE: ${issue}`);
      if (notes.length > 0) for (const note of notes) console.log(`    NOTE:  ${note}`);

      results.push({ id: tc.id, spec: tc.spec, pass, latencyMs, confidence: data.confidence?.overall ?? 0, issues, notes });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ERROR: ${msg.slice(0, 150)}`);
      results.push({ id: tc.id, spec: tc.spec, pass: false, latencyMs: 0, confidence: 0, issues: [msg.slice(0, 200)], notes: [] });
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
  console.log("  MVP 10-QUERY TEST RESULTS");
  console.log("=".repeat(70));
  console.log();
  console.log(`  Pass Rate:       ${passed}/${total} (${((passed / total) * 100).toFixed(0)}%)`);
  console.log(`  Avg Latency:     ${(avgLatency / 1000).toFixed(1)}s`);
  console.log(`  Avg Confidence:  ${avgConfidence.toFixed(0)}%`);
  console.log();

  console.log("  ID    Spec          Pass  Latency  Confidence");
  console.log("  " + "\u2500".repeat(56));
  for (const r of results) {
    const pass = r.pass ? " OK " : "FAIL";
    const lat = r.latencyMs > 0 ? `${(r.latencyMs / 1000).toFixed(1)}s` : "N/A";
    const conf = r.confidence > 0 ? `${r.confidence}%` : "N/A";
    console.log(`  ${r.id.padEnd(6)} ${r.spec.padEnd(13)} ${pass}  ${lat.padStart(7)}  ${conf.padStart(10)}`);
  }
  console.log();

  // Failure analysis
  const failures = results.filter(r => !r.pass);
  if (failures.length > 0) {
    console.log("  FAILURE ANALYSIS:");
    for (const f of failures) {
      console.log(`    ${f.id} (${f.spec}): ${f.issues.join("; ")}`);
    }
    console.log();
  }

  if (passed === total) {
    console.log("  ALL 10 QUERIES PASSED!");
  } else {
    console.log(`  ${failures.length} QUERIES FAILED — see analysis above`);
  }
  console.log();
}

runTest().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
