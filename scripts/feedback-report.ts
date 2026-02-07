/**
 * Feedback Diagnostic Report
 *
 * Reads user feedback from Supabase and produces an actionable report
 * showing error patterns, root causes, and specific queries to fix.
 *
 * Usage:
 *   npx tsx scripts/feedback-report.ts              # All feedback
 *   npx tsx scripts/feedback-report.ts --incorrect   # Only incorrect ratings
 *   npx tsx scripts/feedback-report.ts --limit 20    # Last 20 entries
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface FeedbackEntry {
  id: number;
  query: string;
  response: string;
  sources: { ref: string; document: string; page: string }[];
  confidence: { overall: number; retrieval: number; grounding: number; coherence: number };
  rating: string;
  issue_type: string | null;
  comment: string | null;
  flagged_by: string | null;
  created_at: string;
}

function classifyRootCause(entry: FeedbackEntry): string {
  const resp = entry.response || "";
  const issueType = entry.issue_type;

  // False refusal — model refused when answer was available
  if (issueType === "false_refusal" || /I cannot (provide|answer|find)/i.test(resp)) {
    return "FALSE_REFUSAL — Model refused despite available data. Check anti-refusal logic in route.ts";
  }

  // Wrong source — retrieval returned wrong document
  if (issueType === "wrong_source") {
    const docs = entry.sources?.map(s => s.document).join(", ") || "none";
    return `WRONG_SOURCE — Retrieved: [${docs}]. Check document-mapper.ts and hybrid-search weights`;
  }

  // Hallucination — made up data
  if (issueType === "hallucination") {
    return "HALLUCINATION — Model generated data not in source chunks. Check grounding in answer-grounding.ts";
  }

  // Wrong data — incorrect numbers
  if (issueType === "wrong_data") {
    const grounding = entry.confidence?.grounding || 0;
    if (grounding > 80) {
      return `WRONG_DATA — Grounding score was ${grounding}% (high) but data wrong. May be citing wrong chunk — check reranker.ts`;
    }
    return `WRONG_DATA — Grounding score ${grounding}%. Check if correct table chunks are being retrieved`;
  }

  // Missing info
  if (issueType === "missing_info") {
    const retrieval = entry.confidence?.retrieval || 0;
    if (retrieval < 50) {
      return `MISSING_INFO — Low retrieval score (${retrieval}%). Need more chunks or better search. Check dynamic topK in route.ts`;
    }
    return `MISSING_INFO — Retrieval was OK (${retrieval}%) but response incomplete. Check LLM generation prompt`;
  }

  // General analysis based on confidence
  if (entry.confidence?.overall < 40) {
    return `LOW_CONFIDENCE (${entry.confidence.overall}%) — Pipeline couldn't find good enough data. May be a document gap`;
  }

  return "UNKNOWN — Review query and response manually";
}

async function main() {
  const args = process.argv.slice(2);
  const onlyIncorrect = args.includes("--incorrect");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) || 50 : 50;

  // Fetch feedback
  let query = supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (onlyIncorrect) {
    query = query.in("rating", ["incorrect", "partial"]);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching feedback:", error);
    process.exit(1);
  }

  const entries = (data || []) as FeedbackEntry[];

  if (entries.length === 0) {
    console.log("No feedback entries found.");
    console.log("Users can submit feedback via the thumbs up/down widget on each response.");
    return;
  }

  // Summary stats
  const total = entries.length;
  const correct = entries.filter(e => e.rating === "correct").length;
  const incorrect = entries.filter(e => e.rating === "incorrect").length;
  const partial = entries.filter(e => e.rating === "partial").length;

  console.log("=".repeat(70));
  console.log("  SPECVAULT FEEDBACK DIAGNOSTIC REPORT");
  console.log("=".repeat(70));
  console.log();
  console.log(`  Total Feedback:   ${total}`);
  console.log(`  Correct:          ${correct} (${((correct / total) * 100).toFixed(0)}%)`);
  console.log(`  Partial:          ${partial} (${((partial / total) * 100).toFixed(0)}%)`);
  console.log(`  Incorrect:        ${incorrect} (${((incorrect / total) * 100).toFixed(0)}%)`);
  console.log();

  // Issue type breakdown
  const issueTypes = new Map<string, number>();
  for (const e of entries.filter(e => e.issue_type)) {
    issueTypes.set(e.issue_type!, (issueTypes.get(e.issue_type!) || 0) + 1);
  }

  if (issueTypes.size > 0) {
    console.log("  ISSUE TYPE BREAKDOWN:");
    console.log("  " + "-".repeat(50));
    for (const [type, count] of [...issueTypes.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${type.padEnd(20)} ${count}`);
    }
    console.log();
  }

  // Detailed analysis of failures
  const failures = entries.filter(e => e.rating !== "correct");
  if (failures.length > 0) {
    console.log("  FAILURE ANALYSIS (most recent first):");
    console.log("  " + "=".repeat(66));

    for (let i = 0; i < failures.length; i++) {
      const entry = failures[i];
      const rootCause = classifyRootCause(entry);
      const date = new Date(entry.created_at).toLocaleString();

      console.log();
      console.log(`  [${i + 1}] ${entry.rating.toUpperCase()} — ${date}`);
      if (entry.flagged_by) console.log(`      Flagged by: ${entry.flagged_by}`);
      console.log(`      Query:      "${entry.query.slice(0, 100)}${entry.query.length > 100 ? "..." : ""}"`);
      console.log(`      Response:   "${entry.response.slice(0, 150)}${entry.response.length > 150 ? "..." : ""}"`);
      console.log(`      Sources:    ${entry.sources?.map(s => `${s.ref} ${s.document} p.${s.page}`).join(" | ") || "none"}`);
      console.log(`      Confidence: overall=${entry.confidence?.overall}% ret=${entry.confidence?.retrieval}% gnd=${entry.confidence?.grounding}% coh=${entry.confidence?.coherence}%`);
      if (entry.issue_type) console.log(`      Issue Type: ${entry.issue_type}`);
      if (entry.comment) console.log(`      Comment:    "${entry.comment}"`);
      console.log(`      ROOT CAUSE: ${rootCause}`);
      console.log("  " + "-".repeat(66));
    }
  }

  // Actionable recommendations
  console.log();
  console.log("  RECOMMENDED ACTIONS:");
  console.log("  " + "=".repeat(66));

  const falseRefusals = failures.filter(e => e.issue_type === "false_refusal" || /I cannot/i.test(e.response));
  if (falseRefusals.length > 0) {
    console.log(`  [!] ${falseRefusals.length} false refusals — tighten anti-refusal detection in route.ts`);
    console.log(`      Queries: ${falseRefusals.map(e => `"${e.query.slice(0, 60)}"`).join(", ")}`);
  }

  const wrongSources = failures.filter(e => e.issue_type === "wrong_source");
  if (wrongSources.length > 0) {
    console.log(`  [!] ${wrongSources.length} wrong source citations — review reranker.ts scoring`);
  }

  const hallucinations = failures.filter(e => e.issue_type === "hallucination");
  if (hallucinations.length > 0) {
    console.log(`  [!] ${hallucinations.length} hallucinations — strengthen grounding checks in answer-grounding.ts`);
  }

  const lowRetrieval = failures.filter(e => (e.confidence?.retrieval || 0) < 40);
  if (lowRetrieval.length > 0) {
    console.log(`  [!] ${lowRetrieval.length} entries with retrieval < 40% — check if documents are indexed properly`);
  }

  console.log();
  console.log("  Run specific queries through the test suite to verify fixes:");
  console.log("    npx tsx scripts/mvp-accuracy-test.ts");
  console.log();
}

main().catch(console.error);
