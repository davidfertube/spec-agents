"use client";

import { useState, useCallback, FormEvent, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Menu, X, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SearchForm } from "@/components/search-form";
import { RealtimeComparison } from "@/components/realtime-comparison";
import { DocumentUpload } from "@/components/document-upload";

import { Source, GenericLLMResponse, ConfidenceScore } from "@/lib/api";
import { NetworkVisualization } from "@/components/network-visualization";

function Hero3DAnimation() {
  return (
    <div className="relative w-full aspect-square max-w-[500px] mx-auto">
      <div className="absolute inset-0 flex items-center justify-center">
        <DocumentFlowAnimation />
      </div>
    </div>
  );
}

// Fallback SVG animation - Documents flowing into central AI
function DocumentFlowAnimation() {
  const documents = [
    { id: 1, x: 50, y: 50, delay: 0 },
    { id: 2, x: 300, y: 50, delay: 0.3 },
    { id: 3, x: 25, y: 175, delay: 0.6 },
    { id: 4, x: 325, y: 175, delay: 0.9 },
    { id: 5, x: 50, y: 300, delay: 1.2 },
    { id: 6, x: 300, y: 300, delay: 1.5 },
  ];

  const centerX = 200;
  const centerY = 200;

  return (
    <svg viewBox="0 0 400 400" className="w-full h-full [&_.doc-rect]:fill-white dark:[&_.doc-rect]:fill-neutral-800 [&_.doc-stroke]:stroke-black dark:[&_.doc-stroke]:stroke-white [&_.doc-line]:stroke-black dark:[&_.doc-line]:stroke-white [&_.brain-fill]:fill-white dark:[&_.brain-fill]:fill-neutral-800">
      <defs>
        <radialGradient id="brainGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
          <stop offset="70%" stopColor="#22c55e" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Connection lines */}
      {documents.map((doc) => (
        <motion.line
          key={`line-${doc.id}`}
          x1={doc.x + 22}
          y1={doc.y + 27}
          x2={centerX}
          y2={centerY}
          stroke="#22c55e"
          strokeWidth="2"
          strokeDasharray="8 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: 1,
            opacity: 0.6,
            strokeDashoffset: [0, -12]
          }}
          transition={{
            pathLength: { duration: 0.8, delay: doc.delay + 0.3 },
            opacity: { duration: 0.3, delay: doc.delay + 0.3 },
            strokeDashoffset: { duration: 1.5, repeat: Infinity, ease: "linear" }
          }}
        />
      ))}

      {/* Particles */}
      {documents.map((doc) => (
        <motion.circle
          key={`particle-${doc.id}`}
          r="5"
          fill="#22c55e"
          filter="url(#glow)"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            cx: [doc.x + 22, centerX],
            cy: [doc.y + 27, centerY],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: doc.delay + 1,
            ease: "easeInOut",
            times: [0, 0.1, 0.9, 1]
          }}
        />
      ))}

      {/* Documents */}
      {documents.map((doc) => (
        <g key={`doc-${doc.id}`}>
          <motion.rect
            x={doc.x}
            y={doc.y}
            width="45"
            height="55"
            className="doc-rect doc-stroke"
            strokeWidth="2"
            rx="3"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: doc.delay }}
          />
          {[12, 22, 32, 42].map((yOffset, i) => (
            <motion.line
              key={i}
              x1={doc.x + 8}
              y1={doc.y + yOffset}
              x2={doc.x + (i === 2 ? 30 : 37)}
              y2={doc.y + yOffset}
              className="doc-line"
              strokeWidth="1"
              strokeOpacity="0.3"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, delay: doc.delay + 0.2 + i * 0.05 }}
            />
          ))}
        </g>
      ))}

      {/* Central Brain */}
      <motion.circle
        cx={centerX}
        cy={centerY}
        r="60"
        fill="url(#brainGlow)"
        initial={{ scale: 0 }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle
        cx={centerX}
        cy={centerY}
        r="45"
        className="brain-fill"
        stroke="#22c55e"
        strokeWidth="3"
        filter="url(#glow)"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.6, delay: 0.8, type: "spring" }}
      />
      <motion.circle
        cx={centerX}
        cy={centerY}
        r="35"
        fill="none"
        stroke="#22c55e"
        strokeWidth="1.5"
        strokeDasharray="6 3"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
      />

      {/* Neural nodes */}
      {[
        { x: centerX - 15, y: centerY - 12 },
        { x: centerX + 15, y: centerY - 12 },
        { x: centerX, y: centerY + 5 },
        { x: centerX - 10, y: centerY + 18 },
        { x: centerX + 10, y: centerY + 18 },
      ].map((node, i) => (
        <motion.circle
          key={`node-${i}`}
          cx={node.x}
          cy={node.y}
          r="5"
          fill="#22c55e"
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 1.5 + i * 0.2 }}
        />
      ))}

      {/* Neural connections */}
      <motion.path
        d={`M ${centerX - 15} ${centerY - 12} L ${centerX} ${centerY + 5} L ${centerX + 15} ${centerY - 12}`}
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeOpacity="0.6"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 1.5 }}
      />
      <motion.path
        d={`M ${centerX - 10} ${centerY + 18} L ${centerX} ${centerY + 5} L ${centerX + 10} ${centerY + 18}`}
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeOpacity="0.6"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 1.7 }}
      />
    </svg>
  );
}

