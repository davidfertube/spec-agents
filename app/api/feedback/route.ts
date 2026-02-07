import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const MAX_QUERY_LENGTH = 2000;
const MAX_RESPONSE_LENGTH = 10000;
const MAX_COMMENT_LENGTH = 1000;
const MAX_NAME_LENGTH = 100;

const VALID_RATINGS = ["correct", "incorrect", "partial"] as const;
const VALID_ISSUE_TYPES = [
  "false_refusal",
  "wrong_data",
  "missing_info",
  "wrong_source",
  "hallucination",
  "other",
] as const;

/**
 * POST /api/feedback — Submit feedback on a RAG response
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, response, sources, confidence, rating, issue_type, comment, flagged_by } = body;

    // Validate required fields
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }
    if (!response || typeof response !== "string") {
      return NextResponse.json({ error: "response is required" }, { status: 400 });
    }
    if (!rating || !VALID_RATINGS.includes(rating)) {
      return NextResponse.json(
        { error: `rating must be one of: ${VALID_RATINGS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate optional fields
    if (issue_type && !VALID_ISSUE_TYPES.includes(issue_type)) {
      return NextResponse.json(
        { error: `issue_type must be one of: ${VALID_ISSUE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Length limits
    const sanitizedQuery = query.slice(0, MAX_QUERY_LENGTH);
    const sanitizedResponse = response.slice(0, MAX_RESPONSE_LENGTH);
    const sanitizedComment = comment ? String(comment).slice(0, MAX_COMMENT_LENGTH) : null;
    const sanitizedName = flagged_by ? String(flagged_by).slice(0, MAX_NAME_LENGTH) : null;

    const { error } = await supabase.from("feedback").insert([
      {
        query: sanitizedQuery,
        response: sanitizedResponse,
        sources: sources || [],
        confidence: confidence || {},
        rating,
        issue_type: issue_type || null,
        comment: sanitizedComment,
        flagged_by: sanitizedName,
      },
    ]);

    if (error) {
      console.error("[Feedback] Insert error:", error);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Feedback] Error:", err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

/**
 * GET /api/feedback — Retrieve feedback entries (for diagnostic report)
 * Query params: limit (default 50), rating (filter), issue_type (filter)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const rating = searchParams.get("rating");
  const issueType = searchParams.get("issue_type");

  let query = supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (rating && VALID_RATINGS.includes(rating as typeof VALID_RATINGS[number])) {
    query = query.eq("rating", rating);
  }
  if (issueType && VALID_ISSUE_TYPES.includes(issueType as typeof VALID_ISSUE_TYPES[number])) {
    query = query.eq("issue_type", issueType);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[Feedback] Query error:", error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }

  return NextResponse.json({ feedback: data, count: data?.length || 0 });
}
