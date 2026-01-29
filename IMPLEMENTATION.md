# IMPLEMENTATION.md - Technical Implementation Guide

## Overview

This document provides technical details for implementing and extending Steel Agents, a Next.js-based RAG application with **no separate backend** - all API logic runs in Next.js API Routes.

---

## System Architecture

### Stack Components

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 16, React 19 | Server components, streaming UI |
| **API** | Next.js API Routes | Serverless functions, no separate backend |
| **LLM** | Groq (Llama 3.3 70B) | Free 14,400 req/day, fast inference |
| **Embeddings** | Voyage AI (voyage-3-lite) | 1024 dims, 200M tokens FREE/month |
| **Vector DB** | Supabase pgvector | PostgreSQL with vector extension |
| **Storage** | Supabase Storage | PDF file uploads |
| **Hosting** | Vercel | Serverless, edge functions |

### Why This Architecture?

1. **Serverless-First**: No servers to manage, scales to zero, pay-per-use
2. **Single Codebase**: Frontend + API in one Next.js app
3. **PostgreSQL-Native**: pgvector = vectors + metadata + auth in one DB
4. **Free Tier Friendly**: Voyage AI (200M tokens/mo) + Groq (14,400 req/day) + Supabase + Vercel all have generous free tiers

---

## Key Files & Directories

```
/Users/david/Downloads/repos/steel-venture/
├── app/
│   ├── page.tsx                          # Main landing page
│   ├── layout.tsx                        # Root layout with providers
│   └── api/
│       ├── chat/route.ts                 # RAG query endpoint
│       ├── documents/
│       │   ├── upload/route.ts           # PDF upload to Supabase Storage
│       │   └── process/route.ts          # Extract text, embed, store
│       └── leads/route.ts                # Lead capture form
├── lib/
│   ├── embeddings.ts                     # Voyage AI embedding generation
│   ├── embedding-cache.ts                # Query embedding cache (reduces API calls)
│   ├── vectorstore.ts                    # Supabase pgvector operations
│   ├── hybrid-search.ts                  # BM25 + vector search fusion
│   ├── query-preprocessing.ts            # Technical code extraction (UNS, ASTM, etc.)
│   ├── claim-verification.ts             # Hallucination detection
│   ├── verified-generation.ts            # Zero-hallucination pipeline
│   ├── model-fallback.ts                 # Multi-provider LLM fallback
│   ├── supabase.ts                       # Supabase client
│   └── validation.ts                     # Input validation & sanitization
├── components/
│   ├── upload-section.tsx                # PDF upload UI
│   ├── query-section.tsx                 # Search UI with examples
│   └── response-display.tsx              # AI response with citations
├── supabase/
│   ├── schema.sql                        # Initial DB schema
│   └── migrations/
│       └── 002_voyage_embeddings.sql     # Voyage AI migration (1024 dims)
└── scripts/
    └── evaluate-accuracy.ts              # Evaluation framework
```

---

## Data Flow

### Query Flow

```
User Query
    │
    ▼
Next.js Frontend (app/page.tsx)
    │
    ├──▶ POST /api/chat
    │         │
    │         ▼
    │    API Route (app/api/chat/route.ts)
    │         │
    │         ├──▶ Query Preprocessing (extract codes)
    │         │         │
    │         │         ▼
    │         │    Hybrid Search (BM25 + Vector)
    │         │         │
    │         │         ├──▶ Supabase RPC: hybrid_search_chunks
    │         │         │         │
    │         │         │         ▼
    │         │         │    pgvector similarity search
    │         │         │         │
    │         │         ▼         │
    │         │    Top 5 chunks ◀──┘
    │         │         │
    │         ▼         │
    │    Generate (Groq LLM) ◀──┘
    │         │
    │         ├──▶ [Optional] Claim Verification
    │         │
    │         ▼
    │    Response + Sources
    │
    ▼
Display Response with Citations
```

### Document Ingestion Flow

