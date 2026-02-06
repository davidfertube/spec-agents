# SpecVault - Deployment Guide

This guide walks you through deploying SpecVault to **Vercel** with **Supabase** as the backend.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Production Stack                           │
│  ┌──────────────────┐         ┌──────────────────────────────┐  │
│  │ Vercel           │ ──API──▶│ Next.js API Routes          │  │
│  │ (Static + Edge)  │         │ (Serverless Functions)      │  │
│  │                  │         │ ┌────────────────────────┐  │  │
│  │ - Next.js 16     │         │ │ /api/chat              │  │  │
│  │ - React 19       │         │ │ /api/documents/*       │  │  │
│  │ - Edge Runtime   │         │ │ /api/leads             │  │  │
│  └──────────────────┘         │ └────────────────────────┘  │  │
│                               │            │                 │  │
│                               │            ▼                 │  │
│                               │ ┌────────────────────────┐  │  │
│                               │ │ Voyage AI Embeddings   │  │  │
│                               │ │ Groq LLM              │  │  │
│                               │ └────────────────────────┘  │  │
│                               │            │                 │  │
│                               │            ▼                 │  │
│                               │ ┌────────────────────────┐  │  │
│                               │ │ Supabase               │  │  │
│                               │ │ - PostgreSQL           │  │  │
│                               │ │ - pgvector             │  │  │
│                               │ │ - Storage (PDFs)       │  │  │
│                               │ └────────────────────────┘  │  │
│                               └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

1. **GitHub Account** with access to this repository
2. **Vercel Account** (free tier works great)
3. **Supabase Account** (free tier works great)
4. **API Keys**:
   - Voyage AI API Key (from [voyageai.com](https://www.voyageai.com))
   - Groq API Key (from [console.groq.com](https://console.groq.com))

---

## Quick Start (One-Click Deploy)

### Step 1: Deploy to Vercel

Click this button to deploy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/davidfertube/specvault)

This will:
1. Fork the repository to your GitHub account
2. Create a new Vercel project
3. Prompt you for environment variables

### Step 2: Configure Environment Variables

During deployment, add these environment variables:

| Variable | Where to Get It |
|----------|-----------------|
| `VOYAGE_API_KEY` | Sign up at [voyageai.com](https://www.voyageai.com) → API Keys |
| `GROQ_API_KEY` | Sign up at [console.groq.com](https://console.groq.com) → API Keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → `anon` key |

### Step 3: Set Up Supabase

1. **Create Supabase Project**:
   - Go to [supabase.com/dashboard](https://supabase.com/dashboard)
   - Click "New project"
   - Choose organization, name, database password, region
   - Click "Create new project" (takes ~2 minutes)

2. **Run Database Setup**:
   - Go to SQL Editor (left sidebar)
   - Click "New query"
   - Copy and paste contents of `supabase/schema.sql`
   - Click "Run" or press Cmd/Ctrl + Enter

3. **Run Voyage AI Migration**:
   - Still in SQL Editor
   - Click "New query"
   - Copy and paste contents of `supabase/migrations/002_voyage_embeddings.sql`
   - Click "Run"

4. **Create Storage Bucket**:
   - Go to Storage (left sidebar)
   - Click "New bucket"
   - Name: `documents`
   - Public: ✅ (for demo simplicity)
   - Click "Create bucket"

### Step 4: Verify Deployment

Your app should now be live at `https://your-project.vercel.app`!

Test it:
1. Upload a PDF (ASTM spec, material datasheet, etc.)
2. Wait for processing (you'll see a green checkmark)
3. Ask a question like "What is the yield strength of A106 Grade B?"

---

## Manual Deployment (CLI)

If you prefer command-line deployment:

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

```bash
# From project root
cd /Users/david/Downloads/repos/specvault

# Deploy to production
vercel --prod

# Follow prompts:
# - Link to existing project? No
# - What's your project's name? steel-agents
# - In which directory is your code located? ./
# - Override settings? No
```

### Step 4: Add Environment Variables

```bash
# Add environment variables via CLI
vercel env add VOYAGE_API_KEY
vercel env add GROQ_API_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Or add them in Vercel Dashboard:
# → Settings → Environment Variables
```

### Step 5: Redeploy

```bash
# Trigger new deployment with env vars
vercel --prod
```

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VOYAGE_API_KEY` | Voyage AI embedding API key | `pa-xxx...` |
| `GROQ_API_KEY` | Groq LLM API key | `gsk_xxx...` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJxxx...` |

### Optional Variables (LLM Fallback)

| Variable | Description |
|----------|-------------|
| `CEREBRAS_API_KEY` | Cerebras fallback LLM (optional) |
| `TOGETHER_API_KEY` | Together AI fallback LLM (optional) |
| `OPENROUTER_API_KEY` | OpenRouter fallback LLM (optional) |

### Setting Environment Variables in Vercel

**Via Dashboard:**
1. Go to your project in Vercel Dashboard
2. Settings → Environment Variables
3. Add variable name and value
4. Select environments (Production, Preview, Development)
5. Click "Save"

**Via CLI:**
```bash
vercel env add VARIABLE_NAME
# Paste value when prompted
```

---

## Custom Domain (Optional)

### Step 1: Add Domain in Vercel

1. Vercel Dashboard → Your Project → Settings → Domains
2. Enter your domain (e.g., `steel-agents.com`)
3. Click "Add"

### Step 2: Configure DNS

Vercel will show you DNS records to add. Typically:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

Add these records in your domain registrar's DNS settings.

### Step 3: Wait for SSL

Vercel automatically provisions SSL certificates (usually <1 minute).

---

## Continuous Deployment

### Automatic Deployments

Vercel automatically deploys when you push to GitHub:

- **`main` branch** → Production deployment
- **Other branches** → Preview deployments (unique URLs)
- **Pull requests** → Preview deployments (with comments)

### Deployment Workflow

```bash
# Make changes
git add .
git commit -m "feat: Add new feature"
git push origin main

# Vercel automatically:
# 1. Detects the push
# 2. Runs build
# 3. Deploys to production
# 4. Comments on PR with preview URL
```

### Disable Auto-Deploy (Optional)

Vercel Dashboard → Settings → Git → Production Branch
- Uncheck "Automatically deploy"
- Deploy manually instead

---

## Monitoring

### Vercel Analytics

View in Vercel Dashboard:

1. **Overview Tab**:
   - Deployment status
   - Build logs
   - Runtime logs

2. **Analytics Tab**:
   - Page views
   - Unique visitors
   - Performance metrics (Web Vitals)

3. **Functions Tab**:
   - API route execution time
   - Error rates
   - Invocations count

### Supabase Monitoring

View in Supabase Dashboard:

1. **Database Tab**:
   - Table sizes
   - Query performance
   - Active connections

2. **Storage Tab**:
   - Storage usage
   - Bandwidth

3. **Logs Tab**:
   - API requests
   - Database queries
   - Errors

---

## Cost Estimation

### Free Tier (Recommended for MVP)

| Service | Free Tier | Sufficient For |
|---------|-----------|---------------|
| **Vercel** | 100GB bandwidth, 100 GB-hours | ~100K pageviews/month |
| **Supabase** | 500MB DB, 1GB storage | ~1000 documents, ~50K rows |
| **Voyage AI** | 200M tokens/month, 1000+ RPM | ~10K queries/day |
| **Groq** | 14,400 req/day | ~10K queries/day |

**Total: $0/month** for most MVPs!

### Paid Tier (For Scale)

| Service | Tier | Monthly Cost | Good For |
|---------|------|--------------|----------|
| **Vercel** | Pro | $20/mo | 1TB bandwidth, faster builds |
| **Supabase** | Pro | $25/mo | 8GB DB, 100GB storage |
| **Voyage AI** | Pay-as-you-go | ~$0.0001/1K tokens | Beyond 200M tokens/mo |
| **Groq** | N/A | FREE (no paid tier yet) | All usage |

**Total: ~$45-50/month** for serious production workloads

---

## Troubleshooting

### Build Failures

**Issue**: Vercel build fails with TypeScript errors

**Fix**:
```bash
# Run locally first
npm run lint -- --fix
npm run build

# If it builds locally, commit and push:
git add .
git commit -m "fix: Build errors"
git push
```

### Environment Variables Not Working

**Issue**: API returns errors about missing keys

**Fix**:
1. Verify variables are set in Vercel Dashboard → Settings → Environment Variables
2. Make sure you selected "Production" environment
3. Redeploy: Vercel Dashboard → Deployments → ⋯ → Redeploy

### Supabase Connection Fails

**Issue**: "Database connection failed"

**Fix**:
1. Check `NEXT_PUBLIC_SUPABASE_URL` matches your project URL
2. Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the `anon` key (not `service_role`)
3. Verify RLS policies allow anonymous access (see `supabase/schema.sql`)

### "Hybrid search not available"

**Issue**: API falls back to vector-only search

**Fix**:
- Run `supabase/migrations/002_voyage_embeddings.sql` in Supabase SQL Editor
- The migration creates the `hybrid_search_chunks` function required for hybrid search

### Slow Cold Starts

**Issue**: First request after inactivity is slow

**Explanation**: This is normal for serverless functions (Vercel Edge Functions)

**Solutions**:
- **Accept it**: First request ~2-3s, subsequent <500ms
- **Upgrade to Vercel Pro**: Faster cold starts
- **Use cron job**: Ping your API every 5 minutes to keep it warm

---

## Security Best Practices

### 1. Never Commit API Keys

```bash
# Good: Use environment variables
VOYAGE_API_KEY=xxx

# Bad: Hardcoded in code
const apiKey = "pa-xxx...";  // DON'T DO THIS
```

### 2. Use Environment Variables

All secrets should be in Vercel Dashboard → Settings → Environment Variables.

### 3. Enable Supabase RLS (Row Level Security)

Our schema enables RLS by default. Verify:
```sql
-- In Supabase SQL Editor
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
-- All tables should show: rowsecurity = true
```

### 4. Rotate Keys Periodically

- Voyage AI: Regenerate key every 90 days
- Groq: Regenerate key every 90 days
- Supabase: Rotate `anon` key if suspected compromise

### 5. Monitor Usage

Check dashboards weekly:
- Vercel: Function invocations, errors
- Voyage AI: Token usage, RPM
- Groq: Request count, errors
- Supabase: Database size, API requests

---

## Scaling Considerations

### Horizontal Scaling (Vercel)

Vercel automatically scales:
- Serverless functions spin up on demand
- No configuration needed
- Pay only for execution time

### Database Scaling (Supabase)

**Free Tier Limits:**
- 500MB database
- 1GB storage
- 50K rows

**When to upgrade to Pro ($25/mo):**
- >500MB of data
- >50K document chunks
- Need >1GB file storage

### LLM Scaling

**Groq** (current):
- Free: 14,400 req/day (~6 req/min sustained)
- No paid tier yet

**When you need more:**
- Add fallback providers (Cerebras, Together AI, OpenRouter)
- Our `lib/model-fallback.ts` handles automatic failover

---

## Production Checklist

Before launching:

- [ ] All environment variables set in Vercel
- [ ] Supabase schema and migration scripts run
- [ ] Storage bucket created in Supabase
- [ ] Custom domain configured (optional)
- [ ] Test upload and query flow end-to-end
- [ ] Monitor dashboards set up (Vercel + Supabase)
- [ ] Error tracking configured (Sentry optional)
- [ ] Analytics configured (Vercel Analytics or Google Analytics)

---

## Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Voyage AI Docs**: https://docs.voyageai.com
- **Groq Docs**: https://console.groq.com/docs

---

## Quick Commands

```bash
# Deploy to production
vercel --prod

# View deployment logs
vercel logs

# List deployments
vercel ls

# Roll back to previous deployment
vercel rollback

# Open project in Vercel Dashboard
vercel dashboard
```
