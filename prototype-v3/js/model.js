// Pure operations on the local demo state. Every function returns a new state
// and never mutates its input. User input is validated with the same record
// validators used for import, and field problems are reported as FieldErrors.

import * as S from './schema.js';
import { ASPIRATIONS, COMMITMENTS, EXPERTS, MAIN_COMMITMENT_ID, PROPOSAL, RESPONSES } from './seed.js';

export const LOCAL_AUTHOR = Object.freeze({ kind: 'local', label: 'Participant in this browser' });
export const ANYONE = 'anyone';
const PROPOSED_AT = '2026-09-01T09:00:00Z';

export class FieldErrors extends Error {
  constructor(errors) {
    super('Some fields need attention');
    this.name = 'FieldErrors';
    this.errors = errors; // { fieldName: detail }
  }
}

// Runs each field check; collects SchemaError details per field.
function collect(checks) {
  const values = {};
  const errors = {};
  for (const [name, check] of Object.entries(checks)) {
    try {
      values[name] = check();
    } catch (error) {
      if (!(error instanceof S.SchemaError)) throw error;
      errors[name] = error.detail;
    }
  }
  if (Object.keys(errors).length > 0) throw new FieldErrors(errors);
  return values;
}

const iso = (now) => new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
export const newId = (prefix) => `${prefix}-${globalThis.crypto.randomUUID()}`;
const optionIds = () => PROPOSAL.options.map((o) => o.id);

export function initialDelivery() {
  return {
    commitmentId: MAIN_COMMITMENT_ID,
    history: [
      { state: 'proposed', at: PROPOSED_AT, evidence: 'Options, costs and trade-offs were published for comment.' },
    ],
  };
}

export function emptyState() {
  return {
    storageVersion: S.STORAGE_VERSION,
    drafts: [],
    shared: [],
    bookmarks: [],
    responses: [],
    questions: [],
    decision: null,
    delivery: initialDelivery(),
  };
}

// ----- private drafts ------------------------------------------------------

export function saveDraft(state, input, { now = Date.now(), editingId = null } = {}) {
  const publicIds = new Set(allAspirations(state).map((a) => a.id));
  const fields = collect({
    hard: () => S.text(input.hard, 'hard', { max: S.LIMITS.body }),
    different: () => S.text(input.different, 'different', { max: S.LIMITS.body }),
    protect: () => S.text(input.protect, 'protect', { max: S.LIMITS.body, optional: true }),
    topic: () => S.oneOf(input.topic, 'topic', S.TOPICS),
    horizon: () => S.oneOf(input.horizon || 'none', 'horizon', S.HORIZONS),
    inspiredBy: () => {
      const ref = S.nullableId(input.inspiredBy || null, 'inspiredBy');
      if (ref && !publicIds.has(ref)) throw new S.SchemaError('inspiredBy', 'refers to an aspiration that no longer exists');
      return ref;
    },
  });
  const at = iso(now);
  const next = structuredClone(state);
  if (editingId) {
    const existing = next.drafts.find((d) => d.id === editingId);
    if (!existing) throw new Error('That draft no longer exists.');
    Object.assign(existing, fields, { updatedAt: at });
    return { state: next, draft: existing };
  }
  const draft = { id: newId('draft'), ...fields, sharedId: null, createdAt: at, updatedAt: at };
  next.drafts.push(draft);
  return { state: next, draft };
}

export function deleteDraft(state, draftId) {
  const next = structuredClone(state);
  next.drafts = next.drafts.filter((d) => d.id !== draftId);
  return next;
}

