// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The C4 sensitive-domain launch gate (S4 — docs/SCOPE-DIFFERENTIATION.md
// §4.5 + §7; design/06 critique C4, the "intimacy honeypot"): scope C
// launches on LOW-SENSITIVITY CIVIC topics only — health- and income-grade
// personal disclosure is BLOCKED until privacy-preserving aggregation work
// exists. This is a HARD launch constraint.
//
// What is enforceable client-side, honestly stated:
//   • The seeded scope-C deliberation IS a low-sensitivity civic topic
//     (neighbourhood streets/transport — the fixtures).
//   • This module is a DETERMINISTIC, conservative lexical screen for
//     first-person health/finance disclosure, run FAIL-CLOSED inside the
//     society write chokepoints (lib/pod-society.ts): a statement that trips
//     it is REFUSED before any request fires — a UI bypass cannot write it.
//
// HONESTY (no over-claim): a lexical screen enforces the OBVIOUS cases; it is
// not a classifier and it cannot certify a text safe. The gate's other half is
// deliberation seeding/topic policy (§4.5). The term list is deliberately
// TIGHT — it targets personal health/finance DISCLOSURE vocabulary, not civic
// mentions of institutions ("the hospital needs a bus stop" must pass; "my
// diagnosis" must not). False negatives are accepted; false positives on
// ordinary civic speech are the failure mode to avoid.

/** The two blocked domains of the C4 launch gate. */
export type SensitiveDomain = "health" | "finance";

/** A screen hit: which domain tripped, on which matched term. */
export interface SensitiveHit {
  readonly domain: SensitiveDomain;
  /** The matched term (for the plain-language refusal message). */
  readonly term: string;
}

// Personal-health disclosure vocabulary. Deliberately excludes civic-facility
// words (hospital, clinic, pharmacy, surgery-as-a-place) — those are ordinary
// streets/transport speech. Included terms indicate the AUTHOR'S OWN health.
const HEALTH_TERMS: readonly string[] = [
  "my diagnosis",
  "diagnosed with",
  "my medication",
  "my prescription",
  "my therapist",
  "my psychiatrist",
  "my doctor says",
  "my gp says",
  "my condition",
  "my illness",
  "my disease",
  "my disability",
  "my symptoms",
  "my mental health",
  "my depression",
  "my anxiety",
  "my treatment",
  "my chemotherapy",
  "my blood test",
  "my test results",
  "my medical records",
  "my pregnancy",
  "i am pregnant",
  "i'm pregnant",
  "my hiv",
  "my cancer",
];

// Personal-finance disclosure vocabulary. Excludes civic budget speech
// ("the council's budget", "funding for parks") — included terms indicate the
// AUTHOR'S OWN income/debt-grade data.
const FINANCE_TERMS: readonly string[] = [
  "my salary",
  "my income",
  "my wages",
  "my debt",
  "my debts",
  "my mortgage",
  "my savings",
  "my bank account",
  "my bank balance",
  "my credit score",
  "my credit card",
  "my overdraft",
  "my pension",
  "my benefits claim",
  "my universal credit",
  "i earn £",
  "i earn $",
  "i earn €",
  "my net worth",
  "i am bankrupt",
  "i'm bankrupt",
  "my bankruptcy",
];

const DOMAINS: ReadonlyArray<readonly [SensitiveDomain, readonly string[]]> = [
  ["health", HEALTH_TERMS],
  ["finance", FINANCE_TERMS],
];

/**
 * Screen a statement text against the C4 launch gate. Deterministic,
 * case-insensitive substring matching over the curated first-person
 * disclosure terms. Returns the FIRST hit (health before finance, list
 * order within a domain — stable for tests and messages), or null.
 */
export function screenSensitiveDomain(text: string): SensitiveHit | null {
  const haystack = text.toLowerCase();
  for (const [domain, terms] of DOMAINS) {
    for (const term of terms) {
      if (haystack.includes(term)) return { domain, term };
    }
  }
  return null;
}

/** The plain-language refusal for a screen hit — shared by the error below
 * and the UI pre-checks (one wording everywhere the gate speaks). */
export function describeSensitiveHit(hit: SensitiveHit): string {
  return (
    `This looks like personal ${hit.domain} information (“${hit.term}”). ` +
    "The society scope launches on low-sensitivity civic topics only — " +
    "health- and income-grade disclosure is blocked until privacy-preserving " +
    "aggregation exists (the C4 launch gate). Please rephrase without personal " +
    `${hit.domain} details.`
  );
}

/** The error the society write chokepoints throw on a C4 screen hit. */
export class SensitiveDomainError extends Error {
  readonly hit: SensitiveHit;

  constructor(hit: SensitiveHit) {
    super(describeSensitiveHit(hit));
    this.name = "SensitiveDomainError";
    this.hit = hit;
  }
}

/**
 * The fail-closed chokepoint guard: throws {@link SensitiveDomainError} when
 * `text` trips the screen. Called by every scope-C expression write
 * (vision / claim / value — lib/pod-society.ts) BEFORE serialisation.
 */
export function assertNotSensitive(text: string): void {
  const hit = screenSensitiveDomain(text);
  if (hit) throw new SensitiveDomainError(hit);
}
