# CLAUDE.md - Steel Agents

## Current Status (2026-01-27)

| Component | Status | Notes |
|-----------|--------|-------|
| **Frontend** | READY | Deploy to Vercel |
| **API Routes** | READY | Next.js API routes (no separate backend) |
| **Database** | CONFIGURED | Supabase PostgreSQL + pgvector |
| **LLM** | CONFIGURED | Google Gemini 2.5 Flash |
| **Embeddings** | CONFIGURED | Google gemini-embedding-001 |

### What's Working
- [x] PDF upload to Supabase Storage
- [x] Text extraction with `unpdf`
- [x] Embeddings generation with Google gemini-embedding-001
- [x] Vector storage in Supabase pgvector
- [x] Semantic search with cosine similarity
- [x] LLM responses with Gemini 2.5 Flash
- [x] Citations in responses ([1], [2], etc.)
- [x] Lead capture form (with company field)
- [x] Security hardening (input validation, file limits)

---

## What's Missing for MVP Launch

### Required (2 items)

| Item | Status | How to Fix |
|------|--------|------------|
| **Steel PDFs** | Missing | Upload ASTM/NACE/API specification PDFs via the UI |
| **Custom Domain** | Optional | Configure in Vercel Dashboard → Domains |

### Post-MVP (Add Later)

| Item | Notes |
|------|-------|
| **Rate Limiting** | Add Upstash Redis when you have traffic |
| **User Auth** | Add Clerk when you need usage tracking |
| **Payments** | Add Stripe when ready for paid tiers |
| **Unstructured.io** | Better table extraction for spec sheets |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# 3. Start development
npm run dev

# 4. Open http://localhost:3000
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js 16 App                           │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React 19)     │     API Routes                       │
│  - app/page.tsx          │     - /api/chat (RAG queries)        │
│  - components/*          │     - /api/documents/upload          │
│                          │     - /api/documents/process         │
│                          │     - /api/leads                     │
└──────────────────────────┴──────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  Supabase │   │  Google   │   │  Google   │
            │  pgvector │   │  Gemini   │   │ Embeddings│
            │ (vectors) │   │  (LLM)    │   │ (3072 dim) │
            └───────────┘   └───────────┘   └───────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main landing page with hero, upload, search |
| `app/api/chat/route.ts` | RAG query endpoint |
| `app/api/documents/upload/route.ts` | PDF upload to Supabase Storage |
| `app/api/documents/process/route.ts` | Extract text, generate embeddings, store |
| `app/api/leads/route.ts` | Lead capture form submission |
| `lib/vectorstore.ts` | pgvector search functions |
| `lib/embeddings.ts` | Google embedding generation |
| `lib/supabase.ts` | Supabase client |

---

## Environment Variables

```bash
# Required (3 variables)
GOOGLE_API_KEY=xxx                      # Google AI Studio
NEXT_PUBLIC_SUPABASE_URL=xxx            # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx       # Supabase anon key
```

---

## API Endpoints

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| POST | `/api/chat` | `{ query: string }` | `{ response: string, sources: Source[] }` |
| POST | `/api/documents/upload` | `FormData (file)` | `{ documentId, path, url }` |
| POST | `/api/documents/process` | `{ documentId }` | `{ success, chunks }` |
| POST | `/api/leads` | `{ firstName, lastName, email, company?, phone? }` | `{ success }` |

---

## Demo Flow

1. **Land on homepage** → See animated hero with KPIs
2. **Step 1: Upload PDF** → Select a steel specification (e.g., 316 Stainless datasheet)
3. **Wait for processing** → Green checkmark appears when indexed
4. **Step 2: Ask question** → Click example or type: "What is yield strength of 316L?"
5. **See response** → Answer with [1] citation pointing to uploaded document
6. **Key selling point**: "Every answer has traceable citations for compliance reports"

---

## Commands Reference

```bash
# Development
npm run dev                    # Start dev server on :3000

# Build & Test
npm run build                  # Build for production
npm run lint                   # Run ESLint
npm test                       # Run Vitest tests

# Deployment
git push origin main           # Auto-deploys via GitHub Actions to Vercel
```

---

## Security Checklist

### Implemented
- [x] **File Size Limits**: Upload API enforces 50MB maximum
- [x] **Input Validation**: Leads API validates length and format
- [x] **Error Handling**: Server errors don't leak internal details
- [x] **PDF Only**: Document upload restricted to PDF MIME type
- [x] **Filename Sanitization**: Prevents path traversal attacks

### Post-MVP
- [ ] **Rate Limiting**: Add Upstash for API rate limiting
- [ ] **Row Level Security**: Enable RLS in Supabase
- [ ] **Authentication**: Add Clerk when needed

---

## Troubleshooting

### "No documents indexed"
Upload a PDF first, then wait for processing to complete (status changes to "indexed").

### "Google API error"
Verify `GOOGLE_API_KEY` is set and has Gemini API enabled in Google AI Studio.

### Build fails
Run `npm run lint -- --fix` to auto-fix linting issues.

---

## Tech Stack Summary

| Component | Technology | Cost |
|-----------|------------|------|
| Frontend | Next.js 16, React 19, Tailwind CSS | Free |
| Backend | Next.js API Routes | Free |
| Database | Supabase PostgreSQL + pgvector | Free tier |
| LLM | Google Gemini 2.5 Flash | Free tier |
| Embeddings | Google gemini-embedding-001 | Free tier |
| Hosting | Vercel | Free |
| **Total** | | **$0/month** |

---

## Related Documentation

- [README.md](README.md) - Project overview
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute
- [SECURITY.md](SECURITY.md) - Security policy
