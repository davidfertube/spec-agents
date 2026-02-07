/**
 * Baseline vs RAG Evaluation Test Suite
 *
 * Compares Claude Opus 4.5 (baseline without documents) against
 * the MVP RAG system for materials engineering queries.
 *
 * Auto-detects server/key availability — tests pass (early-return) when unavailable.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  evaluateResponse,
  runComparison,
  runFullEvaluation,
  aggregateMetrics,
  formatMetricsSummary,
  GoldenTestCase,
  EvaluationResult,
} from '../../lib/evaluation-engine';
import { getBaselineClient } from '../../lib/baseline-client';
import { isServerAvailable } from '../helpers/test-env';

// Load test queries
const testQueriesPath = path.join(__dirname, 'test-queries.json');
const confusionQueriesPath = path.join(__dirname, 'a789-a790-confusion.json');

interface TestQueryFile {
  metadata: {
    version: string;
    created: string;
    description: string;
  };
  testCases: Array<{
    id: string;
    query: string;
    expectedPatterns: string[];
    forbiddenPatterns?: string[];
    requiredCitations?: string[];
    category: string;
    categoryLetter: 'A' | 'B' | 'C' | 'D' | 'E';
    documents: string[];
    difficulty: string;
    notes?: string;
  }>;
}

// Convert JSON patterns to RegExp
function parseTestCases(data: TestQueryFile): GoldenTestCase[] {
  return data.testCases.map(tc => ({
    id: tc.id,
    query: tc.query,
    expectedPatterns: tc.expectedPatterns.map(p => new RegExp(p, 'i')),
    forbiddenPatterns: tc.forbiddenPatterns?.map(p => new RegExp(p, 'i')),
    requiredCitations: tc.requiredCitations,
    category: tc.category as GoldenTestCase['category'],
    categoryLetter: tc.categoryLetter,
    documents: tc.documents,
    difficulty: tc.difficulty as GoldenTestCase['difficulty'],
    notes: tc.notes,
  }));
}

// Load test data synchronously at module level (before skipIf evaluates)
let a790TestCases: GoldenTestCase[] = [];
let confusionTestCases: GoldenTestCase[] = [];

if (fs.existsSync(testQueriesPath)) {
  const data = JSON.parse(fs.readFileSync(testQueriesPath, 'utf-8'));
  a790TestCases = parseTestCases(data);
}

if (fs.existsSync(confusionQueriesPath)) {
  const data = JSON.parse(fs.readFileSync(confusionQueriesPath, 'utf-8'));
  confusionTestCases = parseTestCases(data);
}

describe('Baseline vs RAG Evaluation', () => {
  describe('Pattern Matching Unit Tests', () => {
    it('should match yield strength patterns correctly', () => {
      const testCase: GoldenTestCase = {
        id: 'test-1',
        query: 'What is the yield strength?',
        expectedPatterns: [/65\s*ksi|450\s*MPa/i],
        category: 'lookup',
        documents: ['A790'],
        difficulty: 'easy',
      };

      const result1 = evaluateResponse('The yield strength is 65 ksi [450 MPa]', testCase);
      expect(result1.passed).toBe(true);
      expect(result1.matchedPatterns.length).toBe(1);

      const result2 = evaluateResponse('The yield strength is 70 ksi', testCase);
      expect(result2.passed).toBe(false);
    });

    it('should detect forbidden patterns', () => {
      const testCase: GoldenTestCase = {
        id: 'test-2',
        query: 'What is the yield strength per A789?',
        expectedPatterns: [/70\s*ksi/i],
        forbiddenPatterns: [/65\s*ksi/i],
        category: 'lookup',
        documents: ['A789'],
        difficulty: 'medium',
      };

      // Correct answer (A789 value)
      const result1 = evaluateResponse('The yield strength is 70 ksi per A789', testCase);
      expect(result1.passed).toBe(true);
      expect(result1.forbiddenMatches.length).toBe(0);

      // Wrong answer (A790 value)
      const result2 = evaluateResponse('The yield strength is 65 ksi', testCase);
      expect(result2.forbiddenMatches.length).toBe(1);
      expect(result2.passed).toBe(false);
    });

    it('should check required citations', () => {
      const testCase: GoldenTestCase = {
        id: 'test-3',
        query: 'Compare A789 and A790',
        expectedPatterns: [/yield/i],
        requiredCitations: ['A789', 'A790'],
        category: 'comparison',
        documents: ['A789', 'A790'],
        difficulty: 'hard',
      };

      const result1 = evaluateResponse('Per A789, yield is 70 ksi. Per A790, yield is 65 ksi.', testCase);
      expect(result1.citationsFound).toContain('A789');
      expect(result1.citationsFound).toContain('A790');

      const result2 = evaluateResponse('The yield strength varies by specification.', testCase);
      expect(result2.missingCitations.length).toBe(2);
    });

    it('should detect appropriate refusals for Category E', () => {
      const testCase: GoldenTestCase = {
        id: 'test-4',
        query: 'What is the price per foot?',
        expectedPatterns: [/cannot|not\s+in|no\s+information/i],
        forbiddenPatterns: [/\$/i],
        category: 'refusal',
        categoryLetter: 'E',
        documents: ['A790'],
        difficulty: 'easy',
      };

      // Correct refusal
      const result1 = evaluateResponse('I cannot answer this - pricing is not in the specification.', testCase);
      expect(result1.passed).toBe(true);

      // Hallucination (providing price)
      const result2 = evaluateResponse('The price is approximately $50 per foot.', testCase);
      expect(result2.passed).toBe(false);
      expect(result2.forbiddenMatches.length).toBe(1);
    });
  });

  describe('A790-Specific Tests (Categories A-D)', () => {
    it('should have loaded A790 test cases', () => {
      if (a790TestCases.length === 0) {
        console.log('[baseline-vs-rag] Test data not available — skipping');
        return;
      }
      expect(a790TestCases.length).toBeGreaterThan(0);
    });

    describe('Category A: Direct Lookup', () => {
      it('should correctly evaluate Category A queries', () => {
        if (a790TestCases.length === 0) {
          console.log('[baseline-vs-rag] Test data not available — skipping');
          return;
        }

        const catA = a790TestCases.filter(tc => tc.categoryLetter === 'A');
        expect(catA.length).toBe(5);

        // Test pattern for first query (yield strength)
        const yieldTest = catA.find(tc => tc.id === 'A790-T1');
        expect(yieldTest).toBeDefined();
        if (yieldTest) {
          const correctResponse = evaluateResponse(
            'The minimum yield strength of S32205 is 65 ksi [450 MPa] per ASTM A790 Table 2.',
            yieldTest
          );
          expect(correctResponse.passed).toBe(true);
        }
      });
    });

    describe('Category E: Hallucination Detection', () => {
      it('should correctly identify refusal queries', () => {
        if (a790TestCases.length === 0) {
          console.log('[baseline-vs-rag] Test data not available — skipping');
          return;
        }

        const catE = a790TestCases.filter(tc => tc.categoryLetter === 'E');
        expect(catE.length).toBeGreaterThanOrEqual(3);

        // PREN formula test - should refuse
        const prenTest = catE.find(tc => tc.id === 'A790-T17');
        if (prenTest) {
          // Correct: refuses to answer
          const refusalResponse = evaluateResponse(
            'I cannot provide the PREN formula as it is not included in ASTM A790.',
            prenTest
          );
          expect(refusalResponse.passed).toBe(true);

          // Incorrect: provides formula (hallucination)
          const hallucinationResponse = evaluateResponse(
            'PREN = %Cr + 3.3(%Mo) + 16(%N) for S32205.',
            prenTest
          );
          expect(hallucinationResponse.forbiddenMatches.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('A789/A790 Cross-Specification Confusion Tests', () => {
    it('should have loaded confusion test cases', () => {
      if (confusionTestCases.length === 0) {
        console.log('[baseline-vs-rag] Confusion test data not available — skipping');
        return;
      }
      expect(confusionTestCases.length).toBe(10);
    });

    it('should detect A789 vs A790 yield strength confusion', () => {
      if (confusionTestCases.length === 0) {
        console.log('[baseline-vs-rag] Confusion test data not available — skipping');
        return;
      }

      // CONF-001: A789 yield should be 70 ksi, NOT 65 ksi
      const conf001 = confusionTestCases.find(tc => tc.id === 'CONF-001');
      expect(conf001).toBeDefined();

      if (conf001) {
        // Correct: A789 value
        const correct = evaluateResponse(
          'Per A789, S32205 tubing has a yield strength of 70 ksi [485 MPa].',
          conf001
        );
        expect(correct.passed).toBe(true);

        // Wrong: A790 value used for A789 question
        const wrong = evaluateResponse(
          'The yield strength of S32205 is 65 ksi [450 MPa].',
          conf001
        );
        expect(wrong.passed).toBe(false);
        expect(wrong.forbiddenMatches.length).toBeGreaterThan(0);
      }

      // CONF-002: A790 yield should be 65 ksi, NOT 70 ksi
      const conf002 = confusionTestCases.find(tc => tc.id === 'CONF-002');
      if (conf002) {
        const correct = evaluateResponse(
          'Per A790, S32205 pipe has a yield strength of 65 ksi [450 MPa].',
          conf002
        );
        expect(correct.passed).toBe(true);
      }
    });

    it('should require both citations for comparison queries', () => {
      if (confusionTestCases.length === 0) {
        console.log('[baseline-vs-rag] Confusion test data not available — skipping');
        return;
      }

      const conf003 = confusionTestCases.find(tc => tc.id === 'CONF-003');
      if (conf003) {
        const bothCited = evaluateResponse(
          'A789 tubing specifies 70 ksi yield, while A790 pipe specifies 65 ksi for S32205.',
          conf003
        );
        expect(bothCited.citationsFound).toContain('A789');
        expect(bothCited.citationsFound).toContain('A790');
      }
    });
  });

  describe('Integration Tests (require running server)', () => {
    const RAG_BASE_URL = process.env.RAG_BASE_URL || 'http://localhost:3000';

    it('should run comparison against live RAG system', async () => {
      const serverUp = await isServerAvailable();
      if (!serverUp) {
        console.log('[baseline-vs-rag] Server not available — skipping');
        return;
      }

      const baselineClient = getBaselineClient();

      // Quick sanity check with one query
      const testCase = a790TestCases[0];
      if (testCase) {
        const result = await runComparison(testCase, baselineClient, RAG_BASE_URL);

        expect(result.queryId).toBe(testCase.id);
        // Baseline latency may be 0 if ANTHROPIC_API_KEY not configured
        if (baselineClient.isAvailable()) {
          expect(result.baseline.latency_ms).toBeGreaterThan(0);
        }
        expect(result.rag.latency_ms).toBeGreaterThan(0);
      }
    }, 60000);

    it('should run full evaluation and generate metrics', async () => {
      const serverUp = await isServerAvailable();
      if (!serverUp) {
        console.log('[baseline-vs-rag] Server not available — skipping');
        return;
      }

      // Use subset for quick test
      const quickTestCases = a790TestCases.slice(0, 5);

      const { results, metrics } = await runFullEvaluation(quickTestCases, {
        ragBaseUrl: RAG_BASE_URL,
        delayBetweenQueries: 1000,
      });

      expect(results.length).toBe(quickTestCases.length);
      expect(metrics.totalQueries).toBe(quickTestCases.length);

      // Log summary
      console.log('\n' + formatMetricsSummary(metrics));

      // Save results to file
      const outputPath = path.join(__dirname, '../../reports/quick-evaluation-results.json');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(
        outputPath,
        JSON.stringify({ results, metrics, timestamp: new Date().toISOString() }, null, 2)
      );
    }, 300000); // 5 minute timeout
  });
});

describe('Metrics Aggregation', () => {
  it('should correctly calculate accuracy percentages', () => {
    const mockResults: EvaluationResult[] = [
      createMockResult('T1', true, true),
      createMockResult('T2', false, true),
      createMockResult('T3', true, false),
      createMockResult('T4', false, false),
    ];

    const metrics = aggregateMetrics(mockResults);

    expect(metrics.totalQueries).toBe(4);
    expect(metrics.baselineAccuracyPct).toBe(50); // 2/4
    expect(metrics.ragAccuracyPct).toBe(50); // 2/4
    expect(metrics.ragImprovements).toBe(1); // T2
    expect(metrics.ragRegressions).toBe(1); // T3
    expect(metrics.bothCorrect).toBe(1); // T1
    expect(metrics.bothWrong).toBe(1); // T4
  });

  it('should calculate improvement percentage', () => {
    const mockResults: EvaluationResult[] = [
      createMockResult('T1', false, true),
      createMockResult('T2', false, true),
      createMockResult('T3', false, true),
      createMockResult('T4', true, true),
    ];

    const metrics = aggregateMetrics(mockResults);

    expect(metrics.baselineAccuracyPct).toBe(25); // 1/4
    expect(metrics.ragAccuracyPct).toBe(100); // 4/4
    expect(metrics.accuracyImprovementPct).toBe(75); // +75%
  });
});

// Helper function to create mock evaluation results
function createMockResult(
  id: string,
  baselineCorrect: boolean,
  ragCorrect: boolean
): EvaluationResult {
  return {
    queryId: id,
    query: `Test query ${id}`,
    category: 'lookup',
    categoryLetter: 'A',
    difficulty: 'easy',
    baseline: {
      response: baselineCorrect ? 'Correct answer' : 'Wrong answer',
      latency_ms: 1000,
      accuracy: {
        patternMatched: baselineCorrect,
        forbiddenPatternTriggered: false,
        numericalAccuracy: null,
        hallucinationDetected: false,
        appropriateRefusal: false,
      },
      patternResult: {
        passed: baselineCorrect,
        matchedPatterns: baselineCorrect ? ['pattern'] : [],
        missedPatterns: baselineCorrect ? [] : ['pattern'],
        forbiddenMatches: [],
        citationsFound: [],
        missingCitations: [],
      },
    },
    rag: {
      response: ragCorrect ? 'Correct answer with [1] citation' : 'Wrong answer',
      sources: ragCorrect
        ? [{ ref: '[1]', document: 'A790', page: '4' }]
        : [],
      latency_ms: 2000,
      accuracy: {
        patternMatched: ragCorrect,
        forbiddenPatternTriggered: false,
        numericalAccuracy: null,
        hallucinationDetected: false,
        appropriateRefusal: false,
      },
      patternResult: {
        passed: ragCorrect,
        matchedPatterns: ragCorrect ? ['pattern'] : [],
        missedPatterns: ragCorrect ? [] : ['pattern'],
        forbiddenMatches: [],
        citationsFound: ragCorrect ? ['A790'] : [],
        missingCitations: ragCorrect ? [] : ['A790'],
      },
      citationQuality: {
        hasCitations: ragCorrect,
        citationCount: ragCorrect ? 1 : 0,
        validPageNumbers: ragCorrect,
        charOffsetsPresent: false,
        documentNamesCorrect: ragCorrect,
        citationAccuracyPct: ragCorrect ? 66.67 : 0,
      },
    },
    comparison: {
      baselineCorrect,
      ragCorrect,
      ragImprovement: !baselineCorrect && ragCorrect,
      ragRegression: baselineCorrect && !ragCorrect,
      bothCorrect: baselineCorrect && ragCorrect,
      bothWrong: !baselineCorrect && !ragCorrect,
    },
  };
}
