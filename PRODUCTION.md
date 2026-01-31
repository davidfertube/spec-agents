# Production Deployment & Operations Guide

**Enterprise-grade deployment strategies for Spec Agents MVP → Scale**

## Table of Contents

- [Production Readiness Checklist](#production-readiness-checklist)
- [Infrastructure & Deployment](#infrastructure--deployment)
- [Observability & Monitoring](#observability--monitoring)
- [Security & Compliance](#security--compliance)
- [Performance Optimization](#performance-optimization)
- [Incident Response](#incident-response)
- [Cost Optimization](#cost-optimization)

---

## Production Readiness Checklist

### MVP Launch (Current State)

- [x] **Core Functionality**: Upload PDF, hybrid search, LLM generation
- [x] **Citation System**: Page numbers + char offsets for highlighting
- [x] **Error Handling**: Graceful failures, user-friendly messages
- [x] **Input Validation**: Zod schemas, file type/size limits
- [x] **Environment Config**: `.env` for secrets, not hardcoded
- [x] **CI/CD Pipeline**: GitHub Actions for tests + deployment
- [x] **Monitoring**: Basic Vercel analytics

### Production Enhancements (Pre-Scale)

- [ ] **Authentication**: Clerk or Auth0 integration
- [ ] **Rate Limiting**: Upstash Redis + middleware
- [ ] **Observability**: OpenTelemetry + Datadog/New Relic
- [ ] **Error Tracking**: Sentry for exceptions
- [ ] **Database RLS**: Row-level security on Supabase
- [ ] **API Versioning**: `/v1/` prefixed routes
- [ ] **Health Checks**: `/health` endpoint for load balancers
- [ ] **Graceful Shutdown**: Drain connections before restart

### Enterprise Scale (Post-PMF)

- [ ] **Multi-tenancy**: Workspace isolation
- [ ] **Audit Logging**: Compliance trail for all operations
- [ ] **Disaster Recovery**: Automated backups + restoration
- [ ] **Load Testing**: Identify bottlenecks at 10K+ concurrent users
- [ ] **CDN**: CloudFlare/Fastly for static assets
- [ ] **Database Replicas**: Read replicas for analytics queries
- [ ] **Blue-Green Deployments**: Zero-downtime updates

---

## Infrastructure & Deployment

### Current Architecture (Serverless)

```yaml
Platform: Vercel (Edge Functions)
Database: Supabase PostgreSQL + pgvector
File Storage: Supabase Storage (S3-compatible)
LLM: Groq API (external)
Embeddings: Voyage AI API (external)
```

**Benefits**:
- **Scales to zero**: No idle costs
- **Auto-scaling**: Handles traffic spikes automatically
- **Global edge**: Low latency worldwide
- **No ops burden**: Managed infrastructure

**Limitations**:
- **Cold starts**: ~200ms for first request
- **Max execution time**: 60s (Vercel Pro), 300s (Enterprise)
- **Limited control**: Can't optimize Linux kernel

### Migration Path: Serverless → Containerized

**When to migrate**: >100K users, need custom infrastructure

```mermaid
graph LR
    A[Vercel Serverless] --> B{Traffic > 100K?}
    B -->|No| C[Stay on Vercel]
    B -->|Yes| D[AWS ECS Fargate]
    D --> E[Auto Scaling Groups]
    D --> F[Application Load Balancer]
    D --> G[CloudWatch Logs]
```

**Docker Setup**:
```dockerfile
# Dockerfile for production
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

**Kubernetes Deployment** (for multi-region scale):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spec-agents-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0  # Zero downtime
  template:
    spec:
      containers:
      - name: api
        image: spec-agents:v1.0.0
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: spec-agents-api
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: spec-agents
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: spec-agents-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: spec-agents-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: vercel/actions@v2
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  e2e-smoke-test:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - name: Run smoke tests
        run: |
          curl -f https://spec-agents.vercel.app/health || exit 1
          curl -f https://spec-agents.vercel.app/api/health || exit 1

  notify:
    needs: [deploy, e2e-smoke-test]
    runs-on: ubuntu-latest
    if: failure()
    steps:
      - name: Notify on failure
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
          text: "Production deployment failed! @oncall"
```

---

## Observability & Monitoring

### Logging Strategy

**Levels**:
- **DEBUG**: Detailed diagnostic info (dev only)
- **INFO**: Normal operations (query received, PDF uploaded)
- **WARN**: Degraded performance, fallbacks triggered
- **ERROR**: Failures requiring investigation
- **FATAL**: System-level failures (database unreachable)

**Structured Logging**:
```typescript
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => ({ level: label.toUpperCase() })
  }
});

// Usage
logger.info({
  event: "query_received",
  user_id: req.user.id,
  query: req.body.query,
  timestamp: new Date().toISOString()
});

logger.error({
  event: "llm_failure",
  error: error.message,
  stack: error.stack,
  provider: "groq",
  fallback_triggered: true
});
```

### Metrics Collection (OpenTelemetry)

```typescript
import { metrics } from "@opentelemetry/api";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";

const meter = metrics.getMeter("spec-agents");

// Counter: Total queries
const queryCounter = meter.createCounter("queries_total", {
  description: "Total number of queries processed"
});

// Histogram: Query latency
const queryLatency = meter.createHistogram("query_latency_ms", {
  description: "Query processing latency in milliseconds"
});

// Gauge: Active connections
const activeConnections = meter.createObservableGauge("active_connections", {
  description: "Number of active database connections"
});

// Usage
app.post("/api/chat", async (req, res) => {
  const start = Date.now();

  queryCounter.add(1, { user_id: req.user.id, endpoint: "/api/chat" });

  const response = await processQuery(req.body.query);

  queryLatency.record(Date.now() - start, { status: "success" });

  res.json(response);
});
```

**Prometheus Metrics** (exposed at `/metrics`):
```
# HELP queries_total Total number of queries processed
# TYPE queries_total counter
queries_total{user_id="user_123",endpoint="/api/chat"} 1247

# HELP query_latency_ms Query processing latency in milliseconds
# TYPE query_latency_ms histogram
query_latency_ms_bucket{le="1000",status="success"} 950
query_latency_ms_bucket{le="5000",status="success"} 1200
query_latency_ms_sum{status="success"} 1847392
query_latency_ms_count{status="success"} 1247
```

### Distributed Tracing

```typescript
import { trace } from "@opentelemetry/api";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const tracer = trace.getTracer("spec-agents-api");

app.post("/api/chat", async (req, res) => {
  const span = tracer.startSpan("handle_query", {
    attributes: {
      "user.id": req.user.id,
      "query.text": req.body.query
    }
  });

  try {
    // Child span: Search
    const searchSpan = tracer.startSpan("hybrid_search", { parent: span });
    const results = await hybridSearch(req.body.query);
    searchSpan.setAttribute("results.count", results.length);
    searchSpan.end();

    // Child span: LLM generation
    const llmSpan = tracer.startSpan("llm_generate", { parent: span });
    const response = await llm.generate({ context: results });
    llmSpan.setAttribute("tokens.input", response.usage.promptTokens);
    llmSpan.setAttribute("tokens.output", response.usage.completionTokens);
    llmSpan.end();

    span.setStatus({ code: SpanStatusCode.OK });
    res.json(response);
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    span.end();
  }
});
```

**Trace Visualization** (Jaeger/Zipkin):
```
Trace ID: abc123
├─ handle_query (2.3s)
   ├─ hybrid_search (1.1s)
   │  ├─ bm25_search (0.3s)
   │  └─ vector_search (0.8s)
   ├─ llm_generate (1.0s)
   │  ├─ groq_api_call (0.9s)
   │  └─ fallback_anthropic (0.0s - skipped)
   └─ citation_verify (0.2s)
```

### Alerting Rules

```yaml
# alerts.yml (Prometheus AlertManager)
groups:
  - name: spec-agents-critical
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate (> 5%)"
          description: "{{ $value }}% of requests failing in last 5 min"

      - alert: SlowQueryLatency
        expr: histogram_quantile(0.95, query_latency_ms) > 15000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency > 15s"

      - alert: DatabaseConnectionPoolExhausted
        expr: active_connections > 90
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool near exhaustion"

      - alert: CostBudgetExceeded
        expr: daily_llm_cost_usd > 100
        labels:
          severity: warning
        annotations:
          summary: "Daily LLM cost exceeded $100"
```

**PagerDuty Integration**:
```yaml
receivers:
  - name: oncall
    pagerduty_configs:
      - service_key: ${{ secrets.PAGERDUTY_KEY }}
        description: "{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}"

route:
  receiver: oncall
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: oncall
      continue: true
```

---

## Security & Compliance

### Authentication & Authorization

**Clerk Integration** (Recommended):
```typescript
import { clerkMiddleware, requireAuth } from "@clerk/nextjs/server";

// Public routes (no auth)
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Protected routes (auth required)
app.post("/api/chat", clerkMiddleware(), requireAuth(), async (req, res) => {
  const userId = req.auth.userId;

  // Check rate limit
  const rateLimitOk = await checkRateLimit(userId);
  if (!rateLimitOk) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  // Process query
  const response = await processQuery(req.body.query, userId);
  res.json(response);
});
```

### Rate Limiting (Upstash Redis)

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 h"),  // 100 req/hour
  analytics: true
});

async function rateLimitMiddleware(req, res, next) {
  const identifier = req.user?.id || req.ip;
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

  res.setHeader("X-RateLimit-Limit", limit);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", reset);

  if (!success) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      retryAfter: reset
    });
  }

  next();
}
```

### Input Validation & Sanitization

```typescript
import { z } from "zod";

const QuerySchema = z.object({
  query: z.string()
    .min(1, "Query cannot be empty")
    .max(1000, "Query too long (max 1000 chars)")
    .regex(/^[a-zA-Z0-9\s\-_,.\?]+$/, "Invalid characters in query"),
  filters: z.object({
    standard: z.enum(["ASTM", "NACE", "API", "ASME"]).optional(),
    dateFrom: z.string().datetime().optional()
  }).optional()
});

app.post("/api/chat", async (req, res) => {
  try {
    const validated = QuerySchema.parse(req.body);
    const response = await processQuery(validated.query);
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors
      });
    }
    throw error;
  }
});
```

### Secrets Management

**AWS Secrets Manager**:
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });

async function getSecret(secretName: string): Promise<string> {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  return response.SecretString;
}

// Usage
const GROQ_API_KEY = await getSecret("prod/spec-agents/groq-api-key");
```

