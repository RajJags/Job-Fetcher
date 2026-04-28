import { ageInDays } from "@/lib/utils/dates";
import { normalizeText, uniqueStrings } from "@/lib/utils/text";
import type { CandidateProfile, JobRecord, RankedJob, SearchFilters } from "@/types/jobs";

// ── Category helpers ─────────────────────────────────────────────────────────

function inferCategoryFromRoles(roles: string[]): string | null {
  const text = roles.join(" ").toLowerCase();
  if (/engineer|developer|software|backend|frontend|full.?stack|sde|swe|devops|platform|mobile|ios|android/.test(text)) return "engineering";
  if (/product manager|product owner|\bpm\b|program manager/.test(text)) return "product";
  if (/data scientist|data analyst|machine learning|ml engineer|ai engineer|data engineer/.test(text)) return "data";
  if (/designer|ux|ui\b|design lead/.test(text)) return "design";
  if (/sales|account executive|business development|revenue/.test(text)) return "sales";
  if (/marketing|growth|seo|content strateg/.test(text)) return "marketing";
  if (/operations|supply chain|customer success|customer enablement|ops lead/.test(text)) return "operations";
  if (/finance|accounting|financial analyst|investment/.test(text)) return "finance";
  if (/\bhr\b|human resources|talent acquisition|recruiter|people partner/.test(text)) return "hr";
  if (/it support|sysadmin|network engineer|it manager/.test(text)) return "it";
  return null;
}

function inferJobCategory(job: JobRecord): string | null {
  const title = normalizeText(job.title);
  if (/engineer|developer|sde|swe|software|backend|frontend|full.?stack|devops|platform|mobile|ios|android|architect/.test(title)) return "engineering";
  if (/product manager|product owner|program manager/.test(title)) return "product";
  if (/data scientist|data analyst|machine learning|ml engineer|ai engineer|data engineer|analytics/.test(title)) return "data";
  if (/designer|ux\b|ui\b|design lead|product design/.test(title)) return "design";
  if (/sales|account executive|business development|account manager|solution engineer|pre.?sales/.test(title)) return "sales";
  if (/marketing|growth hacker|seo|content strateg|performance market/.test(title)) return "marketing";
  if (/operations manager|ops manager|supply chain|customer success|customer enablement|customer support/.test(title)) return "operations";
  if (/finance|financial analyst|accounting|investment analyst|cfo/.test(title)) return "finance";
  if (/\bhr\b|human resources|talent acquisition|recruiter|people partner|l&d/.test(title)) return "hr";
  if (/it support|sysadmin|network engineer|it manager|helpdesk/.test(title)) return "it";
  return null;
}

// ── Scoring functions ────────────────────────────────────────────────────────

function scoreRoleMatch(job: JobRecord, filters: SearchFilters, profile?: CandidateProfile): number {
  const targetTerms = uniqueStrings([
    filters.role,
    ...(profile?.inferredRoles ?? [])
  ]).map(normalizeText).filter(Boolean);

  if (targetTerms.length === 0) return 0.5;

  const searchable = normalizeText(`${job.title} ${job.description}`);
  const hits = targetTerms.filter((term) => searchable.includes(term)).length;
  return Math.min(1, hits / Math.max(1, targetTerms.length));
}

function scoreSkillMatch(job: JobRecord, profile?: CandidateProfile): {
  score: number;
  matchedSkills: string[];
} {
  if (!profile) return { score: 0.4, matchedSkills: [] };

  const keywords = profile.matchKeywords.length > 0
    ? profile.matchKeywords
    : profile.skills;

  if (keywords.length === 0) return { score: 0.4, matchedSkills: [] };

  const jobSearchable = normalizeText(
    `${job.title} ${job.description} ${job.skills.join(" ")}`
  );

  const matched = keywords.filter((kw) => jobSearchable.includes(normalizeText(kw)));
  const matchedSkills = profile.skills.filter((skill) =>
    jobSearchable.includes(normalizeText(skill))
  );

  return {
    score: Math.min(1, matched.length / Math.max(5, keywords.length)),
    matchedSkills
  };
}

function scoreSeniority(job: JobRecord, profile?: CandidateProfile): number {
  if (!profile?.seniority) return 0.5;
  const searchable = normalizeText(`${job.title} ${job.experienceText}`);
  if (profile.seniority === "senior" && searchable.includes("senior")) return 1;
  if (profile.seniority === "junior" && searchable.includes("associate")) return 1;
  return searchable.includes(profile.seniority) ? 0.8 : 0.45;
}

/**
 * Recency score pinned to the `referenceNow` timestamp passed in from the caller.
 * Using the same timestamp for the entire ranking pass eliminates per-call drift.
 */
function scoreRecency(job: JobRecord, referenceNow: number): number {
  const days = ageInDays(job.postedAt, referenceNow);
  return Math.max(0.15, 1 - days / 30);
}

function scoreSalary(job: JobRecord, filters: SearchFilters): number {
  if (filters.minLpa === null) return 0.5;
  if (job.salaryMinLpa === null && job.salaryMaxLpa === null) return 0.3;

  const minTarget = filters.minLpa;
  const jobMid =
    ((job.salaryMinLpa ?? job.salaryMaxLpa ?? minTarget) +
      (job.salaryMaxLpa ?? job.salaryMinLpa ?? minTarget)) / 2;

  if (jobMid >= minTarget) return 1;
  return Math.max(0.2, 1 - (minTarget - jobMid) / 25);
}

// ── Stable sort key ──────────────────────────────────────────────────────────
// Used as a deterministic tiebreaker so equal-scoring jobs always appear in
// the same order regardless of the original array order.
function stableSortKey(job: JobRecord): string {
  return `${job.company.toLowerCase()}|${job.title.toLowerCase()}|${job.id}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function rankJobs(args: {
  jobs: JobRecord[];
  filters: SearchFilters;
  profile?: CandidateProfile;
  /** Fixed timestamp for recency scoring — pass Date.now() once and reuse. */
  now?: number;
}): RankedJob[] {
  const { jobs, filters, profile } = args;
  // Pin recency to a single instant so the entire pass is deterministic.
  const referenceNow = args.now ?? Date.now();

  const profileCategory: string | null =
    profile?.primaryCategory ??
    (profile?.inferredRoles?.length
      ? inferCategoryFromRoles(profile.inferredRoles)
      : null);

  const ranked = jobs.map((job) => {
    const roleMatch      = scoreRoleMatch(job, filters, profile);
    const skillScore     = scoreSkillMatch(job, profile);
    const seniorityMatch = scoreSeniority(job, profile);
    const recency        = scoreRecency(job, referenceNow);
    const salaryFit      = scoreSalary(job, filters);

    const rawScore =
      0.35 * roleMatch +
      0.30 * skillScore.score +
      0.15 * seniorityMatch +
      0.10 * recency +
      0.10 * salaryFit;

    // Category coherence penalty
    let score = rawScore;
    if (profileCategory && roleMatch < 0.15) {
      const jobCategory = inferJobCategory(job);
      if (jobCategory && jobCategory !== profileCategory) {
        score = Math.min(rawScore * 0.28, 0.15);
      }
    }

    return { ...job, score, matchedSkills: skillScore.matchedSkills };
  });

  // Stable sort: primary key = score (desc), tiebreaker = company|title|id (asc)
  // This guarantees identical results for the same job pool regardless of
  // input array order or JavaScript engine's internal sort implementation.
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return stableSortKey(a) < stableSortKey(b) ? -1 : 1;
  });

  return ranked;
}
