import { parseLpaFromText } from "@/lib/normalization/salary";
import type { CompanyTier, CustomSite, JobRecord, JobSource, SearchFilters } from "@/types/jobs";
import { ageInDays, postedWithinDays } from "@/lib/utils/dates";
import { normalizeText, uniqueStrings } from "@/lib/utils/text";
import type { JobSourceAdapter, SourceContext } from "@/lib/sources/types";
import { mockJobs } from "@/lib/sources/mock-data";
import { KNOWN_SKILLS, SKILL_ALIASES } from "@/lib/constants";
import { allMatchesFalsePositive } from "@/lib/skills/negative-context";

// ── Company registry with tiers ──────────────────────────────────────────────

type CompanyMeta = { tier: CompanyTier };

const COMPANY_META: Record<string, CompanyMeta> = {
  // ── Tier 1 Indian product companies ──────────────────────────────────────
  Razorpay:       { tier: "tier1" },
  Meesho:         { tier: "tier1" },
  BrowserStack:   { tier: "tier1" },
  Groww:          { tier: "tier1" },
  Freshworks:     { tier: "tier1" },
  InMobi:         { tier: "tier1" },
  Postman:        { tier: "tier1" },
  Chargebee:      { tier: "tier1" },
  Paytm:          { tier: "tier1" },
  Flipkart:       { tier: "tier1" },
  Swiggy:         { tier: "tier1" },
  Zomato:         { tier: "tier1" },
  PhonePe:        { tier: "tier1" },
  CRED:           { tier: "tier1" },
  Nykaa:          { tier: "tier1" },
  Unacademy:      { tier: "tier1" },
  Delhivery:      { tier: "tier1" },
  Udaan:          { tier: "tier1" },

  // ── Tier 2 / high-growth startups ─────────────────────────────────────────
  CARS24:         { tier: "tier2" },
  Darwinbox:      { tier: "tier2" },
  Whatfix:        { tier: "tier2" },
  MoEngage:       { tier: "tier2" },
  CleverTap:      { tier: "tier2" },
  Hasura:         { tier: "tier2" },
  Druva:          { tier: "tier2" },
  Jar:            { tier: "tier2" },
  Porter:         { tier: "tier2" },
  Rocketlane:     { tier: "tier2" },
  Innovaccer:     { tier: "tier2" },
  LeadSquared:    { tier: "tier2" },
  Gojek:          { tier: "tier2" },
  Zepto:          { tier: "tier2" },
  "Namma Yatri":  { tier: "tier2" },
  Juspay:         { tier: "tier2" },
  ShareChat:      { tier: "tier2" },
  Khatabook:      { tier: "tier2" },
  Slice:          { tier: "tier2" },
  Acko:           { tier: "tier2" },
  Gupshup:        { tier: "tier2" },
  Perfios:        { tier: "tier2" },
  Rupeek:         { tier: "tier2" },
  "Loop Health":  { tier: "tier2" },
  "Ola Electric": { tier: "tier2" },

  // ── Global MNCs ────────────────────────────────────────────────────────────
  Google:           { tier: "mnc" },
  Microsoft:        { tier: "mnc" },
  Amazon:           { tier: "mnc" },
  Apple:            { tier: "mnc" },
  Meta:             { tier: "mnc" },
  Netflix:          { tier: "mnc" },
  Adobe:            { tier: "mnc" },
  Salesforce:       { tier: "mnc" },
  Uber:             { tier: "mnc" },
  Airbnb:           { tier: "mnc" },
  Stripe:           { tier: "mnc" },
  Atlassian:        { tier: "mnc" },
  Nvidia:           { tier: "mnc" },
  Cisco:            { tier: "mnc" },
  PayPal:           { tier: "mnc" },
  Visa:             { tier: "mnc" },
  "Goldman Sachs":  { tier: "mnc" },
  "JP Morgan":      { tier: "mnc" },
  "Walmart":        { tier: "mnc" },
  ServiceNow:       { tier: "mnc" },
  Expedia:          { tier: "mnc" },
  Twilio:           { tier: "mnc" },
  Turing:           { tier: "mnc" },
  "Dun & Bradstreet": { tier: "mnc" },
  JumpCloud:        { tier: "mnc" },
  ShipBob:          { tier: "mnc" },
  HighLevel:        { tier: "mnc" },
  Onehouse:         { tier: "mnc" },
  Rippling:         { tier: "mnc" },
  Rubrik:           { tier: "mnc" },
  CrowdStrike:      { tier: "mnc" },
  Snowflake:        { tier: "mnc" },
  Databricks:       { tier: "mnc" },
  "6sense":         { tier: "mnc" },
  EarnIn:           { tier: "mnc" },
  Fictiv:           { tier: "mnc" },
  Instawork:        { tier: "mnc" },
  LogicMonitor:     { tier: "mnc" },

  // ── IT Services ────────────────────────────────────────────────────────────
  TCS:              { tier: "services" },
  Infosys:          { tier: "services" },
  Wipro:            { tier: "services" },
  HCLTech:          { tier: "services" },
  "Tech Mahindra":  { tier: "services" },
  Cognizant:        { tier: "services" },
  Accenture:        { tier: "services" },
  Capgemini:        { tier: "services" },
  LTIMindtree:      { tier: "services" },
  "Persistent Systems": { tier: "services" },
  Mphasis:          { tier: "services" },
  "Oracle India":   { tier: "services" },

  // ── Management Consulting (MBB + Big4) ────────────────────────────────────
  "McKinsey & Company": { tier: "mnc" },
  BCG:              { tier: "mnc" },
  "Bain & Company": { tier: "mnc" },
  Deloitte:         { tier: "services" },
  EY:               { tier: "services" },
  KPMG:             { tier: "services" },
  PwC:              { tier: "services" },

  // ── FMCG / Consumer Goods ─────────────────────────────────────────────────
  "Hindustan Unilever": { tier: "mnc" },
  "Procter & Gamble":   { tier: "mnc" },
  Nestle:               { tier: "mnc" },
  "ITC Limited":        { tier: "mnc" },
  Dabur:                { tier: "tier1" },
  Marico:               { tier: "tier1" },
  "Godrej Consumer":    { tier: "tier1" },

  // ── Logistics / Supply Chain ──────────────────────────────────────────────
  Maersk:           { tier: "mnc" },
  DHL:              { tier: "mnc" },
  FedEx:            { tier: "mnc" },
  "Blue Dart":      { tier: "tier2" },

  // ── Banking / Finance / Insurance ─────────────────────────────────────────
  "HDFC Bank":      { tier: "tier1" },
  "ICICI Bank":     { tier: "tier1" },
  "Axis Bank":      { tier: "tier1" },
  "Kotak Mahindra": { tier: "tier1" },
  "Bajaj Finserv":  { tier: "tier1" },
  "American Express": { tier: "mnc" },
  Citi:             { tier: "mnc" },
  HSBC:             { tier: "mnc" },
  Barclays:         { tier: "mnc" },
  "Deutsche Bank":  { tier: "mnc" },
  Zerodha:          { tier: "tier2" },
  "Angel One":      { tier: "tier2" },

  // ── Telecom / Media ───────────────────────────────────────────────────────
  "Bharti Airtel":  { tier: "mnc" },

  // ── E-commerce / Retail ───────────────────────────────────────────────────
  "Tata Digital":   { tier: "tier1" },
  "Reliance Retail": { tier: "tier1" },

  // ── Healthcare / Pharma ───────────────────────────────────────────────────
  "Apollo Hospitals": { tier: "tier1" },
  "1mg":              { tier: "tier2" },
  PharmEasy:          { tier: "tier2" },
  "Manipal Health":   { tier: "tier1" },
  "Sun Pharma":       { tier: "mnc" },
  "Dr. Reddy's":      { tier: "mnc" },
  Cipla:              { tier: "mnc" },

  // ── EdTech ────────────────────────────────────────────────────────────────
  "Physics Wallah": { tier: "tier2" },
  upGrad:           { tier: "tier2" },
  Coursera:         { tier: "mnc" },

  // ── Real Estate / Infra ───────────────────────────────────────────────────
  "Godrej Properties": { tier: "tier1" },

  // ── Misc ───────────────────────────────────────────────────────────────────
  PeopleGrove:      { tier: "tier2" },
  "Oliv AI":        { tier: "startup" },
};