// Creates a SEPARATE public record from reviewed text. The private draft is
// never copied wholesale: only the fields the participant confirmed.
export function shareDraft(state, draftId, input) {
  const draft = state.drafts.find((d) => d.id === draftId);
  if (!draft) throw new Error('That draft no longer exists.');
  if (draft.sharedId) throw new Error('This draft already has a shared copy. Withdraw it first to share again.');
  const fields = collect({
    title: () => S.text(input.title, 'title', { max: S.LIMITS.title }),
    hard: () => S.text(input.hard, 'hard', { max: S.LIMITS.body }),
    different: () => S.text(input.different, 'different', { max: S.LIMITS.body }),
    protect: () => S.text(input.protect, 'protect', { max: S.LIMITS.body, optional: true }),
    confirm: () => {
      if (input.confirm !== true) throw new S.SchemaError('confirm', 'must not be empty');
      return true;
    },
  });
  const record = S.aspiration(
    {
      id: newId('asp-local'),
      title: fields.title,
      topic: draft.topic,
      horizon: draft.horizon,
      hard: fields.hard,
      different: fields.different,
      protect: fields.protect,
      inspiredBy: draft.inspiredBy,
      author: LOCAL_AUTHOR,
    },
    'shared',
  );
  const next = structuredClone(state);
  next.shared.push(record);
  next.drafts.find((d) => d.id === draftId).sharedId = record.id;
  return { state: next, record };
}

// Removes a shared copy. Shared records that cited it keep their content and
// say their inspiration was withdrawn, because a public record must not point
// at one that no longer exists. Nothing else (responses, decision) is touched.
export function withdrawShared(state, sharedId) {
  const next = structuredClone(state);
  next.shared = next.shared.filter((a) => a.id !== sharedId);
  next.bookmarks = next.bookmarks.filter((b) => b !== sharedId);
  for (const d of next.drafts) {
    if (d.sharedId === sharedId) d.sharedId = null;
    if (d.inspiredBy === sharedId) d.inspiredBy = null;
  }
  for (const a of next.shared) markInspirationWithdrawn(a, sharedId);
  return next;
}

export function markInspirationWithdrawn(aspiration, missingId) {
  if (aspiration.inspiredBy !== missingId) return;
  aspiration.inspiredBy = null;
  aspiration.inspirationWithdrawn = true;
}

// ----- explore -------------------------------------------------------------

export const allAspirations = (state) => [...ASPIRATIONS, ...state.shared];

export function toggleBookmark(state, aspirationId) {
  const next = structuredClone(state);
  next.bookmarks = next.bookmarks.includes(aspirationId)
    ? next.bookmarks.filter((b) => b !== aspirationId)
    : [...next.bookmarks, aspirationId];
  return next;
}

export function filterAspirations(state, { topic = 'all', savedOnly = false } = {}) {
  return allAspirations(state).filter(
    (a) => (topic === 'all' || a.topic === topic) && (!savedOnly || state.bookmarks.includes(a.id)),
  );
}

// ----- responses to options ------------------------------------------------

export const allResponses = (state) => [...RESPONSES, ...state.responses];

export function setResponse(state, input) {
  if (state.decision) throw new Error('Responses closed when the decision was recorded.');
  const fields = collect({
    optionId: () => S.oneOf(input.optionId, 'optionId', Object.fromEntries(optionIds().map((i) => [i, i]))),
    stance: () => S.oneOf(input.stance, 'stance', S.STANCES),
    reason: () => S.text(input.reason, 'reason', { max: S.LIMITS.reason, optional: true }),
  });
  const next = structuredClone(state);
  const existing = next.responses.find((r) => r.optionId === fields.optionId);
  if (existing) {
    Object.assign(existing, { stance: fields.stance, reason: fields.reason });
  } else {
    next.responses.push({ id: newId('response-local'), ...fields, author: LOCAL_AUTHOR });
  }
  return next;
}

export function removeResponse(state, optionId) {
  if (state.decision) throw new Error('Responses closed when the decision was recorded.');
  const next = structuredClone(state);
  next.responses = next.responses.filter((r) => r.optionId !== optionId);
  return next;
}

// ----- expert questions ----------------------------------------------------

export function addQuestion(state, input) {
  const recipients = Object.fromEntries([...EXPERTS.map((e) => [e.id, e.role]), [ANYONE, 'Anyone']]);
  const options = Object.fromEntries([['none', ''], ...optionIds().map((i) => [i, i])]);
  const fields = collect({
    text: () => S.text(input.text, 'text', { max: S.LIMITS.reason, min: 10 }),
    to: () => S.oneOf(input.to, 'to', recipients),
    optionId: () => S.oneOf(input.optionId || 'none', 'optionId', options),
  });
  const record = {
    id: newId('question-local'),
    text: fields.text,
    to: fields.to,
    optionId: fields.optionId === 'none' ? null : fields.optionId,
    status: 'open',
    author: LOCAL_AUTHOR,
  };
  const next = structuredClone(state);
  next.questions.push(record);
  return { state: next, record };
}

