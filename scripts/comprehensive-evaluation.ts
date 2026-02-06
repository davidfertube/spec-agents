#!/usr/bin/env tsx
/**
 * Comprehensive RAG Evaluation - Real Tests with Baseline Comparison
 *
 * Compares:
 * 1. SpecVault (RAG system)
 * 2. Baseline Opus 4.5 (no document context)
 *
 * Measures:
 * - Accuracy (pattern matching)
 * - Hallucination detection
 * - Citation quality
 * - Latency
 */

import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { validateCitations, getCitationStats, type CitationCheck } from "../lib/citation-validator";
import type { Source } from "../lib/api";

dotenv.config({ path: ".env.local" });

const anthropic = new Anthropic();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============================================
// Test Case Definitions
// ============================================

interface TestCase {
  id: string;
  query: string;
  expectedPatterns: RegExp[];
  forbiddenPatterns?: RegExp[];
  correctAnswer?: string;  // For hallucination detection
  shouldRefuse?: boolean;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface TestResult {
  testCase: TestCase;
  ragResponse: string;
  baselineResponse: string;
  ragSources: Source[];
  ragPassed: boolean;
  baselinePassed: boolean;
  ragHallucinated: boolean;
  baselineHallucinated: boolean;
  ragLatencyMs: number;
  baselineLatencyMs: number;
  ragCitationChecks: CitationCheck[];  // NEW: Citation validation results
  citationAccuracy: number;            // NEW: Percentage of valid citations
}

// Comprehensive test cases with ground truth
const TEST_CASES: TestCase[] = [
  // ===== LOOKUP TESTS =====
  {
    id: "YIELD-S32205-A790",
    query: "What is the minimum yield strength of S32205 duplex stainless steel pipe per ASTM A790?",
    expectedPatterns: [/65\s*ksi|450\s*MPa/i],
    forbiddenPatterns: [/70\s*ksi|485\s*MPa/i], // Wrong A789 value
    correctAnswer: "65 ksi (450 MPa)",
    category: "lookup",
    difficulty: "easy"
  },
  {
    id: "YIELD-S32205-A789",
    query: "What is the minimum yield strength of S32205 duplex stainless steel tubing per ASTM A789?",
    expectedPatterns: [/70\s*ksi|485\s*MPa/i],
    forbiddenPatterns: [/65\s*ksi|450\s*MPa/i], // Wrong A790 value
    correctAnswer: "70 ksi (485 MPa)",
    category: "lookup",
    difficulty: "medium"
  },
  {
    id: "CARBON-S32750",
    query: "What is the maximum carbon content for S32750 super duplex per A790?",
    expectedPatterns: [/0\.030/i],
    correctAnswer: "0.030% max",
    category: "lookup",
    difficulty: "easy"
  },
  {
    id: "HEAT-S31803",
    query: "What is the heat treatment temperature range for S31803 per A790?",
    expectedPatterns: [/1870|1020/i, /°F|°C|F\b|C\b/i],
    correctAnswer: "1870-2010°F (1020-1100°C)",
    category: "lookup",
    difficulty: "easy"
  },
  {
    id: "HARDNESS-S32205",
    query: "What is the maximum hardness for S32205 duplex pipe per A790?",
    expectedPatterns: [/290\s*(?:HB|HBW)|30\s*HRC/i], // Match HB, HBW, or HRC
    correctAnswer: "290 HBW or 30 HRC max",
    category: "lookup",
    difficulty: "easy"
  },
  {
    id: "SCOPE-A790",
    query: "What is the scope of ASTM A790? What products does it cover?",
    expectedPatterns: [/pipe/i, /seamless|welded/i, /duplex|ferritic.*austenitic/i],
    category: "lookup",
    difficulty: "easy"
  },
  {
    id: "SCOPE-A789",
    query: "What product form does ASTM A789 cover?",
    expectedPatterns: [/tubing|tube/i],
    // Allow "not pipe" clarifications - only forbid stating A789 covers pipe
    forbiddenPatterns: [/(?:covers|for)\s+(?:\w+\s+)*pipe\b/i],
    category: "lookup",
    difficulty: "easy"
  },

  // ===== COMPARISON TESTS =====
  {
    id: "COMPARE-TENSILE",
    query: "Compare the tensile strength of S32205 vs S32750 per A790",
    expectedPatterns: [/S32205/i, /S32750/i, /ksi|MPa/i],
    category: "comparison",
    difficulty: "medium"
  },
  {
    id: "COMPARE-A789-A790-YIELD",
    query: "Compare the yield strength of S32205 in A789 tubing vs A790 pipe specifications",
    expectedPatterns: [/70\s*ksi|485\s*MPa/i, /65\s*ksi|450\s*MPa/i],
    correctAnswer: "A789 tubing: 70 ksi (485 MPa), A790 pipe: 65 ksi (450 MPa)",
    category: "comparison",
    difficulty: "hard"
  },

  // ===== REFUSAL TESTS (Should refuse - not in documents) =====
  {
    id: "REFUSAL-PRICE",
    query: "What is the price per foot of A790 S32205 pipe?",
    expectedPatterns: [/cannot|not\s+(?:in|included|provided|contain)|no\s+(?:information|pricing)|don't\s+have/i],
    forbiddenPatterns: [/\$\d+|\d+\s*USD|\d+\s*(?:per|\/)\s*foot/i], // More specific - actual prices only
    shouldRefuse: true,
    category: "refusal",
    difficulty: "easy"
  },
  {
    id: "REFUSAL-CORROSION",
    query: "What is the corrosion rate of S32750 in seawater at 25C?",
    expectedPatterns: [/cannot|not\s+(?:in|included|provided|contain)|no\s+(?:information|data)|don't\s+have/i],
    forbiddenPatterns: [/mm\/year|mpy|corrosion\s+rate\s*[=:]\s*\d/i],
    shouldRefuse: true,
    category: "refusal",
    difficulty: "medium"
  },
  {
    id: "REFUSAL-LEAD-TIME",
    query: "What is the typical lead time for ordering A790 pipe?",
    expectedPatterns: [/cannot|not\s+(?:in|included|provided|contain)|no\s+(?:information|data)|don't\s+have/i],
    forbiddenPatterns: [/weeks?|days?|months?|lead\s+time\s*[=:]/i],
    shouldRefuse: true,
    category: "refusal",
    difficulty: "easy"
  },

  // ===== HALLUCINATION DETECTION =====
  {
    id: "HALLUC-FAKE-GRADE",
    query: "What is the yield strength of S99999 grade per A790?",
    expectedPatterns: [/cannot|not\s+(?:found|in|included|listed)|no\s+(?:such|information)|doesn't\s+exist|not.*covered/i],
    forbiddenPatterns: [/\d+\s*ksi|\d+\s*MPa/i], // Should NOT make up a value
    shouldRefuse: true,
    correctAnswer: "S99999 does not exist in A790",
    category: "hallucination",
    difficulty: "medium"
  },
  {
    id: "HALLUC-PREN-FORMULA",
    query: "What is the PREN formula for S32205 according to ASTM A790?",
    // A790 does NOT contain the PREN formula - only PREN thresholds in footnotes
    expectedPatterns: [/not\s+(?:in|included|provided|contain)|no\s+formula|footnote|threshold|≥\s*\d+/i],
    forbiddenPatterns: [/PREN\s*=\s*%?\s*Cr\s*\+/i], // Should NOT provide the formula as if from A790
    category: "hallucination",
    difficulty: "hard"
  },
  {
    id: "HALLUC-SPECIFIC-VALUE",
    query: "What is the exact coefficient of thermal expansion for S32205 per A790?",
    expectedPatterns: [/cannot|not\s+(?:in|included|provided|contain|specified)|no\s+(?:information|data)/i],
    forbiddenPatterns: [/\d+\.\d+.*(?:µm|inch|mm).*(?:°C|°F|K)/i], // Should NOT make up a value
    shouldRefuse: true,
    category: "hallucination",
    difficulty: "hard"
  }
];

// ============================================
// API Functions
// ============================================

async function querySpecVault(query: string): Promise<{ response: string; sources: Source[]; latencyMs: number }> {
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

async function queryBaselineOpus(query: string): Promise<{ response: string; latencyMs: number }> {
  const startTime = Date.now();

  try {
    const systemPrompt = `You are a technical assistant specializing in ASTM specifications for steel and stainless steel materials.
Answer questions about ASTM A789, A790, A872, and related specifications based on your training knowledge.
If you don't know or aren't certain, say so clearly.
Be concise and provide specific values where possible.`;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: query }]
    });

    const latencyMs = Date.now() - startTime;
    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    return { response: text, latencyMs };
  } catch (error) {
    return {
      response: `Error: ${error}`,
      latencyMs: Date.now() - startTime
    };
  }
}

// ============================================
// Evaluation Functions
// ============================================

function evaluatePatterns(response: string, testCase: TestCase): {
  passed: boolean;
  matchedPatterns: string[];
  missedPatterns: string[];
  forbiddenMatches: string[];
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

  const patternPassRate = matchedPatterns.length / testCase.expectedPatterns.length;
  const noForbiddenMatches = forbiddenMatches.length === 0;
  const passed = patternPassRate >= 0.5 && noForbiddenMatches;

  return { passed, matchedPatterns, missedPatterns, forbiddenMatches };
}

function detectHallucination(response: string, testCase: TestCase): boolean {
  // For refusal tests, check if the system made up information
  if (testCase.shouldRefuse) {
    // If it should refuse but provides specific values, it's hallucinating
    const madeUpNumberPattern = /(?:is|=|:)\s*\d+(?:\.\d+)?\s*(?:ksi|MPa|%|°[FC]|HBW?|HRC)/i;
    const madeUpPricePattern = /\$\s*\d+|\d+\s*(?:USD|dollars?)/i;

    if (madeUpNumberPattern.test(response) || madeUpPricePattern.test(response)) {
      return true;
    }
  }

  // For hallucination category tests, check forbidden patterns
  if (testCase.category === 'hallucination' && testCase.forbiddenPatterns) {
    for (const pattern of testCase.forbiddenPatterns) {
      if (pattern.test(response)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================
// Main Execution
// ============================================

async function runComprehensiveEvaluation(): Promise<void> {
  console.log("🚀 Comprehensive RAG Evaluation - SpecVault vs Baseline Opus 4.5\n");
  console.log("=".repeat(70));

  // Check documents in database
  const { data: documents } = await supabase
    .from("documents")
    .select("id, filename, status")
    .eq("status", "indexed");

  console.log(`\n📚 Indexed Documents: ${documents?.length || 0}`);
  for (const doc of documents || []) {
    console.log(`  - ${doc.filename}`);
  }

  console.log(`\n🧪 Running ${TEST_CASES.length} test cases...\n`);

  const results: TestResult[] = [];

  for (const testCase of TEST_CASES) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`📋 ${testCase.id} [${testCase.category}/${testCase.difficulty}]`);
    console.log(`   Query: ${testCase.query.slice(0, 60)}...`);

    // Run both systems in parallel
    const [ragResult, baselineResult] = await Promise.all([
      querySpecVault(testCase.query),
      queryBaselineOpus(testCase.query)
    ]);

    // Evaluate both
    const ragEval = evaluatePatterns(ragResult.response, testCase);
    const baselineEval = evaluatePatterns(baselineResult.response, testCase);

    const ragHallucinated = detectHallucination(ragResult.response, testCase);
    const baselineHallucinated = detectHallucination(baselineResult.response, testCase);

    // Validate citations
    const ragCitationChecks = validateCitations(ragResult.response, ragResult.sources);
    const citationStats = getCitationStats(ragCitationChecks);

    const result: TestResult = {
      testCase,
      ragResponse: ragResult.response,
      baselineResponse: baselineResult.response,
      ragSources: ragResult.sources,
      ragPassed: ragEval.passed,
      baselinePassed: baselineEval.passed,
      ragHallucinated,
      baselineHallucinated,
      ragLatencyMs: ragResult.latencyMs,
      baselineLatencyMs: baselineResult.latencyMs,
      ragCitationChecks,
      citationAccuracy: citationStats.accuracy
    };

    results.push(result);

    // Print status
    const ragStatus = ragEval.passed ? "✅" : "❌";
    const baselineStatus = baselineEval.passed ? "✅" : "❌";
    const ragHallucStatus = ragHallucinated ? "⚠️ HALLUC" : "";
    const baselineHallucStatus = baselineHallucinated ? "⚠️ HALLUC" : "";

    console.log(`   RAG:      ${ragStatus} ${ragHallucStatus} (${ragResult.latencyMs}ms)`);
    console.log(`   Baseline: ${baselineStatus} ${baselineHallucStatus} (${baselineResult.latencyMs}ms)`);

    if (!ragEval.passed) {
      console.log(`   RAG missed: ${ragEval.missedPatterns.join(", ")}`);
      if (ragEval.forbiddenMatches.length > 0) {
        console.log(`   RAG forbidden: ${ragEval.forbiddenMatches.join(", ")}`);
      }
    }

    // Small delay
    await new Promise(r => setTimeout(r, 300));
  }

  // Generate summary report
  generateReport(results);
}

function generateReport(results: TestResult[]): void {
  console.log("\n" + "=".repeat(70));
  console.log("COMPREHENSIVE EVALUATION REPORT");
  console.log("=".repeat(70));

  const total = results.length;

  // Overall accuracy
  const ragPassed = results.filter(r => r.ragPassed).length;
  const baselinePassed = results.filter(r => r.baselinePassed).length;

  console.log("\n📊 OVERALL ACCURACY:");
  console.log(`   SpecVault (RAG): ${ragPassed}/${total} (${((ragPassed/total)*100).toFixed(1)}%)`);
  console.log(`   Baseline Opus 4.5: ${baselinePassed}/${total} (${((baselinePassed/total)*100).toFixed(1)}%)`);
  console.log(`   RAG Improvement:   ${ragPassed > baselinePassed ? '+' : ''}${ragPassed - baselinePassed} tests`);

  // Hallucination rate
  const ragHalluc = results.filter(r => r.ragHallucinated).length;
  const baselineHalluc = results.filter(r => r.baselineHallucinated).length;

  console.log("\n🎭 HALLUCINATION RATE:");
  console.log(`   SpecVault (RAG): ${ragHalluc}/${total} (${((ragHalluc/total)*100).toFixed(1)}%)`);
  console.log(`   Baseline Opus 4.5: ${baselineHalluc}/${total} (${((baselineHalluc/total)*100).toFixed(1)}%)`);

  // Citation accuracy
  const totalCitations = results.reduce((sum, r) => sum + r.ragCitationChecks.length, 0);
  const validCitations = results.reduce((sum, r) => {
    const stats = getCitationStats(r.ragCitationChecks);
    return sum + stats.valid;
  }, 0);
  const citationAccuracy = totalCitations > 0 ? (validCitations / totalCitations) * 100 : 0;

  console.log("\n📎 CITATION ACCURACY:");
  console.log(`   Total citations: ${totalCitations}`);
  console.log(`   Valid citations: ${validCitations}/${totalCitations} (${citationAccuracy.toFixed(1)}%)`);

  const testsWithCitations = results.filter(r => r.ragCitationChecks.length > 0).length;
  const testsWithPerfectCitations = results.filter(r => r.citationAccuracy === 100).length;
  console.log(`   Tests with citations: ${testsWithCitations}/${total}`);
  console.log(`   Tests with 100% valid citations: ${testsWithPerfectCitations}/${testsWithCitations}`);

  // By category
  const categories = [...new Set(results.map(r => r.testCase.category))];
  console.log("\n📁 BY CATEGORY:");
  for (const cat of categories) {
    const catResults = results.filter(r => r.testCase.category === cat);
    const catRagPassed = catResults.filter(r => r.ragPassed).length;
    const catBaselinePassed = catResults.filter(r => r.baselinePassed).length;
    console.log(`   ${cat}:`);
    console.log(`     RAG: ${catRagPassed}/${catResults.length} (${((catRagPassed/catResults.length)*100).toFixed(0)}%)`);
    console.log(`     Baseline: ${catBaselinePassed}/${catResults.length} (${((catBaselinePassed/catResults.length)*100).toFixed(0)}%)`);
  }

  // Latency stats
  const ragLatencies = results.map(r => r.ragLatencyMs).sort((a, b) => a - b);
  const baselineLatencies = results.map(r => r.baselineLatencyMs).sort((a, b) => a - b);

  const ragP50 = ragLatencies[Math.floor(total * 0.5)];
  const ragP95 = ragLatencies[Math.floor(total * 0.95)];
  const baselineP50 = baselineLatencies[Math.floor(total * 0.5)];
  const baselineP95 = baselineLatencies[Math.floor(total * 0.95)];

  console.log("\n⏱️ LATENCY:");
  console.log(`   SpecVault (RAG):`);
  console.log(`     P50: ${ragP50}ms, P95: ${ragP95}ms`);
  console.log(`   Baseline Opus 4.5:`);
  console.log(`     P50: ${baselineP50}ms, P95: ${baselineP95}ms`);

  // Failed tests breakdown
  const ragFailed = results.filter(r => !r.ragPassed);
  if (ragFailed.length > 0) {
    console.log("\n❌ RAG FAILED TESTS:");
    for (const r of ragFailed) {
      console.log(`   ${r.testCase.id}: ${r.testCase.query.slice(0, 50)}...`);
    }
  }

  // Hallucination details
  const hallucinatedTests = results.filter(r => r.ragHallucinated);
  if (hallucinatedTests.length > 0) {
    console.log("\n⚠️ HALLUCINATION DETAILS:");
    for (const r of hallucinatedTests) {
      console.log(`   ${r.testCase.id}:`);
      console.log(`     Response snippet: ${r.ragResponse.slice(0, 100)}...`);
    }
  }

  // Summary targets
  console.log("\n" + "=".repeat(70));
  console.log("TARGET COMPARISON:");
  console.log("=".repeat(70));

  const ragAccuracy = (ragPassed / total) * 100;
  const ragHallucRate = (ragHalluc / total) * 100;
  const targetAccuracy = 95;
  const targetHalluc = 2;
  const targetP95 = 10000;
  const targetCitation = 95;

  console.log(`\n   Metric           Current     Target     Status`);
  console.log(`   ─────────────────────────────────────────────────`);
  console.log(`   Accuracy         ${ragAccuracy.toFixed(1)}%       ${targetAccuracy}%       ${ragAccuracy >= targetAccuracy ? '✅' : '❌'}`);
  console.log(`   Hallucination    ${ragHallucRate.toFixed(1)}%        <${targetHalluc}%       ${ragHallucRate < targetHalluc ? '✅' : '❌'}`);
  console.log(`   Citation Acc.    ${citationAccuracy.toFixed(1)}%       ${targetCitation}%       ${citationAccuracy >= targetCitation ? '✅' : '❌'}`);
  console.log(`   P95 Latency      ${ragP95}ms     <${targetP95}ms   ${ragP95 < targetP95 ? '✅' : '❌'}`);

  console.log("\n" + "=".repeat(70));
}

runComprehensiveEvaluation().catch(console.error);
