# SpecVault

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://github.com/davidfertube/specvault/actions/workflows/test.yml/badge.svg)](https://github.com/davidfertube/specvault/actions/workflows/test.yml)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com/new/clone?repository-url=https://github.com/davidfertube/specvault)

**Production-grade RAG system for O&G materials compliance.** Upload steel specifications (ASTM, API, NACE), ask technical questions, get cited answers with zero hallucinations.

[Live Demo](https://specvault.app) · [Developer Docs](CLAUDE.md) · [Contributing](CONTRIBUTING.md)

---

## Performance

Evaluated against 80 golden queries across 8 ASTM/API documents:

| Metric | Result |
|--------|--------|
| **Overall Accuracy** | 91.3% (73/80) |
| **Source Citation** | 96.3% (77/80) |
| **Hallucination Rate** | ~0% |
| **P50 / P95 Latency** | 13.0s / 24.2s |
| **Infrastructure Cost** | ~$0/month (free tiers + low-volume API) |

Complex multi-hop queries (comparisons, multi-part) score **96.9%** — higher than single-lookup queries.

---

## Architecture

### Query Pipeline

```mermaid
graph LR
    A[User Query] --> B[Query Analysis]
    B --> C[Multi-Query RAG]
    C --> D[Hybrid Search]
    D --> E[LLM Re-ranking]
    E --> F[Generation]
    F --> G[Cited Response]

    style A fill:#1a1a2e,color:#fff
    style G fill:#16213e,color:#fff
```

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
| **LLM** | Claude Sonnet 4.5 | Primary generation + CoT prompting via Anthropic API |
| **LLM Fallback** | Groq → Cerebras → OpenRouter | Auto-failover on rate limits via `model-fallback.ts` |
| **Embeddings** | Voyage AI voyage-3-lite (1024-dim) | 200M tokens/month free, 1000+ RPM |
| **Vector DB** | Supabase pgvector (HNSW) | PostgreSQL-native vectors + metadata + RLS in one DB |
| **Framework** | Next.js 16, React 19, TypeScript | API routes eliminate separate backend |
| **Hosting** | Vercel | Serverless, scales to zero |

---

## 5-Stage RAG Pipeline

### 1. Query Analysis
Extracts technical identifiers (UNS codes like `S32205`, ASTM specs like `A790`, API specs like `5CT`, grades like `316L`) and sets adaptive BM25/vector search weights. Queries with exact codes get higher keyword weight (0.6 BM25); natural language queries lean semantic (0.7 vector).

**Key file:** `lib/query-preprocessing.ts`

### 2. Multi-Query Decomposition
Complex queries are decomposed into parallel sub-queries. *"Compare A789 vs A790 yield strength for S32205"* becomes two independent lookups merged after retrieval. Simple queries skip decomposition entirely (fast path).

**Key file:** `lib/multi-query-rag.ts`

### 3. Hybrid Search
BM25 keyword search + vector similarity search fused with adaptive weighting. Document filtering via `document-mapper.ts` prevents cross-specification contamination — critical because A789 (tubing) and A790 (pipe) have different yield strengths for the same grade (70 ksi vs 65 ksi for S32205). Table content gets a +0.15 score boost.

**Key file:** `lib/hybrid-search.ts`

### 4. LLM Re-ranking
Top 40 candidates scored by Claude Sonnet 4.5 on a 0-10 relevance scale, reduced to top 5. Chunks truncated to 800 characters — wide enough to preserve 6-8 table rows (header + data) for ASTM specification tables. Sub-query aware: chunks are scored against the specific sub-query that retrieved them.

**Key file:** `lib/reranker.ts`

### 5. Generation
Claude Sonnet 4.5 with a strict document-only chain-of-thought prompt. SSE streaming with 3-second heartbeat keeps connections alive past Vercel's 10-second hobby tier timeout. Formula guard injects refusal instructions when formulas are requested but not found in context. Cross-document dedup is intentionally document-scoped — chunks from different specs are never merged even with 80%+ vocabulary overlap.

**Key file:** `app/api/chat/route.ts`

---

## Engineering Highlights

**Cross-Spec Contamination Prevention.** A789 and A790 share most of their content but have different mechanical properties for the same UNS designations. `document-mapper.ts` resolves ASTM/API codes to specific document IDs so queries like *"yield strength per A790"* never pull A789 data. Content-level dedup is scoped per-document, not globally.

**Table-Preserving Semantic Chunking.** Variable-size chunks (1500 target, 800 min, 2500 max, 200 overlap) detect table boundaries and keep them intact. ASTM specification tables — the primary source of mechanical property data — are never split mid-row. Each chunk carries metadata: section title, chunk type (table/text/list), and detected technical codes.

**Evaluation-Driven Development.** 80 golden queries across 8 documents with pattern-based validation. RAGAS LLM-as-judge metrics (faithfulness, relevancy). A789/A790 confusion matrix testing. Accuracy improved from 57% → 81% → 91.3% through systematic root cause analysis — the single biggest fix was widening the reranker chunk window from 400 to 800 characters so table data was visible during scoring (+4-6%).

**Multi-Provider LLM Failover.** `model-fallback.ts` chains Claude → Groq → Cerebras → OpenRouter with automatic switching on rate limit errors. Each provider uses OpenAI-compatible format. Zero-downtime on any single provider outage.

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

## Evaluation & Testing

```bash
# Unit tests
npm test

# 80-query accuracy suite (requires running dev server)
npm run test:accuracy
npm run test:accuracy:verbose

# RAGAS LLM-as-judge evaluation
npm run evaluation:rag
npm run evaluation:rag:verbose

# A789/A790 confusion matrix
npm run test:confusion

# Performance profiling
npm run test:performance
npm run test:bottleneck
```

Golden datasets: `tests/golden-dataset/*.json` — 8 specification files, 80+ queries with expected answers and validation patterns.

---

## Project Structure

```
app/
  api/
    chat/route.ts              # Main RAG endpoint (5-stage pipeline)
    chat/compare/route.ts      # Generic LLM comparison (no RAG)
    documents/process/route.ts  # PDF extraction → chunking → embedding
    documents/upload/route.ts   # Upload confirmation
    documents/upload-url/route.ts # Signed URL for direct upload
    leads/route.ts             # Lead capture
  page.tsx                     # Landing page
lib/
  multi-query-rag.ts           # Query decomposition + parallel retrieval
  hybrid-search.ts             # BM25 + vector fusion search
  reranker.ts                  # LLM-based re-ranking (800-char window)
  query-preprocessing.ts       # Technical code extraction + adaptive weights
  semantic-chunking.ts         # Table-preserving variable-size chunking
  document-mapper.ts           # Spec code → document ID resolution
  model-fallback.ts            # Multi-provider LLM failover chain
  verified-generation.ts       # Answer grounding + claim verification
  langfuse.ts                  # Observability + RAG pipeline tracing
  embeddings.ts                # Voyage AI embedding client
  embedding-cache.ts           # 1-hour query embedding cache
  evaluation-engine.ts         # Pattern-based RAG evaluation
  rag-metrics.ts               # RAGAS-style LLM-as-judge metrics
tests/
  golden-dataset/              # 8 spec files, 80+ golden queries
  evaluation/                  # Accuracy + confusion tests
  performance/                 # Bottleneck profiling
  stress/                      # k6 load testing
```

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | RAG query with SSE streaming → `{ response, sources }` |
| POST | `/api/chat/compare` | Generic LLM comparison (no document context) |
| POST | `/api/documents/upload` | Confirm PDF upload |
| POST | `/api/documents/upload-url` | Get signed upload URL |
| POST | `/api/documents/process` | Process PDF → extract, chunk, embed, store |
| POST | `/api/leads` | Lead capture form |

---

## Roadmap

- [ ] BGE cross-encoder re-ranking (replace LLM reranking — faster, no API cost)
- [ ] User authentication (Clerk) + multi-tenant workspace isolation
- [ ] In-app PDF viewer with citation highlighting
- [ ] REST API for workflow integration

---

## Built By

**David Fernandez** — [Portfolio](https://davidfernandez.dev) · [GitHub](https://github.com/davidfertube)

Solo build. ~25,000 lines of TypeScript across 33 library modules, 7 API routes, 17 components, and an 80-query evaluation suite. Accuracy improved from 57% to 91.3% through systematic root cause analysis and evaluation-driven iteration.

---

## License

[MIT](LICENSE)
