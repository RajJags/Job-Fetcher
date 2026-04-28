# JobFetcher

An India-focused job aggregator that pulls listings directly from company ATS career pages — no LinkedIn, no scraping, no paywalls. Upload your resume and get results ranked by how well they match your actual profile.

**Stack:** Next.js 15 · TypeScript · Claude Haiku (AI resume parsing) · Adzuna India API (optional)

---

## What it does

JobFetcher queries 85+ company career pages in parallel across five ATS platforms (Lever, Greenhouse, Ashby, Workday, SmartRecruiters), deduplicates and normalizes the results, then ranks them against your resume. All filtering happens server-side; sorting happens instantly client-side with no re-fetch.

### Filters

| Filter | Type | Behaviour |
|---|---|---|
| Job title | Text search | Searches title, description, skills, company name |
| Location | Text search | Hard filter — strict substring match on job location |
| Experience | Dropdown (0–1 → 10+ yrs) | Hard filter — parsed from job description text |
| Min salary | Slider (0–100 LPA) | Semi-hard — excludes jobs clearly below your target |
| Job category | Dropdown | Hard filter — Product, Engineering, Data, Design, Sales, Marketing, Ops, IT, Finance, HR |
| Company type | Multi-select | Tier 1 Product · Tier 2 / Startup · Global MNC · Services |
| Date posted | Pills above results | 24h · 1 week · 1 month · 3 months |

### Resume matching

Upload a PDF, DOCX, or TXT resume. Claude Haiku extracts 50–80 match keywords (skills, frameworks, tools, domains, role variants) and uses them to re-rank results by relevance. The resume does **not** auto-fill any filter inputs — it only influences ranking. A "View all keywords" panel lets you inspect exactly what was extracted.

### Company coverage (built-in)

| ATS | Count | Examples |
|---|---|---|
| Lever | 30 | Razorpay, Meesho, BrowserStack, Groww, Swiggy, Zomato, Atlassian |
| Greenhouse | 24 | Freshworks, Postman, Netflix, Stripe, Uber, Databricks, Snowflake |
| Ashby | 9 | Jar, Porter, Nykaa, CrowdStrike, Innovaccer |
| Workday | 10 | Adobe, Cisco, PayPal, Visa, Goldman Sachs, Walmart, JP Morgan |
| SmartRecruiters | 10 | HCLTech, Capgemini, LTIMindtree, Bosch, Siemens, Philips |

Add unlimited custom career pages from the sidebar UI — paste a Lever, Greenhouse, Ashby, or Workday URL and it's included in every search, persisted in localStorage.

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/RajJags/Job-Fetcher.git
cd Job-Fetcher
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
# Required for AI resume parsing
# Free API key at https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Optional — adds Adzuna India results (Naukri, TimesJobs, Indeed India, 50+ boards)
# Free tier: 1000 searches/month — register at https://developer.adzuna.com
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key
```

The app runs without `ANTHROPIC_API_KEY` — resume parsing falls back to a regex extractor. It also runs without the Adzuna keys — you just get fewer results.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Customising for your own fork

### Adding companies

All company lists live in `src/lib/sources/adapters.ts`. Find the right ATS array and add an entry.

**How to find a company's ATS:** visit their careers page and check the URL structure.

**Lever** — URL looks like `jobs.lever.co/{slug}`

```typescript
const LEVER_SITES: LeverSite[] = [
  { company: "YourCompany", site: "your-lever-slug" },
];
```

**Greenhouse** — URL looks like `boards.greenhouse.io/{token}`

```typescript
const GREENHOUSE_BOARDS: GreenBoard[] = [
  { company: "YourCompany", boardToken: "yourtoken" },
];
```

**Ashby** — URL looks like `jobs.ashbyhq.com/{orgId}`

```typescript
const ASHBY_ORGS: AshbyOrg[] = [
  { company: "YourCompany", orgId: "your-org-id" },
];
```

**Workday** — URL looks like `{tenant}.wd{n}.myworkdayjobs.com/en-US/{board}`

```typescript
const WORKDAY_TENANTS: WorkdayTenant[] = [
  { company: "YourCompany", tenant: "yourcompany", board: "External", wdNum: 5 },
];
```

**SmartRecruiters** — URL looks like `careers.smartrecruiters.com/{identifier}`

```typescript
const SMARTRECRUITERS_COMPANIES: SmartRecruiterCompany[] = [
  { company: "YourCompany", identifier: "YourCompany" },
];
```

To set a company's tier (affects the badge colour and company type filter), update `COMPANY_META` near the top of the same file:

```typescript
const COMPANY_META: Record<string, CompanyMeta> = {
  YourCompany: { tier: "tier1" }, // tier1 | tier2 | mnc | services | startup
};
```

### Expanding keyword coverage

`src/lib/constants.ts` exports `KNOWN_SKILLS` — a master list of ~200 terms used for both resume parsing and job description keyword extraction. Add domain-specific skills here and they'll be picked up everywhere automatically.

### Tuning the AI resume prompt

`src/lib/resume/ai-extract.ts` contains the prompt sent to Claude Haiku. Edit `buildUserPrompt()` to bias extraction toward a specific domain (e.g., emphasise finance-specific terms, or adjust the keyword count target).

### Changing ranking weights

`src/lib/ranking/score.ts` exposes the scoring formula. Adjust the weights or add new signals:

```
score = 0.35 × roleMatch + 0.35 × skillMatch + 0.15 × seniorityMatch
      + 0.10 × recency   + 0.05 × salaryFit