**HashiCorp Vault**:
```bash
# Store secret
vault kv put secret/spec-agents/groq-api-key value="gsk_..."

# Retrieve in app
export GROQ_API_KEY=$(vault kv get -field=value secret/spec-agents/groq-api-key)
```

### GDPR & Data Privacy

**Right to be Forgotten**:
```typescript
app.delete("/api/users/:userId", requireAuth(), async (req, res) => {
  const userId = req.params.userId;

  // Verify user owns this account
  if (req.auth.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Delete user data
  await Promise.all([
    supabase.from("query_logs").delete().eq("user_id", userId),
    supabase.from("uploaded_documents").delete().eq("user_id", userId),
    supabase.from("users").delete().eq("id", userId)
  ]);

  res.json({ message: "Account deleted" });
});
```

**Data Retention Policy**:
```sql
-- Auto-delete query logs older than 90 days (GDPR compliance)
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'delete-old-query-logs',
  '0 2 * * *',  -- Daily at 2 AM
  $$DELETE FROM query_logs WHERE created_at < NOW() - INTERVAL '90 days'$$
);
```

---

## Performance Optimization

### Database Optimization

**Indexing Strategy**:
```sql
-- pgvector HNSW index (faster than IVFFlat for < 1M vectors)
CREATE INDEX embeddings_hnsw_idx ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- BM25 full-text search index
CREATE INDEX content_fts_idx ON document_chunks
USING GIN (to_tsvector('english', content));

-- Composite index for common filters
CREATE INDEX documents_standard_date_idx ON documents(standard, effective_date DESC);
```