function tierFor(company: string): CompanyTier {
  return COMPANY_META[company]?.tier ?? "startup";
}

// ── ATS type definitions ─────────────────────────────────────────────────────

type LeverPosting = {
  id: string;
  text: string;
  categories?: {
    location?: string; commitment?: string; allLocations?: string[];
  };
  descriptionPlain?: string;
  lists?: Array<{ text?: string; content?: string }>;
  applyUrl?: string;
  hostedUrl?: string;
  salaryRange?: { min?: number; max?: number; interval?: string; currency?: string };
};

type GreenhousePosting = {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  metadata?: Array<{ name?: string; value?: string | string[] | null }> | null;
};

type AshbyJob = {
  id: string;
  title: string;
  teamName?: string;
  locationName?: string;
  isRemote?: boolean;
  publishedDate?: string;
  jobUrl: string;
  descriptionHtml?: string;
  compensation?: {
    summaryComponents?: Array<{
      compensationRangeMin?: number;
      compensationRangeMax?: number;
      compensationType?: string;
      payPeriod?: string;
    }>;
  };
};

type WorkdayJob = {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
  startDate?: string | null;
  jobReqId?: string;
};

type WorkdayResponse = {
  total?: number;
  jobPostings?: WorkdayJob[];
};

// ── Company lists ─────────────────────────────────────────────────────────────

type LeverSite    = { company: string; site: string };
type GreenBoard   = { company: string; boardToken: string };
type AshbyOrg     = { company: string; orgId: string };
type WorkdayTenant = { company: string; tenant: string; board: string; wdNum: number };

const LEVER_SITES: LeverSite[] = [
  // Tier 1 Indian product
  { company: "Razorpay",      site: "razorpay" },
  { company: "Meesho",        site: "meesho" },
  { company: "BrowserStack",  site: "browserstack" },
  { company: "Groww",         site: "groww" },
  { company: "Paytm",         site: "paytm" },
  { company: "Swiggy",        site: "swiggy" },
  { company: "Zomato",        site: "zomato" },
  { company: "Delhivery",     site: "delhivery" },
  { company: "Udaan",         site: "udaan" },
  { company: "CRED",          site: "dreamplug" },
  // Tier 2 / growth startups
  { company: "CARS24",        site: "cars24" },
  { company: "Darwinbox",     site: "darwinboxtech" },
  { company: "Whatfix",       site: "whatfix" },
  { company: "Gojek",         site: "gojek" },
  { company: "ShareChat",     site: "sharechat" },
  { company: "Khatabook",     site: "khatabook" },
  { company: "Acko",          site: "acko" },
  { company: "Juspay",        site: "juspay" },
  { company: "Zepto",         site: "zepto" },
  { company: "Gupshup",       site: "gupshup" },
  { company: "Rupeek",        site: "rupeek" },
  { company: "Slice",         site: "slicecard" },
  // Global
  { company: "Atlassian",     site: "atlassian" },
  { company: "6sense",        site: "6sense" },
  { company: "Instawork",     site: "instawork" },
  { company: "Fictiv",        site: "fictiv" },
  { company: "HighLevel",     site: "gohighlevel" },
  { company: "Onehouse",      site: "Onehouse" },
  { company: "Dun & Bradstreet", site: "dnb" },
  { company: "JumpCloud",     site: "jumpcloud" },
  { company: "PeopleGrove",   site: "peoplegrove" },

  // ── Finance / Fintech ──────────────────────────────────────────────────────
  { company: "Zerodha",       site: "zerodha" },
  { company: "Angel One",     site: "angelbroking" },
  { company: "Bajaj Finserv", site: "bajajfinserv" },
  { company: "Kotak Mahindra", site: "kotak" },

  // ── Healthcare ────────────────────────────────────────────────────────────
  { company: "PharmEasy",     site: "pharmeasy" },
];

const GREENHOUSE_BOARDS: GreenBoard[] = [
  // Tier 1 Indian product
  { company: "Freshworks",    boardToken: "freshworks" },
  { company: "Postman",       boardToken: "postman" },
  { company: "Chargebee",     boardToken: "chargebee" },
  { company: "Unacademy",     boardToken: "unacademy" },
  { company: "InMobi",        boardToken: "inmobi" },
  // Tier 2 / growth
  { company: "MoEngage",      boardToken: "moengage" },
  { company: "CleverTap",     boardToken: "clevertap" },
  { company: "Hasura",        boardToken: "hasura" },
  { company: "Druva",         boardToken: "druva" },
  { company: "Namma Yatri",   boardToken: "nammayatri" },
  { company: "Loop Health",   boardToken: "loophealth" },
  // Global MNCs
  { company: "Netflix",       boardToken: "netflix" },
  { company: "Stripe",        boardToken: "stripe" },
  { company: "Airbnb",        boardToken: "airbnb" },
  { company: "Uber",          boardToken: "uber" },
  { company: "Expedia",       boardToken: "expedia" },
  { company: "Rippling",      boardToken: "rippling" },
  { company: "Rubrik",        boardToken: "rubrikjobs" },
  { company: "Snowflake",     boardToken: "snowflake" },
  { company: "Databricks",    boardToken: "databricks" },
  { company: "LogicMonitor",  boardToken: "logicmonitor" },
  { company: "Twilio",        boardToken: "twilio" },
  { company: "Turing",        boardToken: "turing" },
  { company: "ShipBob",       boardToken: "shipbob" },
  { company: "Oliv AI",       boardToken: "olivai" },

  // ── Management Consulting ─────────────────────────────────────────────────
  { company: "BCG",              boardToken: "bcg" },
  { company: "Bain & Company",   boardToken: "bain" },

  // ── EdTech ────────────────────────────────────────────────────────────────
  { company: "upGrad",           boardToken: "upgrad" },

  // ── Healthcare ────────────────────────────────────────────────────────────
  { company: "1mg",              boardToken: "1mg" },
];

