"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { CandidateProfile, JobCategory, RankedJob, SearchResponse } from "@/types/jobs";

// ── Types ──────────────────────────────────────────────────────────────────────

type SkillData = {
  skill: string;       // display (original casing)
  skillNorm: string;   // lowercase for matching
  count: number;
  pct: number;
  tier: "must-have" | "valuable" | "niche";
  exampleTitles: string[];
};

type ScanStatus = "idle" | "scanning" | "done" | "error";

// ── Constants ──────────────────────────────────────────────────────────────────

const JOB_CATEGORIES: { label: string; value: JobCategory | "" }[] = [
  { label: "Any category", value: "" },
  { label: "Engineering", value: "engineering" },
  { label: "Product", value: "product" },
  { label: "Data / AI", value: "data" },
  { label: "Design", value: "design" },
  { label: "Sales", value: "sales" },
  { label: "Marketing", value: "marketing" },
  { label: "Operations", value: "operations" },
  { label: "IT", value: "it" },
  { label: "Finance", value: "finance" },
  { label: "HR", value: "hr" },
];

const TIER_CONFIG = {
  "must-have": { label: "Must-have", sub: "≥50% of job listings require this" },
  "valuable":  { label: "Valuable",  sub: "20–49% of listings mention this" },
  "niche":     { label: "Niche",     sub: "found in <20% of listings" },
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function aggregateSkills(jobs: RankedJob[]): SkillData[] {
  if (jobs.length === 0) return [];

  const counts = new Map<string, { display: string; count: number; titles: Set<string> }>();

  for (const job of jobs) {
    const seen = new Set<string>();
    for (const skill of job.skills) {
      const norm = skill.toLowerCase().trim();
      if (!norm || norm.length < 2) continue;
      if (seen.has(norm)) continue;
      seen.add(norm);
      if (!counts.has(norm)) counts.set(norm, { display: skill.trim(), count: 0, titles: new Set() });
      const entry = counts.get(norm)!;
      entry.count++;
      entry.titles.add(job.title);
    }
  }

  const total = jobs.length;
  return Array.from(counts.entries())
    .map(([norm, { display, count, titles }]) => {
      const pct = Math.round((count / total) * 100);
      const tier: SkillData["tier"] = pct >= 50 ? "must-have" : pct >= 20 ? "valuable" : "niche";
      return {
        skill: display,
        skillNorm: norm,
        count,
        pct,
        tier,
        exampleTitles: Array.from(titles).slice(0, 3),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
}

function hasSkill(userSkills: Set<string>, targetNorm: string): boolean {
  if (userSkills.has(targetNorm)) return true;
  // Substring containment for multi-word / abbreviated terms (min 4 chars to reduce noise)
  if (targetNorm.length >= 4) {
    for (const us of userSkills) {
      if (us.length >= 4 && (us.includes(targetNorm) || targetNorm.includes(us))) return true;
    }
  }
  return false;
}

function getMarketHealth(count: number) {
  if (count >= 60) return {
    label: "High demand",
    icon: "🔥",
    color: "var(--green)",
    bg: "var(--green-soft)",
    border: "var(--green-bd)",
    warn: false,
    advice: null as string | null,
  };
  if (count >= 25) return {
    label: "Moderate demand",
    icon: "📈",
    color: "var(--blue)",
    bg: "var(--blue-soft)",
    border: "var(--blue-bd)",
    warn: false,
    advice: null as string | null,
  };
  if (count >= 8) return {
    label: "Niche market",
    icon: "⚠️",
    color: "var(--amber)",
    bg: "var(--amber-soft)",
    border: "var(--amber-bd)",
    warn: true,
    advice: "Relatively few openings for this role right now. Try a broader title to see the full demand picture.",
  };
  return {
    label: "Very low demand",
    icon: "🚨",
    color: "var(--red)",
    bg: "var(--red-soft)",
    border: "#fecaca",
    warn: true,
    advice: "Very few active listings found. This role may have limited openings in the current market — consider pivoting to an adjacent, higher-demand title.",
  };
}

// ── Icons ──────────────────────────────────────────────────────────────────────

const IconTarget = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
  </svg>
);

// ── Component ──────────────────────────────────────────────────────────────────

export interface SkillsTabProps {
  profile?: CandidateProfile;
}

export function SkillsTab({ profile }: SkillsTabProps) {
  // Target role state — seeded from resume if available
  const [targetRole, setTargetRole] = useState<string>(
    profile?.inferredRoles?.[0] ?? ""
  );
  const [targetCategory, setTargetCategory] = useState<JobCategory | "">(
    (profile?.primaryCategory as JobCategory) ?? ""
  );

  // Scan state
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanJobs, setScanJobs] = useState<RankedJob[]>([]);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  // Track whether we've already auto-triggered a scan on mount
  const didAutoScan = useRef(false);

  // When profile becomes available after mount, seed the target fields
  useEffect(() => {
    if (profile) {
      if (!targetRole && profile.inferredRoles?.[0]) setTargetRole(profile.inferredRoles[0]);
      if (!targetCategory && profile.primaryCategory) setTargetCategory(profile.primaryCategory as JobCategory);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // ── Scan logic ─────────────────────────────────────────────────────────────

  const runScan = useCallback(async (role?: string, cat?: JobCategory | "") => {
    const r = (role ?? targetRole).trim();
    const c = cat ?? targetCategory;
    if (!r && !c) return;

    setScanStatus("scanning");
    setScanError(null);
    setScanJobs([]);
    setExpandedSkill(null);

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

  // Auto-scan on mount if resume is already loaded
  useEffect(() => {
    if (!didAutoScan.current && profile) {
      const role = profile.inferredRoles?.[0] ?? "";
      const cat  = (profile.primaryCategory as JobCategory) ?? "";
      if (role || cat) {
        didAutoScan.current = true;
        runScan(role, cat);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────

  const marketSkills = useMemo(() => aggregateSkills(scanJobs), [scanJobs]);

  const gapData = useMemo(() => {
    if (!profile || marketSkills.length === 0) return null;

    const userSkillsNorm = new Set<string>([
      ...profile.skills.map(s => s.toLowerCase().trim()),
      ...profile.matchKeywords.map(s => s.toLowerCase().trim()),
    ]);

    const matched: SkillData[] = [];
    const missing: SkillData[] = [];
    for (const ms of marketSkills) {
      if (hasSkill(userSkillsNorm, ms.skillNorm)) matched.push(ms);
      else missing.push(ms);
    }

    const mustHaveAll     = marketSkills.filter(s => s.tier === "must-have");
    const mustHaveMatched = matched.filter(s => s.tier === "must-have");
    const valuableAll     = marketSkills.filter(s => s.tier === "valuable");
    const valuableMatched = matched.filter(s => s.tier === "valuable");

    const mustPct     = mustHaveAll.length > 0 ? mustHaveMatched.length / mustHaveAll.length : 1;
    const valuablePct = valuableAll.length > 0  ? valuableMatched.length / valuableAll.length : 1;
    // Weighted: must-haves 70 pts, valuable 30 pts
    const score = Math.round(mustPct * 70 + valuablePct * 30);

    return {
      matched,
      missing,
      score,
      mustHaveTotal:   mustHaveAll.length,
      mustHaveMatched: mustHaveMatched.length,
      mustHaveScore:   mustHaveAll.length > 0 ? Math.round(mustPct * 100) : 100,
      criticalGaps:    missing.filter(s => s.tier === "must-have"),
      growthGaps:      missing.filter(s => s.tier === "valuable"),
    };
  }, [profile, marketSkills]);

  const marketHealth = useMemo(() => getMarketHealth(scanJobs.length), [scanJobs.length]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="skills-tab">

      {/* ── Target role input card ─────────────────────────────────────────── */}
      <div className="skills-target-card">
        <div className="stc-label">
          <span className="stc-label-icon"><IconTarget /></span>
          <span>Market Skills Intelligence</span>
          {profile && (
            <span className="stc-profile-hint">✦ Pre-filled from your resume</span>
          )}
        </div>
        <div className="stc-controls">
          <input
            className="input stc-role-input"
            placeholder="Target role  (e.g. Senior Software Engineer)"
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
            {scanStatus === "scanning" ? "Scanning…" : scanStatus === "done" ? "Re-scan" : "Scan market"}
          </button>
        </div>
      </div>

      {/* ── Scanning ──────────────────────────────────────────────────────────── */}
      {scanStatus === "scanning" && (
        <div className="skills-loading">
          <div className="spinner" />
          <span>Scanning the market for <strong>{targetRole || targetCategory || "this role"}</strong>…</span>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {scanStatus === "error" && (
        <div className="error-msg">⚠ {scanError}</div>
      )}

      {/* ── Results ───────────────────────────────────────────────────────────── */}
      {scanStatus === "done" && (
        <>

          {/* Market health banner */}
          <div
            className="market-health-bar"
            style={{ background: marketHealth.bg, borderColor: marketHealth.border }}
          >
            <div className="mhb-left">
              <span className="mhb-icon">{marketHealth.icon}</span>
              <div className="mhb-text">
                <span className="mhb-label" style={{ color: marketHealth.color }}>
                  {marketHealth.label}
                </span>
                <span className="mhb-sub">
                  <strong>{scanJobs.length}</strong> active listings for{" "}
                  <em>{targetRole || targetCategory}</em> · Last 30 days
                </span>
                {marketHealth.advice && (
                  <span className="mhb-advice">{marketHealth.advice}</span>
                )}
              </div>
            </div>
            {gapData && (
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
            )}
          </div>

          {/* Two-column body */}
          <div className="skills-body">

            {/* ── Left: market demand ────────────────────────────────────────── */}
            <div className="skills-market-panel">
              <div className="smp-head">
                <h3 className="smp-title">What the market demands</h3>
                <div className="smp-legend">
                  <span className="smp-legend-dot must-have" />
                  <span className="smp-legend-text">Must-have</span>
                  <span className="smp-legend-dot valuable" />
                  <span className="smp-legend-text">Valuable</span>
                  <span className="smp-legend-dot niche" />
                  <span className="smp-legend-text">Niche</span>
                </div>
              </div>

              {(["must-have", "valuable", "niche"] as const).map(tier => {
                const group = marketSkills.filter(s => s.tier === tier);
                if (group.length === 0) return null;
                const tc = TIER_CONFIG[tier];

                return (
                  <div key={tier} className="skill-tier-group">
                    <div className="stg-header">
                      <span className={`stg-tier-badge ${tier}`}>{tc.label}</span>
                      <span className="stg-tier-sub">{tc.sub}</span>
                    </div>

                    {group.map(s => {
                      const isOpen    = expandedSkill === s.skill;
                      const isMatched = gapData ? !!gapData.matched.find(m => m.skillNorm === s.skillNorm) : false;
                      const isMissing = gapData && !isMatched;

                      return (
                        <div
                          key={s.skill}
                          className={[
                            "skill-row",
                            isOpen    ? "sr-open"    : "",
                            gapData   ? (isMatched ? "sr-have" : "sr-miss") : "",
                          ].join(" ").trim()}
                          onClick={() => setExpandedSkill(isOpen ? null : s.skill)}
                          role="button"
                          tabIndex={0}
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
                              <div
                                className={`sr-bar-fill ${tier}`}
                                style={{ width: `${Math.max(s.pct, 3)}%` }}
                              />
                            </div>
                            <span className="sr-pct">{s.pct}%</span>
                            <span className="sr-count">{s.count} job{s.count !== 1 ? "s" : ""}</span>
                            <span className="sr-chevron"><IconChevron open={isOpen} /></span>
                          </div>

                          {isOpen && s.exampleTitles.length > 0 && (
                            <div className="sr-examples">
                              <span className="sre-label">Seen in:</span>
                              {s.exampleTitles.map(t => (
                                <span key={t} className="sre-chip">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {marketSkills.length === 0 && (
                <div className="skills-no-data">
                  No skill data found for this search — try a different role or category.
                </div>
              )}
            </div>

            {/* ── Right: gap analysis ────────────────────────────────────────── */}
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

                {/* Score card */}
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
                      <span className="gsc-n green">{gapData.matched.length}</span>
                      <span className="gsc-l">In-demand<br/>skills you have</span>
                    </div>
                    <div className="gsc-divider" />
                    <div className="gsc-stat">
                      <span className="gsc-n red">{gapData.criticalGaps.length}</span>
                      <span className="gsc-l">Critical<br/>gaps</span>
                    </div>
                    <div className="gsc-divider" />
                    <div className="gsc-stat">
                      <span className="gsc-n amber">{gapData.growthGaps.length}</span>
                      <span className="gsc-l">Growth<br/>opportunities</span>
                    </div>
                  </div>
                </div>

                {/* Must-have progress bar */}
                {gapData.mustHaveTotal > 0 && (
                  <div className="gap-coverage-bar">
                    <div className="gcb-label">
                      Must-have coverage
                      <span className="gcb-pct">{gapData.mustHaveScore}%</span>
                    </div>
                    <div className="gcb-track">
                      <div
                        className="gcb-fill"
                        style={{
                          width: `${gapData.mustHaveScore}%`,
                          background: gapData.mustHaveScore >= 70
                            ? "var(--green)"
                            : gapData.mustHaveScore >= 40
                              ? "var(--amber)"
                              : "var(--red)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Critical gaps */}
                {gapData.criticalGaps.length > 0 && (
                  <div className="gap-section">
                    <div className="gs-header critical">
                      <span>🚨</span>
                      <span className="gs-label">Critical gaps</span>
                      <span className="gs-count">{gapData.criticalGaps.length}</span>
                    </div>
                    <p className="gs-hint">Must-have skills the market expects that aren&apos;t on your resume.</p>
                    <div className="gap-pills">
                      {gapData.criticalGaps.map(s => (
                        <span key={s.skill} className="gap-pill critical">
                          {s.skill}
                          <span className="gp-pct">{s.pct}%</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Growth opportunities */}
                {gapData.growthGaps.length > 0 && (
                  <div className="gap-section">
                    <div className="gs-header growth">
                      <span>📈</span>
                      <span className="gs-label">Growth opportunities</span>
                      <span className="gs-count">{gapData.growthGaps.length}</span>
                    </div>
                    <p className="gs-hint">Valuable skills that would meaningfully improve your match rate.</p>
                    <div className="gap-pills">
                      {gapData.growthGaps.map(s => (
                        <span key={s.skill} className="gap-pill growth">
                          {s.skill}
                          <span className="gp-pct">{s.pct}%</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Your strengths */}
                {gapData.matched.length > 0 && (
                  <div className="gap-section">
                    <div className="gs-header strength">
                      <span>✓</span>
                      <span className="gs-label">Your in-demand skills</span>
                      <span className="gs-count">{gapData.matched.length}</span>
                    </div>
                    <div className="gap-pills">
                      {gapData.matched.map(s => (
                        <span key={s.skill} className="gap-pill strength">
                          {s.skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            ) : (
              /* No resume → upload CTA */
              <div className="skills-gap-cta">
                <div className="sgc-icon">📄</div>
                <div className="sgc-title">See your personal gap</div>
                <div className="sgc-body">
                  Upload your resume on the <strong>Jobs</strong> tab to get a personalised skill gap analysis against this market data.
                </div>
              </div>
            )}

          </div>
        </>
      )}

      {/* ── Idle state ────────────────────────────────────────────────────────── */}
      {scanStatus === "idle" && (
        <div className="skills-idle">
          <div className="si-icon">🎯</div>
          <div className="si-title">Scan the real market</div>
          <div className="si-sub">
            Enter your target role above and hit <strong>Scan market</strong> to see which skills are
            genuinely in demand — not guesswork, but aggregated from real job listings.
            {!profile && " Upload your resume to also see your personal skill gap."}
          </div>
        </div>
      )}

    </div>
  );
}
