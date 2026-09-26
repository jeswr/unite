// Vocabulary, limits and record validators shared by the app, the reader,
// local persistence and the tests. Validators never trust their input: each
// returns a fresh object containing only known fields, or throws SchemaError.

export const SCHEMA_VERSION = 1;
export const BUNDLE_FORMAT = 'unite-demo-public-bundle';
export const STORAGE_VERSION = 1;

export const LIMITS = {
  title: 120,
  label: 120,
  body: 1200,
  reason: 1000,
  listItems: 20,
  records: 500,
  bundleBytes: 512 * 1024,
  budget: 10_000_000,
};

export const TOPICS = {
  accessibility: 'Accessibility',
  switching: 'Switching providers',
  onboarding: 'Getting started',
  hosting: 'Hosting costs',
  privacy: 'Privacy and control',
  collaboration: 'Working together',
};

export const HORIZONS = {
  none: 'No particular time',
  year: 'Within a year',
  'five-years': 'In one to five years',
  longer: 'Longer term',
};

export const STANCES = {
  support: 'Could support',
  concern: 'Have a concern',
  info: 'Need information',
};

export const CLAIM_KINDS = {
  fact: 'Factual claim',
  estimate: 'Estimate',
  value: 'Value choice',
};

export const RELATIVE_COSTS = {
  none: 'No new spending',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const AUTHOR_KINDS = {
  seed: 'Fictional person',
  local: 'Participant in this browser',
  'expert-role': 'Fictional expert role',
};

// A decision *allocates* a budget. The budget holder later *confirms* that the
// funds will be released, which is the "resources-committed" step of the trail.
// The stored keys are unchanged; only the wording separates the two.
export const DELIVERY_STATES = {
  proposed: 'Proposed',
  'decision-recorded': 'Decision recorded',
  'resources-committed': 'Funds confirmed',
  'in-progress': 'In progress',
  delivered: 'Delivered',
  evaluated: 'Evaluated',
};
export const DELIVERY_ORDER = Object.keys(DELIVERY_STATES);

export const FUNDING_KINDS = { budget: 'Budget allocated', none: 'No budget allocated' };
export const DEFER = 'defer';

export class SchemaError extends Error {
  constructor(path, detail) {
    super(`${path}: ${detail}`);
    this.name = 'SchemaError';
    this.path = path;
    this.detail = detail;
  }
}

// C0 controls (except tab/newline/CR), DEL, and bidirectional overrides that
// can visually disguise text.
const UNSAFE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/;
const ID_PATTERN = /^[a-z][a-z0-9-]{1,79}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function object(value, path) {
  if (!isPlainObject(value)) throw new SchemaError(path, 'expected an object');
  return value;
}

export function text(value, path, { max, min = 1, optional = false }) {
  if (optional && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string') throw new SchemaError(path, 'expected text');
  const trimmed = value.trim();
  if (optional && trimmed === '') return '';
  if (trimmed.length === 0) throw new SchemaError(path, 'must not be empty');
  if (trimmed.length < min) throw new SchemaError(path, `must be at least ${min} characters`);
  if (trimmed.length > max) throw new SchemaError(path, `must be at most ${max} characters`);
  if (UNSAFE_CHARS.test(trimmed)) {
    throw new SchemaError(path, 'contains control or text-direction characters that are not allowed');
  }
  return trimmed;
}

export function id(value, path) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new SchemaError(path, 'expected an identifier of lowercase letters, digits and hyphens');
  }
  return value;
}

export function nullableId(value, path) {
  return value === null || value === undefined ? null : id(value, path);
}

export function oneOf(value, path, vocabulary) {
  if (typeof value !== 'string' || !Object.hasOwn(vocabulary, value)) {
    throw new SchemaError(path, `expected one of: ${Object.keys(vocabulary).join(', ')}`);
  }
  return value;
}

export function list(value, path, max, each) {
  if (!Array.isArray(value)) throw new SchemaError(path, 'expected a list');
  if (value.length > max) throw new SchemaError(path, `has more than ${max} entries`);
  return value.map((item, index) => each(item, `${path}[${index}]`));
}

// Date.parse rolls impossible dates over (2026-02-31 becomes 3 March), so the
// parsed value must print back as the same calendar date and time.
function isRealInstant(value, prefix) {
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(prefix);
}

export function date(value, path) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || !isRealInstant(`${value}T00:00:00Z`, value)) {
    throw new SchemaError(path, 'must be a date like 2026-11-30');
  }
  return value;
}