/**
 * Ashby — widely used by Indian product startups.
 * API: GET https://api.ashbyhq.com/posting-api/job-board/{orgId}?includeCompensation=1
 */
const ASHBY_ORGS: AshbyOrg[] = [
  { company: "Jar",           orgId: "jar" },
  { company: "Porter",        orgId: "porter-delivery" },
  { company: "Rocketlane",    orgId: "rocketlane" },
  { company: "Innovaccer",    orgId: "innovaccer" },
  { company: "LeadSquared",   orgId: "leadsquared" },
  { company: "Perfios",       orgId: "perfios" },
  { company: "Nykaa",         orgId: "nykaa" },
  { company: "EarnIn",        orgId: "earnin" },
  { company: "CrowdStrike",   orgId: "crowdstrike" },

  // ── EdTech ────────────────────────────────────────────────────────────────
  { company: "Physics Wallah", orgId: "physicswallah" },
  { company: "Coursera",       orgId: "coursera" },
];

/**
 * Workday — used by large MNCs, consulting firms, and BFSI.
 * API: POST https://{tenant}.wd{n}.myworkdayjobs.com/wday/cxs/{tenant}/{board}/jobs
 */
const WORKDAY_TENANTS: WorkdayTenant[] = [
  { company: "Adobe",          tenant: "adobe",        board: "ADB_External_Experienced", wdNum: 5 },
  { company: "Cisco",          tenant: "cisco",        board: "External",                  wdNum: 5 },
  { company: "PayPal",         tenant: "paypal",       board: "jobs",                      wdNum: 1 },
  { company: "Visa",           tenant: "visa",         board: "External",                  wdNum: 5 },
  { company: "Accenture",      tenant: "accenture",    board: "Accenture_Careers",         wdNum: 3 },
  { company: "Wipro",          tenant: "wipro",        board: "External",                  wdNum: 3 },
  { company: "Goldman Sachs",  tenant: "goldmansachs", board: "gs",                        wdNum: 5 },
  { company: "Walmart",        tenant: "walmart",      board: "External",                  wdNum: 5 },
  { company: "ServiceNow",     tenant: "servicenow",   board: "External",                  wdNum: 5 },
  { company: "JP Morgan",      tenant: "jpmc",         board: "External",                  wdNum: 5 },

  // ── Management Consulting ─────────────────────────────────────────────────
  { company: "McKinsey & Company", tenant: "mckinsey",   board: "External",          wdNum: 5 },
  { company: "Deloitte",           tenant: "deloitte2",  board: "External",          wdNum: 5 },
  { company: "EY",                 tenant: "eygs",       board: "External",          wdNum: 5 },
  { company: "PwC",                tenant: "pwc",        board: "Global_External",   wdNum: 5 },

  // ── FMCG / Consumer Goods ─────────────────────────────────────────────────
  { company: "Hindustan Unilever", tenant: "unilever",   board: "Unilever_Global",   wdNum: 3 },
  { company: "Procter & Gamble",   tenant: "pg",         board: "Global",            wdNum: 5 },
  { company: "Nestle",             tenant: "nestle",     board: "Nestle",            wdNum: 5 },
  { company: "ITC Limited",        tenant: "itcportals", board: "ITC_External",      wdNum: 5 },

  // ── Logistics / Supply Chain ──────────────────────────────────────────────
  { company: "Maersk",             tenant: "maersk",     board: "EXT",               wdNum: 5 },
  { company: "DHL",                tenant: "dhl",        board: "External_Careers",  wdNum: 5 },

  // ── Banking / Finance ──────────────────────────────────────────────────────
  { company: "American Express",   tenant: "aexp",       board: "External",          wdNum: 5 },
  { company: "Citi",               tenant: "citi",       board: "External",          wdNum: 5 },
  { company: "HSBC",               tenant: "hsbc",       board: "External",          wdNum: 5 },
  { company: "Barclays",           tenant: "barclays",   board: "External",          wdNum: 5 },
  { company: "Deutsche Bank",      tenant: "db",         board: "External",          wdNum: 5 },

  // ── IT Services (previously missing from adapters) ────────────────────────
  { company: "Infosys",            tenant: "infosys",    board: "External",          wdNum: 5 },
  { company: "Cognizant",          tenant: "cognizant",  board: "External",          wdNum: 5 },
  { company: "Mphasis",            tenant: "mphasis",    board: "External",          wdNum: 5 },

  // ── Telecom ────────────────────────────────────────────────────────────────
  { company: "Bharti Airtel",      tenant: "bhartiairtel", board: "External",        wdNum: 5 },

  // ── Healthcare / Pharma ───────────────────────────────────────────────────
  { company: "Sun Pharma",         tenant: "sunpharma",  board: "External",          wdNum: 5 },
  { company: "Dr. Reddy's",        tenant: "drreddys",   board: "External",          wdNum: 5 },
  { company: "Cipla",              tenant: "cipla",      board: "External",          wdNum: 5 },
];

// Total built-in companies for display (SmartRecruiters added at export time)
export const BUILTIN_COMPANY_COUNT =
  LEVER_SITES.length + GREENHOUSE_BOARDS.length + ASHBY_ORGS.length + WORKDAY_TENANTS.length;

