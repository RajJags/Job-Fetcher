import type { CandidateProfile } from "@/types/jobs";

// ── Types ──────────────────────────────────────────────────────────────────

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

type AnthropicResponse = {
  content: Array<{ type: string; text: string }>;
  error?: { message: string };
};

// Raw shape Claude returns — validated before trusting
type ParsedProfileRaw = {
  skills?: unknown;
  inferredRoles?: unknown;
  yearsOfExperience?: unknown;
  seniority?: unknown;
  location?: unknown;
  domains?: unknown;
  education?: unknown;
  matchKeywords?: unknown;
  primaryCategory?: unknown;
};

// ── Prompt ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert resume parser for the Indian tech job market.
Your job is to read resume text and extract structured information with a strong emphasis on technical and backend skills.
Always respond with ONLY valid JSON — no markdown, no explanation, just the JSON object.`;

function buildUserPrompt(resumeText: string): string {
  return `Parse this resume and return a JSON object with exactly these fields:

{
  "primaryCategory": string,    // The ONE best-fit job category for this person. Must be exactly one of: "engineering", "product", "data", "design", "sales", "marketing", "operations", "it", "finance", "hr". Pick the category that describes what this person primarily does.
  "skills": string[],           // ALL skills found: backend frameworks, databases, cloud, tools, methodologies, soft skills. Be exhaustive. Examples: "Spring Boot", "Hibernate", "JPA", "Kafka", "PostgreSQL", "Redis", "Elasticsearch", "gRPC", "Docker", "Kubernetes", "Terraform", "CI/CD", "microservices", "system design", "REST API", "GraphQL", "product management", "stakeholder management", "SQL", "Python", "A/B testing"
  "inferredRoles": string[],    // 2–5 job titles this person would apply for, ordered by fit. Use standard titles (e.g. "Senior Software Engineer", "Backend Engineer", "Senior Product Manager")
  "yearsOfExperience": number | null,  // Total years of professional experience as a plain number
  "seniority": "junior" | "mid" | "senior" | null,  // junior = 0–2 yrs, mid = 3–5 yrs, senior = 6+ yrs or senior/lead/principal/staff titles
  "location": string | null,    // Current city (e.g. "Bangalore", "Mumbai", "Hyderabad") or null if not found
  "domains": string[],          // Industries/domains worked in (e.g. "fintech", "saas", "e-commerce", "healthtech", "b2b", "payments")
  "education": string[],        // Degrees/qualifications (e.g. "B.Tech Computer Science", "MBA", "MCA")
  "matchKeywords": string[]     // 50–80 ROLE-SPECIFIC keywords for job matching. These MUST be strongly associated with the person's primaryCategory — do NOT include generic terms that could appear in any job category. MUST include: (1) all domain-specific technologies, frameworks, tools explicitly mentioned, (2) both long-form and short-form (e.g. "Spring Boot" AND "spring", "PostgreSQL" AND "postgres"), (3) architectural patterns (e.g. "microservices", "event-driven"), (4) role titles and seniority variants matching primaryCategory, (5) domain keywords. Do NOT invent — only extract what is genuinely in the resume. IMPORTANT: avoid generic keywords like "communication", "leadership", "management", "excel", "powerpoint" that appear across all job categories.
}

IMPORTANT for primaryCategory:
- "engineering" = software engineers, developers, SDE, SWE, backend, frontend, full-stack, mobile, devops, infrastructure
- "product" = product managers, product owners, program managers
- "data" = data scientists, data analysts, ML engineers, AI researchers, data engineers
- "design" = UX designers, UI designers, graphic designers, product designers
- "sales" = sales reps, account executives, business development, solutions engineers in sales roles
- "marketing" = marketing managers, growth, content, SEO, performance marketing
- "operations" = ops managers, supply chain, customer success, customer enablement
- "it" = IT support, sysadmin, network engineers, ITSM
- "finance" = finance analysts, accountants, CFOs, investment analysts
- "hr" = HR managers, recruiters, talent acquisition, L&D

IMPORTANT for matchKeywords (by category):
- engineering: include all languages, frameworks, databases, cloud services, tools, architectural patterns from the resume
- product: include product strategy, roadmap, OKRs, PRD, A/B testing, analytics tools, stakeholder management
- data: include ML frameworks, statistical methods, data tools, visualization libraries
- If resume mentions any Java framework → include "java", "spring boot", "spring", "jvm"
- If resume mentions any database → include the full name AND common short form
- If resume mentions AWS/GCP/Azure services → include the parent cloud AND the specific services
- If resume mentions Docker/Kubernetes → include "containerization", "orchestration"

Return ONLY the JSON object, nothing else.

Resume text:
---
${resumeText.slice(0, 8000)}
---`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const n = parseFloat(value);
    if (!isNaN(n)) return Math.round(n);
  }
  return null;
}

function toSeniority(value: unknown): string | null {
  if (value === "junior" || value === "mid" || value === "senior") return value;
  return null;
}

function toLocation(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return null;
}

const VALID_CATEGORIES = new Set([
  "engineering", "product", "data", "design",
  "sales", "marketing", "operations", "it", "finance", "hr"
]);

function toPrimaryCategory(value: unknown): string | null {
  if (typeof value === "string" && VALID_CATEGORIES.has(value.toLowerCase().trim())) {
    return value.toLowerCase().trim();
  }
  return null;
}

function parseProfileJson(raw: string): CandidateProfile | null {
  // Strip any accidental markdown fences
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const obj = JSON.parse(cleaned) as ParsedProfileRaw;
    return {
      skills:            toStringArray(obj.skills),
      inferredRoles:     toStringArray(obj.inferredRoles),
      yearsOfExperience: toNumber(obj.yearsOfExperience),
      seniority:         toSeniority(obj.seniority),
      location:          toLocation(obj.location),
      domains:           toStringArray(obj.domains),
      education:         toStringArray(obj.education),
      matchKeywords:     toStringArray(obj.matchKeywords),
      primaryCategory:   toPrimaryCategory(obj.primaryCategory)
    };
  } catch {
    return null;
  }
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Uses Claude to intelligently parse a resume into a CandidateProfile.
 * Throws if the API key is missing or the API call fails.
 */
export async function aiExtractProfile(
  resumeText: string,
  fileName?: string
): Promise<CandidateProfile> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const messages: AnthropicMessage[] = [
    { role: "user", content: buildUserPrompt(resumeText) }
  ];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json"
    },
    body: JSON.stringify({
      model:       "claude-haiku-4-5-20251001",
      max_tokens:  2500,
      temperature: 0,   // deterministic — same resume always yields the same keywords
      system:      SYSTEM_PROMPT,
      messages
    }),
    signal: AbortSignal.timeout(20_000)
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const data = (await response.json()) as AnthropicResponse;

  if (data.error) throw new Error(`Anthropic error: ${data.error.message}`);

  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  const profile = parseProfileJson(text);

  if (!profile) {
    throw new Error("Could not parse AI response into a valid profile");
  }

  return { ...profile, fileName };
}