**Query Optimization**:
```sql
-- Before (slow - sequential scan)
SELECT * FROM document_chunks WHERE content LIKE '%hardness%';

-- After (fast - uses GIN index)
SELECT * FROM document_chunks WHERE to_tsvector('english', content) @@ to_tsquery('hardness');
```

**Connection Pooling**:
```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: false  // Server-side, no session storage
    },
    global: {
      headers: {
        "X-Client-Info": "spec-agents-api"
      }
    }
  }
);

// Use pooler for high-concurrency (6543 instead of 5432)
const DATABASE_URL = "postgresql://user:pass@db.project.supabase.co:6543/postgres";
```

### Caching Strategy

**Multi-Level Cache**:
```
L1 (In-Memory) → L2 (Redis) → L3 (Database)
  ~1ms            ~10ms         ~100ms
```

**Implementation**:
```typescript
import { LRUCache } from "lru-cache";
import { Redis } from "ioredis";

// L1: In-memory cache (per-instance)
const memoryCache = new LRUCache({
  max: 100,  // Store 100 most recent queries
  ttl: 1000 * 60 * 5  // 5 minutes
});

// L2: Redis cache (shared across instances)
const redis = new Redis(process.env.REDIS_URL);

async function getCachedQuery(query: string): Promise<string | null> {
  // Check L1
  const memoryCached = memoryCache.get(query);
  if (memoryCached) return memoryCached;

  // Check L2
  const redisCached = await redis.get(`query:${query}`);
  if (redisCached) {
    memoryCache.set(query, redisCached);  // Populate L1
    return redisCached;
  }

  // Cache miss
  return null;
}

async function setCachedQuery(query: string, response: string) {
  memoryCache.set(query, response);
  await redis.setex(`query:${query}`, 3600, response);  // 1 hour TTL
}
```