// ── Shared helpers ────────────────────────────────────────────────────────────

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Best-effort extraction of the requirements/responsibilities section from a
 * raw job description. Many JDs start with company boilerplate ("We are India's
 * leading payments company...") that would otherwise inflate domain-tag skill
 * counts (e.g. "payments" at 38% for AI engineer roles).
 *
 * Strategy: find the first section header that looks like requirements, then
 * cut off at the first boilerplate header that follows it (benefits, about us,
 * equal-opportunity, etc.). Falls back to the full text if no headers are found.
 */
const REQUIREMENTS_PATTERNS: RegExp[] = [
  /\brequirements?\b/i,
  /\bqualifications?\b/i,
  /\bresponsibilities\b/i,
  /\bwhat you.ll (bring|need|have|do)\b/i,
  /\bwhat you will (bring|need|have|do)\b/i,
  /\bwhat we.re looking for\b/i,
  /\bmust.?have\b/i,
  /\btechnical skills?\b/i,
  /\byou should have\b/i,
  /\byou will need\b/i,
  /\bkey skills?\b/i,
  /\bskills? (required|needed)\b/i,
];

const BOILERPLATE_PATTERNS: RegExp[] = [
  /\babout (us|our company|the company)\b/i,
  /\bwho we are\b/i,
  /\bwhy join\b/i,
  /\bwhat we offer\b/i,
  /\bemployee benefits?\b/i,
  /\bperks? &/i,
  /\bcompensation (and|&) benefits?\b/i,
  /\bequal opportunity\b/i,
  /\bwe are an equal\b/i,
  /\bdiversity (and|&) inclusion\b/i,
];

function extractRequirementsText(text: string): string {
  // Find the start of the first requirements-like section
  let reqStart = Infinity;
  for (const re of REQUIREMENTS_PATTERNS) {
    const m = re.exec(text);
    if (m && m.index < reqStart) reqStart = m.index;
  }
  if (reqStart === Infinity) return text; // no sections found, use full text

  const afterReq = text.slice(reqStart);

  // Cut off at the first boilerplate header that appears after the requirements
  // section (require at least 150 chars of content first to avoid false cuts).
  let cutoff = afterReq.length;
  for (const re of BOILERPLATE_PATTERNS) {
    const m = re.exec(afterReq);
    if (m && m.index > 150 && m.index < cutoff) cutoff = m.index;
  }

  return afterReq.slice(0, cutoff);
}


/**
 * Pre-compiled skill regexes — built once at module load.
 *
 * Strategy: use lookbehind/lookahead (`(?<![a-z0-9])…(?![a-z0-9])`) so that
 * "gin" never matches inside "engineering", "api" inside "rapid", "ai" inside
 * "detail", "excel" inside "excellent", etc.
 *
 * For skills that are ≤3 characters we also exclude hyphens in the lookbehind
 * and lookahead, so "go" cannot match inside "go-to-market".
 */
const SKILL_REGEX_MAP = new Map<string, RegExp>(
  KNOWN_SKILLS.map((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const boundary =
      skill.length <= 3
        ? `(?<![a-z0-9-])${escaped}(?![a-z0-9-])`  // short: exclude hyphens too
        : `(?<![a-z0-9])${escaped}(?![a-z0-9])`;
    return [skill, new RegExp(boundary, "i")];
  })
);

function extractSkillsFromText(text: string): string[] {
  // Strip company boilerplate first so domain terms ("payments", "fintech") in
  // "About us" sections don't inflate skill counts for technical roles.
  const relevant = extractRequirementsText(text);
  const normalized = normalizeText(relevant);

  const raw = KNOWN_SKILLS.filter((s) => {
    const re = SKILL_REGEX_MAP.get(s)!;
    // Fast path for most skills: no negative rules, just test presence
    if (!re.test(normalized)) return false;
    // For skills with negative rules, check that at least one occurrence
    // is NOT in a verb/idiom context ("excel at X", "go ahead", etc.).
    // allMatchesFalsePositive returns true only when EVERY match is a false positive.
    return !allMatchesFalsePositive(s, normalized, re);
  });

  // Normalise aliases: "ml" -> "machine learning", "go" -> "golang", etc.
  return uniqueStrings(raw.map((s) => SKILL_ALIASES[s] ?? s));
}

/**
 * Extract the best "X years" snippet from a job description.
 * Prioritises patterns that are clearly about experience requirements.
 */
function extractExperienceSnippet(text: string): string {
  const candidates: RegExp[] = [
    /(\d+\s*[-–]\s*\d+\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp))/i,
    /(\d+\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp))/i,
    /(?:minimum|at\s+least)\s+(\d+\s*(?:years?|yrs?))/i,
    /(\d+\+?\s*(?:years?|yrs?))/i,
  ];
  for (const re of candidates) {
    const m = text.match(re);
    if (m) return m[1] ?? m[0];
  }
  return "";
}

async function fetchJson<T>(url: string, timeoutMs = 6000): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json() as Promise<T>;
}

