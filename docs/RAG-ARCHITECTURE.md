# Steel Agents - RAG Architecture & Dataflow

## System Overview

Steel Agents is an AI-powered RAG (Retrieval-Augmented Generation) system designed for steel specification compliance verification. It provides traceable, cited answers from uploaded ASTM/NACE/API specification documents.

---

## Dataflow Architecture (0 to 100)

```
                                    STEEL AGENTS RAG PIPELINE

    +------------------+     +------------------+     +------------------+
    |   USER UPLOADS   |     |   PROCESSING     |     |   INDEXING       |
    |      PDF         | --> |   PIPELINE       | --> |   PIPELINE       |
    +------------------+     +------------------+     +------------------+
           |                        |                        |
           v                        v                        v
    +--------------+         +--------------+         +--------------+
    | Supabase     |         | unpdf        |         | Google       |
    | Storage      |         | Extract Text |         | Embeddings   |
    | (50MB max)   |         | (mergePages) |         | (3072 dim)   |
    +--------------+         +--------------+         +--------------+
                                    |                        |
                                    v                        v
                             +--------------+         +--------------+
                             | Chunking     |         | Supabase     |
                             | 1000 chars   |         | pgvector     |
                             | 200 overlap  |         | Storage      |
                             +--------------+         +--------------+


                                    QUERY PIPELINE

    +------------------+     +------------------+     +------------------+
    |   USER QUERY     |     |  HYBRID SEARCH   |     |   LLM RESPONSE   |
    |   "yield of      | --> |  BM25 + Vector   | --> |   with Citations |
    |    S31803?"      |     |  Fusion          |     |   [1], [2], [3]  |
    +------------------+     +------------------+     +------------------+
           |                        |                        |
           v                        v                        v
    +--------------+         +--------------+         +--------------+
    | Query        |         | Vector:      |         | Groq API     |
    | Preprocessing|         | Cosine sim   |         | Llama 3.3    |
    | UNS/ASTM     |         | BM25: Exact  |         | 70B          |
    | Detection    |         | keyword      |         | (+ fallbacks)|
    +--------------+         +--------------+         +--------------+
                                    |
                                    v
                             +--------------+
                             | Top 5 Chunks |
                             | + Metadata   |
                             | (doc, page)  |
                             +--------------+
```

---

## Processing Time Estimation

| Operation | Time per Unit | Example |
|-----------|---------------|---------|
| PDF Upload | ~1s per 5MB | 50MB = 10s |
| Text Extraction | ~0.5s per page | 30 pages = 15s |
| Chunking | ~0.1s per page | 30 pages = 3s |
| Embedding Generation | ~0.3s per chunk | 100 chunks = 30s |
| **Total Processing** | **~3s per page** | **30 pages = 90s** |

### Formula
```
Estimated Time (seconds) = PDF_Pages × 3

Examples:
- 10 page spec: ~30 seconds
- 30 page spec: ~90 seconds
- 100 page spec: ~5 minutes
```

---

## Achieving 90%+ Accuracy

### Current Performance
| Metric | Target | Current |
|--------|--------|---------|
| Overall Accuracy | ≥90% | 65-75% |
| Hallucination Rate | ≤5% | 3-8% |
| Refusal Accuracy | ≥95% | 85-95% |

### Steps to 90% Accuracy

#### 1. Document Coverage (Critical)
- Upload ALL relevant ASTM specifications
- Ensure table data is properly extracted
- Include supplementary materials

#### 2. Chunking Optimization
```typescript
// Current: 1000 chars, 200 overlap
// Recommended for tables: 1500 chars, 300 overlap
chunkSize: 1500,
overlap: 300
```

#### 3. Hybrid Search Tuning
```typescript
// For technical queries with codes (S31803, A790):
bm25Weight: 0.6  // Boost exact matches
vectorWeight: 0.4

// For natural language queries:
bm25Weight: 0.3
vectorWeight: 0.7
```

#### 4. Prompt Engineering
- System prompt enforces citation requirements
- Explicit instruction to refuse when data not found
- Temperature set to 0.3 for consistency

#### 5. Golden Dataset Size
| Documents | Questions | Minimum for 90% |
|-----------|-----------|-----------------|
| 5-10 specs | 50-100 Q&A | Basic validation |
| 15-25 specs | 150-250 Q&A | Production ready |
| 50+ specs | 500+ Q&A | Enterprise grade |

---

## Recommended Document Checklist

### Tier 1: Essential (Must Have)
| Document | Purpose | Priority |
|----------|---------|----------|
| ASTM A790/A790M | Duplex pipe (most queried) | Critical |
| ASTM A312/A312M | Austenitic pipe (316L, 304) | Critical |
| ASTM A240/A240M | Stainless plate/sheet | Critical |
| ASTM A789/A789M | Duplex tubing | High |
| ASTM A182/A182M | Forged fittings/flanges | High |

