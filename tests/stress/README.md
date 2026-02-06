# Stress Testing & Performance Measurement

Comprehensive stress testing framework for the SpecVault RAG system with synthetic data, KPI measurement, and continuous performance monitoring.

## Quick Start

```bash
# Install dependencies (k6 required globally)
npm install
npm install -g k6  # For load testing

# Generate synthetic test PDFs
npm run generate-synthetic-pdfs

# Run all stress tests
npm run stress:all

# Run individual scenarios
npm run stress:query      # Query load test
npm run stress:upload     # Upload load test
npm run stress:mixed      # Mixed workload
npm run stress:spike      # Spike test (DDoS simulation)

# Run performance profiling
npm run test:performance
```

## Architecture

```
tests/
├── stress/
│   ├── scenarios/          # k6 load test scripts
│   │   ├── query-storm.js      # 20-50 concurrent users querying
│   │   ├── upload-storm.js     # 5-10 concurrent uploads
│   │   ├── mixed-workload.js   # 80% queries, 20% uploads
│   │   └── spike-test.js       # 100-user spike test
│   ├── synthetic-pdfs/     # Test data
│   │   ├── generate-all.ts     # PDF generation script
│   │   ├── astm-a999-simple.pdf    # 1 page
│   │   ├── astm-a998-medium.pdf    # 15 pages
│   │   └── astm-a997-complex.pdf   # 50 pages
│   ├── golden-queries.json # 53 test queries with expected answers
│   └── metrics/            # Performance tracking
│       ├── schema.sql          # SQLite schema
│       ├── collector.ts        # Metrics collection
│       ├── reporter.ts         # Reporting & alerts
│       └── stress-test.db      # Metrics database (git-ignored)
├── performance/            # Component profiling
│   ├── component-profiling.test.ts     # Individual component benchmarks
│   └── bottleneck-analysis.test.ts     # Pipeline bottleneck identification
└── regression/
    └── performance-regression.test.ts  # Track perf over time
```

## Test Scenarios

### 1. Query Storm (query-storm.js)

**Purpose**: Test RAG system under sustained query load

**Configuration**:
- 20-50 concurrent users
- 3.5 minute duration
- Random queries from golden dataset

**Pass Criteria**:
- P95 latency < 10s
- P99 latency < 15s
- Error rate < 5%

**What it tests**:
- LLM rate limits (Groq: 14,400 req/day)
- Embedding API (Voyage: 1000+ RPM)
- Cache effectiveness
- Supabase pgvector performance

**Run**:
```bash
npm run stress:query
```

### 2. Upload Storm (upload-storm.js)

**Purpose**: Test document processing under concurrent uploads

**Configuration**:
- 5-10 concurrent users
- 3 minute duration
- Uploads synthetic PDFs

**Pass Criteria**:
- P95 upload time < 60s
- Error rate < 10%

**What it tests**:
- PDF text extraction (unpdf + OCR fallback)
- Embedding generation throughput
- Database write concurrency
- Storage limits

**Run**:
```bash
npm run stress:upload
```

### 3. Mixed Workload (mixed-workload.js)

**Purpose**: Simulate realistic usage (80% reads, 20% writes)

**Configuration**:
- 15 concurrent queriers
- 3 concurrent uploaders
- 5 minute duration

