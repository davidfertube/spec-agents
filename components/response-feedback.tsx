"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, AlertCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Source, ConfidenceScore } from "@/lib/api";

const ISSUE_TYPES = [
  { value: "false_refusal", label: "False Refusal", desc: "Model refused but answer was in the docs" },
  { value: "wrong_data", label: "Wrong Data", desc: "Incorrect numbers or facts" },
  { value: "missing_info", label: "Missing Info", desc: "Answer was incomplete" },
  { value: "wrong_source", label: "Wrong Source", desc: "Cited wrong document or page" },
  { value: "hallucination", label: "Hallucination", desc: "Made up information" },
  { value: "other", label: "Other", desc: "Other issue" },
] as const;

interface ResponseFeedbackProps {
  query: string;
  response: string;
  sources: Source[];
  confidence?: ConfidenceScore | null;
}

export function ResponseFeedback({ query, response, sources, confidence }: ResponseFeedbackProps) {
  const [rating, setRating] = useState<"correct" | "incorrect" | "partial" | null>(null);
  const [issueType, setIssueType] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleRating = (newRating: "correct" | "incorrect" | "partial") => {
    setRating(newRating);
    if (newRating === "correct") {
      // Submit immediately for positive feedback
      submitFeedback(newRating, null, "");
    } else {
      setExpanded(true);
    }
  };

  const submitFeedback = async (
    feedbackRating: string,
    feedbackIssueType: string | null,
    feedbackComment: string
  ) => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          response,
          sources,
          confidence,
          rating: feedbackRating,
          issue_type: feedbackIssueType,
          comment: feedbackComment || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!rating) return;
    submitFeedback(rating, issueType, comment);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 py-2"
      >
        <span className="text-xs text-green-600 font-medium">
          Feedback recorded — thank you!
        </span>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Rating buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Was this helpful?</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRating("correct")}
            className={`h-7 px-2 ${
              rating === "correct"
                ? "text-green-600 bg-green-50 dark:bg-green-950/30"
                : "text-muted-foreground hover:text-green-600"
            }`}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRating("partial")}
            className={`h-7 px-2 ${
              rating === "partial"
                ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30"
                : "text-muted-foreground hover:text-amber-600"
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRating("incorrect")}
            className={`h-7 px-2 ${
              rating === "incorrect"
                ? "text-red-600 bg-red-50 dark:bg-red-950/30"
                : "text-muted-foreground hover:text-red-600"
            }`}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded issue details */}
      <AnimatePresence>
        {expanded && !submitted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            {/* Issue type selection */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">What went wrong?</span>
              <div className="flex flex-wrap gap-1.5">
                {ISSUE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setIssueType(issueType === type.value ? null : type.value)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      issueType === type.value
                        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300"
                        : "border-border bg-background text-muted-foreground hover:border-foreground/30"
                    }`}
                    title={type.desc}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Details <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g., The correct yield strength for S32205 per A790 is 65 ksi, not 70 ksi"
                className="w-full text-xs p-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground resize-none h-16 focus:outline-none focus:ring-1 focus:ring-green-500"
                maxLength={1000}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting}
                className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
              >
                {submitting ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="h-3 w-3 mr-1" />
                    Submit Feedback
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setExpanded(false); setRating(null); }}
                className="h-7 px-2 text-xs text-muted-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
