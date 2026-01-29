"use client";

import { Boxes } from "lucide-react";
import Link from "next/link";

export default function PrivacyPage() {
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
              <span className="text-lg font-semibold tracking-tight text-black">Steel Agents</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-24 pb-16">
        <div className="container-narrow">
          <h1 className="text-4xl font-semibold tracking-tight mb-8">Privacy Policy</h1>
          <p className="text-sm text-black/60 mb-8">Last updated: January 2025</p>

          <div className="prose prose-sm max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-4">1. Information We Collect</h2>
              <p className="text-black/70 leading-relaxed mb-4">We collect the following types of information:</p>
              <ul className="list-disc list-inside space-y-2 text-black/70">
                <li><strong>Account Information:</strong> Email address, name, company name when you register</li>
                <li><strong>Documents:</strong> Files you upload to the Service for processing</li>
                <li><strong>Usage Data:</strong> Queries, search history, and interaction patterns</li>
                <li><strong>Technical Data:</strong> IP address, browser type, device information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">2. How We Use Your Information</h2>
              <ul className="list-disc list-inside space-y-2 text-black/70">
                <li>To provide and improve the Service</li>
                <li>To process your documents and respond to queries</li>
                <li>To communicate with you about your account</li>
                <li>To ensure security and prevent fraud</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">3. How We Protect Your Documents</h2>
              <div className="bg-black/5 border border-black/10 p-4 rounded-lg">
                <ul className="space-y-2 text-black/70">
                  <li>✓ Documents are encrypted at rest and in transit</li>
                  <li>✓ We do NOT use your documents to train AI models</li>
                  <li>✓ Documents are processed only to provide the Service to you</li>
                  <li>✓ You can delete your documents at any time</li>
                  <li>✓ Enterprise customers can deploy on-premise</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">4. Data Retention</h2>
              <p className="text-black/70 leading-relaxed">
                We retain your data for as long as your account is active. You can request deletion of
                your data at any time. Upon account deletion, we will remove your documents and personal
                information within 30 days, except where retention is required by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">5. Data Sharing</h2>
              <p className="text-black/70 leading-relaxed mb-4">We do not sell your personal information. We may share data with:</p>
              <ul className="list-disc list-inside space-y-2 text-black/70">
                <li><strong>Service Providers:</strong> Cloud hosting (Azure), AI processing (Google)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with a merger or acquisition</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">6. Your Rights</h2>
              <p className="text-black/70 leading-relaxed mb-4">You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 text-black/70">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Delete your account and data</li>
                <li>Export your data</li>
                <li>Opt out of marketing communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">7. Cookies</h2>
              <p className="text-black/70 leading-relaxed">
                We use essential cookies to operate the Service and analytics cookies to understand usage.
                You can control cookies through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">8. International Transfers</h2>
              <p className="text-black/70 leading-relaxed">
                Your data may be processed in the United States or other countries where our service
                providers operate. We ensure appropriate safeguards are in place for international transfers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">9. Children&apos;s Privacy</h2>
              <p className="text-black/70 leading-relaxed">
                The Service is not intended for users under 18 years of age. We do not knowingly collect
                information from children.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">10. Changes to This Policy</h2>
              <p className="text-black/70 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of material changes
                by posting the updated policy on our website.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">11. Contact Us</h2>
              <p className="text-black/70 leading-relaxed">
                For privacy-related questions, please contact us at privacy@steelagent.io
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
            <Link href="/terms" className="hover:text-black/60 transition-colors">Terms of Service</Link>
            <span>·</span>
            <Link href="/pricing" className="hover:text-black/60 transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
