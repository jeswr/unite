// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The ODRL consent layer (design/01 "The ODRL consent layer"). When a participant
// submits a fut:Need, they attach an ODRL 2.2 usage-control policy recording what
// the deliberation federation may DO with that statement — expressed with the
// `fut:` consent-action profile (fut:aggregate / synthesize / quoteVerbatim /
// governmentUse + the fut:kThreshold k-anonymity constraint). The policy is stored
// ALONGSIDE the need in the SAME pod resource, linked by `odrl:hasPolicy` — the
// author's standing consent record. Defaults are CONSERVATIVE (aggregate +
// synthesize permitted; quoteVerbatim + governmentUse prohibited).
//
// The ODRL vocabulary IRIs come from `@jeswr/solid-odrl` (the suite's ODRL library
// — the client-side express + evaluate layer); the `fut:` profile action IRIs come
// from fut.ts and match the landed futures sector vocab. Serialisation is via
// n3.Writer (typed quads, correct xsd datatypes — never hand-built RDF); reads go
// through guarded DatasetCore.match accessors (foreign RDF is hostile input).

import { ODRL, OPERATOR_IRI } from "@jeswr/solid-odrl";
import type { DatasetCore, Quad, Term } from "@rdfjs/types";
import { DataFactory } from "n3";
import {
  CONSENT_AGGREGATE,
  CONSENT_GOVERNMENT_USE,
  CONSENT_K_THRESHOLD,
  CONSENT_QUOTE_VERBATIM,
  CONSENT_SYNTHESIZE,
  DEFAULT_K_THRESHOLD,
  NS,
} from "./fut.js";
import { isHttpIri } from "./model.js";

const { namedNode, literal, quad } = DataFactory;

/** The ODRL namespace (re-exported from @jeswr/solid-odrl) — the writer prefix. */
export const ODRL_NS: string = ODRL;

// ── ODRL core term IRIs (derived from the @jeswr/solid-odrl namespace) ────────
const ODRL_SET = `${ODRL}Set`;
const ODRL_PERMISSION_CLASS = `${ODRL}Permission`;
const ODRL_PROHIBITION_CLASS = `${ODRL}Prohibition`;
const ODRL_HAS_POLICY = `${ODRL}hasPolicy`;
const ODRL_PERMISSION = `${ODRL}permission`;
const ODRL_PROHIBITION = `${ODRL}prohibition`;
const ODRL_ACTION = `${ODRL}action`;
const ODRL_TARGET = `${ODRL}target`;
const ODRL_ASSIGNER = `${ODRL}assigner`;
const ODRL_CONSTRAINT = `${ODRL}constraint`;
const ODRL_LEFT_OPERAND = `${ODRL}leftOperand`;
const ODRL_OPERATOR = `${ODRL}operator`;
const ODRL_RIGHT_OPERAND = `${ODRL}rightOperand`;
const ODRL_GTEQ = OPERATOR_IRI.gteq;

const RDF_TYPE = `${NS.rdf}type`;
const XSD_INTEGER = `${NS.xsd}integer`;

/** The four `fut:` consent actions, in canonical UI order + default disposition. */
export const CONSENT_ACTIONS = [
  { key: "aggregate", iri: CONSENT_AGGREGATE, label: "Aggregate", defaultAllow: true },
  { key: "synthesize", iri: CONSENT_SYNTHESIZE, label: "Synthesize", defaultAllow: true },
  {
    key: "quoteVerbatim",
    iri: CONSENT_QUOTE_VERBATIM,
    label: "Quote verbatim",
    defaultAllow: false,
  },
  {
    key: "governmentUse",
    iri: CONSENT_GOVERNMENT_USE,
    label: "Government use",
    defaultAllow: false,
  },
] as const;

/** A consent action key. */
export type ConsentActionKey = (typeof CONSENT_ACTIONS)[number]["key"];

/**
 * A participant's standing consent over an expression-layer resource: which of the
 * four `fut:` actions are permitted, and the k-anonymity threshold any derived
 * publication must meet.
 */
export interface ConsentPolicy {
  readonly aggregate: boolean;
  readonly synthesize: boolean;
  readonly quoteVerbatim: boolean;
  readonly governmentUse: boolean;
  /** ODRL kThreshold on derivation — a positive integer (design/01 default 5). */
  readonly kThreshold: number;
}

/** The conservative default consent (design/01: aggregate + synthesize only). */
export const DEFAULT_CONSENT: ConsentPolicy = {
  aggregate: true,
  synthesize: true,
  quoteVerbatim: false,
  governmentUse: false,
  kThreshold: DEFAULT_K_THRESHOLD,
};

