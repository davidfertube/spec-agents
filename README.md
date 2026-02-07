# SpecVault

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://github.com/davidfertube/specvault/actions/workflows/test.yml/badge.svg)](https://github.com/davidfertube/specvault/actions/workflows/test.yml)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com/new/clone?repository-url=https://github.com/davidfertube/specvault)

**Agentic RAG for O&G materials compliance.** Upload steel specifications (ASTM, API, NACE), ask technical questions, get cited answers with zero hallucinations. Self-correcting pipeline with answer grounding, false refusal detection, and confidence scoring.

[Live Demo](https://specvault.app) · [Agentic Pipeline](AGENTS.md) · [Developer Docs](CLAUDE.md) · [Contributing](CONTRIBUTING.md)

---

## Performance

Evaluated against 80 golden queries across 8 ASTM/API documents (Claude Sonnet 4.5):

| Metric | Result |
|--------|--------|
| **Overall Accuracy** | 91.3% (73/80) |
| **Source Citation** | 96.3% (77/80) |
| **Hallucination Rate** | ~0% |
| **P50 / P95 Latency** | 13.0s / 24.2s |
| **Post-Improvement Accuracy** | 100% (10/10) |
| **Production Smoke Test** | 8/8 (100%) |
| **Unit Tests** | 113/113, 0 skipped |

Complex multi-hop queries (comparisons, multi-part) score **96.9%** — higher than single-lookup queries. Post-improvement 10-query test (covering cross-spec comparison, API 5CT, all major ASTM specs) achieves 100%.

---

## Architecture

### Agentic RAG Pipeline (7 Stages)

```mermaid
graph LR
    A[User Query] --> B[Query Analysis]
    B --> C[Decomposition]
    C --> D[Hybrid Search]
    D --> E[LLM Re-ranking]
    E --> F[Generation]
    F --> G[Verification Agents]
    G --> H[Confidence Gate]
    H --> I[Cited Response]

    style A fill:#1a1a2e,color:#fff
    style I fill:#16213e,color:#fff
```

The pipeline self-corrects through three post-generation agents:

| Agent | Method | Purpose |
|-------|--------|---------|
| **Answer Grounding** | Regex | Verify numerical claims against source chunks |
| **Refusal Detection** | Pattern matching | Catch false "I cannot answer" responses |
| **Partial Refusal Detection** | Pattern matching | Catch hedged "limited information" responses |
| **Coherence Validation** | LLM judge | Ensure response addresses the question |

All agents share a regeneration budget (max 3 attempts). A confidence gate (`retrieval 35% + grounding 25% + coherence 40%`) triggers a final regeneration if the score drops below 55%.

Full pipeline documentation: **[AGENTS.md](AGENTS.md)**

### Document Ingestion

```mermaid
graph LR
    A[PDF Upload] --> B[Text Extraction]
    B --> C[Semantic Chunking]
    C --> D[Embedding]
    D --> E[pgvector Storage]

    style A fill:#1a1a2e,color:#fff
    style E fill:#16213e,color:#fff
```

### Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **LLM** | Claude Sonnet 4.5 | Best accuracy for technical docs, low hallucination |
| **LLM Fallback** | Groq → Cerebras → SambaNova → OpenRouter | Auto-failover on rate limits via `model-fallback.ts` |
| **Embeddings** | Voyage AI voyage-3-lite (1024-dim) | 200M tokens/month free |
| **Vector DB** | Supabase pgvector (HNSW) | PostgreSQL-native vectors + metadata + RLS |
| **Framework** | Next.js 16, React 19, TypeScript | API routes eliminate separate backend |
| **Hosting** | Vercel | Serverless, scales to zero |

---

## Engineering Highlights

**Self-Correcting Pipeline.** Post-generation agents detect hallucinated numbers, false refusals, and incoherent responses. Each verification step can trigger targeted regeneration with specific guidance. The system catches errors that would pass through a naive retrieve-and-generate pipeline.

**Cross-Spec Contamination Prevention.** A789 and A790 share most of their content but have different mechanical properties for the same UNS designations. `document-mapper.ts` resolves ASTM/API codes to specific document IDs. Content-level dedup is scoped per-document, not globally.

**Table-Preserving Semantic Chunking.** Variable-size chunks (1500 target, 800 min, 2500 max, 200 overlap) detect table boundaries and keep them intact. ASTM specification tables — the primary source of mechanical property data — are never split mid-row.

**Evaluation-Driven Development.** 80 golden queries with pattern-based validation. RAGAS LLM-as-judge metrics. A789/A790 confusion matrix testing. Accuracy improved from 57% → 81% → 91.3% through systematic root cause analysis.

**User Feedback Loop.** In-app thumbs up/down feedback with issue classification (false refusal, wrong data, hallucination, etc). Diagnostic script (`scripts/feedback-report.ts`) classifies root causes and generates actionable reports pointing to specific pipeline files.

**Voyage AI Cross-Encoder Re-ranking.** Voyage AI rerank-2 replaces LLM-based reranking as the primary strategy (~200ms vs 5-15s). LLM reranking available as fallback. Dynamic topK: 8 for API specs and comparisons, 5 for standard ASTM.

**Multi-Provider LLM Failover.** `model-fallback.ts` chains Anthropic → Groq → Cerebras → SambaNova → OpenRouter with progressive backoff (500ms × 2^n, cap 4s). Zero-downtime on any single provider outage.

---

## Quick Start

```bash
git clone https://github.com/davidfertube/specvault.git
cd specvault && npm install

cp .env.example .env.local
# Add: ANTHROPIC_API_KEY, VOYAGE_API_KEY,
#      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

npm run dev    # http://localhost:3000
```

### Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in SQL Editor
3. Run `supabase/migrations/002_voyage_embeddings.sql`
4. Create a `documents` storage bucket

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/davidfertube/specvault)

