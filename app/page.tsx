"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Github, Zap, Shield, Database, Menu, X, FileText, Boxes } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SearchForm } from "@/components/search-form";
import { ResponseDisplay } from "@/components/response-display";
import { HealthIndicator } from "@/components/health-indicator";
import { Source } from "@/lib/api";

// Iron/Steel Crystal Lattice Visualization - BCC Structure
function SteelCrystalVisualization() {
  // Body-Centered Cubic (BCC) iron lattice - the crystal structure of steel
  // Main cube vertices (8 corners)
  const cubeVertices = [
    { x: 120, y: 120, z: 0 },   // front-top-left
    { x: 280, y: 120, z: 0 },   // front-top-right
    { x: 280, y: 280, z: 0 },   // front-bottom-right
    { x: 120, y: 280, z: 0 },   // front-bottom-left
    { x: 160, y: 80, z: 1 },    // back-top-left
    { x: 320, y: 80, z: 1 },    // back-top-right
    { x: 320, y: 240, z: 1 },   // back-bottom-right
    { x: 160, y: 240, z: 1 },   // back-bottom-left
  ];

  // Center atom (BCC structure has atom in center)
  const centerAtom = { x: 200, y: 180 };

  // Additional lattice points for extended structure
  const extendedPoints = [
    { x: 60, y: 160 }, { x: 340, y: 160 },
    { x: 200, y: 40 }, { x: 200, y: 320 },
    { x: 80, y: 60 }, { x: 320, y: 60 },
    { x: 80, y: 300 }, { x: 320, y: 300 },
  ];

  // Electron cloud points orbiting around atoms
  const electronOrbits = [
    { cx: 200, cy: 180, r: 40 },
    { cx: 120, cy: 120, r: 25 },
    { cx: 280, cy: 280, r: 25 },
  ];

  return (
    <div className="relative w-full max-w-xl mx-auto h-[400px] lg:h-[480px]">
      <svg
        viewBox="0 0 400 400"
        className="w-full h-full"
        style={{ overflow: "visible" }}
      >
        {/* Grid lines background */}
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.line
            key={`grid-h-${i}`}
            x1="50"
            y1={80 + i * 60}
            x2="350"
            y2={80 + i * 60}
            stroke="black"
            strokeWidth="0.3"
            strokeDasharray="2,4"
            animate={{ opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.line
            key={`grid-v-${i}`}
            x1={80 + i * 60}
            y1="50"
            x2={80 + i * 60}
            y2="350"
            stroke="black"
            strokeWidth="0.3"
            strokeDasharray="2,4"
            animate={{ opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}

        {/* Cube edges - front face */}
        <motion.path
          d="M 120 120 L 280 120 L 280 280 L 120 280 Z"
          fill="none"
          stroke="black"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />

        {/* Cube edges - back face */}
        <motion.path
          d="M 160 80 L 320 80 L 320 240 L 160 240 Z"
          fill="none"
          stroke="black"
          strokeWidth="1.5"
          strokeDasharray="4,2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, delay: 0.3, ease: "easeInOut" }}
        />

        {/* Connecting edges (front to back) */}
        {[
          [120, 120, 160, 80],
          [280, 120, 320, 80],
          [280, 280, 320, 240],
          [120, 280, 160, 240],
        ].map(([x1, y1, x2, y2], i) => (
          <motion.line
            key={`connect-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="black"
            strokeWidth="1.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
          />
        ))}

        {/* Diagonal bonds to center atom (BCC structure) */}
        {cubeVertices.map((vertex, i) => (
          <motion.line
            key={`bond-${i}`}
            x1={vertex.x}
            y1={vertex.y}
            x2={centerAtom.x}
            y2={centerAtom.y}
            stroke="black"
            strokeWidth="0.8"
            strokeDasharray="3,3"
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
          />
        ))}

        {/* Extended lattice connections */}
        {extendedPoints.map((point, i) => (
          <motion.line
            key={`ext-${i}`}
            x1={point.x}
            y1={point.y}
            x2={centerAtom.x}
            y2={centerAtom.y}
            stroke="black"
            strokeWidth="0.5"
            strokeDasharray="2,4"
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}

        {/* Electron orbits */}
        {electronOrbits.map((orbit, i) => (
          <motion.circle
            key={`orbit-${i}`}
            cx={orbit.cx}
            cy={orbit.cy}
            r={orbit.r}
            fill="none"
            stroke="black"
            strokeWidth="0.5"
            strokeDasharray="2,2"
            animate={{ rotate: 360 }}
            transition={{ duration: 10 + i * 2, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: `${orbit.cx}px ${orbit.cy}px` }}
          />
        ))}

        {/* Orbiting electrons */}
        {electronOrbits.map((orbit, i) => (
          <motion.circle
            key={`electron-${i}`}
            cx={orbit.cx + orbit.r}
            cy={orbit.cy}
            r="3"
            fill="#ef4444"
            animate={{ rotate: 360 }}
            transition={{ duration: 3 + i, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: `${orbit.cx}px ${orbit.cy}px` }}
          />
        ))}

        {/* Corner atoms (Fe atoms) */}
        {cubeVertices.map((vertex, i) => (
          <motion.circle
            key={`corner-${i}`}
            cx={vertex.x}
            cy={vertex.y}
            r={vertex.z === 1 ? 6 : 8}
            fill="black"
            animate={{
              scale: [1, 1.15, 1],
              opacity: vertex.z === 1 ? [0.5, 0.7, 0.5] : [0.8, 1, 0.8],
            }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
          />
        ))}

        {/* Center atom (larger, BCC characteristic) */}
        <motion.circle
          cx={centerAtom.x}
          cy={centerAtom.y}
          r="12"
          fill="#ef4444"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.9, 1, 0.9],
          }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
        <motion.circle
          cx={centerAtom.x}
          cy={centerAtom.y}
          r="18"
          fill="none"
          stroke="#ef4444"
          strokeWidth="1"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Extended lattice points */}
        {extendedPoints.map((point, i) => (
          <motion.circle
            key={`ext-atom-${i}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="black"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.12 }}
          />
        ))}

        {/* Labels */}
        <motion.text
          x="45"
          y="35"
          fontSize="8"
          fill="black"
          opacity="0.5"
          fontFamily="monospace"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          Fe-BCC LATTICE
        </motion.text>
        <motion.text
          x="280"
          y="375"
          fontSize="8"
          fill="black"
          opacity="0.5"
          fontFamily="monospace"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
        >
          STEEL STRUCTURE
        </motion.text>
      </svg>

    </div>
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
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black flex items-center justify-center">
                <Boxes className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-black">Steel Agent</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-sm text-black/60 hover:text-black transition-colors">
                Features
              </Link>
              <Link href="#demo" className="text-sm text-black/60 hover:text-black transition-colors">
                Demo
              </Link>
              <Link href="/docs" className="text-sm text-black/60 hover:text-black transition-colors">
                Docs
              </Link>
              <a
                href="https://github.com/davidfertube/knowledge_tool"
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
                href="#features"
                className="block py-3 px-3 text-sm text-black/60 hover:text-black hover:bg-black/5 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="#demo"
                className="block py-3 px-3 text-sm text-black/60 hover:text-black hover:bg-black/5 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Demo
              </Link>
              <Link
                href="/docs"
                className="block py-3 px-3 text-sm text-black/60 hover:text-black hover:bg-black/5 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Docs
              </Link>
              <a
                href="https://github.com/davidfertube/knowledge_tool"
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
        <section className="relative py-16 sm:py-20 md:py-24 lg:py-32 overflow-hidden">
          <div className="container-center">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: Text content */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center lg:text-left space-y-8"
              >
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 border border-black/10 rounded-full text-xs font-medium text-black/70">
                    <span className="w-2 h-2 bg-red-500 rounded-sm" />
                    AI-Powered Knowledge Engine
                  </div>
                  <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.1] text-black">
                    The intelligent engine for{" "}
                    <span className="relative">
                      steel specifications
                      <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-red-500" />
                    </span>
                  </h1>
                  <p className="text-lg text-black/70 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                    Instant answers from your technical documents. Query ASTM standards,
                    material properties, and compliance requirements with AI-powered
                    semantic search and source citations.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <Button size="lg" className="bg-black text-white hover:bg-black/90 h-12 px-8">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" className="border-black/20 bg-white text-black hover:bg-black/5 h-12 px-8" asChild>
                    <a
                      href="https://github.com/davidfertube/knowledge_tool"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Github className="mr-2 h-4 w-4" />
                      View on GitHub
                    </a>
                  </Button>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-10 justify-center lg:justify-start pt-6">
                  <div>
                    <p className="text-3xl font-semibold text-black">100K+</p>
                    <p className="text-sm text-black/60">Vector capacity</p>
                  </div>
                  <div>
                    <p className="text-3xl font-semibold text-black">50+</p>
                    <p className="text-sm text-black/60">Standards</p>
                  </div>
                  <div>
                    <p className="text-3xl font-semibold text-black">&lt;2s</p>
                    <p className="text-sm text-black/60">Response time</p>
                  </div>
                </div>
              </motion.div>

              {/* Right: AI Face visualization */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="hidden lg:block"
              >
                <SteelCrystalVisualization />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section id="demo" className="relative py-16 sm:py-20 md:py-24 border-t border-black/5">
          <div className="container-narrow">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-12"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 border border-black/10 rounded-full text-xs font-medium text-black/70">
                  <span className="w-2 h-2 bg-red-500 rounded-sm" />
                  TRY IT NOW
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-black">
                  Query your knowledge base
                </h2>
                <p className="text-lg text-black/70 max-w-2xl mx-auto">
                  Ask questions about ASTM standards, material properties, or
                  compliance requirements. Get instant, cited answers.
                </p>
              </div>

              {/* Search Card */}
              <Card className="border border-black/10 shadow-lg shadow-black/5 bg-white">
                <CardContent className="p-6 sm:p-8 lg:p-10">
                  <SearchForm
                    onResult={handleResult}
                    onError={handleError}
                    onLoadingChange={handleLoadingChange}
                  />

                  {/* Response Display */}
                  <div className="mt-8">
                    <ResponseDisplay
                      response={response}
                      sources={sources}
                      error={error}
                      isLoading={isLoading}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative py-16 sm:py-20 md:py-24 border-t border-black/5 bg-black/[0.02]">
          <div className="container-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16 space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-black/10 rounded-full text-xs font-medium text-black/70">
                <span className="w-2 h-2 bg-red-500 rounded-sm" />
                WHY STEEL INTELLIGENT
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-black">
                Built for engineering teams
              </h2>
              <p className="text-lg text-black/70 max-w-2xl mx-auto">
                Designed specifically for material science and compliance verification workflows.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {[
                {
                  icon: Zap,
                  title: "Instant Answers",
                  description: "Get precise answers from your technical documents in seconds. No more manual searching through PDFs and spreadsheets.",
                  delay: 0,
                },
                {
                  icon: FileText,
                  title: "Source Citations",
                  description: "Every answer includes source citations with document name, page, and section. Verify compliance with traceable references.",
                  delay: 0.1,
                },
                {
                  icon: Shield,
                  title: "Compliance Ready",
                  description: "Verify compliance with ASTM, ASME, API, and NACE standards. Built for engineers who need audit-ready answers.",
                  delay: 0.2,
                },
                {
                  icon: Database,
                  title: "Scale Ready",
                  description: "Process hundreds of technical documents. Optimized vector pipeline handles large specification libraries efficiently.",
                  delay: 0.3,
                },
                {
                  icon: Boxes,
                  title: "Semantic Search",
                  description: "AI-powered semantic search understands engineering context. Find relevant information even with varied terminology.",
                  delay: 0.4,
                },
                {
                  icon: Github,
                  title: "Open Source",
                  description: "Fully open source and self-hostable. Deploy on your own infrastructure for maximum data security and control.",
                  delay: 0.5,
                },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: feature.delay }}
                >
                  <Card className="h-full border border-black/10 hover:border-black/20 transition-colors bg-white">
                    <CardContent className="p-6 lg:p-8 space-y-4">
                      <div className="w-12 h-12 bg-black/5 flex items-center justify-center">
                        <feature.icon className="w-6 h-6 text-black" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-lg font-semibold text-black">{feature.title}</h3>
                      <p className="text-black/70 text-sm leading-relaxed">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-16 sm:py-20 md:py-24 border-t border-black/5">
          <div className="container-narrow text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-black">
                  Ready to transform your<br />document workflow?
                </h2>
                <p className="text-lg text-black/70 max-w-2xl mx-auto">
                  Join engineering teams using Steel Agent to save hours of manual
                  document searching every week.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-black text-white hover:bg-black/90 h-12 px-8">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="border-black/20 bg-white text-black hover:bg-black/5 h-12 px-8">
                  Contact Sales
                </Button>
              </div>
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
                href="https://github.com/davidfertube/knowledge_tool"
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
            Open source AI-powered RAG for steel specifications and O&G documentation.
          </p>
        </div>
      </footer>
    </div>
  );
}