async function fetchWorkday(tenant: string, board: string, wdNum: number): Promise<WorkdayResponse> {
  const url = `https://${tenant}.wd${wdNum}.myworkdayjobs.com/wday/cxs/${tenant}/${board}/jobs`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ limit: 20, offset: 0, searchText: "", appliedFacets: {} }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from Workday ${tenant}`);
  return res.json() as Promise<WorkdayResponse>;
}

function parseWorkdayDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString();
  // "MM/DD/YYYY" → ISO
  const parts = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (parts) return new Date(`${parts[3]}-${parts[1]}-${parts[2]}`).toISOString();
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

// ── Filter logic (hard filters) ───────────────────────────────────────────────

function matchesRole(job: JobRecord, filters: SearchFilters): boolean {
  const role = normalizeText(filters.role).trim();
  if (!role) return true;
  const searchable = normalizeText(
    `${job.title} ${job.description} ${job.skills.join(" ")} ${job.company}`
  );
  return role.split(/\s+/).filter(Boolean).every((t) => searchable.includes(t));
}

function matchesLocation(job: JobRecord, filters: SearchFilters): boolean {
  if (!filters.location) return true;
  const loc    = normalizeText(job.location);
  const target = normalizeText(filters.location);

  // If the user explicitly searched for "remote", pass any remote/worldwide job
  if (target === "remote") {
    return loc.includes("remote") || loc.includes("anywhere") || loc.includes("worldwide");
  }

  // Otherwise strict: job location must contain the search string.
  // "Remote - United Kingdom" will NOT match "india"; "Remote, India" will.
  return loc.includes(target);
}

/**
 * Extract the MINIMUM years-of-experience required from any text blob.
 * Searches the full text (not just the first 1200 chars) so requirements
 * buried in requirements/qualifications sections are never missed.
 * Returns the first unambiguously experience-related number found.
 */
function extractRequiredMinYears(text: string): number | null {
  const t = text.toLowerCase();

  const patterns: RegExp[] = [
    // "3-5 years of experience" / "3 to 5 years experience"
    /(\d+)\s*(?:[-–]|to)\s*\d+\s*(?:years?|yrs?)[\s\w]{0,15}(?:experience|exp)/i,
    // "5+ years of experience" / "5+ yrs experience"
    /(\d+)\+\s*(?:years?|yrs?)[\s\w]{0,15}(?:experience|exp)/i,
    // "5 years of experience" (no +)
    /(\d+)\s+(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)/i,
    // "experience: 3+ years" / "experience of 3-5 years"
    /(?:experience|exp)[:\s]{0,8}(\d+)\+?\s*(?:years?|yrs?)/i,
    // "minimum 3 years" / "minimum of 3 years experience"
    /minimum\s+(?:of\s+)?(\d+)\s*(?:years?|yrs?)/i,
    // "at least 3 years"
    /at\s+least\s+(\d+)\s*(?:years?|yrs?)/i,
    // "require[sd] * 3 years"
    /required?[^.\n]{0,30}?(\d+)\+?\s*(?:years?|yrs?)/i,
  ];

  for (const p of patterns) {
    const m = t.match(p);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n >= 0 && n <= 25) return n;
    }
  }
  return null;
}

/**
 * Parse a year-range filter string ("0-1", "1-2", "2-3", "3-5", "5-7", "7-10", "10+")
 * into a [min, max] tuple. Returns null if string is unrecognised.
 */
function parseYearRange(level: string): [number, number] | null {
  if (!level) return null;
  if (level === "10+") return [10, 99];
  const m = level.match(/^(\d+)-(\d+)$/);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  return null;
}

/**
 * Hard experience-level filter.
 *
 * Priority order:
 *  1. job.experienceText  — already extracted by the adapter, most reliable
 *  2. job.description     — full text scan for year patterns
 *  3. Title-based heuristic — last resort; intentionally strict
 *
 * The ±1 tolerance allows "3-5 years" to appear when the user picks "2-3 years"
 * (the job's minimum is just outside the selected window) but blocks anything
 * more than 1 year beyond the upper bound.
 */
function matchesExperienceLevel(job: JobRecord, filters: SearchFilters): boolean {
  const level = (filters.experienceLevel ?? "").trim();
  if (!level) return true;

  const range = parseYearRange(level);
  if (!range) return true;

  const [rangeMin, rangeMax] = range;

  // 1 — Check experienceText first (already parsed field, e.g. "3+ yrs exp")
  const reqFromExpText = extractRequiredMinYears(job.experienceText ?? "");
  if (reqFromExpText !== null) {
    return reqFromExpText >= rangeMin && reqFromExpText <= rangeMax + 1;
  }

  // 2 — Scan the full description
  const reqFromDesc = extractRequiredMinYears(job.description ?? "");
  if (reqFromDesc !== null) {
    return reqFromDesc >= rangeMin && reqFromDesc <= rangeMax + 1;
  }

  // 3 — No numeric signal found anywhere → use title heuristics
  const titleLower = normalizeText(job.title);

  // Senior / lead / architect signals → treat as requiring 5+ years
  const isSeniorTitle = /\b(senior|sr\b|lead|principal|staff|head|manager|director|vp|vice\s*president|architect|specialist)\b/.test(titleLower);
  // Explicit junior / entry signals → treat as requiring ≤2 years
  const isJuniorTitle = /\b(intern|trainee|fresher|junior|jr\b|entry.?level|associate|graduate|apprentice)\b/.test(titleLower);
  // Numbered levels like "SDE II", "Engineer III", "L4", "Level 5" → treat as mid-to-senior (3+ yrs)
  const isLevelledTitle = /\b(ii|iii|iv|2|3|4|5)\b/.test(titleLower);

  if (isSeniorTitle)   return rangeMin >= 4;   // senior titles: only match 5-7, 7-10, 10+
  if (isJuniorTitle)   return rangeMax <= 3;   // junior titles: only match 0-1, 1-2, 2-3
  if (isLevelledTitle) return rangeMin >= 2;   // levelled titles: 2-3 and above

  // Completely ambiguous title — only pass mid-range filters (2–5 years).
  // Reject both very-junior (0-1, 1-2) and very-senior (7+, 10+) filters
  // to avoid accidentally surfacing clearly mismatched jobs.
  return rangeMin >= 2 && rangeMax <= 7;
}

function matchesSalary(job: JobRecord, filters: SearchFilters): boolean {
  if (filters.minLpa === null) return true;
  if (job.salaryMinLpa === null && job.salaryMaxLpa === null) return true;
  const minT = filters.minLpa;
  const jobMax = job.salaryMaxLpa ?? job.salaryMinLpa ?? 0;
  // Semi-hard: exclude only if the job's max is clearly below the target minimum (< 70%)
  return jobMax >= minT * 0.7;
}

function matchesCompanyCategory(job: JobRecord, filters: SearchFilters): boolean {
  if (!filters.companyCategories || filters.companyCategories.length === 0) return true;
  return filters.companyCategories.includes(job.companyTier);
}

/**
 * Title-keyword maps for each job category.
 * A job matches if its normalised title contains ANY of the listed tokens.
 */
const JOB_CATEGORY_KEYWORDS: Record<string, string[]> = {
  product: [
    "product manager", "product management", "product owner", "product lead",
    "product head", "associate product", "apm", "senior pm", "staff pm",
    "principal pm", "chief product", "vp product", "director of product",
    "head of product", "product analyst", "growth product", "technical product",
  ],
  engineering: [
    "engineer", "developer", "architect", "sre", "devops", "platform",
    "fullstack", "full stack", "full-stack", "backend", "back end", "back-end",
    "frontend", "front end", "front-end", "mobile", "android", "ios",
    "software", "systems", "infrastructure", "embedded", "firmware", "security engineer",
    "reliability", "cloud engineer", "api developer", "blockchain", "web developer",
  ],
  data: [
    "data scientist", "data analyst", "data engineer", "data architect",
    "machine learning", "ml engineer", "ai engineer", "analytics engineer",
    "business intelligence", "bi analyst", "bi developer", "bi engineer",
    "quantitative analyst", "research scientist", "nlp engineer",
    "computer vision", "deep learning", "analytics", "data lead", "data manager",
  ],
  design: [
    "designer", "ux", "ui", "user experience", "user interface",
    "product design", "visual design", "interaction design", "motion design",
    "graphic design", "brand design", "design researcher", "ux researcher",
    "design lead", "head of design", "creative director", "design manager",
  ],
  sales: [
    "sales", "account executive", "account manager", "business development",
    "bd manager", "solution engineer", "sales engineer", "pre-sales",
    "presales", "inside sales", "enterprise sales", "key account",
    "revenue", "partnership", "channel manager", "commercial",
  ],
  marketing: [
    "marketing", "growth", "demand generation", "content", "seo", "sem",
    "performance marketing", "brand manager", "product marketing",
    "digital marketing", "social media", "email marketing",
    "lifecycle marketing", "crm marketing", "communications",
    "pr manager", "copywriter", "content strategist",
  ],
  operations: [
    "operations", "program manager", "project manager", "delivery manager",
    "chief of staff", "strategy", "business analyst", "process",
    "supply chain", "logistics", "fulfillment", "vendor management",
    "implementation", "customer success", "customer experience",
    "account management", "engagement manager", "consulting",
  ],
  it: [
    "it support", "it manager", "it administrator", "sysadmin", "system admin",
    "network engineer", "network admin", "helpdesk", "it helpdesk",
    "it operations", "service desk", "windows admin", "linux admin",
    "database admin", "dba", "erp", "sap consultant", "it consultant",
    "cybersecurity analyst", "security analyst", "information security",
  ],
  finance: [
    "finance", "financial analyst", "accounting", "accountant", "controller",
    "cfo", "treasurer", "risk analyst", "credit analyst", "investment",
    "equity analyst", "revenue analyst", "fp&a", "financial planning",
    "audit", "tax", "compliance analyst", "financial reporting",
  ],
  hr: [
    "recruiter", "talent acquisition", "talent management", "hr",
    "human resources", "people operations", "people partner", "hrbp",
    "hr business partner", "learning and development", "l&d",
    "compensation", "benefits", "payroll", "organizational development",
    "culture", "employee engagement", "workforce planning",
  ],
};

function matchesJobCategory(job: JobRecord, filters: SearchFilters): boolean {
  if (!filters.jobCategory) return true;
  const keywords = JOB_CATEGORY_KEYWORDS[filters.jobCategory];
  if (!keywords) return true;
  const title = normalizeText(job.title);
  return keywords.some((kw) => title.includes(kw));
}

function matchesFilters(job: JobRecord, filters: SearchFilters): boolean {
  return (
    ageInDays(job.postedAt) <= postedWithinDays(filters.postedWithin) &&
    (!filters.remoteOnly || normalizeText(job.location).includes("remote")) &&
    // NOTE: role/title is intentionally NOT a hard filter here.
    // It is treated as a semantic description passed to AI ranking and
    // the rule-based scorer (scoreRoleMatch). Hard-filtering on role
    // keywords causes false negatives when job titles use synonyms or
    // different phrasings. Let the rankers handle relevance instead.
    matchesLocation(job, filters) &&
    matchesExperienceLevel(job, filters) &&
    matchesSalary(job, filters) &&
    matchesCompanyCategory(job, filters) &&
    matchesJobCategory(job, filters)
  );
}

// ── Lever adapter ─────────────────────────────────────────────────────────────

function mapLeverPosting(site: LeverSite, p: LeverPosting): JobRecord {
  const descText = [
    p.descriptionPlain ?? "",
    ...(p.lists ?? []).map((e) => `${e.text ?? ""} ${stripHtml(e.content ?? "")}`)
  ].join(" ").trim();

  const annualInr = p.salaryRange?.interval === "yearly" && p.salaryRange.currency === "INR"
    ? p.salaryRange : null;

  return {
    id: `lever-${site.site}-${p.id}`,
    source: "lever",
    company: site.company,
    companyTier: tierFor(site.company),
    title: p.text,
    location: p.categories?.location ?? p.categories?.allLocations?.join(", ") ?? "—",
    postedAt: new Date().toISOString(),
    salaryMinLpa: annualInr?.min !== undefined ? annualInr.min / 100_000 : null,
    salaryMaxLpa: annualInr?.max !== undefined ? annualInr.max / 100_000 : null,
    applyUrl: p.applyUrl ?? p.hostedUrl ?? `https://jobs.lever.co/${site.site}`,
    description: descText,
    skills: extractSkillsFromText(descText),
    experienceText: extractExperienceSnippet(descText),
    employmentType: p.categories?.commitment ?? "Full-time"
  };
}

