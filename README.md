# JobFetcher

<img width="1906" height="907" alt="image" src="https://github.com/user-attachments/assets/0da2c95a-c255-4749-b0b6-9e1ba761b5a0" />

**Stop fighting LinkedIn. Start hitting ATS endpoints directly.**

JobFetcher is an India-focused job aggregator that pulls listings from 85+ company career pages in parallel, ranks them against your resume, and gets out of your way. No login walls. No scraping. No paywalls.

[Live demo →](https://job-fetcher-eight.vercel.app/) · [Report an issue](https://github.com/RajJags/Job-Fetcher/issues)

> _Built because applying to jobs in India shouldn't require a second job._

---

## The problem

Job hunting in 2026 is broken in three specific ways.

1. **LinkedIn surfaces "Easy Apply" listings that 4,000 people have already applied to.** By the time you click, your resume is already at the bottom of someone's queue.
2. **Naukri's filters lie.** "Bangalore" returns Gurgaon roles. "20+ LPA" returns 8 LPA roles. Salary fields are optional, so most listings opt out.
3. **The good roles, especially at product companies, often only show up on the company's own careers page.** Which means you end up tab-surfing through 30 careers pages every Monday, copy-pasting the same filters, and missing roles anyway.

JobFetcher solves the third problem by going where the listings actually live: the ATS providers themselves.

## What it does

JobFetcher hits public ATS APIs from Lever, Greenhouse, Ashby, Workday, and SmartRecruiters directly. 85 companies covered out of the box, plus any custom careers page you paste in. It dedupes, normalizes salary text into LPA, parses your resume with Claude, and ranks every result against your actual profile.

Three things make it different from every other job aggregator out there:

**Direct to source.** No scraping, no auth-bypass tricks. The ATS providers themselves expose stable, public JSON endpoints. They don't break overnight and they don't violate anyone's TOS.

**Resume-aware ranking.** Upload a PDF or DOCX. Claude Haiku extracts 50 to 80 match keywords. Results re-rank against your skills, role, seniority, recency, and salary fit using a transparent weighted formula you can tune.

**India-first.** Salary parsing handles "12 LPA" and "₹15-25 lakh" and "$60k". Optional Adzuna India integration adds Naukri, TimesJobs, and Indeed India listings on top of the ATS feeds.

---

## Quick start

```bash
git clone https://github.com/RajJags/Job-Fetcher.git
cd Job-Fetcher
npm install
npm run dev
```

Open `http://localhost:3000` and search.

### Environment variables

Create `.env.local` in the project root:

```bash
# Required for AI resume parsing. Free key at console.anthropic.com.
ANTHROPIC_API_KEY=sk-ant-...

# Optional. Adds Adzuna India results. Free tier is 1000 searches/month.
# Register at developer.adzuna.com.
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key
```

The app works without either. Without `ANTHROPIC_API_KEY`, resume parsing falls back to a regex extractor. Without Adzuna, you just get fewer results.

---

## Features

### Smart filtering

Filters are split into hard (must match) and soft (influences ranking). This is intentional. A hard "minimum 20 LPA" filter would hide every role that doesn't disclose salary, which in India is most of them.

| Filter | Type | Behaviour |
|---|---|---|
| Job title | Soft | Searches title, description, skills, company name |
| Location | Hard | Strict substring match |
| Experience | Hard | Parsed from job description text |
| Min salary | Semi-hard | Excludes only when salary is stated and clearly below target |
| Job category | Hard | Engineering, Product, Data, Design, Sales, plus 5 more |
| Company type | Hard | Tier 1 Product, Tier 2 / Startup, Global MNC, Services |
| Date posted | Soft | 24h, 1 week, 1 month, 3 months |

### Resume matching

Drop in a PDF, DOCX, or TXT. Claude Haiku extracts:

- Skills (technical and domain)
- Inferred role variants (Backend Engineer, Senior Backend Engineer, Platform Engineer)
- Years of experience and seniority bucket
- Domain tags (fintech, saas, devtools)
- 50 to 80 match keywords used for ranking

Your resume never auto-fills the filters. It only changes the order results appear in. There's a "View all keywords" panel so you can see exactly what got extracted, no black box.

### Company coverage

| ATS | Companies | Examples |
|---|---|---|
| Lever | 30 | Razorpay, Meesho, BrowserStack, Groww, Swiggy, Zomato, Atlassian |
| Greenhouse | 24 | Freshworks, Postman, Netflix, Stripe, Uber, Databricks, Snowflake |
| Ashby | 9 | Jar, Porter, Nykaa, CrowdStrike, Innovaccer |
| Workday | 10 | Adobe, Cisco, PayPal, Visa, Goldman Sachs, Walmart, JP Morgan |
| SmartRecruiters | 10 | HCLTech, Capgemini, LTIMindtree, Bosch, Siemens, Philips |

Need more? The sidebar UI accepts any Lever, Greenhouse, Ashby, or Workday URL. It's saved to your localStorage and included in every search after that.

### Transparent ranking

The scoring formula is in `src/lib/ranking/score.ts` and looks like this:

```
score = 0.35 × roleMatch
      + 0.35 × skillMatch
      + 0.15 × seniorityMatch
      + 0.10 × recency
      + 0.05 × salaryFit
```

No black box. No "AI magic." Tune the weights, add new signals, or swap the whole thing out.

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── parse-resume/route.ts   POST. Extracts profile from upload.
│   │   └── search-jobs/route.ts    POST. Runs all adapters, ranks results.
│   └── page.tsx
├── components/
│   └── job-fetcher-app.tsx         Single-page UI. Sidebar filters plus job cards.
├── lib/
│   ├── constants.ts                KNOWN_SKILLS master list (~200 terms).
│   ├── normalization/salary.ts     Text to LPA conversion.
│   ├── ranking/score.ts            Weighted relevance scoring.
│   ├── resume/
│   │   ├── ai-extract.ts           Claude Haiku call plus JSON parsing.
│   │   └── extract.ts              Regex fallback.
│   ├── search/aggregate.ts         Parallel adapter orchestration plus 3-min cache.
│   └── sources/adapters.ts         All 5 ATS adapters plus hard filter logic.
└── types/jobs.ts                   SearchFilters, JobRecord, CandidateProfile.
```

**No database.** Everything is request-scoped. Custom sites live in localStorage. There's no login, no server-side persistence, no background workers.

**Caching.** Search results are cached in-memory for 3 minutes, keyed on the full filter set plus resume keywords. Changing sort order never re-fetches. Sorting is client-side and instant.

**Parallel fetching.** All 85+ adapters fire concurrently. The slowest endpoint dictates total latency, not the sum.

---

## Customizing for your fork

### Adding a company

All ATS lists live in `src/lib/sources/adapters.ts`. Find the right array and add an entry. The slug comes from the company's careers page URL.

| ATS | URL pattern | Field you need |
|---|---|---|
| Lever | `jobs.lever.co/{slug}` | `site` |
| Greenhouse | `boards.greenhouse.io/{token}` | `boardToken` |
| Ashby | `jobs.ashbyhq.com/{orgId}` | `orgId` |
| Workday | `{tenant}.wd{n}.myworkdayjobs.com/en-US/{board}` | `tenant`, `wdNum`, `board` |
| SmartRecruiters | `careers.smartrecruiters.com/{identifier}` | `identifier` |

Then set the company tier (which controls badge colour and the company type filter) in `COMPANY_META` near the top of the same file:

```ts
const COMPANY_META: Record<string, CompanyMeta> = {
  YourCompany: { tier: "tier1" }, // tier1 | tier2 | mnc | services | startup
};
```

### Expanding keyword coverage

`src/lib/constants.ts` exports `KNOWN_SKILLS`, a master list of about 200 terms used for both resume parsing and job description keyword extraction. Add domain-specific skills there and they propagate everywhere automatically.

### Tuning the AI prompt

`src/lib/resume/ai-extract.ts` contains the prompt sent to Haiku. Edit `buildUserPrompt()` to bias extraction toward a specific domain or change the keyword count target.

### Changing ranking weights

`src/lib/ranking/score.ts` exposes the formula. Adjust weights or add new signals. It's just a weighted sum.

---

## API reference

### `POST /api/parse-resume`

`multipart/form-data` with a `file` field (PDF, DOCX, or TXT).

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
    "matchKeywords": ["spring boot", "kafka", "postgresql", "..."]
  }
}
```

### `POST /api/search-jobs`

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
  "profile": {},
  "customSites": []
}
```

Returns:

```json
{
  "jobs": [],
  "totalFetched": 312,
  "companyCount": 85,
  "adzunaEnabled": true
}
```

---

## Why this approach

LinkedIn and Naukri rely on login walls, aggressive bot detection, and undocumented internal APIs that change without notice. Building on top of them is fragile and a TOS minefield.

JobFetcher uses two stable, compliant data sources:

- **Direct ATS APIs.** Lever, Greenhouse, Ashby, Workday, and SmartRecruiters all expose public job board endpoints. No auth required, contracts don't shift, and no rate limits worth worrying about at this scale.
- **Adzuna India.** A licensed feed that aggregates Naukri, TimesJobs, Indeed India, and 50+ other boards. 1000 free searches per month is plenty for personal use.

The result is coverage that won't break overnight and doesn't need a maintenance team.

---

## Deploying

One click to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RajJags/Job-Fetcher)

Set `ANTHROPIC_API_KEY` (and optionally the Adzuna keys) as environment variables in your Vercel project settings. There's no database, no queue, no cron job. The Vercel free tier runs this comfortably.

---

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind · Claude Haiku · Adzuna India API · zero infrastructure

## License

MIT