```
PDF Upload (Drag & Drop)
    │
    ▼
POST /api/documents/upload
    │
    ├──▶ Validate file (PDF, <50MB)
    │
    └──▶ Upload to Supabase Storage
         └──▶ Return documentId

POST /api/documents/process (documentId)
    │
    ├──▶ Download PDF from Supabase Storage
    │
    ├──▶ Extract text with unpdf (mergePages: true)
    │
    ├──▶ Chunk text (2000 chars, 300 overlap)
    │
    ├──▶ Generate embeddings (Voyage AI, batch of 64)
    │         │
    │         ▼
    │    voyage-3-lite API
    │         │
    │         ▼
    │    1024-dim vectors
    │
    └──▶ Store chunks in Supabase (pgvector)
         └──▶ Update document status to "indexed"
```

---

## API Routes

### POST /api/chat

**Request:**
```json
{
  "query": "What is the yield strength of S31803?",
  "verified": false  // Optional: enable claim verification
}
```

**Response:**
```json
{
  "response": "The minimum yield strength for UNS S31803 is 65 ksi (450 MPa) per ASTM A790 [1].",
  "sources": [
    {
      "ref": "[1]",
      "document": "ASTM_A790.pdf",
      "page": "5",
      "content_preview": "Minimum yield strength: 65 ksi [450 MPa]...",
      "document_url": "https://your-project.supabase.co/storage/v1/object/public/..."
    }
  ]
}
```

### POST /api/documents/upload

**Request:** `multipart/form-data` with `file` field (PDF)

**Response:**
```json
{
  "documentId": 123,
  "path": "documents/uuid.pdf",
  "url": "https://your-project.supabase.co/storage/v1/object/public/documents/uuid.pdf"
}
```

### POST /api/documents/process

**Request:**
```json
{
  "documentId": 123
}
```

**Response:**
```json
{
  "success": true,
  "chunks": 42,
  "message": "Document indexed successfully"
}
```

---

## Configuration

### Environment Variables

```bash
# Required (4 variables)
VOYAGE_API_KEY=xxx                      # Voyage AI (voyageai.com)
GROQ_API_KEY=xxx                        # Groq (console.groq.com)
NEXT_PUBLIC_SUPABASE_URL=xxx            # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx       # Supabase anon key

# Optional: Additional LLM fallback providers
CEREBRAS_API_KEY=xxx                    # Cerebras (optional)
TOGETHER_API_KEY=xxx                    # Together AI (optional)
OPENROUTER_API_KEY=xxx                  # OpenRouter (optional)
```

### Supabase Configuration

**Database Setup:**
1. Go to Supabase Dashboard → SQL Editor
2. Run `supabase/schema.sql` (creates tables, indexes, functions)
3. Run `supabase/migrations/002_voyage_embeddings.sql` (1024 dim vectors)

**Storage Setup:**
1. Go to Supabase Dashboard → Storage
2. Create bucket named `documents`
3. Set to public (for demo) or configure RLS policies

---

## Extending the System

### Adding New API Endpoints

Create a new file in `app/api/your-route/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Your logic here
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
```

### Customizing RAG Pipeline

Edit `app/api/chat/route.ts`:

```typescript
// Adjust retrieval count
const chunks = await searchWithFallback(cleanedQuery, 10);  // Default: 5

// Modify system prompt
const systemPrompt = `You are an expert in steel specifications...
Always cite sources using [1], [2], etc.
...`;

// Add metadata filtering (when implemented)
const chunks = await hybridSearchChunks(query, {
  matchCount: 5,
  filterMetadata: { document_type: "astm_standard" }
});
```

### Adding New Document Types

The system currently supports PDFs. To add support for other formats:

1. Update `app/api/documents/upload/route.ts` to accept new MIME types
2. Add text extraction logic in `app/api/documents/process/route.ts`
3. Consider using libraries like `mammoth` (Word docs) or `xlsx` (Excel)

---

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage
```

### Integration Testing

```bash
# Start dev server
npm run dev

# Test query endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the yield strength of A106 Grade B?"}'

# Test document upload (using a PDF file)
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@/path/to/test.pdf"
```

### Evaluation Framework

```bash
# Run full evaluation on golden datasets
npx tsx scripts/evaluate-accuracy.ts --verbose

# Specific dataset
npx tsx scripts/evaluate-accuracy.ts --dataset astm-a1049

