/** Curated skill terms used for both resume parsing and job description matching. */
export const KNOWN_SKILLS = [
  // -- Product Management core --------------------------------------------------
  "product management", "product strategy", "roadmapping", "prioritization",
  "product discovery", "product analytics", "product ops", "product led growth",
  "user research", "customer research", "market research", "competitive analysis",
  "go-to-market", "gtm", "a/b testing", "experimentation", "feature flagging",
  "stakeholder management", "sprint planning",
  "prd", "user stories", "mvp", "kpi", "okr", "metrics", "north star metric",
  "conversion", "retention", "activation", "churn",
  "funnel", "cohort analysis", "monetization", "pricing strategy", "p&l",
  "customer journey", "jobs to be done", "jtbd", "design sprint",
  // -- Frameworks & Methodologies -----------------------------------------------
  "agile", "scrum", "kanban", "lean", "design thinking", "ux research",
  "waterfall", "shape up", "dual track agile",
  // -- Design -------------------------------------------------------------------
  "figma", "miro", "sketch", "invision", "zeplin", "adobe xd",
  "wireframing", "prototyping", "usability testing", "heuristic evaluation",
  "information architecture", "user flows", "interaction design",
  // -- Analytics & BI -----------------------------------------------------------
  "sql", "mixpanel", "amplitude", "google analytics", "looker", "metabase",
  "tableau", "power bi", "dbt", "segment", "heap", "hotjar", "clevertap",
  "moengage", "braze", "rudderstack", "posthog",
  "data analysis", "excel", "google sheets", "spreadsheets",
  "statistical analysis", "regression", "hypothesis testing",
  // -- Collaboration & Project Tools --------------------------------------------
  "jira", "confluence", "notion", "asana", "trello", "linear", "airtable",
  "monday.com", "clickup", "basecamp", "slack", "ms teams",
  // -- Programming Languages ----------------------------------------------------
  "python", "java", "golang", "go", "typescript", "javascript", "scala",
  // note: "go" is kept alongside "golang" - both are used in JDs; aliased to "golang" at extraction time
  "kotlin", "swift", "c++", "c#", "rust", "ruby", "php", "bash", "shell scripting",
  // -- Backend Frameworks -------------------------------------------------------
  "spring boot", "spring", "spring mvc", "spring cloud", "spring security",
  "hibernate", "jpa", "jakarta ee", "j2ee", "servlet",
  "micronaut", "quarkus", "dropwizard", "vert.x",
  "fastapi", "django", "django rest framework", "flask", "sqlalchemy",
  "express.js", "nest.js", "fastify", "koa",
  "gin", "echo", "fiber", "gorilla mux",
  "rails", "sinatra", "laravel", "symfony",
  // -- Frontend Frameworks ------------------------------------------------------
  "react", "react native", "next.js", "vue.js", "angular", "svelte",
  "redux", "mobx", "zustand", "graphql", "apollo", "webpack", "vite",
  "tailwind css", "material ui", "ant design", "storybook",
  // -- Mobile -------------------------------------------------------------------
  "android", "ios", "flutter", "jetpack compose", "swiftui",
  "mobile development", "cross-platform",
  // -- APIs & Integration -------------------------------------------------------
  "rest api", "restful api", "grpc", "soap",
  "websocket", "webhook", "oauth", "openapi", "swagger", "api gateway",
  "microservices", "service mesh", "event-driven architecture",
  // -- Databases ----------------------------------------------------------------
  "postgresql", "mysql", "oracle", "sql server", "sqlite",
  "mongodb", "cassandra", "dynamodb", "couchdb", "firestore",
  "redis", "memcached", "hazelcast",
  "elasticsearch", "opensearch", "solr", "lucene",
  "neo4j", "arangodb", "janusgraph",
  "snowflake", "bigquery", "redshift", "databricks", "hive",
  "database design", "data modeling", "schema design", "query optimization",
  // -- Message Queues & Streaming -----------------------------------------------
  "kafka", "rabbitmq", "activemq", "sqs", "sns", "pub/sub",
  "kinesis", "event streaming", "message queue", "event bus",
  // -- Cloud & Infrastructure ---------------------------------------------------
  "aws", "gcp", "azure", "cloud computing", "multi-cloud", "hybrid cloud",
  "ec2", "s3", "lambda", "rds", "ecs", "eks", "fargate",
  "cloud functions", "cloud run", "gke", "app engine",
  "azure functions", "azure devops", "aks",
  // -- DevOps -------------------------------------------------------------------
  "docker", "kubernetes", "helm", "istio", "envoy",
  "terraform", "ansible", "pulumi", "cloudformation",
  "ci/cd", "jenkins", "github actions", "gitlab ci", "circleci", "argocd", "spinnaker",
  "devops", "sre", "platform engineering", "infrastructure as code", "iac",
  "prometheus", "grafana", "datadog", "new relic", "elk stack", "splunk",
  "nginx", "haproxy", "load balancing", "service discovery",
  // -- ML & Data Science --------------------------------------------------------
  "machine learning", "ml", "deep learning", "neural networks",
  "nlp", "natural language processing", "computer vision", "llm",
  "generative ai", "large language models", "rag", "fine-tuning",
  "pytorch", "tensorflow", "keras", "scikit-learn", "hugging face",
  "xgboost", "lightgbm", "random forest",
  "data science", "feature engineering", "model training",
  "mlflow", "kubeflow", "sagemaker", "vertex ai",
  // -- Data Engineering ---------------------------------------------------------
  "data engineering", "data pipelines", "etl", "elt", "data warehouse",
  "apache spark", "flink", "airflow", "luigi", "prefect", "dagster",
  "fivetran", "stitch", "airbyte",
  // -- Security -----------------------------------------------------------------
  "cybersecurity", "application security", "appsec", "owasp",
  "penetration testing", "security auditing", "jwt", "ssl/tls",
  "sso", "saml", "identity management", "iam",
  // -- System Design & Architecture ---------------------------------------------
  "system design", "distributed systems", "high availability", "scalability",
  "caching", "rate limiting", "circuit breaker",
  "cqrs", "event sourcing", "saga pattern", "ddd", "domain driven design",
  "clean architecture", "hexagonal architecture", "monolith",
  // -- Testing ------------------------------------------------------------------
  "unit testing", "integration testing", "test driven development", "tdd",
  "bdd", "e2e testing", "selenium", "cypress", "jest", "junit",
  "testng", "mockito", "postman", "api testing",
  // -- Business & Domain --------------------------------------------------------
  // Only include terms specific enough to be skill signals.
  // Generic nouns like "platform", "enterprise", "growth", "engagement",
  // "compliance", "operations" are excluded - they are ubiquitous in job
  // descriptions and produce false positives when matched against free text.
  "saas", "b2b", "b2c", "d2c", "marketplace",
  "crm", "erp", "business analysis",
  "business development", "partnerships", "program management",
  "project management", "supply chain", "logistics",
  "fintech", "payments", "lending", "insurance", "insurtech",
  "edtech", "healthtech", "e-commerce", "ecommerce",
  "gaming", "risk management", "fraud detection",
  "seo", "sem", "performance marketing", "lifecycle marketing", "crm marketing",
  "customer success", "customer experience", "account management",
  "revenue operations", "revops", "sales enablement",
];