/** The `fut:` action IRI for a consent key. */
const ACTION_IRI: Readonly<Record<ConsentActionKey, string>> = {
  aggregate: CONSENT_AGGREGATE,
  synthesize: CONSENT_SYNTHESIZE,
  quoteVerbatim: CONSENT_QUOTE_VERBATIM,
  governmentUse: CONSENT_GOVERNMENT_USE,
};

/**
 * A same-document hash-fragment IRI derived from `resourceIri` — SETTING the
 * fragment (never appending), so a resource IRI that already carries a fragment
 * (e.g. the vocab's `…needs/n-1.ttl#it` need subject) yields `…n-1.ttl#<frag>`
 * rather than a malformed double-fragment `…#it#<frag>`. `resourceIri` must be an
 * absolute http(s) IRI (consentQuads validates this first).
 */
function fragmentIri(resourceIri: string, fragment: string): string {
  const u = new URL(resourceIri);
  u.hash = fragment; // replaces any existing fragment
  return u.toString();
}

/** The same-document policy node IRI for a resource. */
export function policyIriFor(resourceIri: string): string {
  return fragmentIri(resourceIri, "consent");
}

/**
 * Build the ODRL policy quads for `resourceIri`'s consent, linked by
 * `odrl:hasPolicy`. Each permitted action is an `odrl:permission`, each prohibited
 * action an `odrl:prohibition`; the k-anonymity constraint rides the `synthesize`
 * rule (derivation ⇒ synthesis) as an `odrl:constraint fut:kThreshold >= k`.
 * `assigner` (the author WebID) is recorded when a valid http(s) IRI.
 *
 * Throws on an invalid required IRI or a non-positive-integer kThreshold — the
 * write path serialises this alongside a need, so a malformed policy must not ship.
 */
export function consentQuads(
  resourceIri: string,
  consent: ConsentPolicy,
  assigner?: string,
): Quad[] {
  if (!isHttpIri(resourceIri)) {
    throw new Error(`consentQuads: resource is not an http(s) IRI: ${resourceIri}`);
  }
  if (!Number.isInteger(consent.kThreshold) || consent.kThreshold < 1) {
    throw new Error(`consentQuads: kThreshold must be a positive integer: ${consent.kThreshold}`);
  }
  const policyIri = policyIriFor(resourceIri);
  const resource = namedNode(resourceIri);
  const policy = namedNode(policyIri);
  const quads: Quad[] = [
    quad(resource, namedNode(ODRL_HAS_POLICY), policy),
    quad(policy, namedNode(RDF_TYPE), namedNode(ODRL_SET)),
  ];
  if (assigner !== undefined && isHttpIri(assigner)) {
    quads.push(quad(policy, namedNode(ODRL_ASSIGNER), namedNode(assigner)));
  }

  for (const { key } of CONSENT_ACTIONS) {
    const allowed = consent[key];
    const ruleIri = fragmentIri(resourceIri, `rule-${key}`);
    const rule = namedNode(ruleIri);
    const rulePredicate = allowed ? ODRL_PERMISSION : ODRL_PROHIBITION;
    const ruleClass = allowed ? ODRL_PERMISSION_CLASS : ODRL_PROHIBITION_CLASS;
    quads.push(
      quad(policy, namedNode(rulePredicate), rule),
      quad(rule, namedNode(RDF_TYPE), namedNode(ruleClass)),
      quad(rule, namedNode(ODRL_ACTION), namedNode(ACTION_IRI[key])),
      quad(rule, namedNode(ODRL_TARGET), resource),
    );
    // The k-anonymity constraint sits on the synthesize rule (design/01: any
    // derived publication must aggregate ≥ k contributors), whether it is
    // permitted or prohibited — it bounds derivation when synthesis is allowed.
    if (key === "synthesize") {
      const constraintIri = fragmentIri(resourceIri, "c-kthreshold");
      const constraint = namedNode(constraintIri);
      quads.push(
        quad(rule, namedNode(ODRL_CONSTRAINT), constraint),
        quad(constraint, namedNode(ODRL_LEFT_OPERAND), namedNode(CONSENT_K_THRESHOLD)),
        quad(constraint, namedNode(ODRL_OPERATOR), namedNode(ODRL_GTEQ)),
        quad(
          constraint,
          namedNode(ODRL_RIGHT_OPERAND),
          literal(String(consent.kThreshold), namedNode(XSD_INTEGER)),
        ),
      );
    }
  }
  return quads;
}

