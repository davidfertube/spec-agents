"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryKnowledgeBase, queryWithComparison, ApiRequestError, Source, GenericLLMResponse, ConfidenceScore } from "@/lib/api";

interface SearchFormProps {
  onResult: (response: string, sources: Source[]) => void;
  onError: (error: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  onComparisonResult?: (
    steelAgent: { response: string; sources: Source[]; confidence?: ConfidenceScore },
    genericLLM: GenericLLMResponse
  ) => void;
  onQuerySubmit?: (query: string) => void;
  documentId?: number | null;
}


export function SearchForm({
  onResult,
  onError,
  onLoadingChange,
  onComparisonResult,
  onQuerySubmit,
  documentId,
}: SearchFormProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim() || isLoading) return;

      setIsLoading(true);
      onLoadingChange?.(true);
      onQuerySubmit?.(query);

      try {
        if (onComparisonResult) {
          // Always run comparison mode
          const result = await queryWithComparison(query, documentId ?? undefined);
          onComparisonResult(
            { response: result.steelAgent.response, sources: result.steelAgent.sources || [], confidence: result.steelAgent.confidence },
            result.genericLLM
          );
        } else {
          // Fallback to single query if no comparison handler
          const result = await queryKnowledgeBase(query, documentId ?? undefined);
          onResult(result.response, result.sources || []);
        }
      } catch (error) {
        if (error instanceof ApiRequestError) {
          onError(error.message);
        } else {
          onError("An unexpected error occurred. Please try again.");
        }
      } finally {
        setIsLoading(false);
        onLoadingChange?.(false);
      }
    },
    [query, isLoading, onResult, onError, onLoadingChange, onComparisonResult, onQuerySubmit, documentId]
  );


  return (
    <div className="w-full space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Search Input - Clean minimal style */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            className={`w-full py-3 px-4 text-base rounded-lg border-2 transition-all duration-300
              ${query
                ? 'bg-black/5 dark:bg-white/5 border-black dark:border-white text-black dark:text-white'
                : 'bg-transparent border-black/20 dark:border-white/20 text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40'
              }
              focus:outline-none focus:border-black dark:focus:border-white focus:bg-black/5 dark:focus:bg-white/5
              disabled:opacity-50`}
            placeholder="Ask about steel specs, compliance, or material properties..."
          />
          <AnimatePresence>
            {query && !isLoading && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="btn-primary touch-target"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                Run Comparison
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>

    </div>
  );
}
