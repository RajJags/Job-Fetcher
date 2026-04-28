"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatSalary } from "@/lib/normalization/salary";
import { formatRelativePosted } from "@/lib/utils/dates";
import { SkillsTab } from "@/components/skills-tab";
import type {
  ATSType,
  CandidateProfile,
  CompanyTier,
  CustomSite,
  JobCategory,
  SearchFilters,
  SearchResponse,
  SortBy
} from "@/types/jobs";

// ── Client-side session cache ─────────────────────────────────────────────────
// Vercel runs stateless Lambda functions — the server-side in-memory cache resets
// on every cold start. This client-side cache keyed by a stable filter hash is
// the primary consistency guarantee: the same filters return the same results
// within a browser session, regardless of how many server instances are running.

const CLIENT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

type CacheEntry = { ts: number; data: SearchResponse };
const clientCache = new Map<string, CacheEntry>();

function buildClientCacheKey(filters: SearchFilters, profile?: CandidateProfile, customSites?: CustomSite[]): string {
  return JSON.stringify({
    filters: {
      ...filters,
      companyCategories: [...(filters.companyCategories ?? [])].sort()
    },
    profile: profile
      ? {
          matchKeywords:   [...profile.matchKeywords].sort(),
          seniority:       profile.seniority,
          primaryCategory: profile.primaryCategory ?? null
        }
      : null,
    siteIds: (customSites ?? []).map(s => s.id).sort()
  });
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const defaultFilters: SearchFilters = {
  role: "",
  minLpa: null,
  postedWithin: "1m",
  location: "",
  experienceLevel: "",
  remoteOnly: false,
  companyCategories: [],
  jobCategory: ""
};

const SORT_OPTIONS: { label: string; value: SortBy }[] = [
  { label: "Best match",     value: "relevance" },
  { label: "Newest first",   value: "recent" },
  { label: "Highest salary", value: "salary_desc" },
  { label: "Lowest salary",  value: "salary_asc" }
];

const EXP_OPTIONS: { label: string; value: string }[] = [
  { label: "Any experience", value: "" },
  { label: "0–1 years",      value: "0-1" },
  { label: "1–2 years",      value: "1-2" },
  { label: "2–3 years",      value: "2-3" },
  { label: "3–5 years",      value: "3-5" },
  { label: "5–7 years",      value: "5-7" },
  { label: "7–10 years",     value: "7-10" },
  { label: "10+ years",      value: "10+" },
];

const COMPANY_CATEGORIES: { label: string; value: CompanyTier }[] = [
  { label: "Top Indian (Tier 1)", value: "tier1" },
  { label: "High-growth Startup", value: "tier2" },
  { label: "Global MNC",          value: "mnc" },
  { label: "IT / Consulting",     value: "services" },
];

const JOB_CATEGORIES: { label: string; value: JobCategory }[] = [
  { label: "Any category",  value: "" },
  { label: "Product",       value: "product" },
  { label: "Engineering",   value: "engineering" },
  { label: "Data / AI",     value: "data" },
  { label: "Design",        value: "design" },
  { label: "Sales",         value: "sales" },
  { label: "Marketing",     value: "marketing" },
  { label: "Operations",    value: "operations" },
  { label: "IT",            value: "it" },
  { label: "Finance",       value: "finance" },
  { label: "HR",            value: "hr" },
];

const SALARY_MAX = 100; // LPA slider ceiling
const SALARY_STEP = 1;  // 1 LPA steps so 3 LPA / 5 LPA seekers can filter precisely

const LS_CUSTOM_SITES_KEY = "JF_CUSTOM_SITES_v1";

// ── localStorage helpers ─────────────────────────────────────────────────────

function loadCustomSites(): CustomSite[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_CUSTOM_SITES_KEY) : null;
    if (!raw) return [];
    return JSON.parse(raw) as CustomSite[];
  } catch {
    return [];
  }
}

function saveCustomSites(sites: CustomSite[]) {
  try {
    localStorage.setItem(LS_CUSTOM_SITES_KEY, JSON.stringify(sites));
  } catch { /* ignore storage quota errors */ }
}

