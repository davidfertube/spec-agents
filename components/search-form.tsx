"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryKnowledgeBase, ApiRequestError, Source } from "@/lib/api";

interface SearchFormProps {
  onResult: (response: string, sources: Source[]) => void;
  onError: (error: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}

// Example queries - generic enough to work with any steel spec document
const EXAMPLE_QUERIES = [
  "What is the minimum tensile strength?",
  "List the chemical composition requirements",
  "What are the hardness limits?",
  "Summarize the mechanical properties",
];

export function SearchForm({ onResult, onError, onLoadingChange }: SearchFormProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim() || isLoading) return;

      setIsLoading(true);
      onLoadingChange?.(true);

      try {
        const result = await queryKnowledgeBase(query);
        onResult(result.response, result.sources || []);
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
    [query, isLoading, onResult, onError, onLoadingChange]
  );

  const handleExampleClick = useCallback((exampleQuery: string) => {
    setIsAnimating(true);
    setQuery(exampleQuery);
    inputRef.current?.focus();
    setTimeout(() => setIsAnimating(false), 600);
  }, []);

  return (
    <div className="w-full space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Search Input - Clean minimal style */}
        <motion.div
          className="relative"
          animate={isAnimating ? { scale: [1, 1.01, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            className={`w-full py-3 px-4 text-base rounded-lg border-2 transition-all duration-300
              ${query
                ? 'bg-black/5 border-black text-black'
                : 'bg-transparent border-black/20 text-black placeholder:text-black/40'
              }
              focus:outline-none focus:border-black focus:bg-black/5
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
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-black/40 hover:text-black transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="btn-primary touch-target"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                Run Analysis
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Quick Prompts - Click to populate input */}
      <div className="space-y-3">
        <p className="label-section">Quick prompts - click to try</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((example, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              type="button"
              onClick={() => handleExampleClick(example)}
              disabled={isLoading}
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-all duration-200
                ${query === example
                  ? 'bg-black text-white border border-black'
                  : 'text-black/60 border border-black/20 hover:border-black hover:text-black'
                }
                disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {example}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