export function datetime(value, path) {
  if (typeof value !== 'string' || !DATETIME_PATTERN.test(value) || !isRealInstant(value, value.slice(0, 19))) {
    throw new SchemaError(path, 'expected a UTC timestamp like 2026-09-26T10:00:00Z');
  }
  return value;
}

export function wholeNumber(value, path, { min, max }) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new SchemaError(path, `must be a whole number from ${min.toLocaleString('en-GB')} to ${max.toLocaleString('en-GB')}`);
  }
  return value;
}

function bool(value, path) {
  if (typeof value !== 'boolean') throw new SchemaError(path, 'expected true or false');
  return value;
}

const textList = (value, path) => list(value, path, LIMITS.listItems, (item, p) => text(item, p, { max: LIMITS.body }));

// ----- record validators ---------------------------------------------------

export function author(value, path) {
  object(value, path);
  return {
    kind: oneOf(value.kind, `${path}.kind`, AUTHOR_KINDS),
    label: text(value.label, `${path}.label`, { max: LIMITS.label }),
  };
}

// `inspirationWithdrawn` records that the description this one was inspired by
// was later withdrawn: the link is gone, but the fact of it is not hidden.
export function aspiration(value, path) {
  object(value, path);
  const inspiredBy = nullableId(value.inspiredBy, `${path}.inspiredBy`);
  const inspirationWithdrawn =
    value.inspirationWithdrawn === undefined ? false : bool(value.inspirationWithdrawn, `${path}.inspirationWithdrawn`);
  if (inspiredBy && inspirationWithdrawn) {
    throw new SchemaError(`${path}.inspirationWithdrawn`, 'cannot be true while the inspiration link is still present');
  }
  return {
    id: id(value.id, `${path}.id`),
    title: text(value.title, `${path}.title`, { max: LIMITS.title }),
    topic: oneOf(value.topic, `${path}.topic`, TOPICS),
    horizon: oneOf(value.horizon, `${path}.horizon`, HORIZONS),
    hard: text(value.hard, `${path}.hard`, { max: LIMITS.body }),
    different: text(value.different, `${path}.different`, { max: LIMITS.body }),
    protect: text(value.protect, `${path}.protect`, { max: LIMITS.body, optional: true }),
    inspiredBy,
    inspirationWithdrawn,
    author: author(value.author, `${path}.author`),
  };
}

export function option(value, path) {
  object(value, path);
  return {
    id: id(value.id, `${path}.id`),
    title: text(value.title, `${path}.title`, { max: LIMITS.title }),
    summary: text(value.summary, `${path}.summary`, { max: LIMITS.body }),
    relativeCost: oneOf(value.relativeCost, `${path}.relativeCost`, RELATIVE_COSTS),
    costEstimate: text(value.costEstimate, `${path}.costEstimate`, { max: LIMITS.title }),
    benefits: textList(value.benefits, `${path}.benefits`),
    tradeoffs: textList(value.tradeoffs, `${path}.tradeoffs`),
    evidenceNeeded: textList(value.evidenceNeeded, `${path}.evidenceNeeded`),
    worseOff: textList(value.worseOff, `${path}.worseOff`),
  };
}

export function proposal(value, path) {
  object(value, path);
  return {
    id: id(value.id, `${path}.id`),
    title: text(value.title, `${path}.title`, { max: LIMITS.title }),
    question: text(value.question, `${path}.question`, { max: LIMITS.body }),
    remit: text(value.remit, `${path}.remit`, { max: LIMITS.body }),
    options: list(value.options, `${path}.options`, 10, option),
  };
}

export function claim(value, path) {
  object(value, path);
  return {
    id: id(value.id, `${path}.id`),
    kind: oneOf(value.kind, `${path}.kind`, CLAIM_KINDS),
    text: text(value.text, `${path}.text`, { max: LIMITS.body }),
    basis: text(value.basis, `${path}.basis`, { max: LIMITS.body }),
  };
}

export function expert(value, path) {
  object(value, path);
  return {
    id: id(value.id, `${path}.id`),
    role: text(value.role, `${path}.role`, { max: LIMITS.title }),
    advisesOn: text(value.advisesOn, `${path}.advisesOn`, { max: LIMITS.body }),
    interest: text(value.interest, `${path}.interest`, { max: LIMITS.body }),
  };
}

export function question(value, path) {
  object(value, path);
  return {
    id: id(value.id, `${path}.id`),
    text: text(value.text, `${path}.text`, { max: LIMITS.reason }),
    to: id(value.to, `${path}.to`),
    optionId: nullableId(value.optionId, `${path}.optionId`),
    status: oneOf(value.status, `${path}.status`, { open: 'Open' }),
    author: author(value.author, `${path}.author`),
  };
}