// ----- decision and delivery -----------------------------------------------

export const mainCommitment = () => COMMITMENTS.find((c) => c.id === MAIN_COMMITMENT_ID);

export function concernSnapshot(responses) {
  return responses
    .filter((r) => r.stance === 'concern')
    .map((r) => ({ responseId: r.id, optionId: r.optionId, reason: r.reason, author: { ...r.author } }));
}

// The decision rule: nothing is recorded without a named owner, public
// reasons, a date, and an explicit funding position (an amount or "none").
// An amount here is an allocation; release is confirmed later on the trail.
export function validateDecisionInput(input) {
  const outcomes = Object.fromEntries([...optionIds(), S.DEFER].map((i) => [i, i]));
  const values = collect({
    outcome: () => S.oneOf(input.outcome, 'outcome', outcomes),
    owner: () => S.text(input.owner, 'owner', { max: S.LIMITS.label }),
    reasons: () => S.text(input.reasons, 'reasons', { max: S.LIMITS.body, min: 20 }),
    decidedOn: () => S.date(input.decidedOn, 'decidedOn'),
    fundingKind: () => S.oneOf(input.fundingKind, 'fundingKind', S.FUNDING_KINDS),
    amount: () => {
      if (input.fundingKind !== 'budget') return null;
      const amount = typeof input.amount === 'string' && /^\d+$/.test(input.amount.trim()) ? Number(input.amount) : input.amount;
      return S.wholeNumber(amount, 'amount', { min: 1, max: S.LIMITS.budget });
    },
  });
  if (values.outcome === S.DEFER && values.fundingKind === 'budget') {
    throw new FieldErrors({ fundingKind: 'cannot allocate a budget to a deferred decision' });
  }
  return values;
}

export function recordDecision(state, input, { now = Date.now() } = {}) {
  if (state.decision) throw new Error('A decision is already recorded for this commitment.');
  const values = validateDecisionInput(input);
  const commitment = mainCommitment();
  const at = iso(now);
  const decision = {
    id: newId('decision'),
    commitmentId: commitment.id,
    outcome: values.outcome,
    owner: values.owner,
    authority: commitment.authority,
    reasons: values.reasons,
    decidedOn: values.decidedOn,
    funding: { kind: values.fundingKind, amount: values.amount },
    attachedConcerns: concernSnapshot(allResponses(state)),
    recordedAt: at,
  };
  const next = structuredClone(state);
  next.decision = decision;
  const funding =
    values.fundingKind === 'budget'
      ? `€${values.amount.toLocaleString('en-GB')} allocated; release still to be confirmed by the budget holder`
      : 'no budget allocated';
  next.delivery.history.push({
    state: 'decision-recorded',
    at,
    evidence: `Decision recorded by ${values.owner} for ${values.decidedOn}, with ${decision.attachedConcerns.length} concerns attached (${funding}).`,
  });
  return next;
}

export const currentDeliveryState = (delivery) => delivery.history.at(-1).state;

// Returns the next state the trail may move to, or a reason why it cannot.
export function nextDeliveryStep(delivery, decision) {
  const current = currentDeliveryState(delivery);
  if (!decision) return { next: null, reason: 'No decision has been recorded yet.' };
  if (decision.outcome === S.DEFER) return { next: null, reason: 'The decision was deferred, so nothing moves forward.' };
  if (current === 'decision-recorded' && decision.funding.kind === 'none') {
    return { next: null, reason: 'No budget was allocated, so the trail stops at “Decision recorded”.' };
  }
  const index = S.DELIVERY_ORDER.indexOf(current);
  if (index === S.DELIVERY_ORDER.length - 1) return { next: null, reason: 'The trail is complete.' };
  return { next: S.DELIVERY_ORDER[index + 1], reason: null };
}