function buildLeverAdapter(): JobSourceAdapter {
  return {
    name: "Lever",
    async fetchJobs({ filters }: SourceContext) {
      const results = await Promise.allSettled(
        LEVER_SITES.map(async (site) => {
          const postings = await fetchJson<LeverPosting[]>(
            `https://api.lever.co/v0/postings/${encodeURIComponent(site.site)}?mode=json`
          );
          return postings.map((p) => mapLeverPosting(site, p));
        })
      );
      return results
        .flatMap((r) => r.status === "fulfilled" ? r.value : [])
        .filter((j) => matchesFilters(j, filters));
    }
  };
}

// ── Greenhouse adapter ────────────────────────────────────────────────────────

function mapGreenhousePosting(board: GreenBoard, p: GreenhousePosting): JobRecord {
  const descText = stripHtml(p.content ?? "");
  const metaText = Array.isArray(p.metadata)
    ? p.metadata.map((e) => Array.isArray(e.value) ? e.value.join(" ") : String(e.value ?? "")).join(" ")
    : "";
  const salary = parseLpaFromText(`${descText} ${metaText}`);

  return {
    id: `gh-${board.boardToken}-${p.id}`,
    source: "greenhouse",
    company: board.company,
    companyTier: tierFor(board.company),
    title: p.title,
    location: p.location?.name ?? "—",
    postedAt: p.updated_at,
    salaryMinLpa: salary.minLpa,
    salaryMaxLpa: salary.maxLpa,
    applyUrl: p.absolute_url,
    description: descText,
    skills: extractSkillsFromText(descText),
    experienceText: extractExperienceSnippet(descText),
    employmentType: "Full-time"
  };
}

function buildGreenhouseAdapter(): JobSourceAdapter {
  return {
    name: "Greenhouse",
    async fetchJobs({ filters }: SourceContext) {
      const results = await Promise.allSettled(
        GREENHOUSE_BOARDS.map(async (board) => {
          const data = await fetchJson<{ jobs: GreenhousePosting[] }>(
            `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.boardToken)}/jobs?content=true`
          );
          return data.jobs.map((p) => mapGreenhousePosting(board, p));
        })
      );
      return results
        .flatMap((r) => r.status === "fulfilled" ? r.value : [])
        .filter((j) => matchesFilters(j, filters));
    }
  };
}

// ── Ashby adapter ─────────────────────────────────────────────────────────────