export function response(value, path) {
  object(value, path);
  return {
    id: id(value.id, `${path}.id`),
    optionId: id(value.optionId, `${path}.optionId`),
    stance: oneOf(value.stance, `${path}.stance`, STANCES),
    reason: text(value.reason, `${path}.reason`, { max: LIMITS.reason, optional: true }),
    author: author(value.author, `${path}.author`),
  };
}

export function commitment(value, path) {
  object(value, path);
  return {
    id: id(value.id, `${path}.id`),
    title: text(value.title, `${path}.title`, { max: LIMITS.title }),
    owner: text(value.owner, `${path}.owner`, { max: LIMITS.label }),
    authority: text(value.authority, `${path}.authority`, { max: LIMITS.body }),
    proposedBudget:
      value.proposedBudget === null
        ? null
        : wholeNumber(value.proposedBudget, `${path}.proposedBudget`, { min: 0, max: LIMITS.budget }),
    responseDue: date(value.responseDue, `${path}.responseDue`),
    decisionRule: text(value.decisionRule, `${path}.decisionRule`, { max: LIMITS.body }),
    responseRecorded: bool(value.responseRecorded, `${path}.responseRecorded`),
  };
}

export function funding(value, path) {
  object(value, path);
  const kind = oneOf(value.kind, `${path}.kind`, FUNDING_KINDS);
  if (kind === 'none') return { kind, amount: null };
  return { kind, amount: wholeNumber(value.amount, `${path}.amount`, { min: 1, max: LIMITS.budget }) };
}

// A copy of a concern taken when a decision is recorded, so the concern stays
// attached to the decision even if the original response later changes.
export function attachedConcern(value, path) {
  object(value, path);
  return {
    responseId: id(value.responseId, `${path}.responseId`),
    optionId: id(value.optionId, `${path}.optionId`),
    reason: text(value.reason, `${path}.reason`, { max: LIMITS.reason, optional: true }),
    author: author(value.author, `${path}.author`),
  };
}

export function decision(value, path) {
  object(value, path);
  return {
    id: id(value.id, `${path}.id`),
    commitmentId: id(value.commitmentId, `${path}.commitmentId`),
    outcome: id(value.outcome, `${path}.outcome`),
    owner: text(value.owner, `${path}.owner`, { max: LIMITS.label }),
    authority: text(value.authority, `${path}.authority`, { max: LIMITS.body }),
    reasons: text(value.reasons, `${path}.reasons`, { max: LIMITS.body, min: 20 }),
    decidedOn: date(value.decidedOn, `${path}.decidedOn`),
    funding: funding(value.funding, `${path}.funding`),
    attachedConcerns: list(value.attachedConcerns, `${path}.attachedConcerns`, LIMITS.records, attachedConcern),
    recordedAt: datetime(value.recordedAt, `${path}.recordedAt`),
  };
}

export function deliveryStep(value, path) {
  object(value, path);
  return {
    state: oneOf(value.state, `${path}.state`, DELIVERY_STATES),
    at: datetime(value.at, `${path}.at`),
    evidence: text(value.evidence, `${path}.evidence`, { max: LIMITS.body }),
  };
}

export function delivery(value, path) {
  object(value, path);
  return {
    commitmentId: id(value.commitmentId, `${path}.commitmentId`),
    history: list(value.history, `${path}.history`, DELIVERY_ORDER.length, deliveryStep),
  };
}

// A private draft. Only ever stored locally; never part of any bundle.
export function draft(value, path) {
  object(value, path);
  return {
    id: id(value.id, `${path}.id`),
    topic: oneOf(value.topic, `${path}.topic`, TOPICS),
    horizon: oneOf(value.horizon, `${path}.horizon`, HORIZONS),
    hard: text(value.hard, `${path}.hard`, { max: LIMITS.body }),
    different: text(value.different, `${path}.different`, { max: LIMITS.body }),
    protect: text(value.protect, `${path}.protect`, { max: LIMITS.body, optional: true }),
    inspiredBy: nullableId(value.inspiredBy, `${path}.inspiredBy`),
    sharedId: nullableId(value.sharedId, `${path}.sharedId`),
    createdAt: datetime(value.createdAt, `${path}.createdAt`),
    updatedAt: datetime(value.updatedAt, `${path}.updatedAt`),
  };
}
