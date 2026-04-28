import type { JobRecord } from "@/types/jobs";

export const mockJobs: JobRecord[] = [
  {
    id: "greenhouse-river-1",
    source: "greenhouse",
    company: "River",
    companyTier: "startup",
    title: "Product Manager",
    location: "Bengaluru, India",
    postedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    salaryMinLpa: 18,
    salaryMaxLpa: 28,
    applyUrl: "https://boards.greenhouse.io/example/jobs/101",
    description:
      "Own product roadmap, work with engineering and design, define KPIs, and use SQL and analytics to improve funnel performance for fintech users.",
    skills: ["product management", "roadmapping", "sql", "analytics", "jira"],
    experienceText: "3+ years",
    employmentType: "Full-time"
  },
  {
    id: "lever-loop-1",
    source: "lever",
    company: "Loop Health",
    companyTier: "startup",
    title: "Senior Product Manager",
    location: "Remote, India",
    postedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    salaryMinLpa: 30,
    salaryMaxLpa: 42,
    applyUrl: "https://jobs.lever.co/example/102",
    description:
      "Lead a cross-functional squad, drive product strategy, collaborate with stakeholders, and ship healthcare platform features using data-driven prioritization.",
    skills: ["product strategy", "stakeholder management", "analytics", "saas"],
    experienceText: "6+ years",
    employmentType: "Full-time"
  },
  {
    id: "jsonld-mint-1",
    source: "jsonld",
    company: "Mintstack",
    companyTier: "startup",
    title: "Associate Product Manager",
    location: "Mumbai, India",
    postedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    salaryMinLpa: 12,
    salaryMaxLpa: 18,
    applyUrl: "https://careers.example.com/jobs/103",
    description:
      "Support discovery, user research, PRD writing, and experimentation for a B2B SaaS workflow tool. Familiarity with Figma and SQL preferred.",
    skills: ["product management", "user research", "figma", "sql", "b2b", "saas"],
    experienceText: "1+ years",
    employmentType: "Full-time"
  },
  {
    id: "mock-cascade-1",
    source: "mock",
    company: "Cascade Commerce",
    companyTier: "startup",
    title: "Growth Product Manager",
    location: "Gurugram, India",
    postedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    salaryMinLpa: 22,
    salaryMaxLpa: 32,
    applyUrl: "https://careers.cascade.example/jobs/104",
    description:
      "Own onboarding and retention experiments, partner with marketing and data teams, and use Mixpanel, SQL, and experimentation frameworks.",
    skills: ["growth", "mixpanel", "sql", "experimentation", "analytics"],
    experienceText: "4+ years",
    employmentType: "Full-time"
  },
  {
    id: "mock-foundry-1",
    source: "mock",
    company: "Foundry Cloud",
    companyTier: "startup",
    title: "Business Analyst",
    location: "Hyderabad, India",
    postedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    salaryMinLpa: 10,
    salaryMaxLpa: 15,
    applyUrl: "https://jobs.foundry.example/105",
    description:
      "Work with product and operations teams, build dashboards, write SQL queries, and support requirement gathering for enterprise SaaS systems.",
    skills: ["business analysis", "sql", "power bi", "stakeholder management", "saas"],
    experienceText: "2+ years",
    employmentType: "Full-time"
  }
];
