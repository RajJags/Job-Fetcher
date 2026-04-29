/** Curated skill terms used for both resume parsing and job description matching. */

export type RoleCategory =
  | "backend"
  | "frontend"
  | "fullstack"
  | "ai_llm"
  | "ml"
  | "data"
  | "devops"
  | "mobile"
  | "security"
  | "product"
  | "design"
  | "general";

/**
 * Master skill list. Every term here is matched (with word-boundary regex)
 * against job description text. Terms are kept specific enough to be meaningful
 * signals -- generic nouns that appear in boilerplate belong on the stoplist.
 */
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
  // note: "go" aliased to "golang" at extraction time
  "kotlin", "swift", "c++", "c#", "rust", "ruby", "php", "bash", "shell scripting",
  "dart", "r",
  // -- Backend Frameworks -------------------------------------------------------
  "spring boot", "spring", "spring mvc", "spring cloud", "spring security",
  "hibernate", "jpa", "jakarta ee", "j2ee", "servlet",
  "micronaut", "quarkus", "dropwizard", "vert.x",
  "fastapi", "django", "django rest framework", "flask", "sqlalchemy",
  "express.js", "nest.js", "fastify", "koa",
  "gin", "echo", "fiber", "gorilla mux",
  "rails", "sinatra", "laravel", "symfony",
  ".net", "asp.net", "entity framework",
  // -- Frontend Frameworks & Tooling --------------------------------------------
  "react", "next.js", "vue.js", "nuxt.js", "angular", "svelte", "sveltekit", "remix",
  "react native",
  "redux", "mobx", "zustand", "react query", "swr",
  "graphql", "apollo", "webpack", "vite", "turbopack",
  "tailwind css", "material ui", "ant design", "storybook",
  "css", "sass", "scss", "css-in-js",
  "jest", "vitest", "cypress", "playwright",
  "accessibility", "wcag", "web vitals", "ssr", "ssg",
  // -- Mobile -------------------------------------------------------------------
  "android", "ios", "flutter", "jetpack compose", "swiftui", "uikit",
  "mobile development", "cross-platform", "objective-c",
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
  "trino", "presto", "apache iceberg", "delta lake",
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
  "observability", "slo", "sli",
  // -- ML & Data Science --------------------------------------------------------
  "machine learning", "ml", "deep learning", "neural networks",
  "nlp", "natural language processing", "computer vision",
  "generative ai", "large language models", "llm", "fine-tuning",
  "pytorch", "tensorflow", "keras", "scikit-learn", "hugging face",
  "xgboost", "lightgbm", "random forest",
  "data science", "feature engineering", "model training",
  "mlflow", "kubeflow", "sagemaker", "vertex ai",
  "weights and biases", "wandb", "mlops", "model serving",
  "pandas", "numpy", "jax",
  // -- LLM Engineering & AI Agents ----------------------------------------------
  "openai", "anthropic", "aws bedrock", "azure openai", "gemini",
  "rag", "retrieval augmented generation", "embeddings", "vector database",
  "pgvector", "pinecone", "weaviate", "qdrant", "chroma", "faiss", "milvus",
  "semantic search", "reranking", "chunking",
  "langchain", "llamaindex", "langgraph", "pydantic ai", "dspy",
  "crewai", "autogen",
  "ai agents", "function calling", "prompt engineering",
  "model context protocol",
  "langfuse", "helicone", "ragas", "llm as judge", "langsmith",
  "lora", "qlora", "peft", "instruction tuning",
  "vllm", "ollama", "triton inference server", "modal",
  // -- Data Engineering ---------------------------------------------------------
  "data engineering", "data pipelines", "etl", "elt", "data warehouse",
  "apache spark", "pyspark", "flink", "airflow", "luigi", "prefect", "dagster",
  "fivetran", "stitch", "airbyte",
  "data lakehouse",
  // -- Security -----------------------------------------------------------------
  "cybersecurity", "application security", "appsec", "owasp",
  "penetration testing", "security auditing", "jwt", "ssl/tls",
  "sso", "saml", "identity management", "iam",
  "sast", "dast", "threat modeling", "zero trust", "soc2", "iso 27001", "gdpr",
  // -- System Design & Architecture ---------------------------------------------
  "system design", "distributed systems", "high availability", "scalability",
  "caching", "rate limiting", "circuit breaker",
  "cqrs", "event sourcing", "saga pattern", "ddd", "domain driven design",
  "clean architecture", "hexagonal architecture", "monolith",
  // -- Testing ------------------------------------------------------------------
  "unit testing", "integration testing", "test driven development", "tdd",
  "bdd", "e2e testing", "selenium", "jest", "junit",
  "testng", "mockito", "postman", "api testing",
  // -- Business & Domain --------------------------------------------------------
  // Only terms specific enough to be skill signals. Generic boilerplate nouns
  // like "platform", "enterprise", "growth" are excluded.
  // Product/sales/domain terms are tagged product-only in SKILL_CATEGORIES and
  // suppressed automatically when scanning for technical roles.
  "saas", "b2b", "b2c", "d2c", "marketplace",
  "crm", "erp", "business analysis",
  "business development", "partnerships", "program management",
  "project management", "supply chain", "logistics",
  "payments", "lending", "insurance", "insurtech",
  "edtech", "healthtech", "e-commerce", "ecommerce",
  "gaming", "risk management", "fraud detection",
  "seo", "sem", "performance marketing", "lifecycle marketing", "crm marketing",
  "customer success", "customer experience", "account management",
  "revenue operations", "revops", "sales enablement",
];

