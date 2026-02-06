/**
 * Evaluation Report Generator
 *
 * Generates markdown and JSON reports from evaluation results,
 * comparing baseline Claude Opus 4.5 vs RAG system performance.
 */

import fs from 'fs';
import path from 'path';
import {
  EvaluationResult,
  ComparisonMetrics,
  aggregateMetrics,
} from '../lib/evaluation-engine';

interface ReportSummary {
  timestamp: string;
  totalQueries: number;
  baselineAccuracy: number;
  ragAccuracy: number;
  improvement: number;
  baselineHallucination: number;
  ragHallucination: number;
  hallucinationImprovement: number;
  citationAccuracy: number;
  ragPassRate: number;
  verdict: 'PASS' | 'FAIL';
  baselineAvgLatency: number;
  ragAvgLatency: number;
  ragP95Latency: number;
  byCategory: Record<string, { baseline: number; rag: number; improvement: number }>;
}

/**
 * Generate summary JSON for CI/CD checks
 */
function generateSummaryJson(metrics: ComparisonMetrics): ReportSummary {
  const passRate = metrics.ragAccuracyPct;

  return {
    timestamp: new Date().toISOString(),
    totalQueries: metrics.totalQueries,
    baselineAccuracy: Math.round(metrics.baselineAccuracyPct * 10) / 10,
    ragAccuracy: Math.round(metrics.ragAccuracyPct * 10) / 10,
    improvement: Math.round(metrics.accuracyImprovementPct * 10) / 10,
    baselineHallucination: Math.round(metrics.baselineHallucinationRate * 10) / 10,
    ragHallucination: Math.round(metrics.ragHallucinationRate * 10) / 10,
    hallucinationImprovement: Math.round(
      (metrics.baselineHallucinationRate - metrics.ragHallucinationRate) * 10
    ) / 10,
    citationAccuracy: Math.round(metrics.citationAccuracyPct * 10) / 10,
    ragPassRate: Math.round(passRate * 10) / 10,
    verdict: passRate >= 90 ? 'PASS' : 'FAIL',
    baselineAvgLatency: Math.round(metrics.baselineAvgLatencyMs),
    ragAvgLatency: Math.round(metrics.ragAvgLatencyMs),
    ragP95Latency: Math.round(metrics.ragP95LatencyMs),
    byCategory: Object.fromEntries(
      Object.entries(metrics.byCategory).map(([cat, data]) => [
        cat,
        {
          baseline: Math.round(data.baseline * 10) / 10,
          rag: Math.round(data.rag * 10) / 10,
          improvement: Math.round(data.improvement * 10) / 10,
        },
      ])
    ),
  };
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(
  results: EvaluationResult[],
  metrics: ComparisonMetrics
): string {
  const summary = generateSummaryJson(metrics);
  const lines: string[] = [];

  // Header
  lines.push('# Evaluation Report: Claude Opus 4.5 Baseline vs RAG System');
  lines.push('');
  lines.push(`**Generated:** ${summary.timestamp}`);
  lines.push(`**Total Queries:** ${summary.totalQueries}`);
  lines.push(`**Verdict:** ${summary.verdict === 'PASS' ? '✅ PASS' : '❌ FAIL'} (${summary.ragPassRate}% pass rate)`);
  lines.push('');

  // Executive Summary Table
  lines.push('## Executive Summary');
  lines.push('');
  lines.push('| Metric | Baseline | RAG | Improvement |');
  lines.push('|--------|----------|-----|-------------|');
  lines.push(
    `| Overall Accuracy | ${summary.baselineAccuracy}% | ${summary.ragAccuracy}% | **${summary.improvement >= 0 ? '+' : ''}${summary.improvement}%** |`
  );
  lines.push(
    `| Hallucination Rate | ${summary.baselineHallucination}% | ${summary.ragHallucination}% | **${summary.hallucinationImprovement >= 0 ? '-' : '+'}${Math.abs(summary.hallucinationImprovement)}%** |`
  );
  lines.push(
    `| Citation Accuracy | N/A | ${summary.citationAccuracy}% | - |`
  );
  lines.push(
    `| Avg Latency | ${summary.baselineAvgLatency}ms | ${summary.ragAvgLatency}ms | ${summary.ragAvgLatency - summary.baselineAvgLatency}ms |`
  );
  lines.push(
    `| P95 Latency | - | ${summary.ragP95Latency}ms | ${summary.ragP95Latency < 5000 ? '✅ <5s' : '⚠️ >5s'} |`
  );
  lines.push('');

  // Category Breakdown
  lines.push('## Category Breakdown');
  lines.push('');
  lines.push('| Category | Description | Baseline | RAG | Winner |');
  lines.push('|----------|-------------|----------|-----|--------|');

  const categoryDescriptions: Record<string, string> = {
    A: 'Direct Lookup',
    B: 'Code Interpretation',
    C: 'Comparison',
    D: 'Complex/Multi-Part',
    E: 'Hallucination Detection',
  };

  for (const [cat, data] of Object.entries(summary.byCategory)) {
    const winner = data.rag > data.baseline ? 'RAG ✅' : data.baseline > data.rag ? 'Baseline' : 'Tie';
    lines.push(
      `| ${cat} | ${categoryDescriptions[cat] || 'Unknown'} | ${data.baseline}% | ${data.rag}% | ${winner} |`
    );
  }
  lines.push('');

  // Refusal Accuracy
  if (metrics.totalRefusalQueries > 0) {
    lines.push('## Hallucination Detection (Category E)');
    lines.push('');
    lines.push('| Metric | Baseline | RAG |');
    lines.push('|--------|----------|-----|');
    lines.push(
      `| Correct Refusals | ${metrics.baselineCorrectRefusals}/${metrics.totalRefusalQueries} | ${metrics.ragCorrectRefusals}/${metrics.totalRefusalQueries} |`
    );
    lines.push(
      `| Refusal Rate | ${Math.round((metrics.baselineCorrectRefusals / metrics.totalRefusalQueries) * 100)}% | ${Math.round((metrics.ragCorrectRefusals / metrics.totalRefusalQueries) * 100)}% |`
    );
    lines.push('');
  }

  // Citation Quality
  lines.push('## Citation Quality (RAG Only)');
  lines.push('');
  lines.push('| Metric | Value | Target | Status |');
  lines.push('|--------|-------|--------|--------|');
  lines.push(
    `| Citation Accuracy | ${summary.citationAccuracy}% | 100% | ${summary.citationAccuracy >= 95 ? '✅' : summary.citationAccuracy >= 80 ? '⚠️' : '❌'} |`
  );
  lines.push(
    `| Valid Page Numbers | ${Math.round(metrics.validPageNumberPct)}% | 100% | ${metrics.validPageNumberPct >= 95 ? '✅' : '⚠️'} |`
  );
  lines.push(
    `| Char Offsets (PDF Highlighting) | ${Math.round(metrics.charOffsetPresentPct)}% | 100% | ${metrics.charOffsetPresentPct >= 95 ? '✅' : '⚠️'} |`
  );
  lines.push('');

  // Comparison Breakdown
  lines.push('## Comparison Breakdown');
  lines.push('');
  lines.push('| Outcome | Count | Percentage |');
  lines.push('|---------|-------|------------|');
  lines.push(
    `| RAG Improvements (Baseline wrong, RAG correct) | ${metrics.ragImprovements} | ${Math.round((metrics.ragImprovements / metrics.totalQueries) * 100)}% |`
  );
  lines.push(
    `| RAG Regressions (Baseline correct, RAG wrong) | ${metrics.ragRegressions} | ${Math.round((metrics.ragRegressions / metrics.totalQueries) * 100)}% |`
  );
  lines.push(
    `| Both Correct | ${metrics.bothCorrect} | ${Math.round((metrics.bothCorrect / metrics.totalQueries) * 100)}% |`
  );
  lines.push(
    `| Both Wrong | ${metrics.bothWrong} | ${Math.round((metrics.bothWrong / metrics.totalQueries) * 100)}% |`
  );
  lines.push('');

  // Detailed Results
  lines.push('## Detailed Results');
  lines.push('');
  lines.push('<details>');
  lines.push('<summary>Click to expand detailed results for each query</summary>');
  lines.push('');

  for (const result of results) {
    const baselineStatus = result.comparison.baselineCorrect ? '✅' : '❌';
    const ragStatus = result.comparison.ragCorrect ? '✅' : '❌';
    const comparison = result.comparison.ragImprovement
      ? '📈 RAG Improvement'
      : result.comparison.ragRegression
        ? '📉 RAG Regression'
        : result.comparison.bothCorrect
          ? '✅ Both Correct'
          : '❌ Both Wrong';

    lines.push(`### ${result.queryId}: ${result.query}`);
    lines.push('');
    lines.push(`**Category:** ${result.categoryLetter} (${result.category}) | **Difficulty:** ${result.difficulty}`);
    lines.push('');
    lines.push(`**Baseline:** ${baselineStatus} (${result.baseline.latency_ms}ms)`);
    lines.push(`**RAG:** ${ragStatus} (${result.rag.latency_ms}ms)`);
    lines.push(`**Comparison:** ${comparison}`);
    lines.push('');

    // Truncate long responses
    const maxResponseLength = 300;
    const baselineResponse = result.baseline.response.length > maxResponseLength
      ? result.baseline.response.slice(0, maxResponseLength) + '...'
      : result.baseline.response;
    const ragResponse = result.rag.response.length > maxResponseLength
      ? result.rag.response.slice(0, maxResponseLength) + '...'
      : result.rag.response;

    lines.push('**Baseline Response:**');
    lines.push('```');
    lines.push(baselineResponse);
    lines.push('```');
    lines.push('');
    lines.push('**RAG Response:**');
    lines.push('```');
    lines.push(ragResponse);
    lines.push('```');
    lines.push('');

    if (result.rag.sources.length > 0) {
      lines.push('**Citations:**');
      for (const source of result.rag.sources) {
        lines.push(`- ${source.ref} ${source.document} (Page ${source.page})`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  lines.push('</details>');
  lines.push('');

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');

  const recommendations: string[] = [];

  if (metrics.ragAccuracyPct < 90) {
    recommendations.push('- ⚠️ RAG accuracy below 90% threshold - review failed queries and improve retrieval');
  }
  if (metrics.ragHallucinationRate > 5) {
    recommendations.push('- ⚠️ RAG hallucination rate above 5% - strengthen refusal logic for out-of-scope queries');
  }
  if (metrics.ragRegressions > 0) {
    recommendations.push(`- ⚠️ ${metrics.ragRegressions} regression(s) detected - investigate cases where baseline outperforms RAG`);
  }
  if (metrics.charOffsetPresentPct < 100) {
    recommendations.push('- ⚠️ Some citations missing character offsets - PDF highlighting may not work for all citations');
  }
  if (metrics.ragP95LatencyMs > 5000) {
    recommendations.push('- ⚠️ P95 latency exceeds 5 seconds - optimize retrieval or LLM generation');
  }

  if (recommendations.length === 0) {
    recommendations.push('- ✅ All metrics within acceptable thresholds');
  }

  lines.push(...recommendations);
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Report generated by SpecVault Evaluation Framework*');

  return lines.join('\n');
}

/**
 * Main report generation function
 */
async function main() {
  const resultsPath = path.join(__dirname, 'evaluation-results.json');
  const quickResultsPath = path.join(__dirname, 'quick-evaluation-results.json');

  // Try to load results from either file
  let resultsData: { results: EvaluationResult[]; metrics: ComparisonMetrics } | null = null;

  if (fs.existsSync(resultsPath)) {
    resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
  } else if (fs.existsSync(quickResultsPath)) {
    resultsData = JSON.parse(fs.readFileSync(quickResultsPath, 'utf-8'));
  }

  if (!resultsData) {
    console.error('No evaluation results found. Run evaluation tests first.');
    console.error('Expected files:');
    console.error(`  - ${resultsPath}`);
    console.error(`  - ${quickResultsPath}`);
    process.exit(1);
  }

  const { results, metrics } = resultsData;

  // Generate summary JSON
  const summary = generateSummaryJson(metrics);
  const summaryPath = path.join(__dirname, 'evaluation-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Summary JSON written to: ${summaryPath}`);

  // Generate markdown report
  const report = generateMarkdownReport(results, metrics);
  const reportPath = path.join(__dirname, 'evaluation-report.md');
  fs.writeFileSync(reportPath, report);
  console.log(`Markdown report written to: ${reportPath}`);

  // Print summary to console
  console.log('\n=== EVALUATION SUMMARY ===');
  console.log(`Verdict: ${summary.verdict}`);
  console.log(`Baseline Accuracy: ${summary.baselineAccuracy}%`);
  console.log(`RAG Accuracy: ${summary.ragAccuracy}%`);
  console.log(`Improvement: ${summary.improvement >= 0 ? '+' : ''}${summary.improvement}%`);
  console.log(`RAG Pass Rate: ${summary.ragPassRate}%`);

  // Exit with error if below threshold
  if (summary.verdict === 'FAIL') {
    console.error('\n❌ EVALUATION FAILED: RAG pass rate below 90% threshold');
    process.exit(1);
  }

  console.log('\n✅ EVALUATION PASSED');
}

// Run if executed directly
main().catch(console.error);

export { generateSummaryJson, generateMarkdownReport };