function mapAshbyJob(org: AshbyOrg, j: AshbyJob): JobRecord {
  const descText = stripHtml(j.descriptionHtml ?? "");
  return {
    id: `ashby-${org.orgId}-${j.id}`,
    source: "ashby",
    company: org.company,
    companyTier: tierFor(org.company),
    title: j.title,
    location: j.isRemote ? "Remote" : (j.locationName ?? "—"),
    postedAt: j.publishedDate ?? new Date().toISOString(),
    salaryMinLpa: null,
    salaryMaxLpa: null,
    applyUrl: j.jobUrl,
    description: descText,
    skills: extractSkillsFromText(descText),
    experienceText: extractExperienceSnippet(descText),
    employmentType: "Full-time"
  };
}

function buildAshbyAdapter(): JobSourceAdapter {
  return {
    name: "Ashby",
    async fetchJobs({ filters }: SourceContext) {
      const results = await Promise.allSettled(
        ASHBY_ORGS.map(async (org) => {
          const data = await fetchJson<{ jobs?: AshbyJob[] }>(
            `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org.orgId)}?includeCompensation=1`
          );
          return (data.jobs ?? []).map((j) => mapAshbyJob(org, j));
        })
      );
      return results
        .flatMap((r) => r.status === "fulfilled" ? r.value : [])
        .filter((j) => matchesFilters(j, filters));
    }
  };
}

// ── Workday adapter ───────────────────────────────────────────────────────────

function mapWorkdayJob(t: WorkdayTenant, j: WorkdayJob): JobRecord {
  const baseUrl = `https://${t.tenant}.wd${t.wdNum}.myworkdayjobs.com`;
  const descText = (j.bulletFields ?? []).join(" ");
  return {
    id: `workday-${t.tenant}-${j.jobReqId ?? j.externalPath ?? String(Math.random())}`,
    source: "workday",
    company: t.company,
    companyTier: tierFor(t.company),
    title: j.title ?? "Position",
    location: j.locationsText ?? "—",
    postedAt: parseWorkdayDate(j.postedOn),
    salaryMinLpa: null,
    salaryMaxLpa: null,
    // Workday externalPath is relative (e.g. "/job/City/Title_ID").
    // The full clickable URL needs the locale + board prefix: /en-US/{board}/job/...
    applyUrl: j.externalPath
      ? `${baseUrl}/en-US/${t.board}${j.externalPath}`
      : `${baseUrl}/en-US/${t.board}`,
    description: descText,
    skills: extractSkillsFromText(descText),
    experienceText: extractExperienceSnippet(descText),
    employmentType: "Full-time"
  };
}

function buildWorkdayAdapter(): JobSourceAdapter {
  return {
    name: "Workday",
    async fetchJobs({ filters }: SourceContext) {
      const results = await Promise.allSettled(
        WORKDAY_TENANTS.map(async (t) => {
          const data = await fetchWorkday(t.tenant, t.board, t.wdNum);
          return (data.jobPostings ?? []).map((j) => mapWorkdayJob(t, j));
        })
      );
      return results
        .flatMap((r) => r.status === "fulfilled" ? r.value : [])
        .filter((j) => matchesFilters(j, filters));
    }
  };
}

// ── SmartRecruiters adapter ───────────────────────────────────────────────────
// No API key required. Many large companies (especially services + MNCs) use it.

type SmartRecruiterJob = {
  id: string;
  name?: string;
  location?: { city?: string; country?: string; region?: string };
  releasedDate?: string;
  ref?: string;
};

type SmartRecruiterResponse = {
  content?: SmartRecruiterJob[];
  totalFound?: number;
};

type SmartRecruiterCompany = { company: string; identifier: string };

const SMARTRECRUITERS_COMPANIES: SmartRecruiterCompany[] = [
  // ── IT Services ───────────────────────────────────────────────────────────
  { company: "HCLTech",              identifier: "HCLTechnologies" },
  { company: "Capgemini",            identifier: "Capgemini" },
  { company: "LTIMindtree",          identifier: "LarsenToubroInfotech" },
  { company: "Persistent Systems",   identifier: "PersistentSystems" },
  { company: "TCS",                  identifier: "TataConsultancyServices" },
  { company: "Tech Mahindra",        identifier: "TechMahindra" },

  // ── Consulting / Professional Services ────────────────────────────────────
  { company: "KPMG",                 identifier: "KPMG" },

  // ── Industrial / Manufacturing ────────────────────────────────────────────
  { company: "Bosch",                identifier: "BoschGroup" },
  { company: "Siemens",              identifier: "Siemens" },
  { company: "Philips",              identifier: "Philips" },
  { company: "Honeywell",            identifier: "Honeywell" },
  { company: "3M",                   identifier: "3M" },
  { company: "ABB",                  identifier: "ABB" },

  // ── Telecom ───────────────────────────────────────────────────────────────
  { company: "Nokia",                identifier: "Nokia" },
  { company: "Ericsson",             identifier: "Ericsson" },

  // ── Logistics ─────────────────────────────────────────────────────────────
  { company: "FedEx",                identifier: "FedEx" },

  // ── Retail / FMCG ─────────────────────────────────────────────────────────
  { company: "Dabur",                identifier: "Dabur" },
  { company: "Marico",               identifier: "Marico" },
];

function mapSmartRecruiterJob(co: SmartRecruiterCompany, j: SmartRecruiterJob): JobRecord {
  const location = [j.location?.city, j.location?.region, j.location?.country]
    .filter(Boolean).join(", ");
  return {
    id: `sr-${co.identifier}-${j.id}`,
    source: "smartrecruiters",
    company: co.company,
    companyTier: tierFor(co.company),
    title: j.name ?? "Position",
    location: location || "—",
    postedAt: j.releasedDate ?? new Date().toISOString(),
    salaryMinLpa: null,
    salaryMaxLpa: null,
    applyUrl: j.ref ?? `https://careers.smartrecruiters.com/${co.identifier}`,
    description: "",
    skills: [],
    experienceText: "",
    employmentType: "Full-time"
  };
}

function buildSmartRecruitersAdapter(): JobSourceAdapter {
  return {
    name: "SmartRecruiters",
    async fetchJobs({ filters }: SourceContext) {
      const results = await Promise.allSettled(
        SMARTRECRUITERS_COMPANIES.map(async (co) => {
          const data = await fetchJson<SmartRecruiterResponse>(
            `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(co.identifier)}/postings?limit=100`,
            8000
          );
          return (data.content ?? []).map((j) => mapSmartRecruiterJob(co, j));
        })
      );
      return results
        .flatMap((r) => r.status === "fulfilled" ? r.value : [])
        .filter((j) => matchesFilters(j, filters));
    }
  };
}

// ── Adzuna India adapter ──────────────────────────────────────────────────────
// Aggregates 50+ Indian job boards (Naukri, TimesJobs, Indeed India, etc.)
// Requires free API key from https://developer.adzuna.com
// Set env vars: ADZUNA_APP_ID and ADZUNA_APP_KEY

