/**
 * Negative-context rules for skill regex matching.
 *
 * After a skill term is detected by word-boundary regex, these rules inspect
 * a small window of surrounding text to decide if the match is a verb/idiom
 * rather than a genuine skill mention.
 *
 * Usage: after SKILL_REGEX_MAP.exec() returns a match, call isFalsePositive().
 * If it returns true, discard the match.
 */

type NegativeRule = {
  /** After-pattern tested against ~60 chars after the skill match (lower-cased) */
  afterPattern?: RegExp;
  /** Before-pattern tested against ~40 chars before the skill match (lower-cased) */
  beforePattern?: RegExp;
};

// Map: canonical skill name (lower-cased) -> rules
const NEGATIVE_RULES: Record<string, NegativeRule[]> = {
  // "excel at communication", "excel in this area", "excel under pressure"
  // vs "Microsoft Excel", "Excel spreadsheet", "proficient in Excel"
  excel: [
    // Catches "excel at X", "excel in fast-paced", "excel within", "excel across", etc.
    // allMatchesFalsePositive ensures we still keep Excel when it also appears as a tool name.
    { afterPattern: /^\s+(at|in|under|throughout|within|by|across)\b/ },
  ],

  // "go ahead", "go back", "go over", "go through", "go on", "go live" (modal verb)
  // vs "Go programming language", "Golang", "proficient in Go"
  go: [
    { afterPattern: /^\s+(ahead|back|over|through|on|into|beyond|further|live|forward|well|hand|to\s+market)\b/ },
    // "let's go", "will go", "can go", "should go" (modal context)
    { beforePattern: /\b(let'?s|will|can|should|must|did|does|would)\s+$/ },
  ],

  // "spring into action", "spring forward", "spring semester", "spring cleaning"
  // vs "Spring Boot", "Spring Framework", "Java Spring"
  spring: [
    { afterPattern: /^\s+(into|forward|cleaning|break|semester|season)\b/ },
    { afterPattern: /^\s*,?\s*(summer|winter|fall|autumn)\b/ },
  ],

  // "swift action", "swift response", "swift turnaround", "swift resolution"
  // vs "Swift iOS development", "Apple Swift", "Swift programming"
  swift: [
    { afterPattern: /^\s+(action|response|turnaround|resolution|delivery|execution|decision|manner|pace)\b/ },
  ],

  // "spark interest", "spark creativity", "spark of hope", "spark a conversation"
  // vs "Apache Spark", "Spark ML", "PySpark"
  spark: [
    { afterPattern: /^\s+(of\s+(light|hope|creativity|joy|enthusiasm)|up\s+|interest|debate|a\s+conversation|innovation)\b/ },
    { beforePattern: /\b(will|can|to)\s+$/, afterPattern: /^\s+(interest|debate|conversation|discussion)\b/ },
  ],

  // "rails (handrail)", "off the rails", "guard rails", "sand rails"
  // vs "Ruby on Rails", "Rails framework"
  rails: [
    { beforePattern: /\b(guard|hand|off\s+the|on\s+the|sand|safety)\s+$/ },
  ],

  // "beam of light", "beam me up"
  // vs "Apache Beam", "Beam pipeline"
  beam: [
    { afterPattern: /^\s+(of\s+(light|hope|energy|sunlight)|me\s+up)\b/ },
  ],

  // "ray of sunshine", "ray ban", "ray charles" (named entities)
  // vs "Ray (distributed computing)", "Ray cluster"
  ray: [
    { afterPattern: /^\s+(of\s+(light|sunshine|hope)|ban|charles|romano|tracing)\b/ },
  ],

  // "rust and decay", "rust prevention", "rust removal"
  // vs "Rust programming language", "Rust systems programming"
  rust: [
    { afterPattern: /^\s+(and\s+(decay|corrosion|oxidation|removal)|prevention|inhibitor|stain)\b/ },
  ],

  // "node of failure", "node in a network" (generic networking term)
  // but "Node.js" or "NodeJS" are distinctive enough that the base skill name
  // "node" matching a generic "network node" is the main risk
  // Not worth suppressing broadly - skip for now

  // "java, indonesia" or "java island" - location context
  // But in job postings this is uncommon and "Java" as location is rare
  // Skip - word boundary already prevents most false positives here
};

/** Skills that have at least one negative rule - used for fast-path skipping. */
export const SKILLS_WITH_NEGATIVE_RULES: ReadonlySet<string> = new Set(
  Object.keys(NEGATIVE_RULES)
);

/**
 * Returns true if a single occurrence of `skill` at `matchIndex` looks like
 * a verb/idiom false positive based on the surrounding context window.
 *
 * The caller is responsible for iterating all match positions and keeping the
 * skill if ANY position returns false (i.e. at least one genuine occurrence).
 */
export function isFalsePositive(
  skill: string,
  fullText: string,
  matchIndex: number
): boolean {
  const rules = NEGATIVE_RULES[skill];
  if (!rules || rules.length === 0) return false;

  const skillLen = skill.length;
  // Window: 40 chars before, 60 chars after
  const before = fullText.slice(Math.max(0, matchIndex - 40), matchIndex);
  const after  = fullText.slice(matchIndex + skillLen, matchIndex + skillLen + 60);

  for (const rule of rules) {
    const failAfter  = rule.afterPattern  ? rule.afterPattern.test(after)   : false;
    const failBefore = rule.beforePattern ? rule.beforePattern.test(before)  : false;
    if (failAfter || failBefore) return true;
  }
  return false;
}

/**
 * Returns true only if EVERY occurrence of `skill` in `fullText` is a false
 * positive. If at least one occurrence is genuine, returns false (keep skill).
 *
 * @param skill    - canonical skill name (lower-cased)
 * @param fullText - normalized full text (lower-cased)
 * @param baseRe   - the non-global word-boundary regex for this skill
 */
export function allMatchesFalsePositive(
  skill: string,
  fullText: string,
  baseRe: RegExp
): boolean {
  // Fast path: no rules for this skill
  if (!SKILLS_WITH_NEGATIVE_RULES.has(skill)) return false;

  // Build a global version to iterate all positions
  const globalRe = new RegExp(baseRe.source, "gi");
  let m: RegExpExecArray | null;
  let foundAny = false;

  while ((m = globalRe.exec(fullText)) !== null) {
    foundAny = true;
    if (!isFalsePositive(skill, fullText, m.index)) {
      return false; // at least one genuine occurrence - keep the skill
    }
  }

  return foundAny; // true = every occurrence was a false positive
}
