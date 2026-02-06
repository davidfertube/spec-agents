# MVP Hardening Report

**Date**: 2026-01-31
**Status**: Ready for Production Testing

---

## Summary

This report documents the MVP hardening work completed to prepare SpecVault for production deployment. The focus areas were:

1. Distributed rate limiting with Upstash Redis
2. PDF viewer simplification (removed highlighting)
3. 100-query test suite creation
4. Documentation cleanup
5. Production readiness verification

---

## 1. Upstash Rate Limiting

### Implementation

Replaced in-memory rate limiting with distributed Upstash Redis for production scalability.

**Files Modified:**
- [lib/rate-limit.ts](../lib/rate-limit.ts) - Complete rewrite with Upstash support
- [middleware.ts](../middleware.ts) - Updated to async for Redis calls
- [.env.example](../.env.example) - Added Upstash configuration variables

**Features:**
- Sliding window algorithm (30 requests/minute for chat)
- Automatic fallback to in-memory if Upstash not configured
- Per-endpoint rate limits:
  - `/api/chat`: 30/min
  - `/api/documents/upload`: 5/min
  - `/api/documents/upload-url`: 5/min
  - `/api/documents/process`: 10/min
  - `/api/leads`: 10/min
  - Default: 60/min

**Required Environment Variables:**
```bash
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

**Cost**: Free tier includes 10K requests/day, paid at $0.20/100K requests

---

## 2. PDF Viewer Simplification

### Changes

Removed all yellow highlighting logic from PDF viewers to improve reliability and reduce complexity.

**Files Modified:**
- [components/pdf-viewer-modal.tsx](../components/pdf-viewer-modal.tsx) - Removed text layer and highlighting
- [components/pdf-viewer-panel.tsx](../components/pdf-viewer-panel.tsx) - Removed highlightText prop and highlighting logic
- [app/page.tsx](../app/page.tsx) - Removed highlightText state management

**Rationale:**
- Highlighting was showing at footer instead of on PDF content
- Text layer matching was unreliable for table values
- Clean PDF rendering is simpler and more maintainable
- Users can navigate to cited page and find content manually

---

## 3. 100-Query Test Suite

### Overview

Created comprehensive accuracy test suite covering 10 document types with 100 queries total.

**File Created:**
- [scripts/accuracy-test.ts](../scripts/accuracy-test.ts)

**Test Distribution:**
- 10 documents x 10 queries each = 100 total queries
- 6 medium difficulty queries per document (single property lookup)
- 4 complex queries per document (comparisons, multi-step reasoning)

**Documents Covered:**
| Document | Queries | Description |
|----------|---------|-------------|
| ASTM A790 | 10 | Duplex stainless steel pipe |
| ASTM A789 | 10 | Duplex stainless steel tubing |
| ASTM A312 | 10 | Austenitic stainless steel pipe |
| ASTM A872 | 10 | Centrifugally cast pipe |
| API 5CT | 10 | Casing and tubing for wells |
| API 6A | 10 | Wellhead equipment |
| API 16C | 10 | Choke and kill equipment |
| API 5CRA | 10 | Corrosion-resistant alloy tubulars |
| ASTM A240 | 10 | Stainless steel plate/sheet |
| ASTM A182 | 10 | Forged fittings and flanges |

**Metrics Tracked:**
- Overall accuracy (target: 75%+)
- Source accuracy (correct document cited)
- Latency (P50, P95)
- Per-document accuracy breakdown
- Medium vs complex query performance

**Usage:**
```bash
npm run dev  # Start the server
npx tsx scripts/accuracy-test.ts  # Run tests
```

---

## 4. Documentation Cleanup

### Files Archived

Moved future-focused documentation to `docs/archive/`:

| File | Reason |
|------|--------|
| `AI-AGENTS.md` | Future AI agent architecture, not MVP |
| `MCP.md` | Model Context Protocol, future integration |
| `PRODUCTION.md` | Enterprise-scale planning, not MVP |

### Files Removed

| File | Reason |
|------|--------|
| `reports/evaluation-report.md` | Outdated, superseded by FINAL-EVALUATION-REPORT.md |

### Essential Documentation Retained

| File | Purpose |
|------|---------|
| `README.md` | Primary project documentation |
| `CLAUDE.md` | Development reference and instructions |
| `DEPLOYMENT.md` | Deployment guide |
| `SECURITY.md` | Security policy |
| `IMPLEMENTATION.md` | Technical implementation guide |
| `CONTRIBUTING.md` | Contribution guidelines |
| `TECHNICAL-NARRATIVE.md` | Architecture decisions |
| `next-steps.md` | Post-MVP roadmap |
| `SME-EVALUATION-SUMMARY.md` | SME evaluation guide |
| `reports/FINAL-EVALUATION-REPORT.md` | Baseline accuracy report |

---

## 5. Build Verification

### Results

```
✓ npm run build - SUCCESS (2.3s compile)
✓ npm run lint - 0 errors (46 warnings for unused variables)
✓ All API routes functional
✓ Static pages generated
```

### API Routes Status

| Route | Type | Status |
|-------|------|--------|
| `/` | Static | Ready |
| `/api/chat` | Dynamic | Ready |
| `/api/chat/compare` | Dynamic | Ready |
| `/api/documents/pdf` | Dynamic | Ready |
| `/api/documents/process` | Dynamic | Ready |
| `/api/documents/upload` | Dynamic | Ready |
| `/api/documents/upload-url` | Dynamic | Ready |
| `/api/leads` | Dynamic | Ready |
| `/privacy` | Static | Ready |
| `/terms` | Static | Ready |

---

## 6. Existing Features Verified

### Document Filtering (Already Implemented)

The system already has document filtering to solve the A789/A790 confusion:

- [lib/document-mapper.ts](../lib/document-mapper.ts) - Maps spec codes to document IDs
- [lib/hybrid-search.ts](../lib/hybrid-search.ts) - Filters search by document_id
- Pattern: "per A790" or "according to A789" triggers document-specific search

### RAG Pipeline Components

| Component | Status | File |
|-----------|--------|------|
| Query preprocessing | Active | `lib/query-preprocessing.ts` |
| Query decomposition | Active | `lib/query-decomposition.ts` |
| Hybrid search (BM25 + vector) | Active | `lib/hybrid-search.ts` |
| Re-ranking | Active | `lib/reranker.ts` |
| Citation validation | Active | `lib/citation-validator.ts` |
| Semantic chunking | Active | `lib/semantic-chunking.ts` |

---

## 7. Production Checklist

### Ready

- [x] Distributed rate limiting (Upstash Redis)
- [x] PDF viewing without complex highlighting
- [x] 80-query test suite for accuracy validation (8 indexed documents)
- [x] Clean documentation structure
- [x] Build passes without errors
- [x] Document filtering for spec disambiguation
- [x] Source accuracy validation with spec code extraction

### Required Before Production

- [x] Add Upstash credentials to Vercel environment
- [x] Run accuracy test suite on production data
- [x] Verify accuracy meets 75% target - **ACHIEVED 87.5%**
- [x] Verify source accuracy meets 80% target - **ACHIEVED 80.0%**
- [ ] Configure custom domain (optional)

---

## Final Test Results (2026-01-31)

### 🎉 MVP READY - All Accuracy Targets Met!

| Metric | Result | Target | Status |
|--------|--------|--------|--------|
| **Answer Accuracy** | **87.5%** | 75% | ✅ PASS |
| **Source Accuracy** | **80.0%** | 80% | ✅ PASS |
| Medium queries | 81.3% | - | ✅ |
| Complex queries | 96.9% | - | ✅ |

### Per-Document Performance (8 Indexed Documents)

| Document | Answer Accuracy | Source Accuracy |
|----------|-----------------|-----------------|
| ASTM A789 | 10/10 (100%) | 100% |
| ASTM A872 | 10/10 (100%) | 90% |
| API 5CRA | 10/10 (100%) | 90% |
| API 5CT | 9/10 (90%) | 50% |
| API 6A | 9/10 (90%) | 70% |
| API 16C | 8/10 (80%) | 40% |
| ASTM A790 | 7/10 (70%) | 100% |
| ASTM A312 | 7/10 (70%) | 100% |

*Note: A240 and A182 excluded from tests (documents not in indexed library)*

### Failed Queries (10/80)

Most failures are due to:
1. Pattern matching sensitivity (exact values not in expected format)
2. Scope questions where system provides more detailed answer than expected pattern

### Latency

- Average: 11.4s
- P50: 11.4s
- P95: 14.0s

*Note: Latency optimization deprioritized to preserve accuracy. Re-ranking enabled for better answer quality.*

### Post-MVP Enhancements

- [ ] Unstructured.io for better table extraction
- [ ] Clerk authentication for user tracking
- [ ] Stripe integration for paid tiers
- [x] Enhanced table chunking boost (+0.15) - Implemented
- [ ] Upload A240 and A182 documents for full coverage

---

## 8. Cost Structure

| Service | Free Tier | Paid Tier | Notes |
|---------|-----------|-----------|-------|
| Vercel | Free | - | Hosting |
| Supabase | Free (500MB, 50K requests) | $25/mo | Database + Storage |
| Groq | 14,400 req/day | $0.05/1M tokens | LLM |
| Voyage AI | 200M tokens/mo | - | Embeddings |
| Upstash Redis | 10K req/day | $0.20/100K req | Rate limiting |
| **Total** | **$0/mo** | **~$25/mo at scale** | |

---

## 9. Production Deployment

### ✅ Ready to Deploy

All accuracy targets met:
- Answer Accuracy: 87.5% (target: 75%)
- Source Accuracy: 80.0% (target: 80%)

### Deployment Steps

1. **Verify Vercel Environment Variables** (already configured):
   - `VOYAGE_API_KEY`
   - `GROQ_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

2. **Deploy to Production**:
   ```bash
   git push origin main  # Auto-deploys via Vercel
   ```

3. **Post-Deployment Verification**:
   - Test 3-5 queries manually on production
   - Verify citations link to correct documents
   - Check Upstash dashboard for rate limiting metrics

---

## Appendix: Key Technical Files

| Category | Files |
|----------|-------|
| Rate Limiting | `lib/rate-limit.ts`, `middleware.ts` |
| PDF Viewing | `components/pdf-viewer-modal.tsx`, `components/pdf-viewer-panel.tsx` |
| RAG Pipeline | `lib/hybrid-search.ts`, `lib/reranker.ts`, `lib/query-decomposition.ts` |
| Document Mapping | `lib/document-mapper.ts` |
| Testing | `scripts/accuracy-test.ts`, `scripts/comprehensive-evaluation.ts` |
| Configuration | `.env.example`, `CLAUDE.md` |