// ── Guarded read-back (round-trip; the facilitation service evaluates this) ───

/** The single object term for (s,p) iff there is exactly one. */
function single(ds: DatasetCore, s: Term, p: string): Term | undefined {
  const matched = ds.match(s, namedNode(p), null, null);
  if (matched.size !== 1) return undefined;
  for (const q of matched) return q.object;
  return undefined;
}

/**
 * True iff `<policy>` lists `<action>` under `<predicate>` (permission/prohibition)
 * on a rule whose `odrl:target` IS `resourceIri` — a rule targeting a DIFFERENT
 * resource never counts (a hostile policy can't grant use of this need by
 * permitting some other asset).
 */
function ruleHasAction(
  ds: DatasetCore,
  policy: Term,
  predicate: string,
  action: string,
  resourceIri: string,
): boolean {
  for (const q of ds.match(policy, namedNode(predicate), null, null)) {
    if (q.object.termType !== "NamedNode") continue;
    const act = single(ds, q.object, ODRL_ACTION);
    if (act?.termType !== "NamedNode" || act.value !== action) continue;
    const target = single(ds, q.object, ODRL_TARGET);
    if (target?.termType === "NamedNode" && target.value === resourceIri) return true;
  }
  return false;
}

/**
 * Parse the consent policy attached to `resourceIri`, or undefined when none is
 * present. FAIL-CLOSED: an action counts as PERMITTED only when a permission rule
 * TARGETING this resource exists AND no prohibition rule for the same action /
 * resource contradicts it (prohibition wins — the ODRL `prohibit` conflict
 * strategy). A malformed / missing kThreshold falls back to the design default.
 */
export function parseConsent(ds: DatasetCore, resourceIri: string): ConsentPolicy | undefined {
  const resource = namedNode(resourceIri);
  const policyTerm = single(ds, resource, ODRL_HAS_POLICY);
  if (policyTerm?.termType !== "NamedNode") return undefined;

  const permitted = (action: string) =>
    ruleHasAction(ds, policyTerm, ODRL_PERMISSION, action, resourceIri) &&
    !ruleHasAction(ds, policyTerm, ODRL_PROHIBITION, action, resourceIri);

  // Read the kThreshold from the SYNTHESIZE rule's constraint, if well-formed. The
  // constraint rides the synthesize rule WHETHER it is permitted OR prohibited
  // (consentQuads always attaches it), so scan BOTH predicates — but ONLY on a rule
  // whose action is fut:synthesize AND whose target is this resource, so a hostile
  // policy cannot lower k by attaching fut:kThreshold to an unrelated rule/target.
  let kThreshold = DEFAULT_K_THRESHOLD;
  for (const predicate of [ODRL_PERMISSION, ODRL_PROHIBITION]) {
    for (const q of ds.match(policyTerm, namedNode(predicate), null, null)) {
      if (q.object.termType !== "NamedNode") continue;
      const act = single(ds, q.object, ODRL_ACTION);
      if (act?.termType !== "NamedNode" || act.value !== CONSENT_SYNTHESIZE) continue;
      const target = single(ds, q.object, ODRL_TARGET);
      if (target?.termType !== "NamedNode" || target.value !== resourceIri) continue;
      const constraint = single(ds, q.object, ODRL_CONSTRAINT);
      if (constraint?.termType !== "NamedNode") continue;
      const left = single(ds, constraint, ODRL_LEFT_OPERAND);
      if (left?.termType !== "NamedNode" || left.value !== CONSENT_K_THRESHOLD) continue;
      // The operator MUST be gteq (the "at least k" bound). A different operator
      // (e.g. lteq) would invert the meaning — reject it rather than trust the value.
      const op = single(ds, constraint, ODRL_OPERATOR);
      if (op?.termType !== "NamedNode" || op.value !== ODRL_GTEQ) continue;
      const right = single(ds, constraint, ODRL_RIGHT_OPERAND);
      if (right?.termType === "Literal" && /^[0-9]+$/.test(right.value)) {
        const n = Number.parseInt(right.value, 10);
        if (Number.isInteger(n) && n >= 1) kThreshold = n;
      }
    }
  }

  return {
    aggregate: permitted(CONSENT_AGGREGATE),
    synthesize: permitted(CONSENT_SYNTHESIZE),
    quoteVerbatim: permitted(CONSENT_QUOTE_VERBATIM),
    governmentUse: permitted(CONSENT_GOVERNMENT_USE),
    kThreshold,
  };
}