export function advanceDelivery(state, evidence, { now = Date.now() } = {}) {
  const { next: step, reason } = nextDeliveryStep(state.delivery, state.decision);
  if (!step) throw new Error(reason);
  const fields = collect({ evidence: () => S.text(evidence, 'evidence', { max: S.LIMITS.body, min: 10 }) });
  const next = structuredClone(state);
  next.delivery.history.push({ state: step, at: iso(now), evidence: fields.evidence });
  return next;
}

// Structural rules for a delivery trail, checked on import and on load.
export function checkDeliveryHistory(delivery, decision, path = 'delivery') {
  const { history } = delivery;
  if (history.length === 0) throw new S.SchemaError(`${path}.history`, 'must start with “proposed”');
  history.forEach((step, i) => {
    if (step.state !== S.DELIVERY_ORDER[i]) {
      throw new S.SchemaError(`${path}.history[${i}].state`, `expected “${S.DELIVERY_ORDER[i]}”; steps cannot be skipped`);
    }
    if (i > 0 && Date.parse(step.at) < Date.parse(history[i - 1].at)) {
      throw new S.SchemaError(`${path}.history[${i}].at`, 'is earlier than the previous step');
    }
  });
  if (history.length > 1 && !decision) {
    throw new S.SchemaError(`${path}.history`, 'goes past “proposed” but no decision is recorded');
  }
  if (decision && history.length < 2) {
    throw new S.SchemaError(`${path}.history`, 'has no “decision-recorded” step although a decision is recorded');
  }
  if (decision && history[1].at !== decision.recordedAt) {
    throw new S.SchemaError(`${path}.history[1].at`, 'does not match when the decision was recorded');
  }
  if (history.length > 2 && (decision.funding.kind === 'none' || decision.outcome === S.DEFER)) {
    throw new S.SchemaError(`${path}.history`, 'confirms funds although the decision allocated no budget');
  }
}

// Rules tying a decision to its commitment, its trail and the concerns it
// carries, checked on import and on load. Responses close when a decision is
// recorded, so every concern response must be attached exactly once, as an
// unchanged copy, and nothing else may be attached.
export function checkDecisionConsistency(decision, { commitments, responses, delivery }, path = 'decision') {
  const commitment = commitments.find((c) => c.id === decision.commitmentId);
  if (!commitment) throw new S.SchemaError(`${path}.commitmentId`, `refers to an unknown commitment “${decision.commitmentId}”`);
  if (decision.commitmentId !== delivery.commitmentId) {
    throw new S.SchemaError(`${path}.commitmentId`, 'is not the commitment the delivery trail follows');
  }
  if (decision.authority !== commitment.authority) {
    throw new S.SchemaError(`${path}.authority`, 'does not match the authority named on the commitment');
  }
  const concerns = new Map(responses.filter((r) => r.stance === 'concern').map((r) => [r.id, r]));
  const attached = new Set();
  decision.attachedConcerns.forEach((c, i) => {
    const at = `${path}.attachedConcerns[${i}]`;
    if (attached.has(c.responseId)) throw new S.SchemaError(`${at}.responseId`, `“${c.responseId}” is attached more than once`);
    attached.add(c.responseId);
    const source = concerns.get(c.responseId);
    if (!source) throw new S.SchemaError(`${at}.responseId`, `“${c.responseId}” is not a concern in this record`);
    const same =
      source.optionId === c.optionId &&
      source.reason === c.reason &&
      source.author.kind === c.author.kind &&
      source.author.label === c.author.label;
    if (!same) throw new S.SchemaError(at, 'differs from the concern it was copied from');
  });
  for (const id of concerns.keys()) {
    if (!attached.has(id)) {
      throw new S.SchemaError(`${path}.attachedConcerns`, `is missing the concern “${id}”; every concern is attached when a decision is recorded`);
    }
  }
}

// Whether the body that owns a commitment has publicly responded in time.
export function commitmentStatus(commitment, decision, today) {
  if (commitment.responseRecorded || decision?.commitmentId === commitment.id) return { kind: 'responded' };
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${commitment.responseDue}T00:00:00Z`)) / 86_400_000);
  return days > 0 ? { kind: 'overdue', days } : { kind: 'awaiting', days: -days };
}
