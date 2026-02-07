# CLAUDE.md - SpecVault

## Quick Reference

- **Framework**: Next.js 16, React 19, Tailwind CSS
- **LLM**: Claude Sonnet 4.5 (primary) with multi-provider fallback (Groq, Cerebras, OpenRouter)
- **Embeddings**: Voyage AI voyage-3-lite (1024 dim, 200M tokens FREE/month)
- **Database**: Supabase PostgreSQL + pgvector
- **Hosting**: Vercel (free tier)

---

## Development Workflow

```bash
# First time setup
npm install
cp .env.example .env.local    # Edit with your API keys

# Start development
npm run dev                    # http://localhost:3000
```

### Running Tests

```bash
# Unit tests (fast, no server needed)
npm test                                # All unit tests
npm run test:evaluation:unit            # Evaluation pattern tests only

# Accuracy tests (requires running dev server on localhost:3000)
npm run test:accuracy                   # 80-query suite across all 8 documents
npm run test:accuracy:verbose           # Same, with detailed per-query output

# Integration tests (requires running server + env vars)
npm run test:evaluation:quick           # 5-query smoke test
npm run test:evaluation:full            # Full evaluation suite
npm run test:confusion                  # A789/A790 cross-spec confusion matrix

# RAGAS LLM-as-judge evaluation
npm run evaluation:rag                  # Run RAGAS metrics (faithfulness, relevancy)
npm run evaluation:rag:verbose          # Same, with detailed scoring

# Performance
npm run test:performance                # Performance analysis
npm run test:bottleneck                 # Bottleneck profiling
```

### Build & Deploy

```bash
npm run build                  # Production build (catches type errors)
npm run lint                   # ESLint
git push origin main           # Auto-deploys to Vercel via GitHub Actions
```

---

## Architecture

### Accuracy Results (Feb 2026)

| Metric | Result | Target | Status |
|--------|--------|--------|--------|
| Overall accuracy | **91.3%** (73/80) | 90%+ | **Exceeded** |
| Source citation | **96.3%** (77/80) | 90%+ | **Exceeded** |
| Hallucination rate | ~0% | 0% | Maintained |
| P50 latency | 13.0s | — | Good |
| P95 latency | 24.2s | 30-60s | Within target |

Golden datasets: `tests/golden-dataset/*.json` (8 files, 80+ queries total)

### RAG Pipeline (5 stages)

1. **Query Analysis**: `query-preprocessing.ts` extracts UNS/ASTM/API codes, `query-enhancement.ts` adds keywords
2. **Hybrid Search**: `multi-query-rag.ts` decomposes complex queries, runs BM25 + vector search via `hybrid-search.ts`
3. **Re-ranking**: `reranker.ts` scores candidates with LLM-based cross-encoder (800-char chunk window, sub-query aware)
4. **Context Building**: Top 5 chunks assembled with `[1][2][3]` refs, deduped by (doc, page) — cross-document dedup prevented
5. **Generation**: Claude Sonnet 4.5 with CoT system prompt, SSE streaming

### Key Files

| File | Purpose |
|------|---------|
| `app/api/chat/route.ts` | Main RAG endpoint (streaming SSE) |
| `app/api/documents/process/route.ts` | PDF text extraction + embedding + storage |
| `lib/multi-query-rag.ts` | Query decomposition + multi-hop retrieval |
| `lib/hybrid-search.ts` | BM25 + vector fusion search |
| `lib/reranker.ts` | LLM-based re-ranking |
| `lib/query-preprocessing.ts` | UNS/ASTM code extraction + adaptive weights |
| `lib/model-fallback.ts` | Multi-provider LLM fallback chain |
| `lib/semantic-chunking.ts` | Table-preserving chunking (1500 chars, 200 overlap) |
| `lib/document-mapper.ts` | Resolves ASTM codes to document IDs |
| `lib/verified-generation.ts` | Answer grounding + claim verification |
| `lib/langfuse.ts` | Observability + RAG pipeline tracing |
| `lib/evaluation-engine.ts` | Pattern-based RAG evaluation |
| `lib/rag-metrics.ts` | RAGAS-style LLM-as-judge evaluation |
| `components/realtime-comparison.tsx` | Side-by-side RAG vs generic LLM display |