**Pass Criteria**:
- No mutual interference (queries don't slow during uploads)
- Query P95 < 10s
- Upload P95 < 60s

**What it tests**:
- Resource contention
- Real-world usage patterns
- System stability under mixed load

**Run**:
```bash
npm run stress:mixed
```

### 4. Spike Test (spike-test.js)

**Purpose**: Test system resilience under sudden traffic surge

**Configuration**:
- 5 → 100 → 5 users (sudden spike)
- 2.5 minute duration

**Pass Criteria**:
- No crashes (server must stay up)
- Error rate < 50% during spike
- Recovery within 30s after spike ends

**What it tests**:
- Graceful degradation
- Rate limiting behavior
- Error handling
- Model fallback activation

**Run**:
```bash
npm run stress:spike
```

## Synthetic Test Data

### 3 PDF Samples

**Simple (astm-a999-simple.pdf)**:
- 1 page, ~500 words
- Single table with mechanical properties
- 10 easy golden questions
- Tests: Basic retrieval, table extraction

**Medium (astm-a998-medium.pdf)**:
- 15 pages, ~3000 words
- Multiple sections (Scope, Heat Treatment, Chemical Composition)
- Multi-page tables
- 20 easy/medium golden questions
- Tests: Section chunking, cross-page retrieval

**Complex (astm-a997-complex.pdf)**:
- 50 pages, ~15,000 words
- Full specification with formulas (hydrostatic test pressure)
- Detailed tables, appendices, index
- 30 easy/medium/hard/trap questions
- Tests: Formula handling, complex retrieval, refusal accuracy

### Golden Query Dataset

53 test queries across 3 documents:

- **32 easy**: Direct lookups (e.g., "What is yield strength?")
- **15 medium**: Cross-section queries (e.g., "Compare Grade A vs B")
- **3 hard**: Formula-based calculations
- **3 trap**: Out-of-scope questions (tests refusal accuracy)

**File**: `tests/stress/golden-queries.json`

## KPI Measurement

### Metrics Collected

**SQLite Database** (`tests/stress/metrics/stress-test.db`):

```sql
CREATE TABLE request_metrics (
  endpoint TEXT,
  duration_ms INTEGER,
  status_code INTEGER,
  timestamp TEXT
);

CREATE TABLE component_metrics (
  component TEXT,           -- 'embedding_api', 'llm', 'vector_search'
  operation TEXT,
  duration_ms INTEGER,
  success BOOLEAN
);
```

### Real-Time Dashboard

During stress tests, view live metrics:

```
📊 STRESS TEST DASHBOARD

/api/chat Performance:
  P50: 4,200ms
  P95: 9,800ms  ✓
  P99: 14,500ms
  Error Rate: 3.2%  ✓

Component Breakdown:
  llm_generation       2,100ms (52%)
  vector_search        1,200ms (29%)
  embedding_api          800ms (19%)

Rate Limit Usage:
  Voyage AI: 68% of 1000 RPM  ✓
  Groq: 42% of 10/min  ✓
```

### Alert Thresholds

```typescript
{
  chat_p95_ms: 10000,           // Alert if P95 > 10s
  upload_p95_ms: 60000,         // Alert if P95 > 60s
  error_rate_percent: 5,        // Alert if error rate > 5%
  embedding_rate_limit: 0.9,    // Alert if within 90% of limit
  cache_hit_rate_min: 0.3,      // Alert if cache hit rate < 30%
}
```

## Performance Instrumentation

### Usage in Code

```typescript
import { perf } from '@/lib/instrumentation';

// Instrument a function
export async function someFunction() {
  const endTimer = perf.startTimer('function_name');

  try {
    // Your code here
    return result;
  } finally {
    endTimer();
  }
}

// Get statistics
const stats = perf.getStats('function_name');
console.log(`Avg: ${stats.avg}ms, P95: ${stats.p95}ms`);
```

### Decorator (for classes)

```typescript
import { instrument } from '@/lib/instrumentation';

class MyService {
  @instrument('my_operation')
  async myOperation() {
    // Automatically instrumented
  }
}
```

## Component Profiling

**Test individual components**:

```bash
npm run test:performance
```

**Output**:
```
✓ Embedding generation: 487ms
✓ Vector search: 312ms
✓ LLM generation: 2,134ms

📊 Component Breakdown:
  llm_generation       2,134ms (65.8%)
  embedding_generation   487ms (15.0%)
  vector_search          312ms (9.6%)

⚠️  Bottleneck: llm_generation (2,134ms)
```

## Bottleneck Analysis

**Identify pipeline bottlenecks**:

```bash
npm run test:bottleneck
```

**Output**:
```
📊 RAG Pipeline Breakdown:
  Total time: 8,123ms

  llm             4,012ms (49.4%)
  rerank          2,987ms (36.8%)
  search            812ms (10.0%)
  embedding         498ms (6.1%)
  preprocessing      10ms (0.1%)

⚠️  Bottlenecks (>30% of total):
  ❗ rag_llm: 49.4%
  ❗ rag_rerank: 36.8%
```

## Regression Testing

**Check for performance regressions**:

```bash
npm run stress:check-regression
```

**Fails if any metric regresses by >10%** from baseline.

## CI/CD Integration

**Automated nightly tests** via GitHub Actions:

```yaml
# .github/workflows/stress-test.yml
on:
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2am
  workflow_dispatch:     # Manual trigger
```

**Artifacts uploaded**:
- Metrics database (30-day retention)
- JSON report
- Performance graphs

## Cost Analysis

**All stress tests stay within free tiers**:

| Service | Usage | Quota | % Used |
|---------|-------|-------|--------|
| Voyage AI | ~100k tokens | 200M tokens/month | 0.05% |
| Groq | ~1000 requests | 14,400 req/day | 6.9% |
| Supabase | ~50MB data | 500MB free | 10% |
| GitHub Actions | ~30 min | 2000 min/month | 1.5% |

**Total cost: $0/month** ✅

## Next Steps

### After Running Stress Tests

1. **Review metrics database**:
   ```bash
   sqlite3 tests/stress/metrics/stress-test.db
   SELECT * FROM request_metrics ORDER BY duration_ms DESC LIMIT 10;
   ```

2. **Identify bottlenecks**:
   - If LLM > 60% of total: Consider caching responses, smaller model, or streaming
   - If embeddings > 30%: Increase cache hit rate, batch more aggressively
   - If search > 20%: Optimize pgvector indexes, reduce match_count

3. **Address rate limits**:
   - Voyage AI: Self-host embeddings (Arctic-Embed-L) if hitting 1000 RPM
   - Groq: Use model fallback chain more aggressively

4. **Set baseline**:
   ```bash
   cp tests/stress/metrics/stress-test.db tests/stress/metrics/baseline.db
   ```

5. **Track improvements**:
   - Re-run stress tests after optimizations
   - Compare with baseline
   - Update thresholds as system improves

## Troubleshooting

**k6 not found**:
```bash
npm install -g k6
# Or install via package manager (see k6.io/docs)
```

**SQLite errors**:
```bash
npm install better-sqlite3 @types/better-sqlite3
```

**Timeout errors during tests**:
- Normal during spike test (expected degradation)
- Check Groq/Voyage API status
- Verify Supabase connection

**High error rates (>10%)**:
- Check API keys in .env
- Verify database connection
- Review server logs

## References

- [k6 Documentation](https://k6.io/docs/)
- [Plan: Comprehensive RAG Improvement Roadmap](/Users/david/.claude/plans/cuddly-puzzling-ocean.md)
- [Golden Dataset Specification](./golden-queries.json)

---

**Need help?** Review the comprehensive plan at `/Users/david/.claude/plans/cuddly-puzzling-ocean.md`