/**
 * Maps each skill to the role categories it is relevant to.
 * Skills absent from this map are shown for ALL role types (safe default).
 *
 * Tech-role scans (backend/frontend/fullstack/ai_llm/ml/data/devops/mobile/security)
 * suppress any skill whose categories are a strict subset of {product, design}.
 * This eliminates business/sales/domain terms from technical role scans without
 * removing them from product-manager or design scans.
 */
export const SKILL_CATEGORIES: Partial<Record<string, RoleCategory[]>> = {

  // -- Product-only: hidden for all tech role scans ----------------------------
  "product management":    ["product"],
  "product strategy":      ["product"],
  "roadmapping":           ["product"],
  "prioritization":        ["product"],
  "product discovery":     ["product"],
  "product analytics":     ["product"],
  "product ops":           ["product"],
  "product led growth":    ["product"],
  "user research":         ["product", "design"],
  "customer research":     ["product"],
  "market research":       ["product"],
  "competitive analysis":  ["product"],
  "go-to-market":          ["product"],
  "gtm":                   ["product"],
  "stakeholder management":["product"],
  "sprint planning":       ["product"],
  "prd":                   ["product"],
  "user stories":          ["product"],
  "mvp":                   ["product"],
  "kpi":                   ["product"],
  "okr":                   ["product"],
  "north star metric":     ["product"],
  "conversion":            ["product"],
  "retention":             ["product"],
  "activation":            ["product"],
  "churn":                 ["product"],
  "funnel":                ["product"],
  "monetization":          ["product"],
  "pricing strategy":      ["product"],
  "p&l":                   ["product"],
  "customer journey":      ["product"],
  "jobs to be done":       ["product"],
  "jtbd":                  ["product"],
  "waterfall":             ["product"],
  "shape up":              ["product"],
  "dual track agile":      ["product"],
  "crm":                   ["product"],
  "erp":                   ["product"],
  "business analysis":     ["product"],
  "business development":  ["product"],
  "partnerships":          ["product"],
  "program management":    ["product"],
  "project management":    ["product"],
  "supply chain":          ["product"],
  "logistics":             ["product"],
  "saas":                  ["product"],
  "b2b":                   ["product"],
  "b2c":                   ["product"],
  "d2c":                   ["product"],
  "marketplace":           ["product"],
  "payments":              ["product"],
  "lending":               ["product"],
  "insurance":             ["product"],
  "insurtech":             ["product"],
  "edtech":                ["product"],
  "healthtech":            ["product"],
  "e-commerce":            ["product"],
  "ecommerce":             ["product"],
  "gaming":                ["product"],
  "risk management":       ["product"],
  "seo":                   ["product"],
  "sem":                   ["product"],
  "performance marketing": ["product"],
  "lifecycle marketing":   ["product"],
  "crm marketing":         ["product"],
  "customer success":      ["product"],
  "customer experience":   ["product"],
  "account management":    ["product"],
  "revenue operations":    ["product"],
  "revops":                ["product"],
  "sales enablement":      ["product"],

  // -- Product + data (also useful in data analyst / growth eng context) --------
  "cohort analysis":       ["product", "data"],
  "a/b testing":           ["product", "data", "ml"],
  "experimentation":       ["product", "data", "ml"],
  "feature flagging":      ["product", "backend", "frontend"],

  // -- Product + general (show in tech scans; low-specificity process terms) ---
  "agile":                 ["product", "general"],
  "scrum":                 ["product", "general"],
  "kanban":                ["product", "general"],

  // -- Design-only: hidden for tech role scans ----------------------------------
  "figma":                 ["design"],
  "miro":                  ["design"],
  "sketch":                ["design"],
  "invision":              ["design"],
  "zeplin":                ["design"],
  "adobe xd":              ["design"],
  "wireframing":           ["design"],
  "usability testing":     ["design"],
  "heuristic evaluation":  ["design"],
  "information architecture": ["design"],
  "user flows":            ["design"],
  "interaction design":    ["design"],
  "ux research":           ["design", "product"],
  "design thinking":       ["design", "product"],
  "design sprint":         ["design", "product"],
  "prototyping":           ["design", "frontend"],

  // -- AI / LLM stack -----------------------------------------------------------
  "openai":                   ["ai_llm"],
  "anthropic":                ["ai_llm"],
  "aws bedrock":              ["ai_llm", "devops"],
  "azure openai":             ["ai_llm", "devops"],
  "gemini":                   ["ai_llm"],
  "rag":                      ["ai_llm", "ml"],
  "retrieval augmented generation": ["ai_llm", "ml"],
  "embeddings":               ["ai_llm", "ml"],
  "vector database":          ["ai_llm", "ml"],
  "pgvector":                 ["ai_llm", "backend"],
  "pinecone":                 ["ai_llm"],
  "weaviate":                 ["ai_llm"],
  "qdrant":                   ["ai_llm"],
  "chroma":                   ["ai_llm"],
  "faiss":                    ["ai_llm", "ml"],
  "milvus":                   ["ai_llm"],
  "semantic search":          ["ai_llm", "backend"],
  "reranking":                ["ai_llm"],
  "chunking":                 ["ai_llm"],
  "langchain":                ["ai_llm"],
  "llamaindex":               ["ai_llm"],
  "langgraph":                ["ai_llm"],
  "pydantic ai":              ["ai_llm"],
  "dspy":                     ["ai_llm"],
  "crewai":                   ["ai_llm"],
  "autogen":                  ["ai_llm"],
  "ai agents":                ["ai_llm"],
  "function calling":         ["ai_llm"],
  "prompt engineering":       ["ai_llm"],
  "model context protocol":   ["ai_llm"],
  "langfuse":                 ["ai_llm"],
  "helicone":                 ["ai_llm"],
  "ragas":                    ["ai_llm", "ml"],
  "llm as judge":             ["ai_llm"],
  "langsmith":                ["ai_llm"],
  "lora":                     ["ai_llm", "ml"],
  "qlora":                    ["ai_llm", "ml"],
  "peft":                     ["ai_llm", "ml"],
  "instruction tuning":       ["ai_llm", "ml"],
  "vllm":                     ["ai_llm"],
  "ollama":                   ["ai_llm"],
  "triton inference server":  ["ai_llm", "devops"],
  "modal":                    ["ai_llm", "devops"],
  "large language models":    ["ai_llm", "ml"],
  "llm":                      ["ai_llm", "ml"],
  "generative ai":            ["ai_llm", "ml"],

  // -- ML (but not LLM-specific) ------------------------------------------------
  "xgboost":               ["ml"],
  "lightgbm":              ["ml"],
  "random forest":         ["ml"],
  "weights and biases":    ["ml"],
  "wandb":                 ["ml"],
  "mlops":                 ["ml", "devops"],
  "model serving":         ["ml", "devops"],
  "mlflow":                ["ml", "data"],
  "kubeflow":              ["ml", "devops"],

  // -- Data Engineering ---------------------------------------------------------
  "apache spark":          ["data", "ml"],
  "pyspark":               ["data", "ml"],
  "flink":                 ["data"],
  "airflow":               ["data"],
  "luigi":                 ["data"],
  "prefect":               ["data"],
  "dagster":               ["data"],
  "fivetran":              ["data"],
  "stitch":                ["data"],
  "airbyte":               ["data"],
  "data engineering":      ["data"],
  "data pipelines":        ["data", "ml"],
  "etl":                   ["data"],
  "elt":                   ["data"],
  "data warehouse":        ["data"],
  "data lakehouse":        ["data"],
  "trino":                 ["data"],
  "presto":                ["data"],
  "apache iceberg":        ["data"],
  "delta lake":            ["data"],
  "snowflake":             ["data", "ml"],
  "databricks":            ["data", "ml"],
  "hive":                  ["data"],
  "bigquery":              ["data", "ml"],
  "redshift":              ["data"],
  "dbt":                   ["data"],

  // -- Frontend-specific --------------------------------------------------------
  "vue.js":                ["frontend", "fullstack"],
  "nuxt.js":               ["frontend", "fullstack"],
  "svelte":                ["frontend", "fullstack"],
  "sveltekit":             ["frontend", "fullstack"],
  "remix":                 ["frontend", "fullstack"],
  "redux":                 ["frontend"],
  "mobx":                  ["frontend"],
  "zustand":               ["frontend"],
  "react query":           ["frontend"],
  "swr":                   ["frontend"],
  "webpack":               ["frontend"],
  "vite":                  ["frontend", "fullstack"],
  "turbopack":             ["frontend"],
  "tailwind css":          ["frontend", "fullstack"],
  "material ui":           ["frontend"],
  "ant design":            ["frontend"],
  "storybook":             ["frontend"],
  "css":                   ["frontend"],
  "sass":                  ["frontend"],
  "scss":                  ["frontend"],
  "css-in-js":             ["frontend"],
  "vitest":                ["frontend"],
  "playwright":            ["frontend", "fullstack"],
  "accessibility":         ["frontend"],
  "wcag":                  ["frontend"],
  "web vitals":            ["frontend"],
  "ssr":                   ["frontend", "fullstack"],
  "ssg":                   ["frontend", "fullstack"],

  // -- Mobile-specific ----------------------------------------------------------
  "swiftui":               ["mobile"],
  "uikit":                 ["mobile"],
  "jetpack compose":       ["mobile"],
  "objective-c":           ["mobile"],
  "dart":                  ["mobile"],
  "flutter":               ["mobile"],
  "mobile development":    ["mobile"],
  "cross-platform":        ["mobile"],

  // -- Security-specific --------------------------------------------------------
  "cybersecurity":         ["security"],
  "application security":  ["security", "backend"],
  "appsec":                ["security", "backend"],
  "owasp":                 ["security", "backend"],
  "penetration testing":   ["security"],
  "security auditing":     ["security"],
  "sast":                  ["security"],
  "dast":                  ["security"],
  "threat modeling":       ["security"],
  "zero trust":            ["security"],
  "soc2":                  ["security"],
  "iso 27001":             ["security"],
  "gdpr":                  ["security", "product"],

  // -- DevOps-specific ----------------------------------------------------------
  "terraform":             ["devops"],
  "ansible":               ["devops"],
  "pulumi":                ["devops"],
  "cloudformation":        ["devops"],
  "helm":                  ["devops"],
  "istio":                 ["devops"],
  "envoy":                 ["devops"],
  "argocd":                ["devops"],
  "spinnaker":             ["devops"],
  "prometheus":            ["devops"],
  "grafana":               ["devops"],
  "elk stack":             ["devops"],
  "splunk":                ["devops"],
  "new relic":             ["devops"],
  "datadog":               ["devops"],
  "observability":         ["devops", "backend"],
  "slo":                   ["devops"],
  "sli":                   ["devops"],
  "infrastructure as code":["devops"],
  "iac":                   ["devops"],
  "platform engineering":  ["devops"],
  "sre":                   ["devops"],

  // -- Fraud detection is also a real ML/backend skill --------------------------
  "fraud detection":       ["ml", "backend", "product"],
};

/**
 * The set of role categories considered "technical".
 * Skills tagged only as product/design are hidden when scanning these categories.
 */
export const TECH_ROLE_CATEGORIES: readonly RoleCategory[] = [
  "backend", "frontend", "fullstack", "ai_llm", "ml",
  "data", "devops", "mobile", "security",
];

/**
 * Maps short/ambiguous skill tokens to their canonical display form.
 * Applied after extraction so both "ml" and "machine learning" in a JD
 * count toward the same canonical skill instead of splitting the signal.
 */
export const SKILL_ALIASES: Record<string, string> = {
  "ml":                          "machine learning",
  "go":                          "golang",
  "retrieval augmented generation": "rag",
  "wandb":                       "weights and biases",
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
  "ai engineer", "llm engineer", "applied scientist", "platform engineer",
  // Marketing / Growth
  "marketing manager", "growth manager", "performance marketer",
  // Operations
  "operations manager", "business operations", "product operations",
  "chief of staff", "strategy manager"
];
