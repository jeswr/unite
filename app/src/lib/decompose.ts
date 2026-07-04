// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The compose-inversion decomposition seam (S4 — docs/SCOPE-DIFFERENTIATION.md
// §4.3 step 2; design/03 §1): a narrative VisionStatement is split into atomic
// deliberation inputs — claims, needs, values — which the author then
// ADOPTS / EDITS / DISCARDS one by one. Only adopted atoms are ever written;
// adoption is what confers authorship (the C6 consent invariant), IDENTICALLY
// for manual and assisted decomposition.
//
// MANUAL-FIRST (the recommended §8 Q4 default): the shipped implementation is
// the author selecting their own text and making atoms from it — no model
// dependency, no attribution machinery needed. The DecompositionAssistant
// interface below is the INJECTABLE SEAM an LLM-backed splitter later plugs
// into, mirroring design/05 §4's SynthesisMediator pattern:
//   • deterministic reference implementation ships first (here: the manual
//     path, where the "assistant" proposes nothing);
//   • an assisted implementation MUST return its provenance plan (model,
//     prompt/version) so each written claim can carry fut:decomposedBy →
//     a prov:Activity with prov:hadPlan — GenAI decomposition is never
//     invisible (design/01);
//   • either way the adopt/edit/discard step is the consent-critical piece,
//     and it is the same UI regardless of who proposed the split.

/** What kind of atom a decomposition proposes. */
export type AtomKind = "claim" | "need" | "value";

/** One proposed atom, pending the author's adopt/edit/discard decision. */
export interface DraftAtom {
  readonly kind: AtomKind;
  /** The proposed atom text (the author may edit before adopting). */
  readonly content: string;
  /** For a need: the proposed need-scheme concept IRI (author may change). */
  readonly needConcept?: string;
  /** For a value: the proposed value-scheme concept IRI (author may change). */
  readonly valueConcept?: string;
}

/** The provenance an ASSISTED decomposition must disclose (prov:hadPlan). */
export interface DecompositionPlan {
  /** The model/tool identifier (e.g. a model id), for the PROV plan. */
  readonly tool: string;
  /** The prompt/version identifier. */
  readonly plan: string;
  /**
   * The prov:Activity IRI the assistant minted for THIS decomposition run
   * (an http(s) IRI naming a resource that records tool + plan). When
   * present, every ADOPTED claim the run proposed is written with
   * `fut:decomposedBy → activity` — GenAI decomposition is never invisible
   * (design/01). An assistant that cannot publish an activity resource
   * omits this and its claims carry no decomposedBy (the honest minimum).
   */
  readonly activity?: string;
}

/** What a decomposition run returns. */
export interface DecompositionResult {
  readonly atoms: readonly DraftAtom[];
  /**
   * Present ONLY for an assisted (non-manual) decomposition: the disclosure
   * that lets the write path record `fut:decomposedBy` on each adopted claim.
   * The manual path returns none — the author IS the decomposer.
   */
  readonly provenance?: DecompositionPlan;
}

/**
 * The injectable decomposition seam. An implementation takes the narrative
 * and proposes atoms; it NEVER adopts them — the author's explicit
 * adopt/edit/discard decision downstream is what makes an atom theirs.
 */
export interface DecompositionAssistant {
  decompose(narrative: string): Promise<DecompositionResult>;
}

/**
 * The manual-first reference implementation (§8 Q4): proposes NOTHING — the
 * author splits their own narrative via the select-text → make-an-atom UI
 * affordances. Deterministic, model-free, and the identity element of the
 * seam: wiring an LLM assistant later changes only which atoms are PROPOSED,
 * never how they are adopted.
 */
export const MANUAL_DECOMPOSITION: DecompositionAssistant = {
  decompose(): Promise<DecompositionResult> {
    return Promise.resolve({ atoms: [] });
  },
};

/**
 * Make a claim draft from a selected span of the narrative (the manual
 * "select text → make a claim" affordance). Pure: trims and returns null for
 * an empty selection — the UI disables the affordance rather than minting
 * blank atoms.
 */
export function atomFromSelection(kind: AtomKind, selection: string): DraftAtom | null {
  const content = selection.trim();
  if (content.length === 0) return null;
  return { kind, content };
}
