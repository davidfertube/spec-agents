# Steel Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://github.com/davidfertube/steel-venture/actions/workflows/test.yml/badge.svg)](https://github.com/davidfertube/steel-venture/actions/workflows/test.yml)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com/new/clone?repository-url=https://github.com/davidfertube/steel-venture)

**AI-powered compliance verification tool for O&G materials engineers.** Query steel specifications instantly with traceable citations for compliance reports.

[Live Demo](https://steel-venture.vercel.app) | [Documentation](CLAUDE.md) | [Contributing](CONTRIBUTING.md)

---

## The Problem We Solve

| Industry Pain Point | Impact | Our Solution |
|---------------------|--------|--------------|
| Engineers spend **2-4 hours/day** searching specs manually | $150K+/year in lost productivity per engineer | Instant AI-powered search across all specs |
| Wrong material specification | **$10M+ liability** per incident | Every answer has traceable citations |
| NACE/ASTM/API docs scattered across systems | Compliance audit failures | Single searchable knowledge base |
| Junior engineers lack tribal knowledge | Extended onboarding, costly mistakes | AI assistant with senior-level expertise |

---

## Built For Energy Industry Compliance

### Supported Standards
- **NACE MR0175/ISO 15156** - Sour service material requirements
- **ASTM A106/A53/A333** - Pipe specifications
- **API 5L/5CT** - Line pipe and casing
- **ASME B31.3** - Process piping

### Example Queries
```
"What is the maximum hardness for 4140 in sour service per NACE MR0175?"
→ 22 HRC maximum per NACE MR0175 Section 7.3.1 [1]

"Compare A106 Grade B vs A333 Grade 6 for low-temperature service"
→ A333 Grade 6 is impact tested to -50°F, A106 is not rated for low-temp [1][2]

"Does duplex 2205 meet PREN requirements for seawater service?"
→ UNS S32205 has PREN ≥34, exceeds 32 minimum for seawater per NORSOK M-001 [1]
```

---

## Architecture Deep Dive

### RAG Pipeline Flow

```mermaid
graph LR
    A[PDF Upload] --> B[Text Extraction<br/>unpdf]
    B --> C[Chunking<br/>500 chars + overlap]
    C --> D[Embedding<br/>gemini-embedding-001]
    D --> E[pgvector<br/>HNSW index]

    F[User Query] --> G[Query Embedding]
    G --> H[Cosine Similarity<br/>top 5 chunks]
    H --> I[LLM Context<br/>+ System Prompt]
    I --> J[Cited Response]
```

### Technical Stack

| Component | Technology | Why This Choice |
|-----------|------------|-----------------|
| Frontend | Next.js 16, React 19 | RSC for performance, API routes = no separate backend |
| Backend | Next.js API Routes | Serverless, scales to zero, no infra to manage |
| LLM | Google Gemini 2.5 Flash | 1M token context, best cost/performance for technical docs |
| Embeddings | Google gemini-embedding-001 | 3072 dims captures technical nuance, free tier |
| Vector DB | Supabase pgvector | PostgreSQL-native, RLS built-in, familiar SQL |
| Hosting | Vercel | One-click deploy, preview deployments, edge functions |

### Why This Architecture Works

1. **Serverless-First**: No servers to manage, scales to zero, pay-per-use
2. **Single Database**: pgvector = vectors + metadata + auth all in PostgreSQL
3. **Edge-Ready**: Vercel edge functions for low-latency global access
4. **Cost-Optimized**: Free tier covers MVP, predictable scaling costs

---

## Engineering Decisions & Trade-offs

### Why These Technology Choices?

| Decision | Chosen | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| **Vector DB** | Supabase pgvector | Pinecone, Weaviate, Qdrant | PostgreSQL-native = one fewer service, RLS built-in, familiar SQL |
| **LLM** | Gemini 2.5 Flash | GPT-4, Claude | Best cost/performance for technical docs, 1M token context |
| **Embeddings** | gemini-embedding-001 | OpenAI ada-002, Cohere | 3072 dims captures technical nuance, free tier generous |
| **Framework** | Next.js 16 App Router | Remix, SvelteKit, Express+React | API routes = no separate backend, React 19 RSC for performance |
| **Hosting** | Vercel | AWS, GCP, Railway | One-click deploy, preview deployments, edge functions |

### What I'd Do Differently at Scale

| Current Approach | Scale Problem | Production Solution |
|-----------------|---------------|---------------------|
| Naive chunking (500 chars) | Breaks tables mid-row | Semantic chunking with Unstructured.io |
| Pure vector search | Misses exact codes like "UNS S31603" | Hybrid search (BM25 + vector) |
| Single document | No multi-doc comparison | Document library with metadata filtering |
| No auth | Public API abuse | Clerk + rate limiting with Upstash |

### Security Model

| Layer | Protection |
|-------|------------|
| Input | Zod validation, file type/size limits (50MB max) |
| API | CORS configured, rate limiting (planned) |
| Database | Row Level Security (RLS) on Supabase |
| Secrets | Environment variables only, no hardcoded keys |

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/davidfertube/steel-venture.git
cd steel-venture && npm install

# Configure (get free API keys)
cp .env.example .env.local
# Add: GOOGLE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

# Run
npm run dev
# Open http://localhost:3000
```

### One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/davidfertube/steel-venture)

---

## Cost Analysis

| Tier | Monthly Cost | Capacity |
|------|--------------|----------|
| **Free** | $0 | 100 queries/day, demos |
| **Production** | $80-155 | 10K queries/month |
| **Enterprise** | $220-420 | Unlimited, dedicated support |

---

## Roadmap

### MVP (Current)
- [x] PDF upload and processing
- [x] Semantic search with citations
- [x] Google Gemini integration
- [x] Lead capture for enterprise interest
- [x] Auto-scroll UX with animations

### Phase 2 (Post-Launch)
- [ ] **Unstructured.io integration** - Better table extraction for spec sheets
- [ ] **Hybrid search** - Combine keyword + vector for exact alloy codes
- [ ] **User authentication** - Clerk integration
- [ ] **Usage analytics** - Track query patterns

### Phase 3 (Scale)
- [ ] **Multi-tenant** - Separate document spaces per company
- [ ] **API access** - Integrate into existing engineering workflows
- [ ] **Compliance reports** - Auto-generate material compliance matrices

---

## Lessons Learned

### What Worked Well
- **pgvector over Pinecone**: One service to manage, SQL familiarity, RLS built-in
- **Gemini over OpenAI**: Better cost/performance for technical documents
- **Next.js App Router**: API routes eliminate backend complexity
- **Supabase**: Auth, storage, database, vectors in one platform

### What I'd Improve
1. **Chunking Strategy**: Current naive chunking breaks tables. Would implement document-structure-aware chunking
2. **Evaluation Framework**: No automated RAG evaluation yet. Would add ragas metrics
3. **Caching**: No query caching. Would add Redis for repeated queries
4. **Multi-tenancy**: Current design is single-tenant. Would add workspace isolation

### Hard Problems Solved
1. **Citation Accuracy**: Mapping LLM references back to exact source pages
2. **Table Extraction**: PDFs have complex table structures, unpdf handles most cases
3. **Embedding Dimension Mismatch**: Migrated from 768 to 3072 dims mid-project

---

## Built By

**David Fernandez** | Senior Full-Stack Engineer

[Portfolio](https://davidfernandez.dev) | [GitHub](https://github.com/davidfertube)

### What This Project Demonstrates

| Competency | Evidence |
|------------|----------|
| **System Design** | End-to-end RAG architecture with clear trade-offs |
| **Full-Stack** | Next.js 16, React 19, TypeScript, API design |
| **AI/ML Engineering** | Vector embeddings, LLM prompt engineering, citation system |
| **Production Mindset** | Security hardening, error handling, input validation |
| **Domain Knowledge** | O&G materials, NACE/ASTM/API compliance requirements |
| **DevOps** | CI/CD pipelines, one-click deployments |

### Project Stats

| Metric | Value |
|--------|-------|
| Development Time | ~3 weeks (solo) |
| Lines of Code | ~5,000 TypeScript |
| Test Coverage | Core API routes covered |
| Dependencies | Minimal, production-ready |

### Technologies I'd Use at Enterprise Scale

- **Better PDF Parsing**: Azure Document Intelligence, Unstructured.io
- **Hybrid Search**: Azure AI Search, Elasticsearch
- **Observability**: Datadog, Sentry, structured logging
- **Auth**: Clerk, Auth0, or Azure AD B2C

---

## License

[MIT](LICENSE) - Use freely, attribution appreciated.
