"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { CandidateProfile, JobCategory, RankedJob, SearchResponse } from "@/types/jobs";
import type { RoleCategory } from "@/lib/constants";
import { SKILL_CATEGORIES, TECH_ROLE_CATEGORIES } from "@/lib/constants";

// -- Types -------------------------------------------------------------------

type SkillData = {
  skill: string;
  skillNorm: string;
  rawCount: number;      // actual job count - shown as (n/total) in UI
  pct: number;           // employer-weighted percentage (used for tier + bar)
  rawPct: number;        // unweighted percentage (tooltip reference)
  tier: "must-have" | "valuable" | "niche";
  exampleTitles: string[];
};

type EmployerStat = {
  company: string;
  count: number;
  pct: number;           // share of title-matched sample (0-100)
};

type AggregateResult = {
  skills: SkillData[];
  topEmployers: EmployerStat[];
  hasDominantEmployer: boolean;
};

type ScanStatus = "idle" | "scanning" | "done" | "error";

// -- Constants ---------------------------------------------------------------

const JOB_CATEGORIES: { label: string; value: JobCategory | "" }[] = [
  { label: "Any category",  value: "" },
  { label: "Engineering",   value: "engineering" },
  { label: "Product",       value: "product" },
  { label: "Data / AI",     value: "data" },
  { label: "Design",        value: "design" },
  { label: "Sales",         value: "sales" },
  { label: "Marketing",     value: "marketing" },
  { label: "Operations",    value: "operations" },
  { label: "IT",            value: "it" },
  { label: "Finance",       value: "finance" },
  { label: "HR",            value: "hr" },
];

const TIER_CONFIG = {
  "must-have": { label: "Must-have", sub: ">=50% of listings require this" },
  "valuable":  { label: "Valuable",  sub: "20-49% of listings mention this" },
  "niche":     { label: "Niche",     sub: "found in <20% of listings" },
} as const;

// Sample size thresholds
const SAMPLE_WARN  = 100;  // warn banner, show results
const SAMPLE_BLOCK = 50;   // block score + hide must-have bucket
const MIN_SKILL_N  = 10;   // min raw count to appear in "your strengths"
const CONC_CAP     = 15;   // employer concentration warning threshold (%)

// -- Helpers -----------------------------------------------------------------

function filterByTitle(jobs: RankedJob[], role: string): RankedJob[] {
  const trimmed = role.trim();
  if (!trimmed) return jobs;
  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  return jobs.filter((job) => {
    const title = job.title.toLowerCase();
    return tokens.every((t) => {
      const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = t.length <= 3
        ? new RegExp(`(?<![a-z0-9-])${escaped}(?![a-z0-9-])`, "i")
        : new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
      return re.test(title);
    });
  });
}

function inferRoleCategory(role: string): RoleCategory | null {
  const r = role.toLowerCase();
  if (/\b(llm|genai|gen ai|generative ai|ai engineer|ai\/ml|applied ai|ai application)\b/.test(r)) return "ai_llm";
  if (/\b(data engineer|data pipeline|analytics engineer|etl engineer)\b/.test(r))               return "data";
  if (/\b(data scientist|data science)\b/.test(r))                                               return "ml";
  if (/\b(ml engineer|machine learning engineer|mlops)\b/.test(r))                               return "ml";
  if (/\b(frontend|front.end|ui engineer|react developer|ui developer)\b/.test(r))               return "frontend";
  if (/\b(backend|back.end|server.side|api engineer)\b/.test(r))                                 return "backend";
  if (/\b(full.?stack)\b/.test(r))                                                               return "fullstack";
  if (/\b(devops|sre|platform engineer|infrastructure engineer|cloud engineer)\b/.test(r))       return "devops";
  if (/\b(mobile|ios engineer|android engineer|flutter developer)\b/.test(r))                    return "mobile";
  if (/\b(security engineer|appsec|cybersecurity engineer)\b/.test(r))                          return "security";
  if (/\b(product manager|product owner|\bpm\b|head of product)\b/.test(r))                     return "product";
  return null;
}

function filterSkillsByCategory(skills: SkillData[], cat: RoleCategory | null): SkillData[] {
  if (!cat || !TECH_ROLE_CATEGORIES.includes(cat)) return skills;
  return skills.filter((s) => {
    const cats = SKILL_CATEGORIES[s.skillNorm];
    if (!cats || cats.length === 0) return true;
    return !cats.every((c) => c === "product" || c === "design");
  });
}