---

## Testing

```bash
# Unit tests (113 tests, 0 skips)
npm test

# 80-query accuracy suite (requires running dev server)
npm run test:accuracy

# Production smoke test (8 complex queries, 1 per document)
npx tsx scripts/production-smoke-test.ts

# RAGAS LLM-as-judge evaluation
npm run evaluation:rag

# A789/A790 confusion matrix
npm run test:confusion
```

Golden datasets: `tests/golden-dataset/*.json` — 8 specification files, 80+ queries with expected answers and validation patterns.

---

## Project Structure

```
app/
  api/
    chat/route.ts              # Main RAG endpoint (7-stage agentic pipeline)
    chat/compare/route.ts      # Generic LLM comparison (no RAG)
    documents/process/route.ts  # PDF extraction → chunking → embedding
    documents/upload/route.ts   # Upload confirmation
    documents/upload-url/route.ts # Signed URL for direct upload
    feedback/route.ts           # User feedback collection + retrieval
    leads/route.ts             # Lead capture
  page.tsx                     # Landing page
components/
  response-feedback.tsx        # Thumbs up/down feedback widget
  realtime-comparison.tsx      # Side-by-side RAG vs generic LLM
lib/
  multi-query-rag.ts           # Query decomposition + parallel retrieval
  hybrid-search.ts             # BM25 + vector fusion search
  reranker.ts                  # Voyage AI rerank-2 + LLM fallback (800-char window)
  query-preprocessing.ts       # Technical code extraction + adaptive weights
  semantic-chunking.ts         # Table-preserving variable-size chunking
  document-mapper.ts           # Spec code → document ID resolution
  model-fallback.ts            # Multi-provider LLM failover chain
  answer-grounding.ts          # Numerical claim verification (regex)
  response-validator.ts        # Coherence validation (LLM judge)
  retrieval-evaluator.ts       # Retrieval quality assessment
  coverage-validator.ts        # Sub-query coverage checking
  verified-generation.ts       # Alternative verified generation pipeline
  claim-verification.ts        # Claim-level verification engine
  structured-output.ts         # Structured JSON output parsing
  timeout.ts                   # Async timeout wrappers
  langfuse.ts                  # Observability + RAG pipeline tracing
  evaluation-engine.ts         # Pattern-based RAG evaluation
  rag-metrics.ts               # RAGAS-style LLM-as-judge metrics
tests/
  golden-dataset/              # 8 spec files, 80+ golden queries
  evaluation/                  # Accuracy + confusion tests
  helpers/                     # Shared test utilities
  performance/                 # Bottleneck profiling
  stress/                      # k6 load testing
scripts/
  production-smoke-test.ts     # 8-query end-to-end validation
  mvp-accuracy-test.ts         # 50-query MVP accuracy suite
  mvp-10-query-test.ts         # 10-query post-improvement validation
  feedback-report.ts           # Feedback diagnostic report
  dedup-documents.ts           # Document deduplication
supabase/
  feedback-migration.sql       # Feedback table schema
  dedup-migration.sql          # Dedup DELETE policies + cleanup
```

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | RAG query with SSE streaming → `{ response, sources, confidence }` |
| POST | `/api/chat/compare` | Generic LLM comparison (no document context) |
| POST | `/api/documents/upload` | Confirm PDF upload |
| POST | `/api/documents/upload-url` | Get signed upload URL |
| POST | `/api/documents/process` | Process PDF → extract, chunk, embed, store |
| POST | `/api/feedback` | Submit/retrieve user feedback on response quality |
| POST | `/api/leads` | Lead capture form |

---

## Roadmap

### Near-Term (Accuracy → 95%+)
- [ ] Improve retrieval quality for API 5CT, A872, A1049 (worst-performing specs)
- [ ] Upload actual API 5CT specification (only Purchasing Guidelines currently indexed)
- [ ] Add table-aware chunking (parse table headers into metadata)
- [ ] Tune confidence thresholds based on production query distribution

### Medium-Term (Production Hardening)
- [x] ~~BGE cross-encoder re-ranking~~ → Voyage AI rerank-2 (done — ~200ms, 10-50x faster than LLM)
- [x] ~~Caching layer for repeated queries~~ → Implemented but disabled (overly aggressive matching)
- [x] User feedback loop with root cause diagnostics (done — `scripts/feedback-report.ts`)
- [ ] User authentication (Clerk) + multi-tenant workspace isolation
- [ ] Query analytics dashboard (most common questions, failure patterns)

### Long-Term (Enterprise Features)
- [ ] In-app PDF viewer with citation highlighting
- [ ] REST API for workflow integration
- [ ] On-premise deployment option
- [ ] Multi-language specification support

---

## Built By

**David Fernandez** — [Portfolio](https://davidfernandez.dev) · [GitHub](https://github.com/davidfertube)

Solo build. ~25,000 lines of TypeScript across 33 library modules, 7 API routes, 17 components, and an 80-query evaluation suite. Features a 7-stage agentic RAG pipeline with self-correction, achieving 91.3% accuracy with zero hallucinations.

---

## License

[MIT](LICENSE)