```

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── parse-resume/route.ts   # POST — extracts profile from uploaded file
│   │   └── search-jobs/route.ts    # POST — runs all adapters, ranks results
│   ├── globals.css
│   └── page.tsx
├── components/
│   └── job-fetcher-app.tsx         # Single-page UI — sidebar filters + job cards
├── lib/
│   ├── constants.ts                # KNOWN_SKILLS master list (~200 terms)
│   ├── normalization/
│   │   └── salary.ts               # Text → LPA conversion
│   ├── ranking/
│   │   └── score.ts                # Weighted relevance scoring
│   ├── resume/
│   │   ├── ai-extract.ts           # Claude Haiku API call + JSON parsing
│   │   └── extract.ts              # Regex fallback extractor
│   ├── search/
│   │   └── aggregate.ts            # Parallel adapter orchestration + 3-min cache
│   └── sources/
│       ├── adapters.ts             # All five ATS adapters + hard filter logic
│       └── types.ts                # JobSourceAdapter interface
└── types/
    └── jobs.ts                     # SearchFilters, JobRecord, CandidateProfile, etc.
```

**Caching:** Results are cached in-memory for 3 minutes keyed on the full filter set + resume keywords. Changing the sort order never triggers a re-fetch — sorting is applied client-side.

**No database.** Everything is request-scoped. There's no login, no server-side persistence. Custom career sites are stored in the user's localStorage.

---

## API reference

### `POST /api/parse-resume`

Accepts `multipart/form-data` with a `file` field (PDF, DOCX, or TXT).

```json
{
  "profile": {
    "skills": ["Spring Boot", "Kafka", "PostgreSQL"],
    "inferredRoles": ["Backend Engineer", "Senior Software Engineer"],
    "yearsOfExperience": 5,
    "seniority": "mid",
    "location": "Bangalore",
    "domains": ["fintech", "saas"],
    "education": ["B.Tech Computer Science"],
    "matchKeywords": ["spring boot", "kafka", "postgresql", "microservices", "..."]
  }
}
```

### `POST /api/search-jobs`

```json
// Request body
{
  "filters": {
    "role": "backend engineer",
    "location": "Bangalore",
    "minLpa": 20,
    "experienceLevel": "3-5",
    "jobCategory": "engineering",
    "companyCategories": ["tier1", "tier2"],
    "postedWithin": "1m",
    "remoteOnly": false
  },
  "profile": {},       // optional CandidateProfile
  "customSites": []    // optional user-added sites from localStorage
}

// Response
{
  "jobs": [],          // RankedJob[] — JobRecord + score + matchedSkills
  "totalFetched": 312,
  "companyCount": 85,
  "adzunaEnabled": true
}
```

---

## Why not LinkedIn / Naukri

Both platforms use login walls, aggressive anti-bot systems, and change their internal APIs without notice. This project covers the same market through:

- **Direct ATS APIs** — Lever, Greenhouse, Ashby, Workday, and SmartRecruiters all expose stable, public job board endpoints with no auth required
- **Adzuna India** — a licensed feed that aggregates Naukri, TimesJobs, Indeed India, and 50+ other boards without any scraping

This gives stable, compliant coverage that won't break overnight.

---

## Deploying

Standard Next.js — deploy to Vercel in one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RajJags/Job-Fetcher)

Set `ANTHROPIC_API_KEY` (and optionally the Adzuna keys) as environment variables in your Vercel project settings. No other infrastructure needed — no database, no queue, no background workers.