### Tier 2: Important (Should Have)
| Document | Purpose | Priority |
|----------|---------|----------|
| ASTM A923 | Duplex testing methods | High |
| ASTM A276/A276M | Stainless bars/shapes | Medium |
| ASTM A479/A479M | Stainless bars for vessels | Medium |
| ASTM A351/A351M | Austenitic castings | Medium |
| ASTM A890/A890M | Duplex castings | Medium |
| ASTM A872/A872M | Centrifugal cast duplex | Medium |
| ASTM A1049/A1049M | Duplex forgings | Medium |

### Tier 3: Comprehensive (Nice to Have)
| Document | Purpose | Priority |
|----------|---------|----------|
| NACE MR0175/ISO 15156 | Sour service requirements | High |
| API 6A | Wellhead equipment | Medium |
| API 5L | Line pipe | Medium |
| ASME B16.5 | Pipe flanges | Medium |
| ASME B31.3 | Process piping | Medium |
| EN 10204 | Test certificates | Low |

### Tier 4: Specialty (As Needed)
| Document | Purpose | Priority |
|----------|---------|----------|
| ASTM A928/A928M | Welded duplex pipe | Low |
| ASTM G48 | Corrosion testing | Low |
| ASTM E562 | Ferrite measurement | Low |
| ASTM A370 | Mechanical testing | Low |

---

## Provider Fallback Chain

```
┌─────────────────────────────────────────────────────────────┐
│                    LLM PROVIDER CHAIN                       │
├─────────────────────────────────────────────────────────────┤
│  1. Groq (Primary)                                          │
│     └─ llama-3.3-70b-versatile (best quality)              │
│     └─ llama-3.1-8b-instant (faster)                       │
│     └─ mixtral-8x7b-32768 (fallback)                       │
│                           ↓ (if rate limited)               │
│  2. Cerebras                                                │
│     └─ llama-3.3-70b                                       │
│     └─ llama-3.1-8b                                        │
│                           ↓ (if rate limited)               │
│  3. Together AI                                             │
│     └─ Llama-3.3-70B-Instruct-Turbo                        │
│                           ↓ (if rate limited)               │
│  4. OpenRouter                                              │
│     └─ llama-3.3-70b-instruct:free                         │
│     └─ mistral-7b-instruct:free                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Model Recommendations

### For Steel Specification RAG

| Model | Accuracy | Speed | Cost | Recommendation |
|-------|----------|-------|------|----------------|
| **Llama 3.3 70B** | 85-90% | Fast | Free | Best free option |
| Claude Opus 4.5 | 95%+ | Medium | $$$ | Best overall |
| GPT-4o | 90-95% | Medium | $$ | Good alternative |
| Mixtral 8x7B | 80-85% | Fast | Free | Budget option |

### Why Llama 3.3 70B Works Well
1. Strong numerical extraction (yield strength, chemistry)
2. Good at following citation instructions
3. Low hallucination on technical content
4. Available free on multiple providers

---

## Improvement Recommendations

### High Priority
1. **Table Extraction**: Use Unstructured.io or Azure Document Intelligence for better table parsing
2. **Hybrid Search Migration**: Apply Supabase migration for BM25+vector fusion
3. **Chunk Metadata**: Include section headers and table titles in chunks

### Medium Priority
4. **Query Expansion**: Add synonym handling (2205 = S31803 = F51)
5. **Confidence Scoring**: Return confidence with each answer
6. **Answer Verification**: Cross-check numerical values across chunks

### Low Priority
7. **Multi-document Reasoning**: Compare specs across standards
8. **Version Tracking**: Handle multiple revisions of same spec
9. **User Feedback Loop**: Track corrections to improve prompts

---

## Environment Variables Required

```bash
# Required (minimum)
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
GOOGLE_API_KEY=xxx           # For embeddings
GROQ_API_KEY=xxx             # Primary LLM

# Optional (fallbacks)
CEREBRAS_API_KEY=xxx         # Fallback 1
TOGETHER_API_KEY=xxx         # Fallback 2
OPENROUTER_API_KEY=xxx       # Fallback 3
```

---

## Testing Checklist

- [ ] Upload 5+ ASTM specs via UI
- [ ] Verify "indexed" status for all documents
- [ ] Run evaluation: `npx tsx scripts/evaluate-accuracy.ts --verbose`
- [ ] Check accuracy ≥90%, hallucination ≤5%
- [ ] Test refusal on out-of-scope questions
- [ ] Verify citations link to correct pages
- [ ] Test fallback when primary LLM rate limited