# JSON output for CI/CD
npx tsx scripts/evaluate-accuracy.ts --json > results.json
```

---

## Deployment

### Vercel (Recommended)

**One-Click Deploy:**
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/davidfertube/steel-venture)

**Manual Deploy:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel Dashboard
# → Settings → Environment Variables
```

### Environment Variables in Production

Add these in Vercel Dashboard:
- `VOYAGE_API_KEY`
- `GROQ_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Troubleshooting

### "Embedding API error"
**Issue**: Rate limits or invalid API key

**Fix**:
- Verify `VOYAGE_API_KEY` is set correctly
- Voyage AI free tier: 200M tokens/month, 1000+ RPM
- Get free key at https://www.voyageai.com

### "Hybrid search not available"
**Issue**: Database migration not run

**Fix**:
- Run `supabase/migrations/002_voyage_embeddings.sql` in Supabase SQL Editor
- The `hybrid_search_chunks` function must exist

### "Build fails with type errors"
**Issue**: TypeScript compilation errors

**Fix**:
```bash
npm run lint -- --fix
npm run build
```

### "Query embedding cache not working"
**Issue**: In-memory cache resets on serverless cold starts

**Solution**:
- This is expected behavior with Vercel's serverless functions
- For production, consider using Redis (Upstash) for persistent caching
- Current in-memory cache works well for development

---

## Performance Optimization

### Retrieval Tuning

```typescript
// In app/api/chat/route.ts

// More comprehensive results
const chunks = await searchWithFallback(query, 10);  // Default: 5

// Adjust similarity threshold (lower = more results)
const { data } = await supabase.rpc("search_chunks", {
  query_embedding: embedding,
  match_threshold: 0.5,  // Default: 0.7
  match_count: 10
});
```

### Embedding Cache

The query embedding cache reduces API calls by ~40%:

```typescript
// In lib/embedding-cache.ts

// Adjust TTL (currently 1 hour)
const CACHE_TTL = 60 * 60 * 1000;  // milliseconds

// Adjust max size (currently 1000 entries)
const MAX_CACHE_SIZE = 1000;
```

### LLM Response Optimization

```typescript
// In app/api/chat/route.ts

// Use faster model for simple queries
const model = isComplexQuery ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant";

// Adjust max tokens based on query type
const maxTokens = query.includes("compare") ? 1500 : 800;
```

---

## Security Considerations

### API Keys
- Never commit API keys to git
- Use environment variables (.env.local)
- Rotate keys periodically
- Monitor usage in provider dashboards

### Input Validation
- All queries are validated for length and content
- File uploads limited to 50MB and PDF MIME type only
- Sanitization prevents SQL injection and XSS

### Rate Limiting
Currently relies on provider rate limits:
- Voyage AI: 1000+ RPM free tier
- Groq: 14,400 requests/day free tier

For production, add Upstash rate limiting:
```bash
npm install @upstash/ratelimit @upstash/redis
```

---

## Monitoring

### Built-in Logging

API routes log to console:
```
[Chat API] Technical codes detected: S31803, A790
[Hybrid Search] Found 5 results in 234ms
[EmbeddingCache] HIT for query: "yield strength S31803"
```

### Vercel Analytics

View in Vercel Dashboard:
- Function execution time
- Error rates
- Bandwidth usage

### Supabase Monitoring

View in Supabase Dashboard:
- Database queries
- Storage usage
- API requests

---

## Cost Monitoring

### Free Tier Limits

| Service | Free Tier | Cost Beyond |
|---------|-----------|-------------|
| Voyage AI | 200M tokens/month, 1000+ RPM | $0.0001/1K tokens |
| Groq | 14,400 req/day | N/A (no paid tier yet) |
| Supabase | 500MB DB, 1GB storage | $25/mo Pro |
| Vercel | 100GB bandwidth | $20/mo Pro |

### Typical Usage (100 active users/month)

- **Embeddings**: ~50M tokens = FREE
- **LLM**: ~5000 queries = FREE
- **Database**: <500MB = FREE
- **Hosting**: <100GB = FREE

**Total cost: $0/month**
