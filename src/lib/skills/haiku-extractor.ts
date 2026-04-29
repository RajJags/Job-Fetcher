/**
 * Haiku-based skill extraction from job descriptions.
 *
 * Why: The regex approach has irreducible false positives — "excel" matching
 * "excel at", "go" matching phrasal verbs, etc. Haiku reads context and only
 * surfaces skills explicitly required for the role.
 *
 * Caching: Each unique job description (first 4 000 chars) is sha256-hashed
 * and the result is written to .skill-cache/<hash>.json so repeated calls are
 * free. The cache dir is .gitignored.
 *
 * Usage: import haikuExtractSkills and call it post-deduplication in aggregate.ts.
 * Gate with HAIKU_SKILLS=true env var so the default path stays free.
 */

import { createHash } from "crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { KNOWN_SKILLS, SKILL_ALIASES } from "@/lib/constants";

const CACHE_DIR  = join(process.cwd(), ".skill-cache");
const MODEL      = "claude-haiku-4-5-20251001";
const MAX_CHARS  = 4000; // ~1 000 tokens — covers full requirements section

// ── Cache helpers ─────────────────────────────────────────────────────────────

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function cacheRead(key: string): string[] | null {
  const path = join(CACHE_DIR, `${key}.json`);
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf8");
      return JSON.parse(raw) as string[];
    }
  } catch { /* corrupt cache entry — ignore */ }
  return null;
}

function cacheWrite(key: string, skills: string[]): void {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(join(CACHE_DIR, `${key}.json`), JSON.stringify(skills), "utf8");
  } catch { /* cache write failure is non-fatal */ }
}

// ── Prompt ────────────────────────────────────────────────────────────────────

// Build approved list once at module load (resolved through aliases)
const APPROVED_SKILLS: string[] = [
  ...new Set(KNOWN_SKILLS.map((s) => SKILL_ALIASES[s] ?? s))
].sort();

function buildPrompt(description: string): string {
  return `Extract technical skills, tools, and frameworks that are explicitly required or preferred in the job description below.

Approved skill list (ONLY return skills from this list, using exact spelling):
${APPROVED_SKILLS.join(", ")}

Rules:
1. Only include skills that appear in requirements, qualifications, or responsibilities sections.
2. Do NOT include: soft skills, general terms (agile, metrics, okr), or business domain knowledge.
3. Use the exact canonical name from the approved list.
4. If a skill variant is mentioned (e.g. "PyTorch", "pytorch", "Pytorch"), return the canonical approved name.
5. Return a compact JSON array. No explanation, no markdown fences.

Job description (requirements section):
${description.slice(0, MAX_CHARS)}

Return ONLY valid JSON, e.g.: ["python","pytorch","aws","docker"]`;
}

// ── Response parser ───────────────────────────────────────────────────────────

const validSkillSet = new Set(APPROVED_SKILLS);

function parseSkills(raw: string): string[] {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const arr = JSON.parse(cleaned) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.toLowerCase().trim())
      .filter((s) => validSkillSet.has(s));
  } catch {
    return [];
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Extract technical skills from a job description using Claude Haiku.
 *
 * - Results are file-cached so repeated calls for the same JD are instant.
 * - Falls back to empty array on API error (caller must fall back to regex).
 * - Strips HTML before hashing/processing.
 */
export async function haikuExtractSkills(description: string): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  // Strip HTML and collapse whitespace
  const cleaned = description
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  // Cache key is based on the truncated cleaned text
  const key   = sha256(cleaned.slice(0, MAX_CHARS));
  const hit   = cacheRead(key);
  if (hit) return hit;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:       MODEL,
        max_tokens:  512,
        temperature: 0,
        system:      "You are a precise technical skill extractor. Return only valid JSON arrays. No explanation.",
        messages:    [{ role: "user", content: buildPrompt(cleaned) }],
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      content?: Array<{ type: string; text: string }>;
      error?:   { message: string };
    };

    if (data.error) return [];

    const text   = data.content?.find((c) => c.type === "text")?.text ?? "";
    const skills = parseSkills(text);

    cacheWrite(key, skills);
    return skills;
  } catch {
    // Timeout, network error, parse failure — silent fallback
    return [];
  }
}

/**
 * Batch-enrich an array of job records' skills arrays using Haiku.
 * Runs concurrently with a capped parallelism to avoid hammering the API.
 *
 * @param jobs     - array of { id, description, skills } records
 * @param maxPar   - max concurrent Haiku calls (default 8)
 * @returns a Map<jobId, string[]> with the enriched skill arrays
 */
export async function batchHaikuEnrich(
  jobs: Array<{ id: string; description: string; skills: string[] }>,
  maxPar = 8
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  // Work through jobs in chunks of maxPar
  for (let i = 0; i < jobs.length; i += maxPar) {
    const chunk = jobs.slice(i, i + maxPar);
    const chunkResults = await Promise.all(
      chunk.map(async (job) => {
        const haikuSkills = await haikuExtractSkills(job.description);
        // Merge with existing regex skills: Haiku is authoritative but union covers edge cases
        const merged = [...new Set([...job.skills, ...haikuSkills])];
        return { id: job.id, skills: merged };
      })
    );
    for (const { id, skills } of chunkResults) {
      results.set(id, skills);
    }
  }

  return results;
}