// Lead Form Component
function LeadForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      company: formData.get('company') as string || undefined,
      phone: formData.get('phone') as string || undefined,
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!result.success) {
        setError(result.error || 'Failed to submit. Please try again.');
      } else {
        setIsSubmitted(true);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="border border-black/10 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-white/5 bg-white dark:bg-neutral-900">
        <CardContent className="p-6 sm:p-8 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-black dark:text-white mb-2">You&apos;re on the list!</h3>
          <p className="text-black/70 dark:text-white/70">We&apos;ll contact you when SpecVault is ready.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-black/10 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-white/5 bg-white dark:bg-neutral-900">
      <CardContent className="p-6 sm:p-8">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-medium text-black dark:text-white">
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                required
                disabled={isSubmitting}
                className="w-full h-11 px-4 border border-black/20 dark:border-white/20 bg-white dark:bg-neutral-800 text-black dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-black dark:focus:border-white transition-colors disabled:opacity-50"
                placeholder=""
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium text-black dark:text-white">
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                required
                disabled={isSubmitting}
                className="w-full h-11 px-4 border border-black/20 dark:border-white/20 bg-white dark:bg-neutral-800 text-black dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-black dark:focus:border-white transition-colors disabled:opacity-50"
                placeholder=""
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-black dark:text-white">
              Work Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              disabled={isSubmitting}
              className="w-full h-11 px-4 border border-black/20 dark:border-white/20 bg-white dark:bg-neutral-800 text-black dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-black dark:focus:border-white transition-colors disabled:opacity-50"
              placeholder=""
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="company" className="text-sm font-medium text-black dark:text-white">
              Company
            </label>
            <input
              type="text"
              id="company"
              name="company"
              disabled={isSubmitting}
              className="w-full h-11 px-4 border border-black/20 dark:border-white/20 bg-white dark:bg-neutral-800 text-black dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-black dark:focus:border-white transition-colors disabled:opacity-50"
              placeholder=""
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium text-black dark:text-white">
              Phone Number <span className="text-black/40 dark:text-white/40">(optional)</span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              disabled={isSubmitting}
              className="w-full h-11 px-4 border border-black/20 dark:border-white/20 bg-white dark:bg-neutral-800 text-black dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-black dark:focus:border-white transition-colors disabled:opacity-50"
              placeholder=""
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 h-12 text-base font-medium disabled:opacity-50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
          >
            {isSubmitting ? 'Submitting...' : 'Join Waitlist'}
            {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>

        <p className="text-xs text-black/50 dark:text-white/50 text-center mt-4">
          We&apos;ll contact you when SpecVault is ready. No spam, ever.
        </p>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [response, setResponse] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<number | null>(null);
  const hasDocumentUploaded = !!uploadedDocumentId;

  // Generic LLM response for comparison display
  const [genericLLMResponse, setGenericLLMResponse] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceScore | null>(null);

  // Refs for auto-scrolling
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);

  // Prevent hydration mismatch for theme toggle
  useEffect(() => { setMounted(true); }, []);

  // Auto-scroll to Step 2 when upload completes
  useEffect(() => {
    if (hasDocumentUploaded && step2Ref.current) {
      setTimeout(() => {
        step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [hasDocumentUploaded]);

  // Auto-scroll to Step 3 when loading starts (user clicked Run Analysis)
  useEffect(() => {
    if (isLoading && step3Ref.current) {
      setTimeout(() => {
        step3Ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  }, [isLoading]);

  const handleUploadComplete = useCallback((documentId: number | null) => {
    setUploadedDocumentId(documentId);
  }, []);

  const handleResult = useCallback((result: string, resultSources: Source[]) => {
    setError(null);
    setResponse(result);
    setSources(resultSources);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setResponse(null);
    setError(errorMessage);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsLoading(loading);
    if (loading) {
      setResponse(null);
      setSources([]);
      setError(null);
      setGenericLLMResponse(null);
      setConfidence(null);
    }
  }, []);

  const handleComparisonResult = useCallback(
    (steelAgent: { response: string; sources: Source[]; confidence?: ConfidenceScore }, genericLLM: GenericLLMResponse) => {
      // Debug: Log sources to see if document_url is present
      console.log("[Comparison Result] Sources received:", steelAgent.sources.map(s => ({
        ref: s.ref,
        document: s.document,
        hasUrl: !!s.document_url,
        url: s.document_url?.slice(0, 50) + "...",
      })));

      setError(null);
      setResponse(steelAgent.response);
      setSources(steelAgent.sources);
      setGenericLLMResponse(genericLLM.response);
      setConfidence(steelAgent.confidence ?? null);
    },
    []
  );

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-neutral-950 text-black dark:text-white overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-black/5 dark:border-white/10">
        <div className="container-center">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="text-lg font-semibold tracking-tight text-black dark:text-white">
              SpecVault
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-8">
              {["Why", "Demo", "Contact"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="relative text-sm text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors group"
                >
                  {item}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-500 transition-all duration-300 group-hover:w-full" />
                </a>
              ))}

              {/* Dark/Light Mode Toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4 text-white/60 hover:text-white transition-colors" />
                  ) : (
                    <Moon className="h-4 w-4 text-black/60 hover:text-black transition-colors" />
                  )}
                </button>
              )}
            </nav>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 touch-target rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 text-black dark:text-white" />
              ) : (
                <Menu className="h-5 w-5 text-black dark:text-white" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-white dark:bg-neutral-950 md:hidden"
          >
            <div className="flex flex-col items-center justify-center h-full gap-8">
              {["Why", "Demo", "Contact"].map((item, i) => (
                <motion.a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="text-3xl font-semibold text-black/80 dark:text-white/80 hover:text-black dark:hover:text-white transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item}
                </motion.a>
              ))}

              {/* Theme toggle in mobile menu */}
              {mounted && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex items-center gap-3 text-lg text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors mt-4"
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="h-5 w-5" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="h-5 w-5" />
                      Dark Mode
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-24 md:py-40 overflow-hidden">
          <div className="container-wide">
            <div className="flex flex-col lg:flex-row gap-12 lg:gap-8 items-center">
              {/* Center/Left: Text content */}
              <div className="flex-1 text-center space-y-8">
                <div className="space-y-6">
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-black dark:text-white"
                  >
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      SPECVAULT
                    </motion.span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="text-lg sm:text-xl text-black/60 dark:text-white/60 max-w-2xl mx-auto leading-relaxed px-4"
                  >
                    ASTM, NACE, and API specs, instantly searchable.
                    <br />
                    Built for materials engineers who need{" "}
                    <span className="relative inline-block text-black dark:text-white font-semibold">
                      audit-ready answers
                      <motion.span
                        className="absolute -bottom-1 left-0 right-0 h-[3px] bg-green-500"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.6, delay: 0.8 }}
                        style={{ transformOrigin: "left" }}
                      />
                    </span>
                    .
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  className="flex flex-wrap gap-3 sm:gap-4 justify-center px-4"
                >
                  <Button size="lg" className="bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg touch-target transition-all duration-300 hover:scale-105 hover:shadow-lg" asChild>
                    <a href="#demo">
                      Try Demo
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" className="border-black/20 dark:border-white/20 bg-white dark:bg-transparent text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 h-12 sm:h-14 px-5 sm:px-6 text-base sm:text-lg touch-target transition-all duration-300 hover:scale-105 hover:shadow-lg" asChild>
                    <a href="#contact">
                      Get Access
                    </a>
                  </Button>
                </motion.div>

                {/* Key Metrics */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.0 }}
                  className="grid grid-cols-2 gap-4 sm:gap-6 pt-4 max-w-md mx-auto px-4"
                >
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-black dark:text-white">4+ hrs</p>
                    <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">Saved per day</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-black dark:text-white">100%</p>
                    <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">Cited sources</p>
                  </div>
                </motion.div>
              </div>

              {/* Right: 3D Animation */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="hidden lg:block flex-shrink-0 w-[500px]"
              >
                <Hero3DAnimation />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Why SpecVault vs Generic LLMs Section */}
        <section id="why" className="relative min-h-screen flex items-center py-12 sm:py-16 md:py-20 border-t border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="container-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-16" // Increased spacing
            >
              {/* Section Header */}
              <div className="text-center space-y-6">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-black dark:text-white"
                >
                  Why SpecVault?
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-xl text-black/60 dark:text-white/60 max-w-3xl mx-auto leading-relaxed"
                >
                  Generic LLMs (ChatGPT, Claude, Gemini) hallucinate specs. <br className="hidden sm:block" />
                  SpecVault only answers from <span className="text-black dark:text-white font-semibold">your documents</span>.
                </motion.p>
              </div>

              {/* Comparison Grid */}
              <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto px-4">
                {/* SpecVault Card */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30 p-8 space-y-8 hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/20">
                      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">SpecVault</h3>
                      <p className="text-sm text-green-600/80 dark:text-green-400/80 font-medium mt-1">Trustworthy & Traceable</p>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    {[
                      "Every answer traceable to page & document",
                      "Audit-ready for ISO/API/ASTM compliance",
                      "Quotes exact values from YOUR specs",
                      "Current as your latest upload",
                      "Searches YOUR documents only",
                      "Liability-safe with traceable sources",
                    ].map((item, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 + i * 0.05 }}
                        className="flex items-start gap-3"
                      >
                        <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-green-700 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-base text-black/80 dark:text-white/80 font-medium">{item}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>

                {/* Generic LLM Card */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/30 p-8 space-y-8 hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-red-400 flex items-center justify-center shadow-lg shadow-red-400/20">
                      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">Generic LLM</h3>
                      <div className="mt-2 inline-block px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-semibold rounded-full">
                        ChatGPT / Claude / Gemini
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    {[
                      "No source citations",
                      "Not acceptable for audits",
                      "May hallucinate numbers",
                      "Training cutoff: months old",
                      "Generic internet knowledge",
                      "No accountability for errors",
                    ].map((item, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: 10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 + i * 0.05 }}
                        className="flex items-start gap-3"
                      >
                        <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <span className="text-base text-black/60 dark:text-white/60">{item}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Live Comparison Section */}
        <section className="relative py-12 sm:py-16 md:py-20 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="container-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="bg-white dark:bg-neutral-900 rounded-2xl border border-black/5 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-white/5 p-8 md:p-10 max-w-4xl mx-auto"
            >
              <div className="text-center mb-8">
                <span className="text-xs font-semibold tracking-wider text-black/40 dark:text-white/40 uppercase">Live Comparison</span>
                <h4 className="text-2xl font-bold text-black dark:text-white mt-2">
                  &quot;What is the yield strength of 316L stainless steel?&quot;
                </h4>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* SpecVault Response */}
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="font-bold text-green-700 dark:text-green-400">SpecVault</span>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-5 border border-green-100 dark:border-green-800 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-green-50 dark:bg-green-950/30 border-t border-l border-green-100 dark:border-green-800 rotate-45 transform"></div>
                    <p className="text-black/90 dark:text-white/90 text-lg">&quot;The minimum yield strength of 316L is <strong className="bg-green-200/50 dark:bg-green-800/50 px-1 rounded">170 MPa (25 ksi)</strong> [1]&quot;</p>
                    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-green-700 dark:text-green-400 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-green-100 dark:border-green-800">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Source: ASTM_A240.pdf, Page 3
                    </div>
                  </div>
                </div>

                {/* Generic LLM Response */}
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-red-400 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <span className="font-bold text-red-600 dark:text-red-400">Generic LLM</span>
                  </div>
                  <div className="bg-red-50/50 dark:bg-red-950/30 rounded-xl p-5 border border-red-100 dark:border-red-800 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-red-50/50 dark:bg-red-950/30 border-t border-l border-red-100 dark:border-red-800 rotate-45 transform"></div>
                    <p className="text-black/60 dark:text-white/60 italic">&quot;316L stainless steel typically has a yield strength around 170-290 MPa...&quot;</p>
                    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-red-500 dark:text-red-400 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-red-100 dark:border-red-800">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      No source • Cannot verify
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Demo Section - Combined Upload & Query */}
        <section id="demo" className="relative py-12 sm:py-16 md:py-20 border-t border-black/5 dark:border-white/10">
          <div className="container-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-12"
            >
              {/* Section Header */}
              <div className="text-center space-y-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  className="inline-flex items-center gap-2 px-3 py-1 border border-black/10 dark:border-white/10 rounded-full text-xs font-medium text-black/70 dark:text-white/70"
                >
                  <motion.span
                    className="w-2 h-2 bg-green-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  TRY IT NOW
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-black dark:text-white"
                >
                  Upload & Ask
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-lg text-black/70 dark:text-white/70 max-w-2xl mx-auto"
                >
                  Upload your steel specification PDF, then ask any question. Get cited answers instantly.
                </motion.p>
              </div>

              {/* Combined Card with Upload + Search */}
              <Card className="border border-black/10 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-white/5 bg-white dark:bg-neutral-900">
                <CardContent className="p-6 sm:p-8 lg:p-10 space-y-8">
                  {/* Upload Area */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-medium">1</span>
                      <h3 className="text-lg font-semibold text-black dark:text-white">Upload PDF</h3>
                    </div>
                    <DocumentUpload onUploadComplete={handleUploadComplete} />
                  </div>

                  <Separator className="bg-black/10 dark:bg-white/10" />

                  {/* Search Area - Animated when upload completes */}
                  <motion.div
                    ref={step2Ref}
                    className={`space-y-4 p-4 -m-4 rounded-xl transition-all duration-500 ${hasDocumentUploaded ? 'bg-green-50 dark:bg-green-950/30 ring-2 ring-green-500 ring-offset-2 dark:ring-offset-neutral-900' : ''
                      }`}
                    animate={hasDocumentUploaded ? {
                      scale: [1, 1.03, 1],
                      transition: { duration: 0.6, ease: "easeOut" }
                    } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <motion.span
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold transition-colors duration-300 ${hasDocumentUploaded ? 'bg-green-500' : 'bg-black dark:bg-white dark:text-black'
                          }`}
                        animate={hasDocumentUploaded ? {
                          scale: [1, 1.3, 1],
                          transition: { duration: 0.5, repeat: 3 }
                        } : {}}
                      >
                        2
                      </motion.span>
                      <h3 className={`text-lg font-semibold transition-colors duration-300 ${hasDocumentUploaded ? 'text-green-700 dark:text-green-400' : 'text-black dark:text-white'
                        }`}>
                        {hasDocumentUploaded ? "Now Ask a Question!" : "Ask a Question"}
                      </h3>
                      {hasDocumentUploaded && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="px-3 py-1 bg-green-500 text-white text-sm font-bold rounded-full"
                        >
                          ✓ Ready
                        </motion.span>
                      )}
                    </div>
                    {hasDocumentUploaded && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-green-600 dark:text-green-400 font-medium pl-11"
                      >
                        Click a quick prompt below or type your own question
                      </motion.p>
                    )}
                    <SearchForm
                      onResult={handleResult}
                      onError={handleError}
                      onLoadingChange={handleLoadingChange}
                      onComparisonResult={handleComparisonResult}
                      onQuerySubmit={setLastQuery}
                      documentId={uploadedDocumentId}
                    />
                  </motion.div>

                  {/* Response Display */}
                  {(response || error || isLoading) && (
                    <>
                      <Separator className="bg-black/10 dark:bg-white/10" />
                      <motion.div
                        ref={step3Ref}
                        className="space-y-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <div className="flex items-center gap-3">
                          <motion.span
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold"
                            animate={isLoading ? {
                              scale: [1, 1.1, 1],
                              transition: { duration: 1, repeat: Infinity }
                            } : {}}
                          >
                            3
                          </motion.span>
                          <h3 className="text-lg font-semibold text-black dark:text-white">
                            {isLoading ? "Analyzing..." : "Cited Answer"}
                          </h3>
                          {response && !isLoading && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="px-3 py-1 bg-blue-500 text-white text-sm font-bold rounded-full"
                            >
                              ✓ Complete
                            </motion.span>
                          )}
                        </div>
                        <RealtimeComparison
                          query={lastQuery}
                          steelAgentResponse={response}
                          steelAgentSources={sources}
                          genericLLMResponse={genericLLMResponse}
                          isLoading={isLoading}
                          error={error}
                          confidence={confidence}
                        />
                      </motion.div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Lead Collection Section */}
        <section id="contact" className="relative py-12 sm:py-16 md:py-20 border-t border-black/5 dark:border-white/10 overflow-hidden">
          <div className="container-wide">
            <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
              {/* Left Column: Form & Content */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="flex-1 w-full max-w-2xl mx-auto lg:mx-0"
              >
                <div className="text-left space-y-6 mb-8">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="inline-flex items-center gap-2 px-3 py-1 border border-black/10 dark:border-white/10 rounded-full text-xs font-medium text-black/70 dark:text-white/70"
                  >
                    <motion.span
                      className="w-2 h-2 bg-amber-500 rounded-full"
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    EARLY ACCESS
                  </motion.div>
                  <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-black dark:text-white">
                    Get Priority Access
                  </h2>
                  <p className="text-lg text-black/70 dark:text-white/70 leading-relaxed">
                    Be the first to automate your compliance reviews with AI.
                  </p>
                </div>

                {/* Lead Form */}
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-black/5 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-white/5 p-6 sm:p-8">
                  <LeadForm />
                </div>
              </motion.div>

              {/* Right Column: Visualization */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="flex-1 w-full hidden lg:flex items-center justify-center"
              >
                <div className="relative">
                  {/* Decorative background element */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-50/50 dark:bg-blue-950/20 rounded-full blur-3xl -z-10" />
                  {/* Processing Pipeline Animation */}
                  <NetworkVisualization />
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/5 dark:border-white/10 py-8 sm:py-12 bg-white dark:bg-neutral-950">
        <div className="container-center">
          <div className="flex justify-center">
            <div>
              <span className="font-semibold text-black dark:text-white">SpecVault</span>
              <span className="text-black/60 dark:text-white/60 text-sm ml-2">
                by Antigravity
              </span>
            </div>
          </div>
          <Separator className="my-8 bg-black/5 dark:bg-white/10" />
          <p className="text-center text-xs text-black/40 dark:text-white/40 max-w-2xl mx-auto">
            <strong>Disclaimer:</strong> SpecVault provides AI-generated responses for reference only.
            Always verify specifications against original source documents. Not intended for safety-critical
            decisions without professional engineering review. Users are responsible for their own document licenses.
          </p>
          <div className="flex justify-center gap-4 mt-4 text-xs text-black/40 dark:text-white/40">
            <Link href="/terms" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Terms of Service</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-black/60 dark:hover:text-white/60 transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
