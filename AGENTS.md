# Agentic RAG Pipeline — SpecVault

SpecVault uses a **7-stage agentic pipeline** that goes beyond basic retrieve-and-generate. The system self-corrects through retrieval evaluation, answer grounding, false refusal detection, coherence validation, and confidence-gated regeneration.

---

## Pipeline Overview

```
User Query
  │
  ├─ 1. Query Analysis         (regex, ~1ms)
  ├─ 2. Query Decomposition     (LLM, ~2s for complex queries)
  ├─ 3. Hybrid Search           (BM25 + vector, ~3s)
  ├─ 4. Re-ranking               (Voyage AI rerank-2, ~200ms)
  ├─ 5. Generation              (Claude Sonnet 4.5, ~10s)
  ├─ 6. Post-Generation Agents  (grounding + refusal + coherence, ~5s)
  └─ 7. Confidence Gate         (score → return or regenerate)
       │
       └─ Cited Response + Confidence Score
```

---

## Stage 1: Query Analysis

**File:** `lib/query-preprocessing.ts`

Extracts technical identifiers from the user's question:
- UNS codes (S32205, S32750)
- ASTM specs (A790, A789, A312)
- API specs (5CT, 6A, 16C)
- Grades (316L, 2205, 2507)

Sets adaptive BM25/vector search weights:
- Queries with exact codes → higher keyword weight (0.6 BM25)
- Natural language queries → higher semantic weight (0.7 vector)

**File:** `lib/query-enhancement.ts`

Adds document-specific keywords and table hints to improve retrieval. Runs before search, invisible to the user.

---

## Stage 2: Query Decomposition

**File:** `lib/query-decomposition.ts`, `lib/multi-query-rag.ts`

Complex queries are decomposed into parallel sub-queries via LLM. Simple queries skip this step entirely (fast path).

Example:
```
"Compare A789 vs A790 yield strength for S32205"
  → Sub-query 1: "A789 S32205 yield strength"
  → Sub-query 2: "A790 S32205 yield strength"
```

After parallel retrieval, results are merged and deduplicated by chunk ID.

**Coverage validation** (`lib/coverage-validator.ts`) checks that all sub-queries contributed chunks. If a sub-query returned zero results, it flags the gap for potential retry with a broader search.

---

## Stage 3: Hybrid Search

**File:** `lib/hybrid-search.ts`

Runs BM25 keyword search and vector similarity search in parallel, then fuses results with adaptive weighting.

**Document filtering** (`lib/document-mapper.ts`) restricts search to the correct specification. This prevents cross-contamination — critical because A789 (tubing) and A790 (pipe) have different yield strengths for the same UNS designation (70 ksi vs 65 ksi for S32205).

Table content gets a +0.15 score boost since ASTM specifications store most data in tables.

---

## Stage 4: Re-ranking (Voyage AI + LLM Fallback)

**File:** `lib/reranker.ts`

Two-tier re-ranking strategy:

1. **Primary: Voyage AI rerank-2** — Dedicated cross-encoder model (~200ms for 40 documents). 10-50x faster than LLM reranking with better consistency.
2. **Fallback: LLM-based scoring** — Claude/Llama scores chunks on a 0-10 relevance scale (5-15s). Used only when Voyage API is unavailable.

Dynamic topK based on query type:
- **API specifications** (6A, 5CT, 16C): topK = 8 (large specs need more coverage)
- **Comparison queries** (2+ ASTM codes): topK = 8
- **Standard ASTM queries**: topK = 5

Chunks truncated to 800-1000 characters for scoring — wide enough to preserve 6-8 table rows (header + data) in ASTM specification tables. Sub-query aware: chunks scored against the specific sub-query that retrieved them.

---

## Stage 5: Generation

**File:** `app/api/chat/route.ts`

