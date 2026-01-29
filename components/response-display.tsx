"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Sparkles, Copy, Check, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Source } from "@/lib/api";
import { ComparisonCard } from "@/components/comparison-card";

interface ResponseDisplayProps {
  response: string | null;
  sources?: Source[];
  error: string | null;
  isLoading?: boolean;
}

// Typewriter effect hook
function useTypewriter(text: string, speed: number = 20) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) {
      setDisplayedText("");
      setIsComplete(false);
      return;
    }

    setDisplayedText("");
    setIsComplete(false);

    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayedText, isComplete };
}

// Skeleton loading component
function ResponseSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-muted animate-pulse" />
        <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
        <div className="h-4 w-4/6 rounded bg-muted animate-pulse" />
      </div>
      {/* Sources skeleton */}
      <div className="pt-4 mt-4 border-t border-border">
        <div className="h-4 w-20 rounded bg-muted animate-pulse mb-2" />
        <div className="space-y-2">
          <div className="h-3 w-48 rounded bg-muted animate-pulse" />
          <div className="h-3 w-40 rounded bg-muted animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

// Source citation component with clickable PDF links
function SourceCitation({ source, index }: { source: Source; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group"
    >
      <div className="flex items-start gap-2 hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors">
        <span className="font-mono text-sm font-semibold text-yellow shrink-0">
          {source.ref}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {source.document_url ? (
              <a
                href={source.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-green-600 hover:text-green-700 hover:underline truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {source.document}
              </a>
            ) : (
              <span className="text-sm font-medium truncate">
                {source.document}
              </span>
            )}
            <span className="text-xs text-muted-foreground shrink-0">
              p. {source.page}
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-auto p-1 -m-1 hover:bg-muted rounded"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable content preview */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-8 mt-2 p-3 bg-muted/30 rounded-md border border-border/50">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {source.content_preview}
              </p>
              {source.document_url && (
                <a
                  href={source.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 hover:text-green-700 hover:underline"
                >
                  Open PDF at page {source.page} →
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ResponseDisplay({ response, sources, error, isLoading }: ResponseDisplayProps) {
  const { displayedText, isComplete } = useTypewriter(response || "", 15);
  const [copied, setCopied] = useState(false);

  // Track the response ID to reset showComparison when response changes
  const [currentResponseId, setCurrentResponseId] = useState(response);
  const [showComparison, setShowComparison] = useState(false);

  // Detect when response changes and reset comparison state
  if (currentResponseId !== response) {
    setCurrentResponseId(response);
    setShowComparison(false);
  }

  // Show comparison card after typewriter completes
  useEffect(() => {
    // If typewriter is not complete or no response, don't show comparison
    if (!isComplete || !response) {
      return;
    }

    // Show comparison card after delay once typewriter completes
    const timer = setTimeout(() => {
      setShowComparison(true);
    }, 800);

    // Cleanup: clear the timer to prevent memory leaks
    return () => {
      clearTimeout(timer);
    };
  }, [isComplete, response]);

  const handleCopy = async () => {
    if (response) {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {/* Loading State */}
      {isLoading && (
        <motion.div
          key="loading"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="rounded-lg border border-border bg-card p-6"
        >
          <ResponseSkeleton />
        </motion.div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-6"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-destructive">Error</p>
              <p className="text-sm text-destructive/90">{error}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Success Response */}
      {response && !isLoading && !error && (
        <motion.div
          key="response"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="rounded-lg border border-border bg-card p-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <Sparkles className="h-5 w-5 text-yellow" />
              </motion.div>
              <span className="text-sm font-medium text-muted-foreground">
                AI Response
              </span>
              {isComplete && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1"
                >
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </motion.div>
              )}
            </div>

            {/* Copy Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1 text-green-500" />
                  <span className="text-xs">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  <span className="text-xs">Copy</span>
                </>
              )}
            </Button>
          </div>

          {/* Response Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">
              {displayedText}
              {!isComplete && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block w-0.5 h-4 bg-yellow ml-0.5 align-middle"
                />
              )}
            </p>
          </div>

          {/* Sources Section */}
          {sources && sources.length > 0 && isComplete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 pt-4 border-t border-border"
            >
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Sources ({sources.length})
                </span>
              </div>
              <div className="space-y-1">
                {sources.map((source, index) => (
                  <SourceCitation key={source.ref} source={source} index={index} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Verification Notice */}
          {isComplete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 pt-4 border-t border-border"
            >
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                AI-generated response. Always verify against original source documents before use.
              </p>
            </motion.div>
          )}

          {/* Comparison Card - shows value vs generic LLMs */}
          <ComparisonCard
            sourcesCount={sources?.length || 0}
            isVisible={showComparison}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
