"use client";

import { useState, useCallback, FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Github, Menu, X, Boxes } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SearchForm } from "@/components/search-form";
import { ResponseDisplay } from "@/components/response-display";
import { HealthIndicator } from "@/components/health-indicator";
import { DocumentUpload } from "@/components/document-upload";
import { Source } from "@/lib/api";

// Industry Visualization - Steel Specifications and AI
function IndustryVisualization() {
  return (
    <div className="relative w-full max-w-xl mx-auto h-[450px] lg:h-[520px] flex items-center justify-center">
      <svg viewBox="0 0 400 400" className="w-full h-full">
        {/* Steel pipe cross-sections */}
        <motion.circle
          cx="150"
          cy="150"
          r="60"
          fill="none"
          stroke="black"
          strokeWidth="3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, delay: 0.2 }}
        />
        <motion.circle
          cx="150"
          cy="150"
          r="45"
          fill="none"
          stroke="black"
          strokeWidth="2"
          strokeDasharray="4 2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, delay: 0.4 }}
        />

        <motion.circle
          cx="280"
          cy="200"
          r="50"
          fill="none"
          stroke="black"
          strokeWidth="3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, delay: 0.6 }}
        />
        <motion.circle
          cx="280"
          cy="200"
          r="38"
          fill="none"
          stroke="black"
          strokeWidth="2"
          strokeDasharray="4 2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, delay: 0.8 }}
        />

        {/* Document/spec icons */}
        <motion.rect
          x="100"
          y="280"
          width="60"
          height="80"
          fill="none"
          stroke="black"
          strokeWidth="2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
        />
        <motion.line
          x1="110"
          y1="295"
          x2="150"
          y2="295"
          stroke="black"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        />
        <motion.line
          x1="110"
          y1="310"
          x2="150"
          y2="310"
          stroke="black"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 1.3 }}
        />
        <motion.line
          x1="110"
          y1="325"
          x2="145"
          y2="325"
          stroke="black"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 1.4 }}
        />

        <motion.rect
          x="240"
          y="300"
          width="60"
          height="80"
          fill="none"
          stroke="black"
          strokeWidth="2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.1 }}
        />
        <motion.line
          x1="250"
          y1="315"
          x2="290"
          y2="315"
          stroke="black"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 1.3 }}
        />
        <motion.line
          x1="250"
          y1="330"
          x2="290"
          y2="330"
          stroke="black"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 1.4 }}
        />
        <motion.line
          x1="250"
          y1="345"
          x2="285"
          y2="345"
          stroke="black"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
        />

        {/* AI connection lines (subtle red) */}
        <motion.line
          x1="150"
          y1="210"
          x2="130"
          y2="280"
          stroke="#ef4444"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          animate={{ strokeDashoffset: [0, 8] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />

        <motion.line
          x1="280"
          y1="250"
          x2="270"
          y2="300"
          stroke="#ef4444"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          animate={{ strokeDashoffset: [0, 8] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 0.5 }}
        />

        {/* Connection nodes */}
        <motion.circle
          cx="150"
          cy="210"
          r="4"
          fill="#ef4444"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.circle
          cx="130"
          cy="280"
          r="4"
          fill="#ef4444"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
        />
        <motion.circle
          cx="280"
          cy="250"
          r="4"
          fill="#ef4444"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
        />
        <motion.circle
          cx="270"
          cy="300"
          r="4"
          fill="#ef4444"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.9 }}
        />

        {/* Labels */}
        <motion.text
          x="200"
          y="30"
          fontSize="10"
          fill="black"
          opacity="0.5"
          fontFamily="monospace"
          textAnchor="middle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 1, delay: 1.5 }}
        >
          STEEL SPECIFICATIONS
        </motion.text>
        <motion.text
          x="200"
          y="460"
          fontSize="10"
          fill="black"
          opacity="0.5"
          fontFamily="monospace"
          textAnchor="middle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 1, delay: 1.6 }}
        >
          AI-POWERED RETRIEVAL
        </motion.text>
      </svg>
    </div>
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
          <p className="text-black/70">We&apos;ll contact you when Steel Agent is ready.</p>
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
          We&apos;ll contact you when Steel Agent is ready. No spam, ever.
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
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white text-black overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-black/5">
        <div className="container-center">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="text-lg font-semibold tracking-tight text-black">
              Steel Agent
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-8">
              <Link href="#demo" className="text-sm text-black/60 hover:text-black transition-colors">
                Demo
              </Link>
              <a
                href="https://github.com/davidfertube/steel-venture"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-black/60 hover:text-black transition-colors"
              >
                GitHub
              </a>
              <HealthIndicator />
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
              <Link
                href="#demo"
                className="block py-3 px-3 text-sm text-black/60 hover:text-black hover:bg-black/5 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Demo
              </Link>
              <a
                href="https://github.com/davidfertube/steel-venture"
                target="_blank"
                rel="noopener noreferrer"
                className="block py-3 px-3 text-sm text-black/60 hover:text-black hover:bg-black/5 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                GitHub
              </a>
              <Separator className="my-4 bg-black/10" />
              <div className="px-3">
                <HealthIndicator />
              </div>
            </nav>
          </motion.div>
        )}
      </header>

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-20 md:py-28 overflow-hidden">
          <div className="container-wide">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: Text content */}
              <div className="text-center lg:text-left space-y-8">
                <div className="space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="inline-flex items-center gap-2 px-3 py-1 border border-black/10 rounded-full text-xs font-medium text-black/70"
                  >
                    <motion.span
                      className="w-2 h-2 bg-red-500 rounded-full"
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    Steel Specification Search Agent
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.1] text-black"
                  >
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                    >
                      Find Steel Specs
                    </motion.span>
                    <br />
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      className="whitespace-nowrap"
                    >
                      Instantly. Get Verified
                    </motion.span>
                    <br />
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.7 }}
                      className="relative inline-block"
                    >
                      Answers.
                      <motion.span
                        className="absolute -bottom-1 left-0 right-0 h-[3px] bg-red-500"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.6, delay: 1.0 }}
                        style={{ transformOrigin: "left" }}
                      />
                    </motion.span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.9 }}
                    className="text-lg text-black/70 max-w-xl mx-auto lg:mx-0 leading-relaxed"
                  >
                    Upload ASTM, NACE, or API documents. Ask any question. Get traceable citations for compliance reports in seconds.
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.0 }}
                  className="flex flex-wrap gap-4 justify-center lg:justify-start"
                >
                  <Button size="lg" className="bg-black text-white hover:bg-black/90 h-12 px-8" asChild>
                    <Link href="#demo">
                      Run Demo
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="border-black/20 bg-white text-black hover:bg-black/5 h-12 w-12 p-0" asChild>
                    <a
                      href="https://github.com/davidfertube/steel-venture"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View on GitHub"
                    >
                      <Github className="h-5 w-5" />
                    </a>
                  </Button>
                </motion.div>

                {/* Key Metrics */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.1 }}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4"
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

              {/* Right: Industry visualization */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="hidden lg:block"
              >
                <IndustryVisualization />
              </motion.div>
            </div>
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
                    <DocumentUpload />
                  </div>

                  <Separator className="bg-black/10" />

                  {/* Search Area */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-black text-white text-sm font-medium">2</span>
                      <h3 className="text-lg font-semibold text-black">Ask a Question</h3>
                    </div>
                    <SearchForm
                      onResult={handleResult}
                      onError={handleError}
                      onLoadingChange={handleLoadingChange}
                    />
                  </div>

                  {/* Response Display */}
                  {(response || error || isLoading) && (
                    <>
                      <Separator className="bg-black/10" />
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500 text-white text-sm font-medium">3</span>
                          <h3 className="text-lg font-semibold text-black">Cited Answer</h3>
                        </div>
                        <ResponseDisplay
                          response={response}
                          sources={sources}
                          error={error}
                          isLoading={isLoading}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Lead Collection Section */}
        <section className="relative py-12 sm:py-16 md:py-20 border-t border-black/5">
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
              <div className="w-8 h-8 bg-black flex items-center justify-center">
                <Boxes className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-semibold text-black">Steel Agent</span>
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
              <HealthIndicator />
              <Separator orientation="vertical" className="h-6 bg-black/10" />
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
          <p className="text-center text-sm text-black/60">
            AI-powered search for ASTM, NACE, and API steel specifications. Built for material engineers in Oil &amp; Gas.
          </p>
          <p className="text-center text-xs text-black/40 mt-4 max-w-2xl mx-auto">
            <strong>Disclaimer:</strong> Steel Agent provides AI-generated responses for reference only.
            Always verify specifications against original source documents. Not intended for safety-critical
            decisions without professional engineering review. Users are responsible for their own document licenses.
          </p>
          <div className="flex justify-center gap-4 mt-4 text-xs text-black/40">
            <Link href="/terms" className="hover:text-black/60 transition-colors">Terms of Service</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-black/60 transition-colors">Privacy Policy</Link>
            <span>·</span>
            <Link href="/pricing" className="hover:text-black/60 transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