// ── ATS URL detection ─────────────────────────────────────────────────────────

function detectATS(rawUrl: string): { atsType: ATSType; siteId: string; company: string } | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim().startsWith("http") ? rawUrl.trim() : `https://${rawUrl.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  // Lever: jobs.lever.co/{site}
  if (host === "jobs.lever.co" && parts[0]) {
    return { atsType: "lever", siteId: parts[0], company: parts[0] };
  }
  // Greenhouse: boards.greenhouse.io/{token}
  if (host === "boards.greenhouse.io" && parts[0]) {
    return { atsType: "greenhouse", siteId: parts[0], company: parts[0] };
  }
  // Greenhouse API direct
  if (host === "boards-api.greenhouse.io" && parts.includes("boards")) {
    const idx = parts.indexOf("boards");
    const token = parts[idx + 1];
    if (token) return { atsType: "greenhouse", siteId: token, company: token };
  }
  // Ashby: jobs.ashbyhq.com/{org}
  if (host === "jobs.ashbyhq.com" && parts[0]) {
    return { atsType: "ashby", siteId: parts[0], company: parts[0] };
  }
  // Workday: {tenant}.wd{n}.myworkdayjobs.com/en-US/{board} or /wday/cxs/{tenant}/{board}
  if (host.includes(".myworkdayjobs.com")) {
    const tenant = host.split(".")[0];
    const wdMatch = host.match(/\.wd(\d+)\./);
    const wdNum = wdMatch ? wdMatch[1] : "5";
    // Board: try to get from path — skip "en-US", "wday", "cxs", tenant segments
    const skip = new Set(["wday", "cxs", "en-us", "en_us", tenant, "jobs"]);
    const board = parts.find((p) => !skip.has(p.toLowerCase())) ?? "External";
    return { atsType: "workday", siteId: `${tenant}/${board}/${wdNum}`, company: tenant };
  }
  return null;
}

function humaniseSiteId(atsType: ATSType, siteId: string): string {
  if (atsType === "workday") return siteId.split("/")[0];
  return siteId;
}

// ── Experience text formatter ─────────────────────────────────────────────────
// Turns "3-5 years of experience" → "3–5 yrs exp", "7+ years" → "7+ yrs exp"
function formatExpText(raw: string): string {
  if (!raw) return "";
  const cleaned = raw
    .replace(/\s*of\s+experience\b/gi, "")
    .replace(/\s*experience\b/gi, "")
    .replace(/\s*exp\b/gi, "")
    .replace(/\bminimum\s+/gi, "")
    .replace(/\bat\s+least\s+/gi, "")
    .replace(/\byears?\b/gi, "yrs")
    .replace(/-/g, "–")
    .trim();
  return cleaned ? `${cleaned} exp` : "";
}

// ── Colour helpers ────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  "#3b82f6","#8b5cf6","#ec4899","#ef4444",
  "#f59e0b","#10b981","#06b6d4","#6366f1"
];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  tier1:    { label: "Tier 1",   color: "var(--tier1)" },
  tier2:    { label: "Tier 2",   color: "var(--tier2)" },
  mnc:      { label: "MNC",      color: "var(--mnc)" },
  services: { label: "Services", color: "var(--services)" },
  startup:  { label: "Startup",  color: "var(--startup)" }
};

const ATS_LABELS: Record<ATSType, string> = {
  lever: "Lever",
  greenhouse: "Greenhouse",
  ashby: "Ashby",
  workday: "Workday",
  unknown: "Unknown"
};

// ── Micro-icons ───────────────────────────────────────────────────────────────

const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconPin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconMoney = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconFile = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IconBriefcase = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);
const IconUser = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconPlus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconX = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconSparkle = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);

// ── Main component ────────────────────────────────────────────────────────────

export function JobFetcherApp() {
  const [activeTab, setActiveTab] = useState<"jobs" | "skills">("jobs");

  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [draft, setDraft] = useState<SearchFilters>(defaultFilters);
  const [sortBy, setSortBy] = useState<SortBy>("relevance");
  const [profile, setProfile] = useState<CandidateProfile | undefined>();
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const companyDropRef = useRef<HTMLDivElement>(null);
  const [companyDropOpen, setCompanyDropOpen] = useState(false);

  // Custom sites state
  const [customSites, setCustomSites] = useState<CustomSite[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [showCustomAdd, setShowCustomAdd] = useState(false);

  // Keyword viewer state
  const [showKeywords, setShowKeywords] = useState(false);
  // true once the user has explicitly triggered a search (Search button or resume upload)
  const [hasSearched, setHasSearched] = useState(false);

  // Load custom sites from localStorage once on mount
  useEffect(() => {
    setCustomSites(loadCustomSites());
  }, []);

  // Close company dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (companyDropRef.current && !companyDropRef.current.contains(e.target as Node)) {
        setCompanyDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Persist whenever custom sites change
  useEffect(() => {
    if (typeof window !== "undefined") saveCustomSites(customSites);
  }, [customSites]);

  // ── Search ────────────────────────────────────────────────────────────────

  const runSearch = useCallback(async (f: SearchFilters, p?: CandidateProfile, sites?: CustomSite[]) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // ── Client-side cache hit ─────────────────────────────────────────────────
    // Check the browser cache before making any network request. This is the
    // primary defence against Vercel's stateless Lambda environment where the
    // server-side cache resets on every cold start.
    const ck = buildClientCacheKey(f, p, sites);
    const hit = clientCache.get(ck);
    if (hit && Date.now() - hit.ts < CLIENT_CACHE_TTL_MS) {
      setResults(hit.data);
      setSearchError(null);
      return;
    }

    setIsLoading(true);
    setResults(null);
    setSearchError(null);

    try {
      const res = await fetch("/api/search-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: f, profile: p, customSites: sites ?? [] }),
        signal: ctrl.signal
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Search failed");
      }
      const data = (await res.json()) as SearchResponse;
      // Store in client cache immediately after a successful fetch
      clientCache.set(ck, { ts: Date.now(), data });
      setResults(data);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasSearched) return;
    runSearch(filters, profile, customSites);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, profile, customSites, runSearch, hasSearched]);

  // ── Drafts ────────────────────────────────────────────────────────────────

  function set<K extends keyof SearchFilters>(key: K, val: SearchFilters[K]) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  function applyFilters() {
    setHasSearched(true);
    setFilters(draft);
  }

  function resetAll() {
    setDraft(defaultFilters);
    setFilters(defaultFilters);
    setSortBy("relevance");
    setProfile(undefined);
    setResumeError(null);
    setResults(null);
    setHasSearched(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Resume ────────────────────────────────────────────────────────────────

  function onResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeError(null);
    setIsParsingResume(true);

    const fd = new FormData();
    fd.append("file", file);

    fetch("/api/parse-resume", { method: "POST", body: fd })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? "Resume parsing failed");
        }
        return (await res.json()) as { profile: CandidateProfile };
      })
      .then(({ profile: parsed }) => {
        setHasSearched(true);
        setProfile(parsed);
      })
      .catch((err) => {
        setResumeError(err instanceof Error ? err.message : "Resume parsing failed");
      })
      .finally(() => setIsParsingResume(false));
  }

  // ── Custom sites ──────────────────────────────────────────────────────────

  function addCustomSite() {
    setUrlError(null);
    const raw = urlInput.trim();
    if (!raw) { setUrlError("Paste a career page URL"); return; }

    const detected = detectATS(raw);
    if (!detected || detected.atsType === "unknown") {
      setUrlError("Couldn't detect ATS. Paste a Lever, Greenhouse, Ashby, or Workday URL.");
      return;
    }

    const company = customName.trim() || detected.company;
    const id = `${detected.atsType}:${detected.siteId}`;

    if (customSites.some((s) => s.id === id)) {
      setUrlError("This career page is already added.");
      return;
    }

    const newSite: CustomSite = {
      id,
      company,
      atsType: detected.atsType,
      siteId: detected.siteId,
      url: raw,
      tier: "startup",
      addedAt: new Date().toISOString()
    };

    setCustomSites((prev) => [...prev, newSite]);
    setUrlInput("");
    setCustomName("");
    setUrlError(null);
    setShowCustomAdd(false);
  }

  function removeCustomSite(id: string) {
    setCustomSites((prev) => prev.filter((s) => s.id !== id));
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const rawJobs = results?.jobs ?? [];
  const companyCount = results?.companyCount ?? 85;
  const adzunaEnabled = results?.adzunaEnabled ?? false;
  const aiRanked = results?.aiRanked ?? false;

  // Client-side sort — changing sortBy never triggers a re-fetch
  const jobs = useMemo(() => {
    const items = [...rawJobs];
    switch (sortBy) {
      case "recent":
        return items.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
      case "salary_desc":
        return items.sort((a, b) => (b.salaryMaxLpa ?? -1) - (a.salaryMaxLpa ?? -1));
      case "salary_asc":
        return items.sort((a, b) => (a.salaryMinLpa ?? Number.MAX_SAFE_INTEGER) - (b.salaryMinLpa ?? Number.MAX_SAFE_INTEGER));
      default:
        return items; // relevance — already ranked by server
    }
  }, [rawJobs, sortBy]);

  // Memoise job cards so typing in the sidebar inputs doesn't re-render the list
  const jobCards = useMemo(() => jobs.map((job) => {
    const initials = job.company
      .split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    const salary = formatSalary(job.salaryMinLpa, job.salaryMaxLpa);
    const hasSalary = salary !== "Salary unavailable";
    const tierMeta = TIER_LABELS[job.companyTier];
    const posted = formatRelativePosted(job.postedAt);
    const isVeryRecent = job.postedAt &&
      (Date.now() - new Date(job.postedAt).getTime()) < 3 * 24 * 60 * 60 * 1000;
    const expLabel = formatExpText(job.experienceText);

    const salaryClass = hasSalary
      ? (sortBy === "salary_desc" || sortBy === "salary_asc" ? "jc-meta-item salary-pill highlight-metric" : "jc-meta-item salary-pill")
      : "jc-meta-item dim";

    return (
      <div key={job.id} className="job-card">
        <div className="jc-top">
          <div className="company-avatar" style={{ background: avatarColor(job.company) }}>
            {initials}
          </div>
          <div className="jc-info">
            <div className="jc-company-row">
              <span className="jc-company">{job.company}</span>
              {tierMeta && (
                <span className="tier-badge" style={{ background: tierMeta.color }}>
                  {tierMeta.label}
                </span>
              )}
            </div>
            <h3 className="jc-title">{job.title}</h3>
            <div className="jc-meta">
              <span className={salaryClass}>
                <IconMoney />
                {hasSalary ? salary : "Salary not listed"}
              </span>
              <span className="meta-dot" />
              <span className={`jc-meta-item${sortBy === "recent" && isVeryRecent ? " highlight-metric" : ""}`}>
                <IconClock />
                {sortBy === "recent" && isVeryRecent ? <strong>{posted}</strong> : posted}
              </span>
              {job.location && job.location !== "—" && (
                <>
                  <span className="meta-dot" />
                  <span className="jc-meta-item"><IconPin />{job.location}</span>
                </>
              )}
              {expLabel && (
                <>
                  <span className="meta-dot" />
                  <span className="jc-meta-item dim"><IconUser />{expLabel}</span>
                </>
              )}
              {job.employmentType && (
                <>
                  <span className="meta-dot" />
                  <span className="jc-meta-item dim"><IconBriefcase />{job.employmentType}</span>
                </>
              )}
            </div>
            {(job.matchedSkills.length > 0 || job.skills.length > 0) && (
              <div className="jc-skills">
                {(job.matchedSkills.length > 0 ? job.matchedSkills.slice(0, 6) : job.skills.slice(0, 5))
                  .map((s) => (
                    <span key={s} className={`skill-tag${job.matchedSkills.includes(s) ? " matched" : ""}`}>
                      {s}
                    </span>
                  ))}
              </div>
            )}
            {job.matchReason && (
              <p className="jc-ai-reason">✦ {job.matchReason}</p>
            )}
          </div>
          <a className="apply-btn" href={job.applyUrl} target="_blank" rel="noreferrer">
            Apply →
          </a>
        </div>
      </div>
    );
  }), [jobs, sortBy]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-shell">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-logo">
          <div className="topbar-mark">JF</div>
          <span className="topbar-name">JobFetcher</span>
        </div>
        <div className="topbar-divider" />
        <nav className="topbar-tabs">
          <button
            type="button"
            className={`topbar-tab${activeTab === "jobs" ? " active" : ""}`}
            onClick={() => setActiveTab("jobs")}
          >
            Jobs
          </button>
          <button
            type="button"
            className={`topbar-tab${activeTab === "skills" ? " active" : ""}`}
            onClick={() => setActiveTab("skills")}
          >
            Skills
          </button>
        </nav>
        <div className="topbar-spacer" />
        <span className="topbar-sub">
          {companyCount} companies
          {adzunaEnabled && <span className="topbar-adzuna-badge">+ Adzuna India</span>}
        </span>
      </header>

      {/* ── Skills tab ────────────────────────────────────────────────────── */}
      {activeTab === "skills" && (
        <div className="page-body page-body-skills">
          <SkillsTab profile={profile} />
        </div>
      )}

      <div className={`page-body${activeTab === "skills" ? " page-body-hidden" : ""}`}>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside className="sidebar">

          {/* Resume */}
          <div className="sb-section">
            <div className="sb-label">Resume</div>
            {profile ? (
              <div className="resume-parsed">
                <div className="parsed-file">
                  <span className="parsed-file-icon"><IconFile /></span>
                  <span className="parsed-name">{profile.fileName ?? "Resume"}</span>
                </div>
                <div className="parsed-meta">
                  {profile.primaryCategory && (
                    <span className="pchip-cat">{profile.primaryCategory}</span>
                  )}
                  {profile.seniority && <span className="pchip">{profile.seniority}</span>}
                  {profile.yearsOfExperience !== null && (
                    <span className="pchip-exp">{profile.yearsOfExperience}+ yrs</span>
                  )}
                  {profile.skills.slice(0, 3).map((s) => <span key={s} className="pchip">{s}</span>)}
                  {profile.skills.length > 3 && <span className="pchip">+{profile.skills.length - 3} more</span>}
                </div>
                <p className="parsed-note">
                  <IconSparkle /> AI ranking active — results personalised to your profile
                </p>

                {/* Keyword viewer */}
                {profile.matchKeywords && profile.matchKeywords.length > 0 && (
                  <div className="kw-viewer">
                    <button
                      type="button"
                      className="kw-toggle"
                      onClick={() => setShowKeywords((v) => !v)}
                    >
                      <span className="kw-toggle-icon">{showKeywords ? "▾" : "▸"}</span>
                      {showKeywords ? "Hide" : "View"} all keywords
                      <span className="kw-count">{profile.matchKeywords.length}</span>
                    </button>
                    {showKeywords && (
                      <div className="kw-panel">
                        <div className="kw-chips">
                          {profile.matchKeywords.map((kw) => (
                            <span key={kw} className="kw-chip">{kw}</span>
                          ))}
                        </div>
                        <p className="kw-note">
                          These keywords are matched against job listings to surface the best roles for you.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <label className="replace-link">
                  Replace resume
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={onResumeUpload}
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                  />
                </label>
              </div>
            ) : (
              <div className={`resume-zone${isParsingResume ? " parsing" : ""}`}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={onResumeUpload}
                  disabled={isParsingResume}
                />
                <span className="rz-icon">{isParsingResume ? "⏳" : "📄"}</span>
                <p className="rz-title">{isParsingResume ? "Reading resume…" : "Upload resume"}</p>
                <p className="rz-hint">PDF, DOCX or TXT · improves ranking</p>
              </div>
            )}
            {resumeError && <p className="field-error">{resumeError}</p>}
          </div>

          {/* Role — soft filter (ranking signal) */}
          <div className="sb-section">
            <div className="sb-label">Role / Keywords</div>
            <div className="input-icon-wrap">
              <span className="ii-icon"><IconSearch /></span>
              <input
                className="input"
                value={draft.role}
                onChange={(e) => set("role", e.target.value)}
                placeholder="Backend engineer, product manager…"
              />
            </div>
            <p className="input-hint">Describes what you&apos;re looking for — used for ranking</p>
          </div>

          {/* Location — hard filter */}
          <div className="sb-section">
            <div className="sb-label">Location</div>
            <div className="input-icon-wrap">
              <span className="ii-icon"><IconPin /></span>
              <input
                className="input"
                value={draft.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Bangalore, Mumbai, India…"
              />
            </div>
            <div className="toggle-row" style={{ marginTop: 10 }}>
              <span className="toggle-label">Remote only</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={draft.remoteOnly}
                  onChange={(e) => set("remoteOnly", e.target.checked)}
                />
                <span className="toggle-track" />
                <span className="toggle-thumb" />
              </label>
            </div>
          </div>

          {/* Experience — hard filter */}
          <div className="sb-section">
            <div className="sb-label">Experience</div>
            <select
              className="select"
              value={draft.experienceLevel}
              onChange={(e) => set("experienceLevel", e.target.value)}
            >
              {EXP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Salary — semi-hard filter */}
          <div className="sb-section">
            <div className="sb-label-row">
              <span className="sb-label">Min salary</span>
              <span className="salary-display">
                {draft.minLpa ? `${draft.minLpa} LPA` : "Any"}
              </span>
            </div>
            <input
              type="range"
              className="salary-slider"
              min="0"
              max={SALARY_MAX}
              step={SALARY_STEP}
              value={draft.minLpa ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                set("minLpa", v === 0 ? null : v);
              }}
            />
            <div className="slider-labels">
              <span>Any</span>
              <span>{SALARY_MAX} LPA</span>
            </div>
          </div>

          {/* Job category */}
          <div className="sb-section">
            <div className="sb-label">Job category</div>
            <select
              className="select"
              value={draft.jobCategory}
              onChange={(e) => set("jobCategory", e.target.value as JobCategory)}
            >
              {JOB_CATEGORIES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Company type — multi-checkbox dropdown */}
          <div className="sb-section">
            <div className="sb-label">Company type</div>
            <div className="multi-drop" ref={companyDropRef}>
              <button
                type="button"
                className={`multi-drop-btn${companyDropOpen ? " open" : ""}`}
                onClick={() => setCompanyDropOpen((v) => !v)}
              >
                <span className="multi-drop-val">
                  {draft.companyCategories.length === 0
                    ? "All companies"
                    : draft.companyCategories.length === 1
                      ? COMPANY_CATEGORIES.find((c) => c.value === draft.companyCategories[0])?.label
                      : `${draft.companyCategories.length} selected`}
                </span>
                <span className="multi-drop-arrow">{companyDropOpen ? "▴" : "▾"}</span>
              </button>
              {companyDropOpen && (
                <div className="multi-drop-menu">
                  {COMPANY_CATEGORIES.map(({ label, value }) => {
                    const checked = draft.companyCategories.includes(value);
                    return (
                      <label key={value} className="multi-drop-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            set(
                              "companyCategories",
                              checked
                                ? draft.companyCategories.filter((c) => c !== value)
                                : [...draft.companyCategories, value]
                            );
                          }}
                        />
                        {label}
                      </label>
                    );
                  })}
                  {draft.companyCategories.length > 0 && (
                    <button
                      type="button"
                      className="multi-drop-clear"
                      onClick={() => set("companyCategories", [])}
                    >
                      Clear selection
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Custom career sites */}
          <div className="sb-section">
            <div className="sb-label-row">
              <span className="sb-label">Custom career pages</span>
              <button
                type="button"
                className="sb-label-action"
                onClick={() => { setShowCustomAdd((v) => !v); setUrlError(null); }}
              >
                <IconPlus /> Add
              </button>
            </div>

            {showCustomAdd && (
              <div className="custom-add-form">
                <input
                  className="input"
                  placeholder="https://jobs.lever.co/zepto"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && addCustomSite()}
                />
                <input
                  className="input"
                  placeholder="Company name (optional)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomSite()}
                  style={{ marginTop: 6 }}
                />
                {urlError && <p className="field-error" style={{ marginTop: 4 }}>{urlError}</p>}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button type="button" className="btn-add-site" onClick={addCustomSite}>
                    Add site
                  </button>
                  <button type="button" className="btn-cancel-site" onClick={() => { setShowCustomAdd(false); setUrlError(null); }}>
                    Cancel
                  </button>
                </div>
                <p className="custom-hint">
                  Supports Lever, Greenhouse, Ashby & Workday URLs
                </p>
              </div>
            )}

            {customSites.length > 0 && (
              <div className="custom-site-list">
                {customSites.map((site) => (
                  <div key={site.id} className="custom-site-item">
                    <div className="csi-left">
                      <span className="csi-name">{site.company}</span>
                      <span className="csi-ats">{ATS_LABELS[site.atsType]} · {humaniseSiteId(site.atsType, site.siteId)}</span>
                    </div>
                    <button
                      type="button"
                      className="csi-remove"
                      onClick={() => removeCustomSite(site.id)}
                      title="Remove"
                    >
                      <IconX />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {customSites.length === 0 && !showCustomAdd && (
              <p className="custom-empty">
                Add any company career page — included in every search
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="sb-section" style={{ borderBottom: "none" }}>
            <button
              type="button"
              className="btn-search"
              onClick={applyFilters}
              disabled={isLoading}
            >
              {isLoading ? "Searching…" : "Search"}
            </button>
            <button
              type="button"
              className="btn-reset"
              onClick={resetAll}
              disabled={isLoading || isParsingResume}
            >
              Reset
            </button>
          </div>
        </aside>

        {/* ── Main ──────────────────────────────────────────────────────── */}
        <main className="main">

          {/* Header row */}
          <div className="results-bar">
            <span className="results-count">
              {isLoading
                ? "Searching…"
                : results
                  ? <><span className="count-num">{jobs.length}</span> {jobs.length !== 1 ? "jobs" : "job"} found</>
                  : "Set filters and search"}
              {aiRanked && !isLoading && (
                <span className="ai-ranked-badge" title="Results ranked by Claude AI based on your resume">
                  <IconSparkle /> AI ranked
                </span>
              )}
            </span>

            <div className="sort-wrap">
              <span className="sort-label">Sort:</span>
              <select
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date posted pills */}
          <div className="date-pills">
            <span className="date-pills-label">Posted:</span>
            {([ ["1d","24 h"],["1w","1 wk"],["1m","1 mo"],["3m","3 mo"] ] as const).map(
              ([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  className={`date-pill${(draft.postedWithin === val ? " date-pill-on" : "")}`}
                  onClick={() => { set("postedWithin", val); setFilters((f) => ({ ...f, postedWithin: val })); }}
                >
                  {lbl}
                </button>
              )
            )}
          </div>

          {/* Error */}
          {searchError && (
            <div className="error-msg">⚠ {searchError}</div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="loading-state">
              <div className="spinner" />
              <span>Finding jobs…</span>
            </div>
          )}

          {/* Empty */}
          {!isLoading && results && jobs.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p className="empty-title">No jobs matched your filters</p>
              <p className="empty-sub">Try broadening the location, clearing the experience level, or widening the salary range.</p>
            </div>
          )}

          {/* Initial idle */}
          {!isLoading && !results && !searchError && (
            <div className="empty-state">
              <div className="empty-icon">💼</div>
              <p className="empty-title">Ready to search</p>
              <p className="empty-sub">Set your filters and hit Search, or upload a resume for personalised ranking.</p>
            </div>
          )}

          {/* Job cards */}
          {!isLoading && jobs.length > 0 && (
            <div className="job-list">{jobCards}</div>
          )}
        </main>
      </div>
    </div>
  );
}
