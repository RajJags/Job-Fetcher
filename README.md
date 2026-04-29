# Job Fetcher

An India-focused job aggregator that reads directly from company ATS career pages. No LinkedIn wall, no Naukri paywall, no scraping. Search across 85+ companies in one place, upload your resume for personalised ranking, and scan the live market for skill demand.

**Live:** [https://job-fetcher-rajjags.vercel.app](https://job-fetcher-eight.vercel.app/)

---

## For job seekers

### What you get

- **Jobs tab** -- search roles across Razorpay, Meesho, BrowserStack, Groww, Freshworks, Postman, Netflix, Stripe, Databricks, Snowflake, and 75+ more in a single query
- **Skills tab** -- scan the live market for a role and see which skills are actually required, with employer-weighted percentages so one dominant company cannot skew the data
- **Resume upload** -- upload your PDF, DOCX, or TXT resume and results re-rank instantly by how well each job matches your profile

### Searching jobs

1. Type a role in the search bar -- `Backend Engineer`, `Data Scientist`, `Product Manager`
2. Optionally set location, experience range, minimum salary, and company type
3. Hit **Search** -- results come from 85+ live career pages in about 5 seconds
4. Upload your resume on the left to personalise the ranking

### Skills Intelligence tab

1. Click the **Skills** tab at the top
2. Type a target role and hit **Scan market**
3. See which skills appear in what percentage of real listings, grouped by Must-have / Valuable / Niche
4. Each percentage shows the raw count `(17/34)` so you can judge sample quality
5. Upload your resume first and the right panel shows your personal skill gap against the market

**Sample size note:** results below 50 title-matched listings show a warning and hide the must-have bucket. Small samples are directional only.

### Adding your own companies

Paste any Lever, Greenhouse, Ashby, or Workday career page URL into the **Add career site** field in the sidebar. It is included in every search and persists in your browser.

---

## For developers

### Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router, TypeScript |
| AI | Claude Haiku (`claude-haiku-4-5-20251001`) -- resume parsing + optional skill extraction |
| Extra jobs | Adzuna India API (optional) -- aggregates Naukri, TimesJobs, Indeed India |
| Infrastructure | None -- no database, no auth, no background workers |

### Getting started

```bash
git clone https://github.com/RajJags/Job-Fetcher.git
cd Job-Fetcher
npm install
```

Create `.env.local` in the project root:

```env
# Required for AI resume parsing (regex fallback used if absent)
# Free key at https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Optional: adds Adzuna India results (1,000 free searches/month)
# Register at https://developer.adzuna.com
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key

# Optional: Haiku-based skill extraction (more accurate, sha256 file-cached)
# HAIKU_SKILLS=true
```

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

### Project structure

```
src/
+-- app/
|   +-- api/
|   |   +-- parse-resume/route.ts   POST: extract CandidateProfile from uploaded file
|   |   +-- search-jobs/route.ts    POST: run all adapters, dedupe, rank
|   +-- globals.css                 Single CSS file, custom design tokens
|   +-- page.tsx
+-- components/
|   +-- job-fetcher-app.tsx         Jobs tab: sidebar filters + job cards
|   +-- skills-tab.tsx              Skills tab: market scan + gap analysis
+-- lib/
|   +-- constants.ts                KNOWN_SKILLS (~200 terms) + RoleCategory taxonomy
|   +-- normalization/
|   |   +-- salary.ts               Free-text salary -> LPA conversion
|   +-- ranking/
|   |   +-- ai-rerank.ts            Haiku semantic reranking (top 40 results)
|   |   +-- score.ts                Weighted rule-based scoring
|   +-- resume/
|   |   +-- ai-extract.ts           Haiku resume parsing
|   |   +-- extract.ts              Regex fallback extractor
|   +-- search/
|   |   +-- aggregate.ts            Parallel adapter orchestration, 10-min cache
|   +-- skills/
|   |   +-- haiku-extractor.ts      Haiku skill extraction with sha256 file cache
|   |   +-- negative-context.ts     False-positive suppression for regex matching
|   +-- sources/
|   |   +-- adapters.ts             Five ATS adapters + hard filter logic + company lists
|   |   +-- mock-data.ts            Offline development fixtures
|   |   +-- types.ts                JobSourceAdapter interface
+-- types/
    +-- jobs.ts                     SearchFilters, JobRecord, CandidateProfile, RankedJob
    +-- resume.ts                   Parsed resume shape
```

### Adding companies

All company lists live in `src/lib/sources/adapters.ts`. Identify the ATS from the careers page URL and add an entry to the matching array:

| URL pattern | ATS | Array |
|---|---|---|
| `jobs.lever.co/{slug}` | Lever | `LEVER_SITES` |
| `boards.greenhouse.io/{token}` | Greenhouse | `GREENHOUSE_BOARDS` |
| `jobs.ashbyhq.com/{orgId}` | Ashby | `ASHBY_ORGS` |
| `{tenant}.wd{n}.myworkdayjobs.com/en-US/{board}` | Workday | `WORKDAY_TENANTS` |
| `careers.smartrecruiters.com/{id}` | SmartRecruiters | `SMARTRECRUITERS_COMPANIES` |

```typescript
// Example -- Lever
const LEVER_SITES: LeverSite[] = [
  { company: "YourCompany", site: "your-lever-slug" },
];

// Set tier for badge colour + company-type filter
const COMPANY_META: Record<string, CompanyMeta> = {
  YourCompany: { tier: "tier1" }, // tier1 | tier2 | mnc | services | startup
};
```

### Expanding the skill taxonomy

`src/lib/constants.ts` exports three objects that control skill matching everywhere:

- **`KNOWN_SKILLS`** -- master list (~200 terms). Add a term here and it is matched in job descriptions and resume extraction automatically.
- **`SKILL_CATEGORIES`** -- tags each skill with one or more `RoleCategory` values (`backend`, `frontend`, `ai_llm`, `data`, `devops`, ...). Skills tagged `product`-only are suppressed when scanning for engineering roles.
- **`SKILL_ALIASES`** -- maps variants to canonical names: `"ml" -> "machine learning"`, `"go" -> "golang"`.

### False-positive suppression

`src/lib/skills/negative-context.ts` prevents regex from matching skills used as verbs or idioms.

Examples of what is suppressed vs kept:

| Text in JD | Outcome |
|---|---|
| `excel in fast-paced environments` | Suppressed (verb) |
| `Microsoft Excel proficiency` | Kept (tool) |
| `go ahead and build the pipeline` | Suppressed (phrasal verb) |
| `proficiency in Go programming` | Kept |
| `swift response to incidents` | Suppressed (adjective) |
| `Swift and SwiftUI for iOS` | Kept |

`allMatchesFalsePositive()` checks every occurrence in the document, so a JD containing both patterns keeps the skill.

### Haiku skill extraction (optional)

Set `HAIKU_SKILLS=true` in `.env.local`. Haiku reads each job description and returns only skills explicitly required in the role -- more accurate than regex alone. Results are sha256-cached to `.skill-cache/` (gitignored) so each unique JD is only processed once.

### Ranking formula

Rule-based score applied to all results (`src/lib/ranking/score.ts`):

```
score = 0.35 x role_match  + 0.35 x skill_match   + 0.15 x seniority_match
      + 0.10 x recency      + 0.05 x salary_fit
```

When a resume is present, Claude Haiku reranks the top 40 results semantically (`src/lib/ranking/ai-rerank.ts`). Falls back to rule-based order silently on timeout or API error.

### Employer concentration weighting

In the Skills tab, each listing is weighted by `1 / sqrt(employer_listing_count)` so one company with 20 postings contributes ~4.5 effective listings instead of 20. The raw count `(n/total)` is shown alongside every weighted percentage so the underlying data is always visible.

### API

**`POST /api/parse-resume`** -- multipart/form-data with a `file` field (PDF, DOCX, or TXT).

Returns `{ profile: CandidateProfile }` containing: `skills`, `inferredRoles`, `yearsOfExperience`, `seniority`, `location`, `domains`, `education`, `matchKeywords`.

**`POST /api/search-jobs`**

Request:
```json
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
  "profile": null,
  "customSites": []
}
```

Response: `{ jobs: RankedJob[], totalFetched, companyCount, adzunaEnabled, aiRanked }`

Results are cached in-memory for 10 minutes keyed on the full filter set. Changing sort order on the client never triggers a re-fetch.

### Deploying

Standard Next.js -- one-click Vercel deploy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RajJags/Job-Fetcher)

Set `ANTHROPIC_API_KEY` in Vercel environment variables (and optionally `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`). No other infrastructure required.

### Why not LinkedIn / Naukri

Both use login walls and change their internal APIs without notice. This project uses:

- **Direct ATS APIs** -- Lever, Greenhouse, Ashby, Workday, and SmartRecruiters all expose stable, unauthenticated public job board endpoints
- **Adzuna India** -- a licensed feed aggregating Naukri, TimesJobs, Indeed India, and 50+ boards without scraping

---

## Contributing

Issues and PRs welcome. When adding companies, verify the ATS endpoint returns data before submitting -- some career pages sit on the ATS domain but require a private API key.
