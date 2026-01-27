"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { checkHealth } from "@/lib/api";

interface HealthIndicatorProps {
  className?: string;
}

export function HealthIndicator({ className }: HealthIndicatorProps) {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    // Initial check
    checkHealth().then(setIsHealthy);

    // Poll every 30 seconds
    const interval = setInterval(() => {
      checkHealth().then(setIsHealthy);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (isHealthy === null) {
    // Loading state
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
        <span className="text-muted-foreground text-xs sm:text-sm">Checking backend...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <motion.div
        animate={isHealthy ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        className={`h-2 w-2 rounded-full ${
          isHealthy ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <span className="text-muted-foreground text-xs sm:text-sm">
        {isHealthy ? "Backend Connected" : "Demo Mode Active"}
      </span>
    </div>
  );
}
