"use client";

import { useState, useCallback, FormEvent, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Github, Menu, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SearchForm } from "@/components/search-form";
import { ResponseDisplay } from "@/components/response-display";
import { RealtimeComparison } from "@/components/realtime-comparison";
import { DocumentUpload } from "@/components/document-upload";
import { Source, GenericLLMResponse } from "@/lib/api";

// Spline 3D Animation Component
// Shows PDFs flowing into the Steel Agents brain
import Spline from '@splinetool/react-spline';

function Hero3DAnimation() {
  return (
    <div className="relative w-full aspect-square max-w-[500px] mx-auto">
      {/* Fallback SVG animation while Spline loads or if no scene URL */}
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
    <svg viewBox="0 0 400 400" className="w-full h-full">
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
            fill="white"
            stroke="black"
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
              stroke="black"
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
        fill="white"
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
      <Card className="border border-black/10 shadow-lg shadow-black/5 bg-white">
        <CardContent className="p-6 sm:p-8 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-black mb-2">You&apos;re on the list!</h3>
          <p className="text-black/70">We&apos;ll contact you when Steel Agents is ready.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-black/10 shadow-lg shadow-black/5 bg-white">
      <CardContent className="p-6 sm:p-8">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-medium text-black">
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                required
                disabled={isSubmitting}
                className="w-full h-11 px-4 border border-black/20 rounded focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-colors disabled:opacity-50"
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium text-black">
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                required
                disabled={isSubmitting}
                className="w-full h-11 px-4 border border-black/20 rounded focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-colors disabled:opacity-50"
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-black">
              Work Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              disabled={isSubmitting}
              className="w-full h-11 px-4 border border-black/20 rounded focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-colors disabled:opacity-50"
              placeholder="john.doe@company.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="company" className="text-sm font-medium text-black">
              Company
            </label>
            <input
              type="text"
              id="company"
              name="company"
              disabled={isSubmitting}
              className="w-full h-11 px-4 border border-black/20 rounded focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-colors disabled:opacity-50"
              placeholder="Shell, ExxonMobil, Bechtel..."
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium text-black">
              Phone Number <span className="text-black/40">(optional)</span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              disabled={isSubmitting}
              className="w-full h-11 px-4 border border-black/20 rounded focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-colors disabled:opacity-50"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="w-full bg-black text-white hover:bg-black/90 h-12 text-base font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Join Waitlist'}
            {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>

        <p className="text-xs text-black/50 text-center mt-4">
          We&apos;ll contact you when Steel Agents is ready. No spam, ever.
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasDocumentUploaded, setHasDocumentUploaded] = useState(false);

  // Comparison mode state
  const [compareMode, setCompareMode] = useState(false);
  const [genericLLMResponse, setGenericLLMResponse] = useState<string | null>(null);

  // Refs for auto-scrolling
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);

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

  const handleUploadComplete = useCallback((hasCompleted: boolean) => {
    setHasDocumentUploaded(hasCompleted);
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
    }
  }, []);

  const handleComparisonResult = useCallback(
    (steelAgent: { response: string; sources: Source[] }, genericLLM: GenericLLMResponse) => {
      setError(null);
      setResponse(steelAgent.response);
      setSources(steelAgent.sources);
      setGenericLLMResponse(genericLLM.response);
    },
    []
  );

  return (
    <div className="flex min-h-screen flex-col bg-white text-black overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-black/5">
        <div className="container-center">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="text-lg font-semibold tracking-tight text-black">
              Steel Agents
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-8">
              <a
                href="#demo"
                className="text-sm text-black/60 hover:text-black transition-colors"
              >
                Demo
              </a>
              <a
                href="#contact"
                className="text-sm text-black/60 hover:text-black transition-colors"
              >
                Contact
              </a>
              <a
                href="https://github.com/davidfertube/steel-venture"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-black/60 hover:text-black transition-colors"
              >
                GitHub
              </a>
            </nav>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 touch-target rounded hover:bg-black/5 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 text-black" />
              ) : (
                <Menu className="h-5 w-5 text-black" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden border-t border-black/5 bg-white"
          >
            <nav className="container-center py-6 space-y-1">
              <a
                href="#demo"
                className="block py-3 px-3 text-sm text-black/60 hover:text-black hover:bg-black/5 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Demo
              </a>
              <a
                href="#contact"
                className="block py-3 px-3 text-sm text-black/60 hover:text-black hover:bg-black/5 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </a>
              <a
                href="https://github.com/davidfertube/steel-venture"
                target="_blank"
                rel="noopener noreferrer"
                className="block py-3 px-3 text-sm text-black/60 hover:text-black hover:bg-black/5 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                GitHub
              </a>
            </nav>
          </motion.div>
        )}
      </header>

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-20 md:py-28 overflow-hidden">
          <div className="container-wide">
            <div className="flex flex-col lg:flex-row gap-12 lg:gap-8 items-center">
              {/* Center/Left: Text content */}
              <div className="flex-1 text-center space-y-8">
                <div className="space-y-6">
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] text-black"
                  >
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      STEEL AGENTS
                    </motion.span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="text-xl text-black/60 max-w-xl mx-auto leading-relaxed"
                  >
                    Upload specs. Ask questions. Get{" "}
                    <span className="relative inline-block text-black font-semibold">
                      cited answers
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
                  className="flex flex-wrap gap-4 justify-center"
                >
                  <Button size="lg" className="bg-black text-white hover:bg-black/90 h-12 px-8" asChild>
                    <a href="#demo">
                      Try Demo
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" className="border-black/20 bg-white text-black hover:bg-black/5 h-12 px-6" asChild>
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
                  className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4 max-w-2xl mx-auto"
                >
                  <div>
                    <p className="text-2xl sm:text-3xl font-semibold text-black">4+ hrs</p>
                    <p className="text-sm text-black/60">Saved per day</p>
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-semibold text-black">100%</p>
                    <p className="text-sm text-black/60">Cited sources</p>
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-semibold text-black">&lt;5s</p>
                    <p className="text-sm text-black/60">Response time</p>
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-semibold text-black">$0</p>
                    <p className="text-sm text-black/60">Open source</p>
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

        {/* Why Steel Agents vs Generic LLMs Section */}
        <section className="relative py-12 sm:py-16 md:py-20 border-t border-black/5 bg-black/[0.02]">
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
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-black"
                >
                  Why Steel Agents?
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-lg text-black/70 max-w-2xl mx-auto"
                >
                  Generic LLMs (ChatGPT, Claude, Gemini) hallucinate specs. Steel Agents only answers from your documents.
                </motion.p>
              </div>

              {/* Comparison Grid */}
              <div className="grid lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {/* Steel Agents Card */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="rounded-xl border-2 border-green-500 bg-green-50/50 p-6 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-green-700">Steel Agents</h3>
                  </div>
                  <ul className="space-y-3">
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
                        className="flex items-start gap-2"
                      >
                        <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm text-black/80">{item}</span>
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
                  className="rounded-xl border-2 border-red-300 bg-red-50/30 p-6 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-400 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-red-600">Generic LLM</h3>
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">ChatGPT / Claude / Gemini</span>
                  </div>
                  <ul className="space-y-3">
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
                        className="flex items-start gap-2"
                      >
                        <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-sm text-black/60">{item}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </div>

              {/* Visual Demo Animation */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="bg-white rounded-xl border border-black/10 p-6 max-w-3xl mx-auto"
              >
                <p className="text-sm text-black/50 mb-4 text-center">Example Question</p>
                <p className="text-lg font-medium text-black text-center mb-6">
                  &quot;What is the yield strength of 316L stainless steel?&quot;
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Steel Agents Response */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-green-700">Steel Agents</span>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-sm">
                      <p className="text-black/80">&quot;The minimum yield strength of 316L is <strong>170 MPa (25 ksi)</strong> [1]&quot;</p>
                      <p className="text-green-600 text-xs mt-2 font-medium">
                        Source: ASTM_A240.pdf, Page 3
                      </p>
                    </div>
                  </div>
                  {/* Generic LLM Response */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-red-400 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-red-600">Generic LLM</span>
                    </div>
                    <div className="bg-red-50/50 rounded-lg p-4 text-sm">
                      <p className="text-black/60">&quot;316L stainless steel typically has a yield strength around 170-290 MPa...&quot;</p>
                      <p className="text-red-400 text-xs mt-2">
                        No source • Cannot verify
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Demo Section - Combined Upload & Query */}
        <section id="demo" className="relative py-12 sm:py-16 md:py-20 border-t border-black/5">
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
                  className="inline-flex items-center gap-2 px-3 py-1 border border-black/10 rounded-full text-xs font-medium text-black/70"
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
                  className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-black"
                >
                  Upload & Ask
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-lg text-black/70 max-w-2xl mx-auto"
                >
                  Upload your steel specification PDF, then ask any question. Get cited answers instantly.
                </motion.p>
              </div>

              {/* Combined Card with Upload + Search */}
              <Card className="border border-black/10 shadow-lg shadow-black/5 bg-white">
                <CardContent className="p-6 sm:p-8 lg:p-10 space-y-8">
                  {/* Upload Area */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-black text-white text-sm font-medium">1</span>
                      <h3 className="text-lg font-semibold text-black">Upload PDF</h3>
                    </div>
                    <DocumentUpload onUploadComplete={handleUploadComplete} />
                  </div>

                  <Separator className="bg-black/10" />

                  {/* Search Area - Animated when upload completes */}
                  <motion.div
                    ref={step2Ref}
                    className={`space-y-4 p-4 -m-4 rounded-xl transition-all duration-500 ${
                      hasDocumentUploaded ? 'bg-green-50 ring-2 ring-green-500 ring-offset-2' : ''
                    }`}
                    animate={hasDocumentUploaded ? {
                      scale: [1, 1.03, 1],
                      transition: { duration: 0.6, ease: "easeOut" }
                    } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <motion.span
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold transition-colors duration-300 ${
                          hasDocumentUploaded ? 'bg-green-500' : 'bg-black'
                        }`}
                        animate={hasDocumentUploaded ? {
                          scale: [1, 1.3, 1],
                          transition: { duration: 0.5, repeat: 3 }
                        } : {}}
                      >
                        2
                      </motion.span>
                      <h3 className={`text-lg font-semibold transition-colors duration-300 ${
                        hasDocumentUploaded ? 'text-green-700' : 'text-black'
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
                        className="text-sm text-green-600 font-medium pl-11"
                      >
                        Click a quick prompt below or type your own question
                      </motion.p>
                    )}
                    <SearchForm
                      onResult={handleResult}
                      onError={handleError}
                      onLoadingChange={handleLoadingChange}
                      onComparisonResult={handleComparisonResult}
                      compareMode={compareMode}
                      onCompareModeChange={setCompareMode}
                    />
                  </motion.div>

                  {/* Response Display */}
                  {(response || error || isLoading) && (
                    <>
                      <Separator className="bg-black/10" />
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
                          <h3 className="text-lg font-semibold text-black">
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
                        {compareMode ? (
                          <RealtimeComparison
                            steelAgentResponse={response}
                            steelAgentSources={sources}
                            genericLLMResponse={genericLLMResponse}
                            isLoading={isLoading}
                            error={error}
                          />
                        ) : (
                          <ResponseDisplay
                            response={response}
                            sources={sources}
                            error={error}
                            isLoading={isLoading}
                          />
                        )}
                      </motion.div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Lead Collection Section */}
        <section id="contact" className="relative py-12 sm:py-16 md:py-20 border-t border-black/5">
          <div className="container-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center space-y-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  className="inline-flex items-center gap-2 px-3 py-1 border border-black/10 rounded-full text-xs font-medium text-black/70"
                >
                  <motion.span
                    className="w-2 h-2 bg-amber-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  EARLY ACCESS
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-black"
                >
                  Get Priority Access
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-lg text-black/70"
                >
                  Join 500+ material engineers already on the waitlist. Be first to access premium features.
                </motion.p>
              </div>

              {/* Lead Form */}
              <LeadForm />
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/5 py-8 sm:py-12 bg-white">
        <div className="container-center">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div>
                <span className="font-semibold text-black">Steel Agents</span>
                <span className="text-black/60 text-sm ml-2">
                  by{" "}
                  <a
                    href="https://github.com/davidfertube"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-black transition-colors"
                  >
                    Antigravity
                  </a>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/davidfertube/steel-venture"
                target="_blank"
                rel="noopener noreferrer"
                className="text-black/60 hover:text-black transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
          <Separator className="my-8 bg-black/5" />
          <p className="text-center text-xs text-black/40 max-w-2xl mx-auto">
            <strong>Disclaimer:</strong> Steel Agents provides AI-generated responses for reference only.
            Always verify specifications against original source documents. Not intended for safety-critical
            decisions without professional engineering review. Users are responsible for their own document licenses.
          </p>
          <div className="flex justify-center gap-4 mt-4 text-xs text-black/40">
            <Link href="/terms" className="hover:text-black/60 transition-colors">Terms of Service</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-black/60 transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