---

## Common Gotchas

### A789/A790 Confusion
A789 (tubing) and A790 (pipe) have DIFFERENT yield strengths for S32205:
- A789: **70 ksi** / 485 MPa
- A790: **65 ksi** / 450 MPa

`lib/document-mapper.ts` resolves specs to document IDs to prevent cross-contamination.
Content-level dedup in `chat/route.ts` is **document-scoped** — chunks from different documents are never merged even if they share 80%+ vocabulary overlap.
Confusion tests: `tests/golden-dataset/astm-a789.json` / `astm-a790.json`.

### Reranker Chunk Window
Reranker truncates chunks to **800 chars** (was 400) for relevance scoring. This preserves ~6-8 table rows — enough to include header + data rows for most ASTM tables. Increasing further risks slower reranking without proportional accuracy gains.

### Document Filter Patterns
`lib/document-mapper.ts` detects document references via three pattern types:
- **Per-pattern**: "per A790", "according to A312", "ASTM A789"
- **Code-first**: "A789 tubing", "A790 pipe"
- **API pattern**: "API 5CT", "API 6A", "API 16C"

### Groq TPM Limits (Fallback Only)
Groq is now a fallback provider (primary is Claude Sonnet 4.5).
Free tier: 6000 TPM. Chunks limited to 3 (was 5) to stay under limit.
If 429 errors occur, `model-fallback.ts` auto-switches providers.

### Chunk Size
Semantic chunking: 1500 chars target, 800 min, 2500 max, 200 overlap.
Tables preserved intact. Increasing chunk size improves coverage but risks TPM limits.

### Vercel Hobby Timeout
10-second request limit. SSE streaming with 3s heartbeat keeps connection alive.
See `app/api/chat/route.ts` lines 70-107.

---

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=xxx             # Claude Sonnet 4.5 — primary LLM (console.anthropic.com)
VOYAGE_API_KEY=xxx                # Voyage AI (voyageai.com)
NEXT_PUBLIC_SUPABASE_URL=xxx      # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx # Supabase anon key

# Optional (fallback LLMs + OCR)
GOOGLE_API_KEY=xxx                # Gemini (ai.google.dev) — used for OCR vision
GROQ_API_KEY=xxx                  # Groq fallback (console.groq.com)
CEREBRAS_API_KEY=xxx              # Cerebras fallback

# Optional (observability)
LANGFUSE_SECRET_KEY=xxx           # LangFuse tracing (langfuse.com)
LANGFUSE_PUBLIC_KEY=xxx           # LangFuse public key
LANGFUSE_BASE_URL=xxx             # LangFuse base URL
```

---

## API Endpoints

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| POST | `/api/chat` | `{ query, stream? }` | SSE stream → `{ response, sources }` |
| POST | `/api/chat/compare` | `{ query }` | `{ response }` (generic LLM, no RAG) |
| POST | `/api/documents/upload` | `FormData(file)` | `{ success, message }` |
| POST | `/api/documents/upload-url` | `{ filename, contentType }` | `{ signedUrl }` |
| POST | `/api/documents/process` | `{ documentId }` | `{ success, chunks }` |
| POST | `/api/leads` | `{ firstName, lastName, email, company?, phone? }` | `{ success }` |

---

## Deployment Checklist

- [ ] All env vars set in Vercel Dashboard
- [ ] `npm run build` passes locally
- [ ] `npm run lint` passes
- [ ] `npm test` passes (unit tests)
- [ ] Upload test PDF and verify indexing works
- [ ] Run a query and verify cited response
- [ ] Check SSE streaming works (no 504 timeout)

---

## Related Documentation

- [README.md](README.md) - Project overview
- [MCP.md](MCP.md) - MCP server configuration
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute
- [SECURITY.md](SECURITY.md) - Security policy
