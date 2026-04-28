import { KNOWN_DOMAINS, KNOWN_SKILLS, TITLE_HINTS } from "@/lib/constants";
import type { CandidateProfile } from "@/types/jobs";
import { normalizeText, uniqueStrings } from "@/lib/utils/text";

// ── Location extraction (used internally for ranking, not for auto-fill) ────

const LOCATION_CANONICAL: Record<string, string> = {
  bangalore: "Bangalore", bengaluru: "Bangalore",
  mumbai: "Mumbai", bombay: "Mumbai",
  delhi: "Delhi", "new delhi": "New Delhi",
  hyderabad: "Hyderabad",
  chennai: "Chennai", madras: "Chennai",
  pune: "Pune",
  kolkata: "Kolkata", calcutta: "Kolkata",
  gurgaon: "Gurgaon", gurugram: "Gurgaon",
  noida: "Noida",
  ahmedabad: "Ahmedabad",
  jaipur: "Jaipur",
  lucknow: "Lucknow",
  chandigarh: "Chandigarh",
  indore: "Indore",
  bhopal: "Bhopal",
  surat: "Surat",
  vadodara: "Vadodara",
  kochi: "Kochi", cochin: "Kochi",
  coimbatore: "Coimbatore",
  nagpur: "Nagpur",
  visakhapatnam: "Visakhapatnam", vizag: "Visakhapatnam",
  bhubaneswar: "Bhubaneswar",
  remote: "Remote"
};

const LOCATION_HINTS = Object.keys(LOCATION_CANONICAL).sort((a, b) => b.length - a.length);

function extractLocation(text: string): string | null {
  const explicit = text.match(/(?:location|address|city|based\s+in)[:\s]+([^\n,|•–-]{2,50})/i);
  if (explicit) {
    const raw = normalizeText(explicit[1]);
    for (const hint of LOCATION_HINTS) {
      if (raw.includes(hint)) return LOCATION_CANONICAL[hint];
    }
  }
  const header = normalizeText(text.slice(0, 1000));
  for (const hint of LOCATION_HINTS) {
    if (header.includes(hint)) return LOCATION_CANONICAL[hint];
  }
  return null;
}

// ── Keyword extraction helpers ───────────────────────────────────────────────

function extractKeywordHits(text: string, candidates: string[]): string[] {
  const normalized = normalizeText(text);
  return candidates.filter((c) => normalized.includes(c));
}

function inferYearsOfExperience(text: string): number | null {
  const patterns = [
    /(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:total\s+)?(?:work\s+)?experience/i,
    /(\d+)\+?\s*(?:years?|yrs?)\s+in/i,
    /experience\s*(?:of|:)?\s*(\d+)\+?\s*(?:years?|yrs?)/i,
    /(\d+)\+?\s*(?:years?|yrs?)/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

function inferSeniority(years: number | null, text: string): string | null {
  const n = normalizeText(text);
  if (n.includes("senior") || n.includes("lead") || n.includes("principal") || n.includes("staff")) return "senior";
  if (n.includes("associate") || n.includes("intern")) return "junior";
  if (years === null) return null;
  if (years >= 6) return "senior";
  if (years >= 2) return "mid";
  return "junior";
}

/**
 * Build a rich, deduplicated keyword set from the resume.
 *
 * Sources (in priority order):
 *  1. All matched skills from KNOWN_SKILLS (multi-word and single)
 *  2. All matched role titles from TITLE_HINTS
 *  3. All matched domain terms
 *  4. Education credentials
 *  5. Tech / business tokens scraped directly from the text
 *     (single words of 4+ chars that look technical)
 */
function buildMatchKeywords(
  text: string,
  skills: string[],
  roles: string[],
  domains: string[],
  education: string[]
): string[] {
  const normalized = normalizeText(text);

  // Additional tech/business single-word tokens not covered by KNOWN_SKILLS
  const EXTRA_TERMS = [
    "ux", "ui", "pm", "tpm", "apm", "gm", "ba", "sre",
    "crm", "erp", "api", "sdk", "mlops", "llm", "genai",
    "b2b", "b2c", "d2c", "saas", "paas", "iaas",
    "mrr", "arr", "gmv", "dau", "mau", "nps", "csat",
    "sprint", "backlog", "epic", "story", "velocity",
    "kubernetes", "docker", "kafka", "spark", "airflow",
    "snowflake", "bigquery", "looker", "redshift",
    "android", "ios", "flutter", "swift", "kotlin",
    "golang", "typescript", "nextjs", "fastapi", "django",
    "react", "vue", "angular", "graphql"
  ];

  const extraHits = EXTRA_TERMS.filter((t) => normalized.includes(t));

  // High-value raw tokens from the resume text (nouns / tech terms)
  const rawTokens = normalized
    .split(/[^a-z0-9+#./]+/)
    .filter((t) => t.length >= 4 && t.length <= 25)
    // exclude stop words and very common words
    .filter((t) => !STOP_WORDS.has(t))
    .slice(0, 60);

  return uniqueStrings([
    ...skills,
    ...roles,
    ...domains,
    ...education,
    ...extraHits,
    ...rawTokens
  ]);
}

const STOP_WORDS = new Set([
  "with", "from", "that", "this", "have", "been", "will", "also",
  "more", "than", "able", "team", "work", "time", "year", "years",
  "good", "well", "make", "take", "help", "need", "used", "both",
  "each", "here", "such", "them", "they", "into", "over", "when",
  "where", "there", "about", "using", "would", "could", "should",
  "across", "within", "strong", "experience", "including",
  "responsibilities", "requirements", "skills", "knowledge",
  "ability", "understanding", "working", "manage", "build",
  "develop", "ensure", "drive", "deliver", "define"
]);

// ── Main export ──────────────────────────────────────────────────────────────

export function extractCandidateProfile(
  text: string,
  fileName?: string
): CandidateProfile {
  const skills = uniqueStrings(extractKeywordHits(text, KNOWN_SKILLS));
  const inferredRoles = uniqueStrings(extractKeywordHits(text, TITLE_HINTS));
  const domains = uniqueStrings(extractKeywordHits(text, KNOWN_DOMAINS));
  const yearsOfExperience = inferYearsOfExperience(text);
  const seniority = inferSeniority(yearsOfExperience, text);
  const location = extractLocation(text);
  const education = uniqueStrings(
    ["b.tech", "mba", "b.e", "m.tech", "b.sc", "bcom", "bba", "pgdm", "phd"].filter(
      (item) => normalizeText(text).includes(item)
    )
  );
  const matchKeywords = buildMatchKeywords(text, skills, inferredRoles, domains, education);

  return {
    fileName,
    skills,
    inferredRoles,
    yearsOfExperience,
    seniority,
    location,
    domains,
    education,
    matchKeywords,
    primaryCategory: null   // AI-only field; rule-based extractor doesn't set this
  };
}
