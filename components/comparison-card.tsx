"use client";

import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  FileText,
  Shield,
  Clock,
  AlertTriangle,
  Search,
  Scale
} from "lucide-react";

interface ComparisonCardProps {
  sourcesCount: number;
  isVisible: boolean;
}

interface ComparisonItem {
  icon: React.ComponentType<{ className?: string }>;
  steelAgent: string;
  genericLLM: string;
}

const COMPARISON_ITEMS: ComparisonItem[] = [
  {
    icon: FileText,
    steelAgent: "Every answer traceable to page & document",
    genericLLM: "No source citations",
  },
  {
    icon: Shield,
    steelAgent: "Audit-ready for ISO/API/ASTM compliance",
    genericLLM: "Not acceptable for audits",
  },
  {
    icon: AlertTriangle,
    steelAgent: "Quotes exact values from your specs",
    genericLLM: "May hallucinate numbers",
  },
  {
    icon: Clock,
    steelAgent: "Current as your latest upload",
    genericLLM: "Training cutoff: months old",
  },
  {
    icon: Search,
    steelAgent: "Searches YOUR documents only",
    genericLLM: "Generic internet knowledge",
  },
  {
    icon: Scale,
    steelAgent: "Liability-safe with traceable sources",
    genericLLM: "No accountability for errors",
  },
];

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 }
  },
};

const columnHeaderVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3 }
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3 }
  },
};

const checkVariants = {
  hidden: { scale: 0, rotate: -180 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring" as const,
      stiffness: 500,
      damping: 25
    }
  },
};

const xVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 20
    }
  },
};

const pulseVariants = {
  visible: {
    boxShadow: [
      "0 0 0 0 rgba(34, 197, 94, 0)",
      "0 0 0 4px rgba(34, 197, 94, 0.2)",
      "0 0 0 0 rgba(34, 197, 94, 0)",
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      repeatDelay: 1,
    },
  },
};

export function ComparisonCard({ sourcesCount, isVisible }: ComparisonCardProps) {
  if (!isVisible) return null;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mt-6 rounded-lg border border-border bg-gradient-to-br from-muted/30 to-muted/10 p-6 overflow-hidden"
    >
      {/* Header with animated badge */}
      <motion.div variants={headerVariants} className="mb-5">
        <div className="flex items-center gap-3">
          <motion.div
            variants={pulseVariants}
            animate="visible"
            className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30"
          >
            <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">
              RAG Advantage
            </span>
          </motion.div>
          <h3 className="text-sm font-semibold text-foreground">
            Why Steel Agents?
          </h3>
        </div>
        {sourcesCount > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xs text-muted-foreground mt-2"
          >
            Your answer is backed by{" "}
            <span className="font-semibold text-green-600">{sourcesCount} traceable source{sourcesCount !== 1 ? "s" : ""}</span>
          </motion.p>
        )}
      </motion.div>

      {/* Animated Comparison Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-2 bg-muted/50">
          <motion.div
            variants={columnHeaderVariants}
            className="px-4 py-3 border-r border-border"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  transition: { duration: 2, repeat: Infinity }
                }}
                className="w-2.5 h-2.5 rounded-full bg-green-500"
              />
              <span className="text-sm font-semibold text-foreground">Steel Agents</span>
            </div>
          </motion.div>
          <motion.div
            variants={columnHeaderVariants}
            className="px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50" />
              <span className="text-sm font-medium text-muted-foreground">Generic LLM</span>
            </div>
          </motion.div>
        </div>

        {/* Table Rows */}
        {COMPARISON_ITEMS.map((item, index) => (
          <motion.div
            key={index}
            variants={rowVariants}
            custom={index}
            className={`grid grid-cols-2 ${index !== COMPARISON_ITEMS.length - 1 ? "border-b border-border" : ""}`}
          >
            {/* Steel Agents Cell */}
            <motion.div
              className="px-4 py-3 border-r border-border bg-green-50/50 dark:bg-green-950/20"
              whileHover={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-start gap-2.5">
                <motion.div variants={checkVariants}>
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                </motion.div>
                <span className="text-sm text-foreground leading-tight">{item.steelAgent}</span>
              </div>
            </motion.div>

            {/* Generic LLM Cell */}
            <motion.div
              className="px-4 py-3 bg-red-50/30 dark:bg-red-950/10"
              whileHover={{ backgroundColor: "rgba(239, 68, 68, 0.05)" }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-start gap-2.5">
                <motion.div variants={xVariants}>
                  <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                </motion.div>
                <span className="text-sm text-muted-foreground leading-tight">{item.genericLLM}</span>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Bottom CTA with animation */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="mt-5 pt-4 border-t border-border"
      >
        <p className="text-xs text-center text-muted-foreground">
          <motion.span
            className="font-semibold text-foreground"
            animate={{
              color: ["hsl(var(--foreground))", "hsl(142.1 76.2% 36.3%)", "hsl(var(--foreground))"],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            Built for compliance.
          </motion.span>{" "}
          Every answer has an audit trail.
        </p>
      </motion.div>
    </motion.div>
  );
}