### CDN for Static Assets

```typescript
// next.config.js
module.exports = {
  images: {
    loader: 'cloudflare',
    path: 'https://spec-agents.com/'
  },
  assetPrefix: process.env.CDN_URL,  // CloudFlare CDN
};
```

---

## Incident Response

### Runbook Template

**Incident**: Database Connection Pool Exhausted

**Detection**:
- Alert: "active_connections > 90"
- Symptoms: 500 errors, slow queries

**Diagnosis**:
```bash
# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Identify long-running queries
psql $DATABASE_URL -c "SELECT pid, query_start, state, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;"
```

**Resolution**:
```bash
# Kill long-running queries
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';"

# Scale up connection pool
# Update DATABASE_MAX_CONNECTIONS=200 in Vercel dashboard
```

**Prevention**:
- Implement query timeouts (30s max)
- Add connection pooler (PgBouncer)
- Monitor query performance with `pg_stat_statements`

### On-Call Escalation

```
Level 1: Automated alerts → #alerts Slack channel
Level 2: PagerDuty → On-call engineer
Level 3: Escalation → Engineering manager
Level 4: Incident commander → CTO
```

---

## Cost Optimization

### Current Costs (MVP)

| Service | Monthly Cost | Usage |
|---------|-------------|-------|
| Vercel Pro | $20 | Hosting + edge functions |
| Supabase Pro | $25 | Database + storage |
| Groq API | $0 | 14,400 req/day free tier |
| Voyage AI | $0 | 200M tokens/month free |
| **Total** | **$45** | ~1K queries/day |

### Projected Costs at Scale

| Tier | Users | Queries/Day | Monthly Cost |
|------|-------|-------------|--------------|
| Launch | 100 | 1K | $45 |
| Growth | 1K | 10K | $155 |
| Scale | 10K | 100K | $720 |
| Enterprise | 100K | 1M | $4,500 |

**Cost Breakdown at 100K queries/day**:
- Vercel: $20 (fixed)
- Supabase: $50 (Pro + compute)
- Groq: $200 (usage-based)
- Voyage: $150 (usage-based)
- Redis: $50 (Upstash Pro)
- Monitoring: $50 (Datadog/Sentry)

### Cost Reduction Strategies

1. **Aggressive Caching**: 40% cost reduction
   ```typescript
   // Cache hit rate: 60% → saves $120/month on LLM costs
   ```

2. **Batch Embedding Generation**:
   ```typescript
   // Batch 100 chunks → 1 API call instead of 100
   const embeddings = await voyage.embed(chunks);  // 10x cheaper
   ```

3. **Smart Model Routing**:
   ```typescript
   // Route simple queries to Groq (free), complex to Anthropic (paid)
   const complexity = analyzeQueryComplexity(query);
   const model = complexity < 0.5 ? "groq" : "anthropic";
   ```

4. **Query Deduplication**:
   ```typescript
   // If 2 users ask same question within 1 hour, reuse response
   const cacheKey = hashQuery(query);
   const cached = await redis.get(cacheKey);
   if (cached) return cached;  // No LLM call
   ```

---

## Resources

- [Vercel Production Checklist](https://vercel.com/docs/concepts/deployments/production-checklist)
- [Supabase Performance Tips](https://supabase.com/docs/guides/platform/performance)
- [OpenTelemetry Best Practices](https://opentelemetry.io/docs/reference/specification/)
- [SRE Book (Google)](https://sre.google/sre-book/table-of-contents/)

---

## Next Steps for Spec Agents

1. **Week 1**: Add health checks + Sentry error tracking
2. **Week 2**: Implement rate limiting with Upstash
3. **Week 3**: Add OpenTelemetry tracing
4. **Week 4**: Set up Prometheus metrics + Grafana dashboards
5. **Month 2**: Load testing with k6, identify bottlenecks
6. **Month 3**: Implement blue-green deployments

Questions? Open a GitHub discussion or issue.
