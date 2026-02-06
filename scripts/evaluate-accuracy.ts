/**
 * Golden Dataset Evaluation Script
 *
 * Evaluates RAG accuracy against predefined Q&A pairs.
 * Measures citation accuracy, hallucination rate, and refusal correctness.
 *
 * Usage:
 *   npx tsx scripts/evaluate-accuracy.ts [--dataset <name>] [--verbose]
 *
 * Options:
 *   --dataset <name>  Run specific dataset (e.g., "astm-a790", "duplex-general")
 *   --verbose         Show detailed results for each question
 *   --json            Output results as JSON
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

interface QAPair {
  id: string;
  question: string;
  /** Expected answer text (for exact matching) */
  expected_answer?: string;
  /** Expected values (any of these is acceptable) - more flexible */
  expected_values?: string[];
  source_table?: string;
  source_section?: string;
  source_page?: number;
  source_document?: string;
  difficulty: "easy" | "medium" | "hard" | "trap";
  tags: string[];
  expect_refusal?: boolean;
  allow_general_knowledge?: boolean;
  verification?: {
    numerical_value: number;
    unit: string;
    property: string;
  };
}

interface GoldenDataset {
  document: string;
  description: string;
  revision?: string;
  qa_pairs: QAPair[];
  metadata: {
    total_questions: number;
    easy: number;
    medium: number;
    hard: number;
    trap: number;
    requires_document: boolean;
  };
}

interface EvaluationResult {
  id: string;
  question: string;
  expected: string;
  actual: string;
  status: "correct" | "incorrect" | "refused_correctly" | "hallucinated" | "missed_refusal";
  confidence?: number;
  match_details?: {
    match: boolean;
    numberMatch: boolean;
    citationPresent: boolean;
  };
}

interface EvaluationSummary {
  dataset: string;
  timestamp: string;
  results: EvaluationResult[];
  stats: {
    total_questions: number;
    correct: number;
    incorrect: number;
    refused_correctly: number;
    hallucinated: number;
    missed_refusal: number;
    accuracy: number;
    hallucination_rate: number;
    refusal_accuracy: number;
  };
  by_difficulty: Record<string, { total: number; correct: number; accuracy: number }>;
  by_tag: Record<string, { total: number; correct: number; accuracy: number }>;
}

// ============================================================================
// API Client (Simulated for script)
// ============================================================================

const API_BASE_URL = process.env.API_URL || "http://localhost:3000";

interface APIResponse {
  response: string;
  sources: Array<{ ref: string; document: string; page: string }>;
  confidence?: number;
  status?: "success" | "refused";
}

async function queryAPI(question: string): Promise<APIResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: question }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json() as Promise<APIResponse>;
  } catch (error) {
    // Return a simulated refusal for connection errors
    return {
      response: `[API Error] ${error instanceof Error ? error.message : "Unknown error"}`,
      sources: [],
      status: "refused",
    };
  }
}

// ============================================================================
// Evaluation Logic
// ============================================================================

/**
 * Compare actual answer with expected answer or expected values
 */
