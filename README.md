# Steel Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://github.com/davidfertube/steel-venture/actions/workflows/test.yml/badge.svg)](https://github.com/davidfertube/steel-venture/actions/workflows/test.yml)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com/new/clone?repository-url=https://github.com/davidfertube/steel-venture)

**AI-powered compliance verification tool for O&G materials engineers.** Query steel specifications instantly with traceable citations for compliance reports.

[Deploy on Vercel](https://vercel.com/new/clone?repository-url=https://github.com/davidfertube/steel-venture) | [Documentation](CLAUDE.md) | [Contributing](CONTRIBUTING.md)

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

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    RAG Pipeline                              │
├─────────────────────────────────────────────────────────────┤
│  1. Upload PDF specs (ASTM, NACE, API, company standards)   │
│  2. AI extracts and indexes content with vector embeddings  │
│  3. Query in natural language                               │
│  4. Get answers with [1] [2] citations to source documents  │
│  5. Click citation → jump to exact page in source PDF       │
└─────────────────────────────────────────────────────────────┘
```

**Key Differentiator**: Not another AI chatbot. It's a **compliance verification engine** with traceable citations that engineers can cite in their reports.

---

## Technical Architecture

| Component | Technology | Why This Choice |
|-----------|------------|-----------------|
| Frontend | Next.js 16, React 19 | Fast, modern, great DX |
| Backend | Next.js API Routes | Serverless, no infra to manage |
| LLM | Google Gemini 2.5 Flash | Fast, accurate, free tier |
| Embeddings | Google text-embedding-004 | 768 dims, excellent for technical docs |
| Vector DB | Supabase pgvector | PostgreSQL-native, easy to scale |
| Hosting | Vercel | One-click deploy, global CDN |

### Cost Analysis

| Tier | Monthly Cost | Capacity |
|------|--------------|----------|
| **Free** | $0 | 100 queries/day, demos |
| **Production** | $80-155 | 10K queries/month |
| **Enterprise** | $220-420 | Unlimited, dedicated support |

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

## Roadmap

### MVP (Current)
- [x] PDF upload and processing
- [x] Semantic search with citations
- [x] Google Gemini integration
- [x] Lead capture for enterprise interest

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

## For Hiring Managers

This project demonstrates:

| Skill | Evidence |
|-------|----------|
| **Full-Stack Development** | Next.js 16, React 19, TypeScript, API routes |
| **AI/ML Integration** | RAG pipeline, embeddings, LLM prompt engineering |
| **Domain Expertise** | O&G materials, NACE/ASTM/API standards |
| **Production Mindset** | Security hardening, input validation, error handling |
| **DevOps** | CI/CD with GitHub Actions, Vercel deployment |
| **Documentation** | Comprehensive README, CLAUDE.md, CONTRIBUTING.md |

### Code Quality Highlights
- **Security**: Input validation, file size limits, no error leakage
- **Architecture**: Clean separation, serverless-ready
- **Testing**: Vitest for frontend, type-safe throughout
- **Open Source**: MIT license, contribution guidelines

---

## Contact

**David Fernandez** - [davidfernandez.dev](https://www.davidfernandez.dev)

Building AI tools for the energy industry. Open to opportunities in:
- Materials/Corrosion Engineering + AI
- O&G Digital Transformation
- Technical Product Management

---

## License

[MIT](LICENSE) - Use freely, attribution appreciated.