/**
 * Maps short/ambiguous skill tokens to their canonical display form.
 * Applied after extraction so both "ml" and "machine learning" in a JD
 * count toward the same canonical skill rather than splitting the signal.
 */
export const SKILL_ALIASES: Record<string, string> = {
  "ml":  "machine learning",
  "go":  "golang",
  "llm": "large language models",
};

export const KNOWN_DOMAINS = [
  "fintech", "saas", "e-commerce", "ecommerce", "healthtech", "edtech",
  "gaming", "logistics", "enterprise", "marketplace", "b2b", "b2c",
  "adtech", "proptech", "traveltech", "hrtech", "devtools", "cybersecurity"
];

export const TITLE_HINTS = [
  // Product
  "product manager", "associate product manager", "senior product manager",
  "staff product manager", "principal product manager", "director of product",
  "head of product", "chief product officer",
  "growth product manager", "technical product manager",
  // Program & Project
  "program manager", "senior program manager", "project manager",
  "delivery manager", "engagement manager",
  // Analysis
  "business analyst", "product analyst", "strategy analyst",
  "data analyst", "data scientist",
  // Design
  "product designer", "ux designer", "ui designer", "ux researcher",
  // Engineering
  "engineering manager", "software engineer", "software developer",
  "frontend engineer", "backend engineer", "fullstack engineer",
  "mobile engineer", "data engineer", "ml engineer", "devops engineer",
  // Marketing / Growth
  "marketing manager", "growth manager", "performance marketer",
  // Operations
  "operations manager", "business operations", "product operations",
  "chief of staff", "strategy manager"
];
