import { rankJobs } from "@/lib/ranking/score";
import { aiRerankJobs } from "@/lib/ranking/ai-rerank";
import { sourceAdapters, buildAdapterForCustomSite, ADZUNA_ENABLED, configuredSourceSummary } from "@/lib/sources/adapters";
import type { CandidateProfile, CustomSite, JobRecord, SearchFilters, SearchResponse } from "@/types/jobs";

// ── Server-side cache ─────────────────────────────────────────────────────────
// NOTE: on Vercel (serverless), each Lambda invocation may be a fresh Node process
// so this cache only helps when the same warm instance handles multiple requests
// in a short window. The client-side cache in the browser is the primary guard.
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
const searchCache = new Map<string, { expiresAt: number; response: SearchResponse }>();

function dedupeJobs(jobs: JobRecord[]): JobRecord[] {
  const map = new Map<string, JobRecord>();
  for (const job of jobs) {
    const key = `${job.company.toLowerCase().trim()}|${job.title.toLowerCase().trim()}`;
    if (!map.has(key)) map.set(key, job);
  }
  return Array.from(map.values());
}

/**
 * Build a deterministic cache key.
 * All arrays are sorted before serialisation so array order cannot produce
 * different keys for the same logical query.
 */
function cacheKey(filters: SearchFilters, profile?: CandidateProfile, customSites?: CustomSite[]): string {
  return JSON.stringify({
    filters: {
      ...filters,
      companyCategories: [...(filters.companyCategories ?? [])].sort()
    },
    profile: profile
      ? {
          matchKeywords:   [...profile.matchKeywords].sort(),
          skills:          [...profile.skills].sort(),
          seniority:       profile.seniority,
          primaryCategory: profile.primaryCategory ?? null
        }
      : null,
    customSiteIds: [...(customSites?.map((s) => s.id) ?? [])].sort()
  });
}

export async function aggregateJobs(args: {
  filters: SearchFilters;
  profile?: CandidateProfile;
  customSites?: CustomSite[];
}): Promise<SearchResponse> {
  const { filters, profile, customSites = [] } = args;

  const key = cacheKey(filters, profile, customSites);
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.response;

  // ── 1. Fetch from all ATS sources concurrently ─────────────────────────────
  const customAdapters = customSites
    .map((s) => buildAdapterForCustomSite(s))
    .filter(Boolean) as typeof sourceAdapters;

  const allAdapters = [...sourceAdapters, ...customAdapters];

  const fetched = await Promise.allSettled(
    allAdapters.map((adapter) => adapter.fetchJobs({ filters }))
  );

  const jobs = fetched.flatMap((r) => r.status === "fulfilled" ? r.value : []);
  const deduped = dedupeJobs(jobs);

  // ── 2. Rule-based ranking — hard filters already applied inside adapters ───
  // This produces a solid initial ordering and acts as a pre-filter so the AI
  // reranker only sees candidates that passed location/experience/category gates.
  const now = Date.now();
  const ruleRanked = rankJobs({ jobs: deduped, filters, profile, now });

  // ── 3. AI reranking — only when a resume profile is available ──────────────
  // Claude Haiku semantically scores each job against the candidate's full
  // profile, understanding context that keyword counts can't capture.
  // Falls back to rule-based order silently on timeout or API error.
  let finalJobs = ruleRanked;
  let aiRanked = false;

  if (profile && ruleRanked.length > 0) {
    const result = await aiRerankJobs(ruleRanked, profile, filters);
    finalJobs = result.jobs;
    aiRanked  = result.aiRanked;
  }

  const response: SearchResponse = {
    jobs:          finalJobs,
    totalFetched:  jobs.length,
    companyCount:  configuredSourceSummary.total_companies + customSites.length,
    adzunaEnabled: ADZUNA_ENABLED,
    aiRanked
  };

  searchCache.set(key, { expiresAt: now + CACHE_TTL_MS, response });
  return response;
}
