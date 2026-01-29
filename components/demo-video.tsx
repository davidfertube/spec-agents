"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";

interface DemoVideoProps {
  className?: string;
}

export function DemoVideo({ className }: DemoVideoProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className={className}
    >
      {/* Video Container */}
      <div className="relative w-full max-w-4xl mx-auto">
        {/* Aspect Ratio Container (16:9) */}
        <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden border border-border bg-card shadow-lg">
          {/* Placeholder Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-card to-muted">
            {/* Animated Grid Background */}
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            {/* Play Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsPlaying(!isPlaying)}
              className="relative z-10 flex items-center justify-center w-20 h-20 rounded-full bg-yellow text-yellow-foreground shadow-lg glow-yellow transition-transform"
            >
              {isPlaying ? (
                <Pause className="h-8 w-8" />
              ) : (
                <Play className="h-8 w-8 ml-1" />
              )}
            </motion.button>

            {/* Demo Text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="relative z-10 mt-6 text-center"
            >
              <p className="text-lg font-medium text-foreground">Demo Coming Soon</p>
              <p className="text-sm text-muted-foreground mt-1">
                Watch how SteelIntel transforms your document workflow
              </p>
            </motion.div>

            {/* Decorative Elements */}
            <div className="absolute top-4 right-4 badge-yellow">
              Preview
            </div>

            {/* Animated Pulse Ring */}
            {!isPlaying && (
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute w-24 h-24 rounded-full border-2 border-yellow"
                style={{ top: "calc(50% - 48px)", left: "calc(50% - 48px)" }}
              />
            )}
          </div>

          {/* Video Timeline Placeholder */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: isPlaying ? "100%" : "0%" }}
              transition={{ duration: 30, ease: "linear" }}
              className="h-full bg-yellow"
            />
          </div>
        </div>

        {/* Video Caption */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-sm text-muted-foreground mt-4"
        >
          Experience intelligent document querying powered by RAG and Groq LLM
        </motion.p>
      </div>
    </motion.div>
  );
}