/**
 * Aggregate skills from title-matched jobs with employer-concentration weighting.
 * Each listing is weighted by 1/sqrt(employer_listing_count) so a company with 20
 * postings contributes 20/sqrt(20) ~ 4.5 effective listings, not 20.
 */
function aggregateSkills(jobs: RankedJob[]): AggregateResult {
  if (jobs.length === 0) {
    return { skills: [], topEmployers: [], hasDominantEmployer: false };
  }

  // Count listings per employer (case-insensitive)
  const empCounts = new Map<string, number>();
  for (const job of jobs) {
    const co = job.company.toLowerCase().trim();
    empCounts.set(co, (empCounts.get(co) ?? 0) + 1);
  }

  const getW = (company: string) =>
    1 / Math.sqrt(empCounts.get(company.toLowerCase().trim()) ?? 1);
  const totalW = jobs.reduce((s, j) => s + getW(j.company), 0);

  // Skill accumulation
  const skillMap = new Map<string, {
    display: string;
    rawCount: number;
    weighted: number;
    titles: Set<string>;
  }>();

  for (const job of jobs) {
    const w = getW(job.company);
    const seen = new Set<string>();
    for (const skill of job.skills) {
      const norm = skill.toLowerCase().trim();
      if (!norm || norm.length < 2 || seen.has(norm)) continue;
      seen.add(norm);
      if (!skillMap.has(norm)) {
        skillMap.set(norm, { display: skill.trim(), rawCount: 0, weighted: 0, titles: new Set() });
      }
      const e = skillMap.get(norm)!;
      e.rawCount++;
      e.weighted += w;
      e.titles.add(job.title);
    }
  }

  const totalRaw = jobs.length;
  const skills: SkillData[] = Array.from(skillMap.entries())
    .map(([norm, { display, rawCount, weighted, titles }]) => {
      const pct    = Math.round((weighted / totalW)   * 100);
      const rawPct = Math.round((rawCount / totalRaw) * 100);
      const tier: SkillData["tier"] = pct >= 50 ? "must-have" : pct >= 20 ? "valuable" : "niche";
      return { skill: display, skillNorm: norm, rawCount, pct, rawPct, tier, exampleTitles: Array.from(titles).slice(0, 3) };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 50);

  // Top employers (resolve display name from original jobs)
  const displayName = new Map<string, string>();
  for (const j of jobs) displayName.set(j.company.toLowerCase().trim(), j.company);

  const topEmployers: EmployerStat[] = Array.from(empCounts.entries())
    .map(([co, count]) => ({
      company: displayName.get(co) ?? co,
      count,
      pct: Math.round((count / totalRaw) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    skills,
    topEmployers,
    hasDominantEmployer: topEmployers.some(e => e.pct > CONC_CAP),
  };
}

function hasSkill(userSkills: Set<string>, targetNorm: string): boolean {
  if (userSkills.has(targetNorm)) return true;
  if (targetNorm.length >= 4) {
    for (const us of userSkills) {
      if (us.length >= 4 && (us.includes(targetNorm) || targetNorm.includes(us))) return true;
    }
  }
  return false;
}

function getMarketHealth(count: number) {
  if (count >= 60) return { label: "High demand",     icon: "fire",  color: "var(--green)", bg: "var(--green-soft)", border: "var(--green-bd)", advice: null as string | null };
  if (count >= 25) return { label: "Moderate demand", icon: "chart", color: "var(--blue)",  bg: "var(--blue-soft)",  border: "var(--blue-bd)",  advice: null as string | null };
  if (count >= 8)  return { label: "Niche market",    icon: "warn",  color: "var(--amber)", bg: "var(--amber-soft)", border: "var(--amber-bd)", advice: "Relatively few openings. Try a broader title to see the full demand picture." };
  return              { label: "Very low demand",  icon: "alert", color: "var(--red)",   bg: "var(--red-soft)",   border: "#fecaca",        advice: "Very few active listings — consider pivoting to a higher-demand adjacent title." };
}

const HEALTH_ICONS: Record<string, string> = {
  fire: "🔥", chart: "📈", warn: "⚠️", alert: "🚨",
};

// -- Icons -------------------------------------------------------------------

const IconTarget = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
  </svg>
);
const IconEdit = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// -- Component ---------------------------------------------------------------

export interface SkillsTabProps {
  profile?: CandidateProfile;
}

export function SkillsTab({ profile }: SkillsTabProps) {
  // Scan inputs
  const [targetRole,     setTargetRole]     = useState<string>((profile?.inferredRoles?.[0]) ?? "");
  const [targetCategory, setTargetCategory] = useState<JobCategory | "">((profile?.primaryCategory as JobCategory) ?? "");

  // Gate override: user clicked "show anyway" on blocked/insufficient sample
  const [showAnyway, setShowAnyway] = useState(false);

  // Scan state
  const [scanStatus,    setScanStatus]    = useState<ScanStatus>("idle");
  const [scanError,     setScanError]     = useState<string | null>(null);
  const [scanJobs,      setScanJobs]      = useState<RankedJob[]>([]);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);


  // Seed scan fields from profile when it arrives
  useEffect(() => {
    if (profile) {
      if (!targetRole     && profile.inferredRoles?.[0])  setTargetRole(profile.inferredRoles[0]);
      if (!targetCategory && profile.primaryCategory)      setTargetCategory(profile.primaryCategory as JobCategory);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // -- Scan -------------------------------------------------------------------

  const runScan = useCallback(async (role?: string, cat?: JobCategory | "") => {
    const r = (role ?? targetRole).trim();
    const c = cat ?? targetCategory;
    if (!r && !c) return;

    setScanStatus("scanning");
    setScanError(null);
    setScanJobs([]);
    setExpandedSkill(null);
    setShowAnyway(false);

    try {
      const res = await fetch("/api/search-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            role: r,
            jobCategory: c,
            minLpa: null,
            postedWithin: "1m",
            location: "",
            experienceLevel: "",
            remoteOnly: false,
            companyCategories: [],
          },
          profile: null,
          customSites: [],
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Scan failed");
      }
      const data = (await res.json()) as SearchResponse;
      setScanJobs(data.jobs);
      setScanStatus("done");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
      setScanStatus("error");
    }
  }, [targetRole, targetCategory]);



  // -- Derived data -----------------------------------------------------------

  const titleMatchedJobs = useMemo(() => filterByTitle(scanJobs, targetRole), [scanJobs, targetRole]);
  const n                = titleMatchedJobs.length;
  const titleMatchPct    = scanJobs.length > 0 ? Math.round((n / scanJobs.length) * 100) : 100;

  // Sample quality
  const isInsufficient = n > 0 && n < SAMPLE_WARN;
  const isBlocked      = n < SAMPLE_BLOCK || titleMatchPct < 5;

  const aggResult = useMemo(() => aggregateSkills(titleMatchedJobs), [titleMatchedJobs]);

  const inferredCategory = useMemo(() => inferRoleCategory(targetRole),              [targetRole]);
  const displaySkills    = useMemo(() => filterSkillsByCategory(aggResult.skills, inferredCategory), [aggResult.skills, inferredCategory]);

  const gapData = useMemo(() => {
    if (!profile || displaySkills.length === 0) return null;

    const userNorm = new Set<string>([
      ...profile.skills.map(s => s.toLowerCase().trim()),
      ...profile.matchKeywords.map(s => s.toLowerCase().trim()),
    ]);

    const matched: SkillData[] = [];
    const missing: SkillData[] = [];
    for (const s of displaySkills) {
      if (hasSkill(userNorm, s.skillNorm)) matched.push(s);
      else missing.push(s);
    }

    const mustHaveAll     = displaySkills.filter(s => s.tier === "must-have");
    const mustHaveMatched = matched.filter(s => s.tier === "must-have");
    const valuableAll     = displaySkills.filter(s => s.tier === "valuable");
    const valuableMatched = matched.filter(s => s.tier === "valuable");

    const mustPct     = mustHaveAll.length     > 0 ? mustHaveMatched.length / mustHaveAll.length     : 1;
    const valuablePct = valuableAll.length     > 0 ? valuableMatched.length / valuableAll.length     : 1;
    const score       = Math.round(mustPct * 70 + valuablePct * 30);

    // Strength skills: must have rawCount >= MIN_SKILL_N to avoid noise
    const strengthSkills = matched.filter(s => s.rawCount >= MIN_SKILL_N);

    return {
      matched, strengthSkills, missing, score,
      mustHaveTotal:   mustHaveAll.length,
      mustHaveMatched: mustHaveMatched.length,
      mustHaveScore:   mustHaveAll.length > 0 ? Math.round(mustPct * 100) : 100,
      criticalGaps:    missing.filter(s => s.tier === "must-have"),
      growthGaps:      missing.filter(s => s.tier === "valuable"),
    };
  }, [profile, displaySkills]);

  const marketHealth   = useMemo(() => getMarketHealth(n), [n]);
  const canShowMustHave = !isBlocked || showAnyway;
  const canShowScore    = !isBlocked || showAnyway;

  // -- Render -----------------------------------------------------------------

  return (
    <div className="skills-tab">

      {/* -- Target role input card ----------------------------------------- */}
      <div className="skills-target-card">
        <div className="stc-label">
          <span className="stc-label-icon"><IconTarget /></span>
          <span>Market Skills Intelligence</span>
          {profile && <span className="stc-profile-hint">Pre-filled from resume</span>}
        </div>

        <div className="stc-controls">
          <input
            className="input stc-role-input"
            placeholder="Target role (e.g. Backend Engineer, SDE)"
            value={targetRole}
            onChange={e => setTargetRole(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runScan()}
          />
          <select
            className="select stc-cat-select"
            value={targetCategory}
            onChange={e => setTargetCategory(e.target.value as JobCategory)}
          >
            {JOB_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-scan"
            onClick={() => runScan()}
            disabled={scanStatus === "scanning" || (!targetRole.trim() && !targetCategory)}
          >
            {scanStatus === "scanning" ? "Scanning..." : scanStatus === "done" ? "Re-scan" : "Scan market"}
          </button>
        </div>
      </div>

      {/* -- Scanning -------------------------------------------------------- */}
      {scanStatus === "scanning" && (
        <div className="skills-loading">
          <div className="spinner" />
          <span>Scanning the market for <strong>{targetRole || targetCategory || "this role"}</strong>...</span>
        </div>
      )}

      {/* -- Error ----------------------------------------------------------- */}
      {scanStatus === "error" && (
        <div className="error-msg">{scanError}</div>
      )}

      {/* -- Results --------------------------------------------------------- */}
      {scanStatus === "done" && (
        <>
          {/* Confidence BLOCKING banner — score + must-have hidden */}
          {isBlocked && !showAnyway && (
            <div className="confidence-blocker">
              <div className="cb-content">
                <span className="cb-icon">&#x26A0;</span>
                <div className="cb-body">
                  <strong className="cb-title">Insufficient data &mdash; scores hidden</strong>
                  <p className="cb-text">
                    Only <strong>{n} title-matched listing{n !== 1 ? "s" : ""}</strong> found
                    (title-match rate: <strong>{titleMatchPct}%</strong>).
                    With fewer than {SAMPLE_BLOCK} listings a single employer can swing percentages by 20+ points.
                  </p>
                  <p className="cb-text">
                    Try <em>Backend Engineer</em> or <em>Software Engineer</em> for a broader signal,
                    or expand to 60-90 days if your app supports it.
                  </p>
                </div>
                <button type="button" className="cb-show-btn" onClick={() => setShowAnyway(true)}>
                  Show anyway
                </button>
              </div>
            </div>
          )}

          {/* Sample WARNING banner (50-100 range) */}
          {isInsufficient && !isBlocked && (
            <div className="sample-warning-banner">
              <span className="swb-icon">&#x1F4CA;</span>
              <div className="swb-text">
                <strong>Small sample ({n} listings, {titleMatchPct}% title-match).</strong>{" "}
                Percentages are directional. Must-have threshold can shift significantly with more data.
                Consider broadening the title or expanding the date window.
              </div>
            </div>
          )}

          {/* Market health banner */}
          <div
            className="market-health-bar"
            style={{ background: marketHealth.bg, borderColor: marketHealth.border }}
          >
            <div className="mhb-left">
              <span className="mhb-icon">{HEALTH_ICONS[marketHealth.icon]}</span>
              <div className="mhb-text">
                <span className="mhb-label" style={{ color: marketHealth.color }}>
                  {marketHealth.label}
                </span>
                <span className="mhb-sub">
                  <strong>{n}</strong> title-matched listings for{" "}
                  <em>{targetRole || targetCategory}</em> &middot; Last 30 days
                  {scanJobs.length > n && (
                    <span className="mhb-scan-total"> ({scanJobs.length} total scanned)</span>
                  )}
                </span>
                {titleMatchPct < 40 && scanJobs.length >= 20 && (
                  <span className="mhb-advice">
                    Only {titleMatchPct}% of listings match this exact title.
                    Skills data is based on title-matched jobs only.
                  </span>
                )}
                {marketHealth.advice && (
                  <span className="mhb-advice">{marketHealth.advice}</span>
                )}
                {/* Top employers in sample */}
                {aggResult.topEmployers.length > 0 && (
                  <div className="mhb-employers">
                    <span className="mhbe-label">Top employers:</span>
                    {aggResult.topEmployers.map(e => (
                      <span
                        key={e.company}
                        className={`mhbe-chip${e.pct > CONC_CAP ? " dominant" : ""}`}
                        title={`${e.count} listings (${e.pct}% of sample)`}
                      >
                        {e.company} {e.pct}%
                      </span>
                    ))}
                    {aggResult.hasDominantEmployer && (
                      <span className="mhbe-warn">Concentration detected &mdash; employer weighting applied</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Score ring (or blocked placeholder) */}
            {gapData && canShowScore ? (
              <div className="mhb-score-wrap">
                <div className="mhb-ring-wrap">
                  <svg viewBox="0 0 60 60" width="60" height="60">
                    <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(0,0,0,.08)" strokeWidth="6"/>
                    <circle
                      cx="30" cy="30" r="24" fill="none"
                      stroke={gapData.score >= 70 ? "var(--green)" : gapData.score >= 40 ? "var(--amber)" : "var(--red)"}
                      strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={`${2 * Math.PI * 24 * (1 - gapData.score / 100)}`}
                      transform="rotate(-90 30 30)"
                    />
                  </svg>
                  <div className="mhb-ring-inner">
                    <span className="mhb-ring-num">{gapData.score}%</span>
                  </div>
                </div>
                <span className="mhb-score-label">Skills match</span>
              </div>
            ) : gapData ? (
              <div className="mhb-score-wrap">
                <div className="mhb-ring-wrap mhb-ring-blocked">
                  <svg viewBox="0 0 60 60" width="60" height="60">
                    <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(0,0,0,.06)" strokeWidth="6"/>
                    <circle cx="30" cy="30" r="24" fill="none" stroke="var(--border)" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 24}`} strokeDashoffset={`${2 * Math.PI * 24 * 0.5}`}
                      transform="rotate(-90 30 30)"/>
                  </svg>
                  <div className="mhb-ring-inner"><span className="mhb-ring-num">--</span></div>
                </div>
                <span className="mhb-score-label">Low sample</span>
              </div>
            ) : null}
          </div>

          {/* Two-column body */}
          <div className="skills-body">

            {/* -- Left: market demand --------------------------------------- */}
            <div className="skills-market-panel">
              <div className="smp-head">
                <h3 className="smp-title">What the market demands</h3>
                <div className="smp-legend">
                  <span className="smp-legend-dot must-have"/><span className="smp-legend-text">Must-have</span>
                  <span className="smp-legend-dot valuable" /><span className="smp-legend-text">Valuable</span>
                  <span className="smp-legend-dot niche"    /><span className="smp-legend-text">Niche</span>
                </div>
              </div>

              {(["must-have", "valuable", "niche"] as const).map(tier => {
                // Must-have gate: hide when sample is too small
                if (tier === "must-have" && !canShowMustHave) {
                  return (
                    <div key={tier} className="skill-tier-group">
                      <div className="stg-header">
                        <span className="stg-tier-badge must-have">Must-have</span>
                        <span className="stg-tier-sub">hidden &mdash; need {SAMPLE_BLOCK}+ listings</span>
                      </div>
                      <div className="stg-hidden-notice">
                        Only <strong>{n} listing{n !== 1 ? "s" : ""}</strong> in sample.
                        With fewer than {SAMPLE_BLOCK}, one employer can swing this bucket by 20+ points.{" "}
                        <button type="button" className="stg-show-btn" onClick={() => setShowAnyway(true)}>
                          Show anyway
                        </button>
                      </div>
                    </div>
                  );
                }

                const group = displaySkills.filter(s => s.tier === tier);
                if (group.length === 0) return null;

                return (
                  <div key={tier} className="skill-tier-group">
                    <div className="stg-header">
                      <span className={`stg-tier-badge ${tier}`}>{TIER_CONFIG[tier].label}</span>
                      <span className="stg-tier-sub">{TIER_CONFIG[tier].sub}</span>
                    </div>
                    {group.map(s => {
                      const isOpen    = expandedSkill === s.skill;
                      const isMatched = gapData ? !!gapData.matched.find(m => m.skillNorm === s.skillNorm) : false;
                      const isMissing = !!gapData && !isMatched;

                      return (
                        <div
                          key={s.skill}
                          className={["skill-row", isOpen ? "sr-open" : "", gapData ? (isMatched ? "sr-have" : "sr-miss") : ""].join(" ").trim()}
                          onClick={() => setExpandedSkill(isOpen ? null : s.skill)}
                          role="button" tabIndex={0}
                          onKeyDown={e => (e.key === "Enter" || e.key === " ") && setExpandedSkill(isOpen ? null : s.skill)}
                        >
                          <div className="sr-main">
                            {gapData && (
                              <span className={`sr-status-dot ${isMatched ? "have" : isMissing ? "miss" : ""}`}>
                                {isMatched ? "✓" : "✗"}
                              </span>
                            )}
                            <span className="sr-name">{s.skill}</span>
                            <div className="sr-bar-track">
                              <div className={`sr-bar-fill ${tier}`} style={{ width: `${Math.max(s.pct, 3)}%` }}/>
                            </div>
                            <span
                              className="sr-pct"
                              title={`${s.rawCount}/${n} listings (${s.rawPct}% raw, ${s.pct}% employer-weighted)`}
                            >
                              {s.pct}%
                            </span>
                            <span className="sr-count">({s.rawCount}/{n})</span>
                            <span className="sr-chevron"><IconChevron open={isOpen}/></span>
                          </div>
                          {isOpen && s.exampleTitles.length > 0 && (
                            <div className="sr-examples">
                              <span className="sre-label">Seen in:</span>
                              {s.exampleTitles.map(t => <span key={t} className="sre-chip">{t}</span>)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {displaySkills.length === 0 && n > 0 && (
                <div className="skills-no-data">
                  No skill data found for this search &mdash; try a different role or category.
                </div>
              )}
              {n === 0 && (
                <div className="skills-no-data">
                  No title-matched listings found. Try a broader role name.
                </div>
              )}
            </div>

            {/* -- Right: gap analysis --------------------------------------- */}
            {gapData ? (
              <div className="skills-gap-panel">
                <div className="sgp-head">
                  <h3 className="sgp-title">Your skill gap</h3>
                  {gapData.mustHaveTotal > 0 && (
                    <span className="sgp-fraction">
                      {gapData.mustHaveMatched}/{gapData.mustHaveTotal} must-haves
                    </span>
                  )}
                </div>

                {canShowScore ? (
                  <div className="gap-score-card">
                    <div className="gsc-ring-wrap">
                      <svg viewBox="0 0 88 88" width="88" height="88">
                        <circle cx="44" cy="44" r="36" fill="none" stroke="var(--border)" strokeWidth="8"/>
                        <circle
                          cx="44" cy="44" r="36" fill="none"
                          stroke={gapData.score >= 70 ? "var(--green)" : gapData.score >= 40 ? "var(--amber)" : "var(--red)"}
                          strokeWidth="8" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 36}`}
                          strokeDashoffset={`${2 * Math.PI * 36 * (1 - gapData.score / 100)}`}
                          transform="rotate(-90 44 44)"
                        />
                      </svg>
                      <div className="gsc-ring-inner">
                        <span className="gsc-score">{gapData.score}</span>
                        <span className="gsc-score-label">/ 100</span>
                      </div>
                    </div>
                    <div className="gsc-stats">
                      <div className="gsc-stat">
                        <span className="gsc-n green">{gapData.strengthSkills.length}</span>
                        <span className="gsc-l">In-demand<br/>skills you have</span>
                      </div>
                      <div className="gsc-divider"/>
                      <div className="gsc-stat">
                        <span className="gsc-n red">{gapData.criticalGaps.length}</span>
                        <span className="gsc-l">Critical<br/>gaps</span>
                      </div>
                      <div className="gsc-divider"/>
                      <div className="gsc-stat">
                        <span className="gsc-n amber">{gapData.growthGaps.length}</span>
                        <span className="gsc-l">Growth<br/>opportunities</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="gap-score-blocked">
                    <div className="gsb-text">Score hidden &mdash; insufficient sample</div>
                    <button type="button" className="gsb-show-btn" onClick={() => setShowAnyway(true)}>
                      Show anyway
                    </button>
                  </div>
                )}

                {/* Must-have coverage */}
                {canShowMustHave && gapData.mustHaveTotal > 0 && (
                  <div className="gap-coverage-bar">
                    <div className="gcb-label">
                      Must-have coverage
                      <span className="gcb-pct">{gapData.mustHaveScore}%</span>
                    </div>
                    <div className="gcb-track">
                      <div className="gcb-fill" style={{
                        width: `${gapData.mustHaveScore}%`,
                        background: gapData.mustHaveScore >= 70 ? "var(--green)" : gapData.mustHaveScore >= 40 ? "var(--amber)" : "var(--red)",
                      }}/>
                    </div>
                  </div>
                )}

                {/* Critical gaps */}
                {canShowMustHave && gapData.criticalGaps.length > 0 && (
                  <div className="gap-section">
                    <div className="gs-header critical">
                      <span>&#x1F6A8;</span>
                      <span className="gs-label">Critical gaps</span>
                      <span className="gs-count">{gapData.criticalGaps.length}</span>
                    </div>
                    <p className="gs-hint">Must-have skills the market expects that are not on your resume.</p>
                    <div className="gap-pills">
                      {gapData.criticalGaps.map(s => (
                        <span key={s.skill} className="gap-pill critical">
                          {s.skill}
                          <span className="gp-pct">{s.pct}%</span>
                          <span className="gp-n">({s.rawCount}/{n})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Growth opportunities */}
                {gapData.growthGaps.length > 0 && (
                  <div className="gap-section">
                    <div className="gs-header growth">
                      <span>&#x1F4C8;</span>
                      <span className="gs-label">Growth opportunities</span>
                      <span className="gs-count">{gapData.growthGaps.length}</span>
                    </div>
                    <p className="gs-hint">Valuable skills that would improve your match rate.</p>
                    <div className="gap-pills">
                      {gapData.growthGaps.map(s => (
                        <span key={s.skill} className="gap-pill growth">
                          {s.skill}
                          <span className="gp-pct">{s.pct}%</span>
                          <span className="gp-n">({s.rawCount}/{n})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths */}
                {gapData.strengthSkills.length > 0 && (
                  <div className="gap-section">
                    <div className="gs-header strength">
                      <span>&#x2713;</span>
                      <span className="gs-label">Your in-demand skills</span>
                      <span className="gs-count">{gapData.strengthSkills.length}</span>
                    </div>
                    <p className="gs-hint">Matched skills with {MIN_SKILL_N}+ listings &mdash; noise filtered.</p>
                    <div className="gap-pills">
                      {gapData.strengthSkills.map(s => (
                        <span key={s.skill} className="gap-pill strength">{s.skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="skills-gap-cta">
                <div className="sgc-icon">&#x1F4C4;</div>
                <div className="sgc-title">See your personal gap</div>
                <div className="sgc-body">
                  Upload your resume on the <strong>Jobs</strong> tab to get a personalised skill gap analysis.
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Idle state */}
      {scanStatus === "idle" && (
        <div className="skills-idle">
          <div className="si-icon">&#x1F3AF;</div>
          <div className="si-title">Scan the real market</div>
          <div className="si-sub">
            Enter your target role above and hit <strong>Scan market</strong> to see which skills
            are genuinely in demand &mdash; aggregated from live job listings.
            {!profile && " Upload your resume to also see your personal skill gap."}
          </div>
        </div>
      )}
    </div>
  );
}
