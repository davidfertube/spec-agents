/**
 * RAGAS-style RAG Evaluation Metrics Tests
 *
 * Unit tests run without external dependencies.
 * Integration tests auto-detect LLM keys and server availability.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateRAGMetrics,
  computeCompositeScore,
  type RAGMetrics,
} from "@/lib/rag-metrics";
import { hasLLMKeys, isServerAvailable } from "../helpers/test-env";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

describe("RAG Metrics (RAGAS-style)", () => {
  describe("Unit Tests - computeCompositeScore", () => {
    it("should compute weighted score with all metrics", () => {
      const metrics: RAGMetrics = {
        faithfulness: 0.9,
        answerRelevancy: 0.8,
        contextPrecision: 1.0,
        contextRecall: 0.7,
        hallucination: 0.1,
      };
      const score = computeCompositeScore(metrics);
      // (0.9*0.3 + 0.8*0.3 + 1.0*0.2 + 0.7*0.2) / 1.0 = 0.85
      expect(score).toBeCloseTo(0.85, 2);
    });

    it("should handle null contextRecall", () => {
      const metrics: RAGMetrics = {
        faithfulness: 1.0,
        answerRelevancy: 1.0,
        contextPrecision: 1.0,
        contextRecall: null,
        hallucination: 0.0,
      };
      const score = computeCompositeScore(metrics);
      // (1.0*0.3 + 1.0*0.3 + 1.0*0.2) / 0.8 = 1.0
      expect(score).toBeCloseTo(1.0, 2);
    });

    it("should return 0 for all-zero metrics", () => {
      const metrics: RAGMetrics = {
        faithfulness: 0,
        answerRelevancy: 0,
        contextPrecision: 0,
        contextRecall: 0,
        hallucination: 1,
      };
      expect(computeCompositeScore(metrics)).toBe(0);
    });
  });

  describe("Integration Tests - LLM Judge", () => {
    it(
      "should score high faithfulness for grounded answer",
      async () => {
        if (!hasLLMKeys()) {
          console.log("[rag-metrics] No LLM API keys — skipping");
          return;
        }

        const result = await evaluateRAGMetrics({
          question: "What is the yield strength of S32205 per ASTM A790?",
          answer:
            "The minimum yield strength for S32205 duplex stainless steel pipe per ASTM A790 is 65 ksi (450 MPa) [1].",
          contexts: [
            "Table 3 - Mechanical Requirements: UNS S32205 — Minimum yield strength: 65 ksi [450 MPa], Minimum tensile strength: 90 ksi [620 MPa], Minimum elongation: 25%.",
          ],
        });

        console.log("Faithfulness test:", {
          score: result.faithfulness,
          claims: result.details.faithfulness.claims,
        });

        expect(result.faithfulness).toBeGreaterThan(0.7);
        expect(result.hallucination).toBeLessThan(0.3);
      },
      30000
    );

    it(
      "should score low faithfulness for hallucinated answer",
      async () => {
        if (!hasLLMKeys()) {
          console.log("[rag-metrics] No LLM API keys — skipping");
          return;
        }

        const result = await evaluateRAGMetrics({
          question: "What is the yield strength of S32205 per ASTM A790?",
          answer:
            "The yield strength is 100 ksi per the latest revision, and the price is $50/ft.",
          contexts: [
            "Table 3 - Mechanical Requirements: UNS S32205 — Minimum yield strength: 65 ksi [450 MPa].",
          ],
        });

        console.log("Hallucination test:", {
          score: result.faithfulness,
          claims: result.details.faithfulness.claims,
        });

        expect(result.faithfulness).toBeLessThan(0.5);
        expect(result.hallucination).toBeGreaterThan(0.5);
      },
      30000
    );

    it(
      "should evaluate context precision",
      async () => {
        if (!hasLLMKeys()) {
          console.log("[rag-metrics] No LLM API keys — skipping");
          return;
        }

        const result = await evaluateRAGMetrics({
          question: "What is the yield strength of S32205?",
          answer: "65 ksi [1]",
          contexts: [
            "Table 3 - UNS S32205: Yield strength 65 ksi [450 MPa]",
            "The weather in Pittsburgh today is sunny with a high of 72F",
            "Section 6 - Heat Treatment: Solution anneal at 1900-2100°F",
          ],
        });

        console.log("Context precision:", {
          score: result.contextPrecision,
          perChunk: result.details.contextPrecision.relevancePerChunk,
        });

        // First chunk relevant, second irrelevant, third partially
        expect(result.contextPrecision).toBeGreaterThan(0.3);
        expect(result.contextPrecision).toBeLessThan(1.0);
      },
      30000
    );

    it(
      "should evaluate context recall with ground truth",
      async () => {
        if (!hasLLMKeys()) {
          console.log("[rag-metrics] No LLM API keys — skipping");
          return;
        }

        const result = await evaluateRAGMetrics({
          question: "What is the yield strength of S32205 per A790?",
          answer: "The yield strength is 65 ksi [450 MPa] [1].",
          contexts: [
            "Table 3 - UNS S32205: Yield strength 65 ksi [450 MPa], Tensile 90 ksi [620 MPa]",
          ],
          groundTruth:
            "The minimum yield strength of S32205 per ASTM A790 is 65 ksi [450 MPa].",
        });

        console.log("Context recall:", {
          score: result.contextRecall,
          statements: result.details.contextRecall?.coveredStatements,
        });

        expect(result.contextRecall).toBeGreaterThan(0.7);
      },
      30000
    );

    it(
      "should evaluate full RAG pipeline response",
      async () => {
        if (!hasLLMKeys()) {
          console.log("[rag-metrics] No LLM API keys — skipping");
          return;
        }
        const serverUp = await isServerAvailable();
        if (!serverUp) {
          console.log("[rag-metrics] Server not available — skipping pipeline test");
          return;
        }

        const response = await fetch(`${BASE_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "What is the yield strength of S32205?",
            stream: false,
          }),
        });

        if (!response.ok) {
          console.log("Skipping: API returned", response.status);
          return;
        }

        const data = await response.json();

        const metrics = await evaluateRAGMetrics({
          question: "What is the yield strength of S32205?",
          answer: data.response,
          contexts: data.sources.map(
            (s: { content_preview: string }) => s.content_preview
          ),
          groundTruth:
            "The minimum yield strength of S32205 is 65 ksi [450 MPa].",
        });

        const composite = computeCompositeScore(metrics);

        console.log("\n=== Full RAG Pipeline Evaluation ===");
        console.log("Faithfulness:", metrics.faithfulness.toFixed(2));
        console.log("Answer Relevancy:", metrics.answerRelevancy.toFixed(2));
        console.log("Context Precision:", metrics.contextPrecision.toFixed(2));
        console.log(
          "Context Recall:",
          metrics.contextRecall?.toFixed(2) ?? "N/A"
        );
        console.log("Hallucination:", metrics.hallucination.toFixed(2));
        console.log("Composite Score:", composite.toFixed(2));

        expect(metrics.faithfulness).toBeGreaterThan(0.5);
        expect(metrics.answerRelevancy).toBeGreaterThan(0.5);
        expect(composite).toBeGreaterThan(0.5);
      },
      60000
    );
  });
});
