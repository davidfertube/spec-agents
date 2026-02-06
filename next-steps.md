# SpecVault - Next Steps

## Current State (2026-01-28)

SpecVault is a working RAG-powered compliance verification tool for O&G materials engineers. The system uses **Voyage AI embeddings** (1024 dims, 200M tokens FREE/month) + **Groq LLM** (Llama 3.3 70B) + **Supabase pgvector** for document search with traceable citations.

**What's Working:**
- PDF upload and processing (batch embeddings, ~1-2s/page)
- Hybrid search (BM25 + vector fusion) with technical code extraction
- Query embedding cache (instant repeat queries)
- Claim verification framework with hallucination detection
- Zero hallucination rate (0% in evaluations)

**What Needs Work:**
- Accuracy at 57% (target 95%)
- Page numbers are estimated, not exact
- Chunking breaks tables mid-row

---

## Accuracy & Performance Roadmap

| Configuration | Accuracy | Hallucination | Page Citation | Speed | Cost/Query |
|--------------|----------|---------------|---------------|-------|------------|
| **Current (MVP)** | 57% | 0% | Estimated | 3-5s | $0.0001 |
| **+ Accurate Pages** | 65% | 0% | Exact | 3-5s | $0.0001 |
| **+ Smart Chunking** | 75% | 0% | Exact | 3-5s | $0.0001 |
| **+ Unstructured.io** | 85% | 0% | Exact | 5-7s | $0.005 |
| **+ Opus 4.5 (Paid)** | 92% | <2% | Exact | 8-12s | $0.15 |
| **Target (All Above)** | **95%+** | **<1%** | **Exact** | **<5s** | **$0.02** |

**Impact Breakdown:**
- Accurate page extraction (unpdf mergePages: false) → +8% accuracy
- Smart chunking (preserve tables) → +10% accuracy
- Unstructured.io (better table parsing) → +10% accuracy
- Claude Opus 4.5 (superior reasoning) → +7% accuracy
- Verification by default (already implemented) → reduces hallucination risk

---

## Immediate Priorities (Week 1-2)

### 1. Fix Page Extraction
**File:** `app/api/documents/process/route.ts`
**Change:** Line 190: `mergePages: true` → `mergePages: false`
**Impact:** +8% accuracy, exact page citations
**Cost:** $0 (code change only)

```typescript
// BEFORE
let { text } = await extractText(arrayBuffer, { mergePages: true });

// AFTER
const { pages } = await extractText(arrayBuffer, { mergePages: false });

// Chunk each page separately with accurate page numbers
for (let pageNum = 0; pageNum < pages.length; pageNum++) {
  const pageChunks = chunkText(pages[pageNum], 2000, 300);
  // ... store with page_number: pageNum + 1
}
```

**Database Migration:**
```sql
ALTER TABLE chunks ADD COLUMN char_offset_start INT;
ALTER TABLE chunks ADD COLUMN char_offset_end INT;
```

### 2. Implement Smart Chunking
**File:** Create `lib/smart-chunking.ts`
**Change:** Detect tables and keep them together
**Impact:** +10% accuracy (no broken tables)
**Cost:** $0 (code change only)

### 3. Enable Verification by Default
**File:** `app/api/chat/route.ts`
**Change:** Line 38: `verified = false` → `verified = true`
**Impact:** Lower hallucination risk on production queries
**Cost:** $0 (already implemented)

---

## Future Enhancements (Month 2-3)

### 1. Unstructured.io for Table Extraction
**Cost:** $500/mo
**Impact:** +10% accuracy, handles complex spec sheets
**When:** After accuracy hits 75% from free improvements

### 2. Claude Opus 4.5 for Enterprise Tier
**Cost:** ~$75-150/mo for 100 users
**Impact:** +7% accuracy, <2% hallucination
**When:** When paying customers need certified compliance reports

### 3. In-App PDF Viewer
**Dependencies:** `react-pdf`, `pdfjs-dist`, `@radix-ui/react-dialog`
**Impact:** Better UX, citation highlighting with red bar indicator
**When:** After page extraction is accurate

---

## Cost Projections & Pricing Strategy

### Infrastructure Costs (100 Active Users)

| Tier | Monthly Cost | Included |
|------|--------------|----------|
| **Free (Current)** | $0 | Voyage AI, Groq, Supabase free tiers |
| **Pro** | ~$5/user | Same stack, higher usage limits |
| **Enterprise** | ~$50/user | + Opus 4.5 + Unstructured.io + priority support |

### Recommended Pricing

| Tier | Price | Features | Target Margin |
|------|-------|----------|---------------|
| **Free** | $0 | 5 docs, 50 queries/day, basic citations | Lead gen |
| **Pro** | $49/mo | Unlimited docs, 1000 queries/day, PDF viewer | ~90% margin |
| **Business** | $149/mo | All Pro + verified responses, priority support | ~85% margin |
| **Enterprise** | $499/mo | All Business + Opus 4.5, API access, SSO | ~90% margin |

**Break-even Analysis:**
- 100 paying users (50 Pro, 30 Business, 20 Enterprise) = $202K/year revenue
- Infrastructure + support costs = ~$40K/year
- **Profit margin: ~80%** (SaaS standard is 70-80%)

---

## Migration Notes

Users need to:
1. Get **VOYAGE_API_KEY** from [voyageai.com](https://www.voyageai.com) (FREE 200M tokens/month)
2. Run migration: `supabase/migrations/002_voyage_embeddings.sql`
3. Re-upload PDF documents (old Google embeddings are 3072 dims, incompatible)

---

## KPI Targets

### MVP Launch (Free Tier)
- Lead capture rate: 30%
- Demo completion: 50%
- Time to first query: <60s

### Paid Tiers
- Citation accuracy: 95%
- Response accuracy: 90%
- Hallucination rate: <1%
- Query latency P95: <3s
- Monthly churn: <5%

---

## Quick Commands

```bash
# Run evaluation
npx tsx scripts/evaluate-accuracy.ts --verbose

# Check current accuracy metrics
cat tests/evaluation-results.json

# Start dev server
npm run dev

# Build for production
npm run build
```

---

## Questions?

- **Accuracy improvement:** Focus on page extraction first (+8%), then smart chunking (+10%)
- **When to add Opus 4.5:** When we have paying Enterprise customers
- **When to add Unstructured.io:** When accuracy hits 75% and we need the extra 10%
- **Cost concerns:** Free tier covers MVP. Scale costs predictably at $5-50/user/month.