type AdzunaJob = {
  id: string;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  redirect_url?: string;
  salary_min?: number;
  salary_max?: number;
  created?: string;
  contract_type?: string;
};

type AdzunaResponse = { results?: AdzunaJob[] };

export const ADZUNA_ENABLED =
  Boolean(process.env.ADZUNA_APP_ID) && Boolean(process.env.ADZUNA_APP_KEY);

function mapAdzunaJob(j: AdzunaJob): JobRecord {
  const company  = j.company?.display_name ?? "Unknown";
  const descText = j.description ?? "";
  return {
    id: `adzuna-${j.id}`,
    source: "adzuna",
    company,
    companyTier: tierFor(company),           // known companies get their tier; rest → "startup"
    title: j.title ?? "Position",
    location: j.location?.display_name ?? "—",
    postedAt: j.created ?? new Date().toISOString(),
    // Adzuna returns annual INR for India (country code "in")
    salaryMinLpa: j.salary_min ? Math.round(j.salary_min / 100_000 * 10) / 10 : null,
    salaryMaxLpa: j.salary_max ? Math.round(j.salary_max / 100_000 * 10) / 10 : null,
    applyUrl: j.redirect_url ?? "#",
    description: descText,
    skills: extractSkillsFromText(descText),
    experienceText: extractExperienceSnippet(descText),
    employmentType: j.contract_type === "permanent" ? "Full-time" : (j.contract_type ?? "Full-time")
  };
}

function buildAdzunaAdapter(): JobSourceAdapter | null {
  const appId  = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return null;

  return {
    name: "Adzuna",
    async fetchJobs({ filters }: SourceContext) {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: "50",
        "content-type": "application/json",
      });

      if (filters.role)     params.set("what", filters.role);
      if (filters.location) params.set("where", filters.location);
      if (filters.remoteOnly) params.set("what_or", "remote work from home");

      // Map postedWithin → Adzuna max_days_old
      const daysMap: Record<string, number> = { "1d": 1, "1w": 7, "1m": 30, "3m": 90 };
      const days = daysMap[filters.postedWithin];
      if (days) params.set("max_days_old", String(days));

      // Salary range hint (Adzuna uses annual INR for India)
      if (filters.minLpa !== null) params.set("salary_min", String(filters.minLpa * 100_000));

      const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?${params.toString()}`;
      const data = await fetchJson<AdzunaResponse>(url, 10_000);
      return (data.results ?? [])
        .map(mapAdzunaJob)
        .filter((j) => matchesFilters(j, filters));
    }
  };
}

// ── Mock adapter ──────────────────────────────────────────────────────────────

function buildMockAdapter(): JobSourceAdapter | null {
  if (process.env.JOB_FETCHER_ENABLE_MOCK !== "true") return null;
  return {
    name: "Mock",
    async fetchJobs({ filters }: SourceContext) {
      return mockJobs.filter((j) => matchesFilters(j, filters));
    }
  };
}

// ── Custom site adapter ───────────────────────────────────────────────────────
// Dynamically builds an adapter for a user-added career page URL.

export function buildAdapterForCustomSite(site: CustomSite): JobSourceAdapter | null {
  const { company, atsType, siteId, tier } = site;
  const customTier: CompanyTier = tier ?? "startup";

  switch (atsType) {
    case "lever": {
      const leverSite: LeverSite = { company, site: siteId };
      return {
        name: `Lever/${company}`,
        async fetchJobs({ filters }) {
          const postings = await fetchJson<LeverPosting[]>(
            `https://api.lever.co/v0/postings/${encodeURIComponent(siteId)}?mode=json`
          );
          return postings
            .map((p) => ({ ...mapLeverPosting(leverSite, p), companyTier: customTier }))
            .filter((j) => matchesFilters(j, filters));
        }
      };
    }

    case "greenhouse": {
      const board: GreenBoard = { company, boardToken: siteId };
      return {
        name: `Greenhouse/${company}`,
        async fetchJobs({ filters }) {
          const data = await fetchJson<{ jobs: GreenhousePosting[] }>(
            `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(siteId)}/jobs?content=true`
          );
          return data.jobs
            .map((p) => ({ ...mapGreenhousePosting(board, p), companyTier: customTier }))
            .filter((j) => matchesFilters(j, filters));
        }
      };
    }

    case "ashby": {
      const org: AshbyOrg = { company, orgId: siteId };
      return {
        name: `Ashby/${company}`,
        async fetchJobs({ filters }) {
          const data = await fetchJson<{ jobs?: AshbyJob[] }>(
            `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(siteId)}?includeCompensation=1`
          );
          return (data.jobs ?? [])
            .map((j) => ({ ...mapAshbyJob(org, j), companyTier: customTier }))
            .filter((j) => matchesFilters(j, filters));
        }
      };
    }

    case "workday": {
      // siteId format: "{tenant}/{board}/{wdNum}"
      const [tenant, board, wdNumStr] = siteId.split("/");
      const wdNum = parseInt(wdNumStr ?? "5", 10);
      const wdTenant: WorkdayTenant = { company, tenant, board, wdNum };
      return {
        name: `Workday/${company}`,
        async fetchJobs({ filters }) {
          const data = await fetchWorkday(tenant, board, wdNum);
          // mapWorkdayJob already uses t.board for URL construction
          return (data.jobPostings ?? [])
            .map((j) => ({ ...mapWorkdayJob(wdTenant, j), companyTier: customTier }))
            .filter((j) => matchesFilters(j, filters));
        }
      };
    }

    default:
      return null;
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

export const sourceAdapters: JobSourceAdapter[] = [
  buildLeverAdapter(),
  buildGreenhouseAdapter(),
  buildAshbyAdapter(),
  buildWorkdayAdapter(),
  buildSmartRecruitersAdapter(),
  ...[buildAdzunaAdapter(), buildMockAdapter()].filter(Boolean) as JobSourceAdapter[]
];

export const configuredSourceSummary: Record<JobSource | "total_companies", number> = {
  lever:            LEVER_SITES.length,
  greenhouse:       GREENHOUSE_BOARDS.length,
  ashby:            ASHBY_ORGS.length,
  workday:          WORKDAY_TENANTS.length,
  smartrecruiters:  SMARTRECRUITERS_COMPANIES.length,
  adzuna:           ADZUNA_ENABLED ? 1 : 0,
  jsonld:           0,
  mock:             0,
  total_companies:
    LEVER_SITES.length +
    GREENHOUSE_BOARDS.length +
    ASHBY_ORGS.length +
    WORKDAY_TENANTS.length +
    SMARTRECRUITERS_COMPANIES.length,
};
