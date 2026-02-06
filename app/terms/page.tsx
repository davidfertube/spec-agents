"use client";

import { Boxes } from "lucide-react";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-black">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-black/5">
        <div className="container-center">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black flex items-center justify-center">
                <Boxes className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-black">SpecVault</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-24 pb-16">
        <div className="container-narrow">
          <h1 className="text-4xl font-semibold tracking-tight mb-8">Terms of Service</h1>
          <p className="text-sm text-black/60 mb-8">Last updated: January 2025</p>

          <div className="prose prose-sm max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p className="text-black/70 leading-relaxed">
                By accessing or using SpecVault (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
                If you do not agree to these terms, do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
              <p className="text-black/70 leading-relaxed">
                SpecVault is an AI-powered document retrieval and analysis tool designed for engineering
                specifications and technical documentation. The Service uses artificial intelligence to search,
                retrieve, and summarize information from documents uploaded by users.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">3. Important Disclaimers</h2>
              <div className="bg-black/5 border border-black/10 p-4 rounded-lg">
                <p className="text-black/80 leading-relaxed font-medium">
                  THE SERVICE PROVIDES AI-GENERATED RESPONSES FOR REFERENCE PURPOSES ONLY.
                </p>
                <ul className="list-disc list-inside mt-4 space-y-2 text-black/70">
                  <li>Responses may contain errors, inaccuracies, or hallucinations</li>
                  <li>Always verify information against original source documents</li>
                  <li>Do not use for safety-critical decisions without professional engineering review</li>
                  <li>The Service is not a substitute for professional engineering judgment</li>
                  <li>We are not responsible for decisions made based on AI-generated content</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">4. User Responsibilities</h2>
              <p className="text-black/70 leading-relaxed mb-4">You are responsible for:</p>
              <ul className="list-disc list-inside space-y-2 text-black/70">
                <li>Ensuring you have proper licenses for any documents you upload (e.g., ASTM, ASME, API standards)</li>
                <li>Not uploading copyrighted materials you do not have rights to use</li>
                <li>Verifying all AI-generated responses against original sources before relying on them</li>
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>Complying with all applicable laws and regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">5. Intellectual Property</h2>
              <p className="text-black/70 leading-relaxed">
                You retain all rights to documents you upload. We do not claim ownership of your content.
                We do not use your documents to train AI models. Your documents are processed solely
                to provide the Service to you.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">6. Limitation of Liability</h2>
              <p className="text-black/70 leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, STEEL AGENT AND ITS AFFILIATES SHALL NOT BE LIABLE
                FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
                LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
              </p>
              <p className="text-black/70 leading-relaxed mt-4">
                IN NO EVENT SHALL OUR TOTAL LIABILITY EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS
                PRECEDING THE CLAIM.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">7. Indemnification</h2>
              <p className="text-black/70 leading-relaxed">
                You agree to indemnify and hold harmless SpecVault from any claims, damages, or expenses
                arising from your use of the Service, your violation of these Terms, or your violation of
                any rights of a third party.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">8. Data Security</h2>
              <p className="text-black/70 leading-relaxed">
                We implement industry-standard security measures to protect your data. However, no method
                of transmission over the Internet is 100% secure. We cannot guarantee absolute security of
                your data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">9. Termination</h2>
              <p className="text-black/70 leading-relaxed">
                We reserve the right to suspend or terminate your access to the Service at any time,
                with or without cause. Upon termination, your right to use the Service will immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">10. Changes to Terms</h2>
              <p className="text-black/70 leading-relaxed">
                We may modify these Terms at any time. We will notify you of material changes by posting
                the updated Terms on our website. Your continued use of the Service after changes constitutes
                acceptance of the modified Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">11. Contact</h2>
              <p className="text-black/70 leading-relaxed">
                For questions about these Terms, please contact us at legal@steelagent.io
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/5 py-8 bg-white">
        <div className="container-center text-center">
          <div className="flex justify-center gap-4 text-xs text-black/40">
            <Link href="/" className="hover:text-black/60 transition-colors">Home</Link>
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
