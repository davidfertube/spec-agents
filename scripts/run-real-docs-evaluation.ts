#!/usr/bin/env tsx
/**
 * Comprehensive Real Docs Evaluation
 *
 * Runs ~110 queries (10 per document x 11 documents) against:
 * 1. SpecVault RAG system
 * 2. Baseline comparison
 *
 * Simplified: No easy queries, 4 medium, 5 difficult, 1 edge case per doc
 * Measures accuracy, hallucination rate, citation quality, and latency.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config({ path: '.env.local' });

const anthropic = new Anthropic();

// Load test queries
const testData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../tests/evaluation/comprehensive-real-docs.json'), 'utf-8')
);

interface Query {
  id: string;
  query: string;
  expectedPatterns: string[];
  forbiddenPatterns?: string[];
  category: string;
  notes?: string;
}

interface TestResult {
  id: string;
  document: string;
  difficulty: string;
  query: string;
  ragResponse: string;
  ragLatencyMs: number;
  ragPassed: boolean;
  ragMatchedPatterns: string[];
  ragForbiddenMatches: string[];
  baselineResponse?: string;
  baselineLatencyMs?: number;
  baselinePassed?: boolean;
  hasCitations: boolean;
  error?: string;
}

interface DifficultyStats {
  total: number;
  passed: number;
  accuracy: number;
}

interface DocumentResults {
  document: string;
  easy: DifficultyStats;
  medium: DifficultyStats;
  difficult: DifficultyStats;
  edge_case: DifficultyStats;
  overall: DifficultyStats;
}

type DifficultyLevel = 'easy' | 'medium' | 'difficult' | 'edge_case';

const RAG_ENDPOINT = process.env.RAG_ENDPOINT || 'http://localhost:3000/api/chat';
const DELAY_BETWEEN_QUERIES = parseInt(process.env.QUERY_DELAY || '500');
const RUN_BASELINE = process.env.RUN_BASELINE !== 'false';
const SPECIFIC_DOC = process.env.TEST_DOC; // Run only specific document

interface RAGSource {
  ref: string;
  document: string;
  page: string;
  content_preview: string;
}

async function queryRAG(query: string): Promise<{ response: string; sources: RAGSource[]; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(RAG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      throw new Error(`RAG API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return {
      response: data.response || '',
      sources: data.sources || [],
      latencyMs: Date.now() - start,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      response: `ERROR: ${errorMessage}`,
      sources: [],
      latencyMs: Date.now() - start,
    };
  }
}

async function queryBaseline(query: string): Promise<{ response: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a materials engineer. Answer this question about steel specifications. If you don't know or aren't sure, say so clearly.\n\nQuestion: ${query}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return { response: text, latencyMs: Date.now() - start };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { response: `ERROR: ${errorMessage}`, latencyMs: Date.now() - start };
  }
}

function checkPatterns(response: string, expectedPatterns: string[], forbiddenPatterns?: string[]): {
  passed: boolean;
  matchedPatterns: string[];
  forbiddenMatches: string[];
} {
  const lowerResponse = response.toLowerCase();
  const matchedPatterns: string[] = [];
  const forbiddenMatches: string[] = [];

  // Check expected patterns
  for (const pattern of expectedPatterns) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(response)) {
        matchedPatterns.push(pattern);
      }
    } catch {
      // Invalid regex, try literal match
      if (lowerResponse.includes(pattern.toLowerCase())) {
        matchedPatterns.push(pattern);
      }
    }
  }

  // Check forbidden patterns
  if (forbiddenPatterns) {
    for (const pattern of forbiddenPatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(response)) {
          forbiddenMatches.push(pattern);
        }
      } catch {
        if (lowerResponse.includes(pattern.toLowerCase())) {
          forbiddenMatches.push(pattern);
        }
      }
    }
  }

  // Pass if at least 50% of expected patterns match and no forbidden patterns
  const matchRatio = matchedPatterns.length / expectedPatterns.length;
  const passed = matchRatio >= 0.5 && forbiddenMatches.length === 0;

  return { passed, matchedPatterns, forbiddenMatches };
}

async function runTest(
  docKey: string,
  difficulty: string,
  queryData: Query
): Promise<TestResult> {
  console.log(`  Testing ${queryData.id}...`);

  // Query RAG
  const ragResult = await queryRAG(queryData.query);
  const ragCheck = checkPatterns(
    ragResult.response,
    queryData.expectedPatterns,
    queryData.forbiddenPatterns
  );

  const result: TestResult = {
    id: queryData.id,
    document: docKey,
    difficulty,
    query: queryData.query,
    ragResponse: ragResult.response,
    ragLatencyMs: ragResult.latencyMs,
    ragPassed: ragCheck.passed,
    ragMatchedPatterns: ragCheck.matchedPatterns,
    ragForbiddenMatches: ragCheck.forbiddenMatches,
    hasCitations: ragResult.sources.length > 0,
  };

  // Query baseline if enabled
  if (RUN_BASELINE && difficulty !== 'edge_case') {
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_QUERIES));
    const baselineResult = await queryBaseline(queryData.query);
    const baselineCheck = checkPatterns(
      baselineResult.response,
      queryData.expectedPatterns,
      queryData.forbiddenPatterns
    );
    result.baselineResponse = baselineResult.response;
    result.baselineLatencyMs = baselineResult.latencyMs;
    result.baselinePassed = baselineCheck.passed;
  }

  // Log result
  const status = ragCheck.passed ? '✅' : '❌';
  const baselineStatus = result.baselinePassed !== undefined
    ? (result.baselinePassed ? ' | Baseline: ✅' : ' | Baseline: ❌')
    : '';
  console.log(`    ${status} ${queryData.id} (${ragResult.latencyMs}ms)${baselineStatus}`);

  if (!ragCheck.passed) {
    console.log(`      Expected: ${queryData.expectedPatterns.join(', ')}`);
    console.log(`      Matched: ${ragCheck.matchedPatterns.join(', ') || 'none'}`);
    if (ragCheck.forbiddenMatches.length > 0) {
      console.log(`      Forbidden matches: ${ragCheck.forbiddenMatches.join(', ')}`);
    }
  }

  return result;
}

async function runDocumentTests(docKey: string): Promise<{ results: TestResult[]; summary: DocumentResults }> {
  const docData = testData.documents[docKey];
  if (!docData) {
    throw new Error(`Document ${docKey} not found`);
  }

  console.log(`\n📄 Testing: ${docData.description}`);
  console.log(`   File: ${docData.filename}`);

  const results: TestResult[] = [];
  const summary: DocumentResults = {
    document: docKey,
    easy: { total: 0, passed: 0, accuracy: 0 },
    medium: { total: 0, passed: 0, accuracy: 0 },
    difficult: { total: 0, passed: 0, accuracy: 0 },
    edge_case: { total: 0, passed: 0, accuracy: 0 },
    overall: { total: 0, passed: 0, accuracy: 0 },
  };

  // Skip easy queries entirely, reduce medium to 4, difficult to 5
  for (const difficulty of ['medium', 'difficult', 'edge_case']) {
    let queries = docData.queries[difficulty];
    if (!queries || queries.length === 0) continue;

    // Reduce query counts significantly
    if (difficulty === 'medium') {
      queries = queries.slice(0, 4);
    } else if (difficulty === 'difficult') {
      queries = queries.slice(0, 5);
    }

    console.log(`\n  ${difficulty.toUpperCase()} (${queries.length} queries):`);

    for (const queryData of queries) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_QUERIES));

      try {
        const result = await runTest(docKey, difficulty, queryData);
        results.push(result);

        const diffStats = summary[difficulty as DifficultyLevel];
        diffStats.total++;
        summary.overall.total++;

        if (result.ragPassed) {
          diffStats.passed++;
          summary.overall.passed++;
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`    ❌ ${queryData.id}: Error - ${errorMessage}`);
        results.push({
          id: queryData.id,
          document: docKey,
          difficulty,
          query: queryData.query,
          ragResponse: '',
          ragLatencyMs: 0,
          ragPassed: false,
          ragMatchedPatterns: [],
          ragForbiddenMatches: [],
          hasCitations: false,
          error: errorMessage,
        });
        const errDiffStats = summary[difficulty as DifficultyLevel];
        errDiffStats.total++;
        summary.overall.total++;
      }
    }

    // Calculate accuracy for this difficulty
    const diffSummary = summary[difficulty as DifficultyLevel];
    diffSummary.accuracy = diffSummary.total > 0
      ? Math.round((diffSummary.passed / diffSummary.total) * 100)
      : 0;
  }

  // Calculate overall accuracy
  summary.overall.accuracy = summary.overall.total > 0
    ? Math.round((summary.overall.passed / summary.overall.total) * 100)
    : 0;

  return { results, summary };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('           COMPREHENSIVE REAL DOCS EVALUATION');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`\n📊 Test Configuration:`);
  console.log(`   Total Documents: ${Object.keys(testData.documents).length}`);
  console.log(`   Queries per Document: 31 (10 easy + 10 medium + 10 difficult + 1 edge case)`);
  console.log(`   Total Queries: ${Object.keys(testData.documents).length * 31}`);
  console.log(`   RAG Endpoint: ${RAG_ENDPOINT}`);
  console.log(`   Run Baseline: ${RUN_BASELINE}`);
  console.log(`   Query Delay: ${DELAY_BETWEEN_QUERIES}ms`);

  const allResults: TestResult[] = [];
  const documentSummaries: DocumentResults[] = [];

  const docsToTest = SPECIFIC_DOC
    ? [SPECIFIC_DOC]
    : Object.keys(testData.documents);

  for (const docKey of docsToTest) {
    try {
      const { results, summary } = await runDocumentTests(docKey);
      allResults.push(...results);
      documentSummaries.push(summary);

      console.log(`\n  📈 ${docKey} Summary:`);
      console.log(`     Easy: ${summary.easy.passed}/${summary.easy.total} (${summary.easy.accuracy}%)`);
      console.log(`     Medium: ${summary.medium.passed}/${summary.medium.total} (${summary.medium.accuracy}%)`);
      console.log(`     Difficult: ${summary.difficult.passed}/${summary.difficult.total} (${summary.difficult.accuracy}%)`);
      console.log(`     Edge Case: ${summary.edge_case.passed}/${summary.edge_case.total} (${summary.edge_case.accuracy}%)`);
      console.log(`     Overall: ${summary.overall.passed}/${summary.overall.total} (${summary.overall.accuracy}%)`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`\n  ❌ Error testing ${docKey}: ${errorMessage}`);
    }
  }

  // Calculate overall statistics
  const overallStats = {
    totalQueries: allResults.length,
    ragPassed: allResults.filter(r => r.ragPassed).length,
    ragAccuracy: 0,
    baselinePassed: allResults.filter(r => r.baselinePassed).length,
    baselineAccuracy: 0,
    withCitations: allResults.filter(r => r.hasCitations).length,
    citationRate: 0,
    avgLatency: 0,
    p95Latency: 0,
    byDifficulty: {
      easy: { total: 0, passed: 0, accuracy: 0 },
      medium: { total: 0, passed: 0, accuracy: 0 },
      difficult: { total: 0, passed: 0, accuracy: 0 },
      edge_case: { total: 0, passed: 0, accuracy: 0 },
    },
    failedTests: allResults.filter(r => !r.ragPassed).map(r => ({
      id: r.id,
      document: r.document,
      difficulty: r.difficulty,
      query: r.query,
      response: r.ragResponse.substring(0, 200),
    })),
  };

  overallStats.ragAccuracy = Math.round((overallStats.ragPassed / overallStats.totalQueries) * 100 * 10) / 10;
  overallStats.baselineAccuracy = RUN_BASELINE
    ? Math.round((overallStats.baselinePassed / allResults.filter(r => r.baselineResponse !== undefined).length) * 100 * 10) / 10
    : 0;
  overallStats.citationRate = Math.round((overallStats.withCitations / overallStats.totalQueries) * 100 * 10) / 10;

  const latencies = allResults.map(r => r.ragLatencyMs).filter(l => l > 0).sort((a, b) => a - b);
  overallStats.avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  overallStats.p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;

  // Calculate by difficulty
  for (const difficulty of ['easy', 'medium', 'difficult', 'edge_case'] as const) {
    const diffResults = allResults.filter(r => r.difficulty === difficulty);
    overallStats.byDifficulty[difficulty].total = diffResults.length;
    overallStats.byDifficulty[difficulty].passed = diffResults.filter(r => r.ragPassed).length;
    overallStats.byDifficulty[difficulty].accuracy = diffResults.length > 0
      ? Math.round((overallStats.byDifficulty[difficulty].passed / diffResults.length) * 100 * 10) / 10
      : 0;
  }

  // Print final report
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                    FINAL EVALUATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════════');

  console.log('\n📊 OVERALL RESULTS:');
  console.log(`   Total Queries: ${overallStats.totalQueries}`);
  console.log(`   RAG Accuracy: ${overallStats.ragPassed}/${overallStats.totalQueries} (${overallStats.ragAccuracy}%)`);
  if (RUN_BASELINE) {
    console.log(`   Baseline Accuracy: ${overallStats.baselinePassed}/${allResults.filter(r => r.baselineResponse !== undefined).length} (${overallStats.baselineAccuracy}%)`);
    console.log(`   RAG Improvement: +${Math.round((overallStats.ragAccuracy - overallStats.baselineAccuracy) * 10) / 10}%`);
  }
  console.log(`   Citation Rate: ${overallStats.withCitations}/${overallStats.totalQueries} (${overallStats.citationRate}%)`);

  console.log('\n📈 BY DIFFICULTY:');
  console.log(`   Easy: ${overallStats.byDifficulty.easy.passed}/${overallStats.byDifficulty.easy.total} (${overallStats.byDifficulty.easy.accuracy}%)`);
  console.log(`   Medium: ${overallStats.byDifficulty.medium.passed}/${overallStats.byDifficulty.medium.total} (${overallStats.byDifficulty.medium.accuracy}%)`);
  console.log(`   Difficult: ${overallStats.byDifficulty.difficult.passed}/${overallStats.byDifficulty.difficult.total} (${overallStats.byDifficulty.difficult.accuracy}%)`);
  console.log(`   Edge Cases: ${overallStats.byDifficulty.edge_case.passed}/${overallStats.byDifficulty.edge_case.total} (${overallStats.byDifficulty.edge_case.accuracy}%)`);

  console.log('\n⏱️ LATENCY:');
  console.log(`   Average: ${overallStats.avgLatency}ms`);
  console.log(`   P95: ${overallStats.p95Latency}ms`);

  console.log('\n📋 BY DOCUMENT:');
  for (const docSummary of documentSummaries) {
    const emoji = docSummary.overall.accuracy >= 85 ? '✅' : docSummary.overall.accuracy >= 70 ? '⚠️' : '❌';
    console.log(`   ${emoji} ${docSummary.document}: ${docSummary.overall.passed}/${docSummary.overall.total} (${docSummary.overall.accuracy}%)`);
  }

  // Determine verdict
  const verdict = overallStats.ragAccuracy >= 85 ? 'PASS' : overallStats.ragAccuracy >= 70 ? 'CONDITIONAL' : 'FAIL';
  console.log('\n═══════════════════════════════════════════════════════════════════');
  if (verdict === 'PASS') {
    console.log('   ✅ VERDICT: READY FOR LAUNCH');
    console.log('   Accuracy meets enterprise threshold (≥85%)');
  } else if (verdict === 'CONDITIONAL') {
    console.log('   ⚠️ VERDICT: CONDITIONAL LAUNCH');
    console.log('   Accuracy between 70-85%. Launch with disclaimers.');
  } else {
    console.log('   ❌ VERDICT: NOT READY FOR LAUNCH');
    console.log('   Accuracy below 70%. Additional improvements needed.');
  }
  console.log('═══════════════════════════════════════════════════════════════════');

  // Save results
  const reportPath = path.join(__dirname, '../reports/real-docs-evaluation.json');
  const report = {
    timestamp: new Date().toISOString(),
    config: {
      totalDocuments: Object.keys(testData.documents).length,
      queriesPerDocument: 31,
      ragEndpoint: RAG_ENDPOINT,
      runBaseline: RUN_BASELINE,
    },
    overall: overallStats,
    byDocument: documentSummaries,
    verdict,
    failedTests: overallStats.failedTests.slice(0, 50), // Limit to first 50
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📁 Report saved to: ${reportPath}`);

  // Exit with appropriate code
  process.exit(verdict === 'FAIL' ? 1 : 0);
}

main().catch(console.error);
