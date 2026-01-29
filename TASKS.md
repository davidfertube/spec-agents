# Steel Agents - Launch Checklist

## ✅ COMPLETED
- [x] Frontend UI (Next.js 16)
- [x] Next.js API Routes (RAG pipeline)
- [x] Source citations with expandable previews
- [x] Hybrid search (BM25 + vector)
- [x] Query embedding cache
- [x] Claim verification framework
- [x] Mobile-responsive design
- [x] CI/CD pipeline (GitHub Actions → Vercel)
- [x] Unit tests (frontend + API routes)

---

## 🚀 YOUR TODO LIST (To Make It Production-Ready)

### Step 1: Get API Keys (5 min)
- [ ] **Voyage AI** → https://www.voyageai.com
  - Sign up, get API key (200M tokens FREE/month)
- [ ] **Groq** → https://console.groq.com
  - Sign up, get API key (14,400 req/day FREE)
- [ ] **Supabase** → https://supabase.com
  - Create project, get URL and anon key

### Step 2: Configure Environment (2 min)
- [ ] Create `.env.local` file in project root:
```bash
cp .env.example .env.local
```
- [ ] Add your keys to `.env.local`:
```
VOYAGE_API_KEY=your_voyage_api_key
GROQ_API_KEY=your_groq_api_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 3: Set Up Supabase Database (5 min)
- [ ] Go to Supabase Dashboard → SQL Editor
- [ ] Run the schema setup:
```bash
# Copy and paste contents of supabase/schema.sql
```
- [ ] Run the Voyage AI migration:
```bash
# Copy and paste contents of supabase/migrations/002_voyage_embeddings.sql
```

### Step 4: Create Storage Bucket (2 min)
- [ ] Go to Supabase Dashboard → Storage
- [ ] Click "New bucket"
- [ ] Name: `documents`
- [ ] Check "Public bucket" (for demo simplicity)
- [ ] Click "Create bucket"

### Step 5: Start the App (1 min)
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Step 6: Test It
- [ ] Open http://localhost:3000
- [ ] Upload a PDF (ASTM standard, material spec, etc.)
- [ ] Wait for processing to complete (green checkmark)
- [ ] Try these queries:
  - "What is the yield strength of A106 Grade B?"
  - "Does 4140 steel meet NACE MR0175 requirements?"
  - "Compare A53 and A106 for high-temperature service"

---

## 🌐 VERCEL DEPLOYMENT (One-Click Deploy)

### Option 1: Deploy with Vercel Button
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/davidfertube/steel-venture)

### Option 2: Manual Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
# → Settings → Environment Variables
```

### Required Environment Variables in Vercel
- `VOYAGE_API_KEY`
- `GROQ_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 📸 PORTFOLIO (After Launch)

- [ ] Take screenshot (1200x630)
- [ ] Update portfolio project card
- [ ] Add live demo link
- [ ] Add to resume/LinkedIn

---

## Quick Commands

| Task | Command |
|------|---------|
| Start dev server | `npm run dev` |
| Build for production | `npm run build` |
| Run tests | `npm test` |
| Run linter | `npm run lint` |
| Run evaluation | `npx tsx scripts/evaluate-accuracy.ts` |

---

## URLs

- **Frontend & API**: http://localhost:3000
- **API Routes**: http://localhost:3000/api/chat
- **GitHub**: https://github.com/davidfertube/steel-venture
- **Supabase Dashboard**: https://supabase.com/dashboard

---

## Troubleshooting

### "No documents indexed"
Upload a PDF first, then wait for processing to complete (status changes to "indexed").

### "Embedding API error"
Verify `VOYAGE_API_KEY` is set. Get a free key at https://www.voyageai.com (200M tokens FREE/month).

### "Database connection failed"
Check Supabase credentials in `.env.local`. Make sure the schema and migration scripts have been run.

### Build fails
Run `npm run lint -- --fix` to auto-fix linting issues.
