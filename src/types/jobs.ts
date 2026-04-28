export type PostedWithin = "1d" | "1w" | "1m" | "3m";

export type SortBy = "relevance" | "recent" | "salary_desc" | "salary_asc";

export type CompanyTier = "tier1" | "tier2" | "mnc" | "services" | "startup";

export type JobCategory =
  | "product"
  | "engineering"
  | "data"
  | "design"
  | "sales"
  | "marketing"
  | "operations"
  | "it"
  | "finance"
  | "hr"
  | "";

export type ATSType = "lever" | "greenhouse" | "ashby" | "workday" | "unknown";

export type SearchFilters = {
  role: string;
  /** Minimum LPA — null means no minimum */
  minLpa: number | null;
  postedWithin: PostedWithin;
  location: string;
  /** Year-range string: "0-1" | "1-2" | "2-3" | "3-5" | "5-7" | "7-10" | "10+" | "" */
  experienceLevel: string;
  remoteOnly: boolean;
  /** Empty array = all companies */
  companyCategories: CompanyTier[];
  jobCategory: JobCategory;
};

export type CandidateProfile = {
  fileName?: string;
  skills: string[];
  inferredRoles: string[];
  yearsOfExperience: number | null;
  seniority: string | null;
  location: string | null;
  domains: string[];
  education: string[];
  /** Comprehensive normalised keyword set used for ranking */
  matchKeywords: string[];
  /**
   * Broad job category inferred by AI: "engineering" | "product" | "data" |
   * "design" | "sales" | "marketing" | "operations" | "it" | "finance" | "hr"
   * Used to apply a coherence penalty when ranking jobs of mismatched categories.
   */
  primaryCategory: string | null;
};

export type JobSource = "greenhouse" | "lever" | "ashby" | "workday" | "smartrecruiters" | "adzuna" | "jsonld" | "mock";

export type JobRecord = {
  id: string;
  source: JobSource;
  company: string;
  companyTier: CompanyTier;
  title: string;
  location: string;
  postedAt: string;
  salaryMinLpa: number | null;
  salaryMaxLpa: number | null;
  applyUrl: string;
  description: string;
  skills: string[];
  experienceText: string;
  employmentType: string;
};

export type RankedJob = JobRecord & {
  score: number;
  matchedSkills: string[];
  /** One-line AI reasoning for why this job was ranked this way (only set when AI reranking is active) */
  matchReason?: string;
};

/** A user-added career site, persisted in localStorage */
export type CustomSite = {
  id: string;           // unique, e.g. "lever:zepto"
  company: string;      // display name
  atsType: ATSType;     // detected ATS
  siteId: string;       // ATS-specific identifier (lever slug / GH token / Ashby orgId / "tenant/board/wdNum")
  url: string;          // original pasted URL
  tier: CompanyTier;    // default "startup"
  addedAt: string;      // ISO timestamp
};

export type SearchResponse = {
  jobs: RankedJob[];
  totalFetched: number;
  companyCount: number;
  /** True when Adzuna API credentials are configured server-side */
  adzunaEnabled: boolean;
  /** True when results were ranked by Claude instead of the rule-based scorer */
  aiRanked: boolean;
};
