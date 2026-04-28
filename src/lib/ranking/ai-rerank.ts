/**
 * AI-based job reranking using Claude Haiku.
 *
 * Flow:
 *   1. Rule-based ranking in score.ts produces an initial ordered list
 *      (hard filters already applied, so this list is clean).
 *   2. Top MAX_JOBS are sent to Claude in a single API call with a compact
 *      representation of each job + the candidate's profile.
 *   3. Claude returns a 0–100 fit score + one-line reason for each job.
 *   4. Jobs are re-sorted by AI score. The original rule-based score is kept
 *      as a fallback for jobs Claude didn't score (e.g. if the list was cut).
 *
 * Why this beats keyword matching:
 *   - Semantic overlap: "Golang + gRPC" matches "backend infra" even if those
 *     exact words aren't in the job description.
 *   - Holistic role fit: Claude reads the full context, not just individual tokens.
 *   - Experience calibration: Claude understands "SDE II" implies 2-4 years even
 *     when the description omits a numeric range.
 */

import type { CandidateProfile, RankedJob, SearchFilters } from "@/types/jobs";

// Maximum jobs to send to Claude. Beyond this the prompt gets too long and
// the marginal jobs are unlikely to be relevant anyway.
const MAX_JOBS = 40;

// Normalise AI score (0-100) to the same 0-1 range used by rule-based scorer.
const normalise = (s: number) => Math.max(0, Math.min(1, s / 100));

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(jobs: RankedJob[], profile: CandidateProfile, filters: SearchFilters): string {
  const profileLines = [
    `Primary category: ${profile.primaryCategory ?? "unknown"}`,
    `Seniority: ${profile.seniority ?? "unknown"}`,
    `Years of experience: ${profile.yearsOfExperience != null ? profile.yearsOfExperience : "unknown"}`,
    `Target roles: ${profile.inferredRoles.slice(0, 4).join(", ") || "not specified"}`,
    `Top skills: ${profile.skills.slice(0, 20).join(", ")}`,
    profile.domains.length ? `Domains: ${profile.domains.join(", ")}` : "",
    filters.role ? `Search query: "${filters.role}"` : "",
    filters.location ? `Preferred location: ${filters.location}` : "",
  ].filter(Boolean).join("\n");

  const jobEntries = jobs.slice(0, MAX_JOBS).map((job) => {
    // Keep each job entry compact — description capped at 300 chars to control tokens
    const desc = job.description
      .replace(/<[^>]+>/g, " ")          // strip HTML
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);

    return [
      `ID: ${job.id}`,
      `Title: ${job.title}`,
      `Company: ${job.company} (${job.companyTier})`,
      `Location: ${job.location}`,
      job.experienceText ? `Experience required: ${job.experienceText}` : "",
      job.skills.length ? `Skills mentioned: ${job.skills.slice(0, 8).join(", ")}` : "",
      `Description: ${desc}`,
    ].filter(Boolean).join(" | ");
  }).join("\n");

  return `You are a technical recruiter scoring job listings for a candidate. \
Your goal is accurate fit scoring — not flattery. Penalise hard when the \
role, seniority, or domain clearly mismatches the candidate.

## Candidate profile
${profileLines}

## Jobs to score (${jobs.slice(0, MAX_JOBS).length} total)
${jobEntries}

## Scoring criteria
- Role alignment (40 pts): Does the job title and description match the candidate's target roles? \
Heavily penalise roles from a completely different function (e.g. Sales, HR, Customer Success for an engineer).
- Skill overlap (35 pts): Semantic match — understand that "Golang" covers "Go", \
"Spring Boot" covers "Java backend", etc. Don't require exact keyword matches.
- Seniority fit (15 pts): Is the required experience level appropriate for the candidate?
- Domain/industry relevance (10 pts): Does the company domain align with the candidate's background?

## Response format
Return ONLY a valid JSON array — no markdown, no explanation. One object per job:
[{"id":"<exact job id>","score":<0-100>,"reason":"<one sentence max, specific>"},...]

All ${jobs.slice(0, MAX_JOBS).length} job IDs must appear in the response.`;
}

// ── Response parser ───────────────────────────────────────────────────────────

type AIScoreItem = { id: string; score: number; reason?: string };

function parseResponse(raw: string): AIScoreItem[] | null {
  // Strip accidental markdown fences
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const arr = JSON.parse(cleaned) as unknown[];
    if (!Array.isArray(arr)) return null;
    const items: AIScoreItem[] = [];
    for (const item of arr) {
      if (
        typeof item === "object" && item !== null &&
        "id" in item && typeof (item as Record<string, unknown>).id === "string" &&
        "score" in item && typeof (item as Record<string, unknown>).score === "number"
      ) {
        const { id, score, reason } = item as { id: string; score: number; reason?: string };
        items.push({
          id,
          score: Math.max(0, Math.min(100, Math.round(score))),
          reason: typeof reason === "string" ? reason.slice(0, 120) : undefined
        });
      }
    }
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Re-rank `jobs` using Claude Haiku semantic scoring.
 * Returns the re-sorted list. Falls back to the original order on any error.
 */
export async function aiRerankJobs(
  jobs: RankedJob[],
  profile: CandidateProfile,
  filters: SearchFilters
): Promise<{ jobs: RankedJob[]; aiRanked: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || jobs.length === 0) return { jobs, aiRanked: false };

  const prompt = buildPrompt(jobs, profile, filters);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json"
      },
      body: JSON.stringify({
        model:       "claude-haiku-4-5-20251001",
        max_tokens:  1500,
        temperature: 0,
        system:      "You are a precise job-matching engine. Return only valid JSON arrays as instructed.",
        messages: [{ role: "user", content: prompt }]
      }),
      signal: AbortSignal.timeout(18_000)   // 18 s — generous but bounded
    });

    if (!response.ok) return { jobs, aiRanked: false };

    const data = (await response.json()) as {
      content?: Array<{ type: string; text: string }>;
      error?: { message: string };
    };

    if (data.error) return { jobs, aiRanked: false };

    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    const scores = parseResponse(text);
    if (!scores) return { jobs, aiRanked: false };

    // Build lookup: jobId → { score, reason }
    const lookup = new Map<string, AIScoreItem>(scores.map((s) => [s.id, s]));

    // Apply AI scores; jobs not in the lookup keep their original normalised score
    const reranked = jobs.map((job) => {
      const ai = lookup.get(job.id);
      if (!ai) return job;
      return {
        ...job,
        score:       normalise(ai.score),
        matchReason: ai.reason
      };
    });

    // Stable sort: primary = AI score desc, tiebreaker = company|title|id
    reranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ka = `${a.company}|${a.title}|${a.id}`;
      const kb = `${b.company}|${b.title}|${b.id}`;
      return ka < kb ? -1 : 1;
    });

    return { jobs: reranked, aiRanked: true };
  } catch {
    // Timeout, network error, parse failure — silently fall back
    return { jobs, aiRanked: false };
  }
}