Claude Sonnet 4.5 with a Chain-of-Thought system prompt. The prompt includes:
- Role definition (materials engineer assistant)
- 5-step reasoning framework (SCAN → SEARCH → VERIFY → CITE → RESPOND)
- Specification-specific knowledge (A790 = pipe, A789 = tubing, etc.)
- Table extraction guidance
- Hardness scale rules (only report what's in the document)
- Formula guard (refuses if formula not found in context)

SSE streaming with 3-second heartbeat keeps connections alive past Vercel's 10-second hobby tier timeout.

---

## Stage 6: Post-Generation Agents

Three independent verification agents run after generation, sharing a regeneration budget of `MAX_REGENS = 3`:

### C1: Answer Grounding

**File:** `lib/answer-grounding.ts`

Pure regex — no LLM call. Extracts numerical values with units (MPa, ksi, HRC, %) from the response and verifies each exists in at least one source chunk (0.01 tolerance).

If grounding fails (score < 50%), the response is regenerated with a prefix instructing the LLM to only quote values that appear exactly in the context.

### C1.5: False Refusal Detection

**File:** `app/api/chat/route.ts` (inline)

Pattern-based detection of false refusals — when the LLM says "I cannot answer" despite having relevant chunks. Uses 10 regex patterns covering common refusal phrasings.

Context-aware triggering: only fires when chunks have meaningful relevance (BM25 keyword match or combined score > 0.3). This avoids wasting regen budget on queries where the model correctly identified irrelevant context.

If a false refusal is detected and chunks exist, up to 2 anti-refusal regeneration attempts are made. Each attempt includes a chunk summary showing the LLM what data is available.

### C1.75: Partial Refusal Detection

**File:** `app/api/chat/route.ts` (inline)

Detects hedged responses like "I cannot provide a complete answer" or "the information is limited" where the model provides some data but unnecessarily downgrades confidence. Uses 5 regex patterns.

When triggered, regenerates with a data-first prompt that instructs the model to lead with the available data and only add a brief caveat at the end if needed.

### C2: Response Coherence

**File:** `lib/response-validator.ts`

LLM-as-judge call to assess whether the response actually answers the user's question. Returns a coherence score (0-100) and identifies missing aspects.

If coherence is low (< 50), the response is regenerated with guidance about what was missed. Fails open on timeout — the pipeline is never blocked by a coherence check failure.

---

## Stage 7: Confidence Gate

**File:** `app/api/chat/route.ts`

Computes an overall confidence score from three weighted components:

```
overall = retrieval (35%) + grounding (25%) + coherence (40%)
```

| Component | Source | Weight |
|-----------|--------|--------|
| Retrieval confidence | `lib/retrieval-evaluator.ts` (LLM judge) | 35% |
| Grounding score | `lib/answer-grounding.ts` (regex) | 25% |
| Coherence score | `lib/response-validator.ts` (LLM judge) | 40% |

Coherence has the highest weight because it directly measures whether the response answers the question. Grounding was reduced from 40% → 25% since regex-based grounding can be overly strict on natural-language responses that paraphrase rather than quote verbatim.

If overall confidence drops below 55% and the regeneration budget hasn't been exhausted, one final regeneration attempt is made with targeted guidance based on the weakest component.

The confidence score is returned to the frontend in the API response.

---

## Retrieval Evaluation (Agentic Feedback Loop)

**File:** `lib/retrieval-evaluator.ts`

Before generation, an LLM call evaluates whether the retrieved chunks can actually answer the query. If confidence is low, it suggests a retry strategy:
- `broader_search` — widen search parameters
- `section_lookup` — target specific document sections
- `more_candidates` — retrieve more candidates for re-ranking

This evaluation feeds into the overall confidence score and drives the retry loop in `lib/multi-query-rag.ts`.

---

## Verified Generation Pipeline (Alternative Path)

**File:** `lib/verified-generation.ts`

An alternative pipeline activated via `{ verified: true }` in the API request. Uses structured JSON output with per-claim source references and exact quotes.

Each claim is verified against source chunks via `lib/claim-verification.ts`:
- Fuzzy text matching for quotes
- Exact matching for numerical values
- Guardrail enforcement (return / regenerate / refuse)

Not used in the default path due to higher latency, but available for high-stakes queries.

---

## Multi-Provider LLM Fallback

**File:** `lib/model-fallback.ts`

All LLM calls go through `ModelFallbackClient`, which chains providers:

1. **Anthropic** — Claude Sonnet 4.5 (primary), Claude Haiku 4.5 (fast fallback)
2. **Groq** — Llama 3.3 70B (free tier)
3. **Cerebras** — Llama 3.3 70B (free tier)
4. **SambaNova** — Llama 3.3 70B (free tier)
5. **OpenRouter** — Llama 3.3 70B (paid, then free)

Progressive backoff on rate limits: `500ms × 2^n`, capped at 4 seconds. Model-not-found errors skip immediately without backoff.

---

## Timeout Architecture

**File:** `lib/timeout.ts`

Every async operation is wrapped with `withTimeout()`. Calibrated timeouts:

| Operation | Timeout | Rationale |
|-----------|---------|-----------|
| LLM generation | 45s | Claude can take 10-30s for long prompts |
| Vector search | 15s | Supabase pgvector + network latency |
| Re-ranking | 20s | Accuracy-critical, worth the wait |
| Multi-query RAG | 60s | Full pipeline including cross-spec comparisons |
| Coherence validation | 12s | LLM judge call with context |
| Retrieval evaluation | 8s | Fast-fail, non-critical |
| Embedding | 10s | Single Voyage AI call |
| Database query | 5s | Simple Supabase queries |
| File upload | 60s | Large PDFs (50MB) |

---

## Observability

**File:** `lib/langfuse.ts`

LangFuse tracing is opt-in (requires `LANGFUSE_SECRET_KEY`). Traces the full pipeline:
- Query preprocessing
- Multi-query RAG (decomposition + search + re-ranking)
- LLM generation (model used, prompt length, response length)
- Post-generation verification (grounding, coherence, regen count)
- Final confidence scores

Each trace captures the full query lifecycle for debugging and optimization.

---

## User Feedback Loop

**Files:** `app/api/feedback/route.ts`, `components/response-feedback.tsx`, `scripts/feedback-report.ts`

End-to-end system for collecting and analyzing user feedback on response quality:

1. **UI Widget** — After each response, users see thumbs up/down/partial buttons. Negative feedback expands to show issue type (false refusal, wrong data, missing info, wrong source, hallucination, other) and an optional comment.
2. **API** — `POST /api/feedback` stores the query, response, sources, confidence scores, rating, issue type, and comment in Supabase.
3. **Diagnostic Script** — `scripts/feedback-report.ts` reads feedback, classifies root causes (e.g., `FALSE_REFUSAL`, `WRONG_SOURCE`, `HALLUCINATION`, `LOW_CONFIDENCE`), and produces an actionable report pointing to specific files to fix.

This closes the feedback loop: users flag problems → diagnostic script identifies root cause → developer fixes the pipeline → re-tests with `scripts/mvp-10-query-test.ts`.

---

## Document Deduplication

**Files:** `scripts/dedup-documents.ts`, `supabase/dedup-migration.sql`

The same specification can be uploaded multiple times, creating duplicate documents with identical chunks. This causes search noise (same content returned from multiple document IDs) and inflated result counts.

- `scripts/dedup-documents.ts` — Groups documents by normalized filename, keeps the copy with the most chunks (tie-break: newest), reports duplicates. Supports `--apply` for deletion.
- `supabase/dedup-migration.sql` — Direct SQL for Supabase SQL Editor (bypasses RLS restrictions on anonymous DELETE).
