"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  Sparkles,
  Bot,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Source } from "@/lib/api";

interface RealtimeComparisonProps {
  steelAgentResponse: string | null;
  steelAgentSources: Source[];
  genericLLMResponse: string | null;
  isLoading: boolean;
  error: string | null;
  onOpenPdf?: (source: Source) => void;
}

// Typewriter effect hook
function useTypewriter(text: string, speed: number = 15) {
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

// Source citation component with clickable PDF links
function SourceCitation({
  source,
  index,
  onOpenPdf
}: {
  source: Source;
  index: number;
  onOpenPdf?: (source: Source) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasUrl = !!source.document_url;

  const handleOpenPdf = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onOpenPdf && hasUrl) {
      onOpenPdf(source);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group"
    >
      {/* Main citation row - clickable if URL exists */}
      <motion.div
        className={`flex items-start gap-2 rounded-lg p-2 -m-1 transition-all duration-200 ${
          hasUrl
            ? "cursor-pointer hover:bg-green-100 hover:shadow-sm border border-transparent hover:border-green-200"
            : "hover:bg-green-50"
        }`}
        onClick={hasUrl ? handleOpenPdf : undefined}
        whileHover={hasUrl ? { scale: 1.01 } : {}}
        whileTap={hasUrl ? { scale: 0.99 } : {}}
      >
        {/* Citation number badge */}
        <motion.span
          className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
            hasUrl
              ? "bg-green-500 text-white"
              : "bg-green-100 text-green-700"
          }`}
          whileHover={hasUrl ? { scale: 1.1 } : {}}
        >
          {source.ref}
        </motion.span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <FileText className={`h-3.5 w-3.5 shrink-0 ${hasUrl ? "text-green-600" : "text-muted-foreground"}`} />
            <span className={`text-xs font-medium truncate ${hasUrl ? "text-green-700" : "text-foreground"}`}>
              {source.document}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
              Page {source.page}
            </span>

            {/* View PDF button - only show if URL exists */}
            {hasUrl && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200 group-hover:bg-green-500 group-hover:text-white group-hover:border-green-500 transition-all duration-200"
              >
                <Eye className="h-3 w-3" />
                <span className="hidden sm:inline">View PDF</span>
              </motion.span>
            )}

            {/* Expand button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className={`p-1 hover:bg-green-200 rounded transition-colors ${hasUrl ? "" : "ml-auto"}`}
            >
              {expanded ? (
                <ChevronUp className="h-3 w-3 text-green-600" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-green-600 transition-colors" />
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Expanded content preview */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-8 mt-2 p-3 bg-green-50 rounded-lg text-xs text-muted-foreground leading-relaxed border border-green-100">
              <p className="italic">&quot;{source.content_preview}&quot;</p>
              {hasUrl && (
                <motion.button
                  onClick={handleOpenPdf}
                  className="mt-2 flex items-center gap-1.5 text-green-600 hover:text-green-700 font-medium"
                  whileHover={{ x: 2 }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in PDF viewer (page {source.page})
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Skeleton loader
function ResponseSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-3 w-full rounded bg-muted animate-pulse" />
      <div className="h-3 w-5/6 rounded bg-muted animate-pulse" />
      <div className="h-3 w-4/6 rounded bg-muted animate-pulse" />
    </div>
  );
}

export function RealtimeComparison({
  steelAgentResponse,
  steelAgentSources,
  genericLLMResponse,
  isLoading,
  error,
  onOpenPdf,
}: RealtimeComparisonProps) {
  const steelAgent = useTypewriter(steelAgentResponse || "", 12);
  const genericLLM = useTypewriter(genericLLMResponse || "", 12);
  const [copiedSteel, setCopiedSteel] = useState(false);
  const [copiedGeneric, setCopiedGeneric] = useState(false);

  const handleCopy = async (text: string, setter: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-destructive/50 bg-destructive/10 p-6"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-destructive">Error</p>
            <p className="text-sm text-destructive/90">{error}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!isLoading && !steelAgentResponse && !genericLLMResponse) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <div className="px-3 py-1 rounded-full bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30">
            <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">
              Live Comparison
            </span>
          </div>
        </motion.div>
      </div>

      {/* Side-by-side Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SpecVault Column */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-lg border-2 border-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-green-500/10 border-b border-green-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-4 w-4 text-green-600" />
              </motion.div>
              <span className="text-sm font-semibold text-green-700">SpecVault</span>
              <motion.span
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium"
              >
                RAG
              </motion.span>
            </div>
            {steelAgentResponse && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(steelAgentResponse, setCopiedSteel)}
                className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-100"
              >
                {copiedSteel ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="p-4 min-h-[200px]">
            {isLoading && !steelAgentResponse ? (
              <ResponseSkeleton />
            ) : (
              <>
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {steelAgent.displayedText}
                  {!steelAgent.isComplete && steelAgentResponse && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="inline-block w-0.5 h-4 bg-green-500 ml-0.5 align-middle"
                    />
                  )}
                </div>

                {/* Sources - with attention-grabbing animation */}
                {steelAgent.isComplete && steelAgentSources.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    className="mt-4 pt-4 border-t-2 border-green-300 bg-gradient-to-b from-green-50/50 to-transparent rounded-lg p-3 -mx-1"
                  >
                    {/* Header with pulse animation */}
                    <motion.div
                      className="flex items-center justify-between mb-3"
                      initial={{ x: -10 }}
                      animate={{ x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <div className="flex items-center gap-2">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.5, delay: 0.5 }}
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </motion.div>
                        <span className="text-sm font-semibold text-green-700">
                          {steelAgentSources.length} Verified Source{steelAgentSources.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {/* Show clickable hint if any source has a URL */}
                      {steelAgentSources.some(s => s.document_url) && (
                        <motion.div
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 }}
                          className="flex items-center gap-1.5 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full"
                        >
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1.5, repeat: 3 }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </motion.div>
                          <span className="font-medium">Click to view PDF</span>
                        </motion.div>
                      )}
                    </motion.div>
                    <div className="space-y-2">
                      {steelAgentSources.map((source, index) => (
                        <SourceCitation key={source.ref} source={source} index={index} onOpenPdf={onOpenPdf} />
                      ))}
                    </div>

                    {/* AI-assisted disclaimer */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                      className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md"
                    >
                      <p className="text-xs text-amber-700 flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3" />
                        <span>AI-assisted — verify against source documents</span>
                      </p>
                    </motion.div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* Generic LLM Column */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-lg border-2 border-muted-foreground/30 bg-gradient-to-br from-muted/30 to-background overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Generic LLM</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted-foreground/20 text-muted-foreground font-medium">
                No RAG
              </span>
            </div>
            {genericLLMResponse && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(genericLLMResponse, setCopiedGeneric)}
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
              >
                {copiedGeneric ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="p-4 min-h-[200px]">
            {isLoading && !genericLLMResponse ? (
              <ResponseSkeleton />
            ) : (
              <>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {genericLLM.displayedText}
                  {!genericLLM.isComplete && genericLLMResponse && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="inline-block w-0.5 h-4 bg-muted-foreground ml-0.5 align-middle"
                    />
                  )}
                </div>

                {/* No Sources Warning */}
                {genericLLM.isComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-4 pt-3 border-t border-border"
                  >
                    <div className="flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5 text-red-400" />
                      <span className="text-xs text-red-400">
                        No citations • Cannot verify accuracy
                      </span>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Comparison Summary */}
      {steelAgent.isComplete && genericLLM.isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-transparent border border-green-200"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-green-100">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                SpecVault provides traceable, audit-ready answers
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {steelAgentSources.length > 0 ? (
                  <>
                    This response cites {steelAgentSources.length} source{steelAgentSources.length !== 1 ? "s" : ""} from your uploaded documents.
                    Every fact can be verified against the original specification.
                  </>
                ) : (
                  <>
                    Upload documents to get cited, verifiable answers.
                    Generic LLMs cannot provide audit trails for compliance.
                  </>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