function compareAnswers(
  actual: string,
  qa: QAPair
): { match: boolean; numberMatch: boolean; citationPresent: boolean } {
  // Normalize: remove special chars, extra spaces, handle unicode dashes
  const normalizedActual = actual
    .toLowerCase()
    .replace(/[–—−]/g, "-") // Unicode dashes to hyphen
    .replace(/\s+/g, " ")
    .trim();

  // Check for citation presence
  const citationPresent = /\[\d+\]/.test(actual);

  // Check for refusal patterns
  const refusalPatterns = [
    "could not find",
    "not in the",
    "not covered",
    "not specified",
    "no information",
    "unable to",
    "cannot find",
    "is not in",
    "does not contain",
    "not available",
  ];
  const isRefusal = refusalPatterns.some((p) => normalizedActual.includes(p));

  if (qa.expect_refusal) {
    // For trap questions, refusal is the correct answer
    return { match: isRefusal, numberMatch: true, citationPresent: false };
  }

  // Check numerical value match if specified
  let numberMatch = true;
  if (qa.verification) {
    const expectedNum = qa.verification.numerical_value;
    const numbers = actual.match(/[\d,]+\.?\d*/g) || [];
    const parsedNumbers = numbers.map((n) => parseFloat(n.replace(/,/g, "")));
    numberMatch = parsedNumbers.some((n) => Math.abs(n - expectedNum) < 0.01);
  }

  // Use expected_values array if available (more flexible)
  if (qa.expected_values && qa.expected_values.length > 0) {
    const anyValueMatch = qa.expected_values.some((expectedValue) => {
      // Normalize expected value same way
      const normalizedExpected = expectedValue
        .toLowerCase()
        .replace(/[–—−]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
      // Check direct inclusion
      if (normalizedActual.includes(normalizedExpected)) {
        return true;
      }
      // Check for number matching (e.g., "65 ksi" matches "65ksi" or "65 ksi")
      const numMatch = expectedValue.match(/^([\d.]+)\s*(.*)$/);
      if (numMatch) {
        const [, num, unit] = numMatch;
        const pattern = new RegExp(`${num}\\s*${unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
        if (pattern.test(actual)) {
          return true;
        }
      }
      // Check if the number appears anywhere in the response
      const numbersInExpected = expectedValue.match(/[\d.]+/g) || [];
      if (numbersInExpected.length > 0) {
        const allNumbersFound = numbersInExpected.every(n => normalizedActual.includes(n));
        if (allNumbersFound) return true;
      }
      return false;
    });
    return { match: anyValueMatch, numberMatch, citationPresent };
  }

  // Fall back to expected_answer if no expected_values
  const expected = qa.expected_answer || "";
  const normalizedExpected = expected.toLowerCase().trim();

  // Extract key terms (numbers, technical codes, units)
  const keyTerms = expected.match(/\d+(?:\.\d+)?|[A-Z]\d{5}|\w+%|ksi|MPa|HRC|HBW/gi) || [];
  const matchedTerms = keyTerms.filter((term) =>
    normalizedActual.includes(term.toLowerCase())
  );
  const termMatch = keyTerms.length > 0 ? matchedTerms.length >= keyTerms.length * 0.5 : false;

  return {
    match: termMatch || (normalizedExpected.length > 0 && normalizedActual.includes(normalizedExpected.substring(0, 50))),
    numberMatch,
    citationPresent,
  };
}

/**
 * Evaluate a single Q&A pair
 */
async function evaluateQA(qa: QAPair, verbose: boolean): Promise<EvaluationResult> {
  if (verbose) {
    console.log(`\n  Testing: ${qa.id} - ${qa.question.substring(0, 50)}...`);
  }

  const response = await queryAPI(qa.question);
  const comparison = compareAnswers(response.response, qa);

  let status: EvaluationResult["status"];

  if (qa.expect_refusal) {
    // Trap question - should refuse
    if (comparison.match) {
      status = "refused_correctly";
    } else {
      status = "missed_refusal"; // Hallucinated an answer when should have refused
    }
  } else {
    // Normal question - should answer
    if (comparison.match && comparison.numberMatch) {
      status = "correct";
    } else if (!comparison.citationPresent && response.sources.length === 0) {
      status = "hallucinated"; // Answered without sources
    } else {
      status = "incorrect";
    }
  }

  // Get expected string for display
  const expectedDisplay = qa.expected_values
    ? qa.expected_values.slice(0, 3).join(" | ")
    : qa.expected_answer || "";

  if (verbose) {
    const emoji = {
      correct: "✅",
      incorrect: "❌",
      refused_correctly: "🚫✓",
      hallucinated: "⚠️",
      missed_refusal: "🚫❌",
    };
    console.log(`    ${emoji[status]} ${status}`);
    if (status !== "correct" && status !== "refused_correctly") {
      console.log(`    Expected: ${expectedDisplay.substring(0, 60)}...`);
      console.log(`    Actual: ${response.response.substring(0, 60)}...`);
    }
  }

  return {
    id: qa.id,
    question: qa.question,
    expected: expectedDisplay,
    actual: response.response,
    status,
    confidence: response.confidence,
    match_details: comparison,
  };
}

/**
 * Evaluate a full golden dataset
 */
async function evaluateDataset(
  dataset: GoldenDataset,
  verbose: boolean
): Promise<EvaluationSummary> {
  console.log(`\n📊 Evaluating: ${dataset.document}`);
  console.log(`   ${dataset.description}`);
  console.log(`   Total questions: ${dataset.qa_pairs.length}`);

  const results: EvaluationResult[] = [];

  for (const qa of dataset.qa_pairs) {
    const result = await evaluateQA(qa, verbose);
    results.push(result);
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  // Calculate statistics
  const correct = results.filter((r) => r.status === "correct").length;
  const incorrect = results.filter((r) => r.status === "incorrect").length;
  const refusedCorrectly = results.filter((r) => r.status === "refused_correctly").length;
  const hallucinated = results.filter((r) => r.status === "hallucinated").length;
  const missedRefusal = results.filter((r) => r.status === "missed_refusal").length;

  const total = results.length;
  const trapQuestions = dataset.qa_pairs.filter((q) => q.expect_refusal).length;
  const _normalQuestions = total - trapQuestions; // Kept for potential future use

  // Calculate by difficulty
  const byDifficulty: Record<string, { total: number; correct: number; accuracy: number }> = {};
  for (const difficulty of ["easy", "medium", "hard", "trap"]) {
    const diffQAs = dataset.qa_pairs.filter((q) => q.difficulty === difficulty);
    const diffResults = results.filter((r) =>
      diffQAs.some((q) => q.id === r.id)
    );
    const diffCorrect = diffResults.filter(
      (r) => r.status === "correct" || r.status === "refused_correctly"
    ).length;
    byDifficulty[difficulty] = {
      total: diffQAs.length,
      correct: diffCorrect,
      accuracy: diffQAs.length > 0 ? (diffCorrect / diffQAs.length) * 100 : 0,
    };
  }

  // Calculate by tag
  const byTag: Record<string, { total: number; correct: number; accuracy: number }> = {};
  const allTags = new Set(dataset.qa_pairs.flatMap((q) => q.tags));
  for (const tag of allTags) {
    const tagQAs = dataset.qa_pairs.filter((q) => q.tags.includes(tag));
    const tagResults = results.filter((r) => tagQAs.some((q) => q.id === r.id));
    const tagCorrect = tagResults.filter(
      (r) => r.status === "correct" || r.status === "refused_correctly"
    ).length;
    byTag[tag] = {
      total: tagQAs.length,
      correct: tagCorrect,
      accuracy: tagQAs.length > 0 ? (tagCorrect / tagQAs.length) * 100 : 0,
    };
  }

  return {
    dataset: dataset.document,
    timestamp: new Date().toISOString(),
    results,
    stats: {
      total_questions: total,
      correct,
      incorrect,
      refused_correctly: refusedCorrectly,
      hallucinated,
      missed_refusal: missedRefusal,
      accuracy: ((correct + refusedCorrectly) / total) * 100,
      hallucination_rate: ((hallucinated + missedRefusal) / total) * 100,
      refusal_accuracy: trapQuestions > 0 ? (refusedCorrectly / trapQuestions) * 100 : 100,
    },
    by_difficulty: byDifficulty,
    by_tag: byTag,
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");
  const jsonOutput = args.includes("--json");
  const datasetArg = args.find((a, i) => args[i - 1] === "--dataset");

  // Find golden dataset files
  const datasetDir = path.join(__dirname, "..", "tests", "golden-dataset");

  let datasetFiles: string[];
  if (datasetArg) {
    datasetFiles = [`${datasetArg}.json`];
  } else {
    try {
      datasetFiles = fs.readdirSync(datasetDir).filter((f) => f.endsWith(".json"));
    } catch {
      console.error("❌ No golden dataset directory found at:", datasetDir);
      console.log("\nTo create golden datasets, add JSON files to: tests/golden-dataset/");
      process.exit(1);
    }
  }

  if (datasetFiles.length === 0) {
    console.error("❌ No dataset files found");
    process.exit(1);
  }

  console.log("🧪 SpecVault Accuracy Evaluation");
  console.log("====================================");
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Datasets: ${datasetFiles.join(", ")}`);

  const allSummaries: EvaluationSummary[] = [];

  for (const file of datasetFiles) {
    const filePath = path.join(datasetDir, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const dataset = JSON.parse(content) as GoldenDataset;
      const summary = await evaluateDataset(dataset, verbose);
      allSummaries.push(summary);
    } catch (error) {
      console.error(`❌ Error loading ${file}:`, error);
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📈 EVALUATION SUMMARY");
  console.log("=".repeat(60));

  for (const summary of allSummaries) {
    console.log(`\n📄 ${summary.dataset}`);
    console.log(`   Accuracy:          ${summary.stats.accuracy.toFixed(1)}%`);
    console.log(`   Hallucination:     ${summary.stats.hallucination_rate.toFixed(1)}%`);
    console.log(`   Refusal Accuracy:  ${summary.stats.refusal_accuracy.toFixed(1)}%`);
    console.log(`   Correct:           ${summary.stats.correct}/${summary.stats.total_questions}`);
    console.log(`   Refused Correctly: ${summary.stats.refused_correctly}`);
    console.log(`   Hallucinated:      ${summary.stats.hallucinated}`);

    console.log(`\n   By Difficulty:`);
    for (const [diff, stats] of Object.entries(summary.by_difficulty)) {
      if (stats.total > 0) {
        console.log(`     ${diff.padEnd(8)}: ${stats.accuracy.toFixed(0)}% (${stats.correct}/${stats.total})`);
      }
    }
  }

  // Overall metrics
  const totalQuestions = allSummaries.reduce((s, r) => s + r.stats.total_questions, 0);
  const totalCorrect = allSummaries.reduce(
    (s, r) => s + r.stats.correct + r.stats.refused_correctly,
    0
  );
  const totalHallucinated = allSummaries.reduce(
    (s, r) => s + r.stats.hallucinated + r.stats.missed_refusal,
    0
  );

  console.log("\n" + "=".repeat(60));
  console.log("📊 OVERALL METRICS");
  console.log("=".repeat(60));
  console.log(`Total Questions:    ${totalQuestions}`);
  console.log(`Overall Accuracy:   ${((totalCorrect / totalQuestions) * 100).toFixed(1)}%`);
  console.log(`Hallucination Rate: ${((totalHallucinated / totalQuestions) * 100).toFixed(1)}%`);

  // Thresholds check
  const accuracy = (totalCorrect / totalQuestions) * 100;
  const hallRate = (totalHallucinated / totalQuestions) * 100;

  console.log("\n📋 THRESHOLD CHECK");
  if (accuracy >= 90) {
    console.log("✅ Accuracy >= 90%");
  } else {
    console.log(`❌ Accuracy ${accuracy.toFixed(1)}% < 90% threshold`);
  }

  if (hallRate <= 5) {
    console.log("✅ Hallucination <= 5%");
  } else {
    console.log(`❌ Hallucination ${hallRate.toFixed(1)}% > 5% threshold`);
  }

  // JSON output
  if (jsonOutput) {
    const outputPath = path.join(datasetDir, "..", "evaluation-results.json");
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          summaries: allSummaries,
          overall: {
            accuracy: (totalCorrect / totalQuestions) * 100,
            hallucination_rate: (totalHallucinated / totalQuestions) * 100,
          },
        },
        null,
        2
      )
    );
    console.log(`\n📁 Results saved to: ${outputPath}`);
  }

  // Exit with error if thresholds not met
  if (accuracy < 90 || hallRate > 5) {
    process.exit(1);
  }
}

main().catch(console.error);
