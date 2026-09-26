// The public export bundle: what this demo would share with a community.
// Built by allow-listing public record types; private drafts and bookmarks are
// never read here. The same validator guards the reader's import.

import * as S from './schema.js';
import { LOCAL_AUTHOR, checkDecisionConsistency, checkDeliveryHistory } from './model.js';
import { ASPIRATIONS, CLAIMS, COMMITMENTS, EXPERTS, PROPOSAL, QUESTIONS, RESPONSES } from './seed.js';

// The disclosures are part of the format, not of the file: an import whose
// notice differs is rejected, so the reader only ever shows this text.
export const NOTICE = Object.freeze({
  fictionalSeed:
    'All seeded people, expert roles, support, budgets, dates and commitments are fictional and were written for this demo.',
  userAuthored:
    'Records attributed to “Participant in this browser” were written by whoever used the demo and chose to add them.',
  scope:
    'This file comes from a local browser demo. It was not sent to any community, is not a vote or a representative sample, and does not use Solid or ActivityPub.',
});

const TOP_LEVEL_KEYS = [
  'format',
  'schemaVersion',
  'exportedAt',
  'notice',
  'proposal',
  'aspirations',
  'claims',
  'experts',
  'questions',
  'responses',
  'commitments',
  'decision',
  'delivery',
];

const recordList = (value, path, each) => S.list(value, path, S.LIMITS.records, each);

export function buildPublicBundle(state, { now = Date.now() } = {}) {
  const decided = state.decision?.commitmentId;
  const draft = {
    format: S.BUNDLE_FORMAT,
    schemaVersion: S.SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    notice: { ...NOTICE },
    proposal: PROPOSAL,
    aspirations: [...ASPIRATIONS, ...state.shared],
    claims: CLAIMS,
    experts: EXPERTS,
    questions: [...QUESTIONS, ...state.questions],
    responses: [...RESPONSES, ...state.responses],
    commitments: COMMITMENTS.map((c) => ({ ...c, responseRecorded: c.responseRecorded || c.id === decided })),
    decision: state.decision,
    delivery: state.delivery,
  };
  // Running the export through the import validator strips any field that is
  // not part of the public schema and guarantees the reader can open it.
  return validateBundle(draft);
}

export function validateBundle(value) {
  S.object(value, 'bundle');
  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.includes(key)) throw new S.SchemaError(`bundle.${key}`, 'is not part of a public bundle');
  }
  if (value.format !== S.BUNDLE_FORMAT) {
    throw new S.SchemaError('bundle.format', `expected “${S.BUNDLE_FORMAT}”; this is not a Unite demo export`);
  }
  if (value.schemaVersion !== S.SCHEMA_VERSION) {
    throw new S.SchemaError('bundle.schemaVersion', `expected ${S.SCHEMA_VERSION}; this reader only understands version ${S.SCHEMA_VERSION}`);
  }
  S.object(value.notice, 'bundle.notice');
  for (const [key, text] of Object.entries(NOTICE)) {
    if (value.notice[key] !== text) {
      throw new S.SchemaError(`bundle.notice.${key}`, 'differs from the built-in demo disclosure, so the file cannot be trusted to describe itself');
    }
  }
  const bundle = {
    format: value.format,
    schemaVersion: value.schemaVersion,
    exportedAt: S.datetime(value.exportedAt, 'bundle.exportedAt'),
    notice: { ...NOTICE },
    proposal: S.proposal(value.proposal, 'bundle.proposal'),
    aspirations: recordList(value.aspirations, 'bundle.aspirations', S.aspiration),
    claims: recordList(value.claims, 'bundle.claims', S.claim),
    experts: recordList(value.experts, 'bundle.experts', S.expert),
    questions: recordList(value.questions, 'bundle.questions', S.question),
    responses: recordList(value.responses, 'bundle.responses', S.response),
    commitments: recordList(value.commitments, 'bundle.commitments', S.commitment),
    decision: value.decision === null ? null : S.decision(value.decision, 'bundle.decision'),
    delivery: S.delivery(value.delivery, 'bundle.delivery'),
  };
  checkReferences(bundle);
  return bundle;
}

function checkReferences(bundle) {
  const seen = new Set();
  const records = [
    ['proposal', [bundle.proposal]],
    ['proposal.options', bundle.proposal.options],
    ['aspirations', bundle.aspirations],
    ['claims', bundle.claims],
    ['experts', bundle.experts],
    ['questions', bundle.questions],
    ['responses', bundle.responses],
    ['commitments', bundle.commitments],
  ];
  for (const [name, list] of records) {
    list.forEach((record, i) => {
      if (seen.has(record.id)) throw new S.SchemaError(`bundle.${name}[${i}].id`, `“${record.id}” is used more than once`);
      seen.add(record.id);
    });
  }
  const optionIds = new Set(bundle.proposal.options.map((o) => o.id));
  const aspirationIds = new Set(bundle.aspirations.map((a) => a.id));
  const recipients = new Set([...bundle.experts.map((e) => e.id), 'anyone']);
  const commitmentIds = new Set(bundle.commitments.map((c) => c.id));

  const mustExist = (set, ref, path, what) => {
    if (ref !== null && !set.has(ref)) throw new S.SchemaError(path, `refers to an unknown ${what} “${ref}”`);
  };
  bundle.aspirations.forEach((a, i) => mustExist(aspirationIds, a.inspiredBy, `bundle.aspirations[${i}].inspiredBy`, 'aspiration'));
  bundle.responses.forEach((r, i) => mustExist(optionIds, r.optionId, `bundle.responses[${i}].optionId`, 'option'));
  bundle.questions.forEach((q, i) => {
    mustExist(recipients, q.to, `bundle.questions[${i}].to`, 'expert role');
    mustExist(optionIds, q.optionId, `bundle.questions[${i}].optionId`, 'option');
  });
  checkAttribution(bundle);
  if (bundle.decision) {
    const { decision } = bundle;
    mustExist(commitmentIds, decision.commitmentId, 'bundle.decision.commitmentId', 'commitment');
    if (decision.outcome !== S.DEFER) mustExist(optionIds, decision.outcome, 'bundle.decision.outcome', 'option');
    if (decision.outcome === S.DEFER && decision.funding.kind === 'budget') {
      throw new S.SchemaError('bundle.decision.funding', 'a deferred decision cannot allocate a budget');
    }
    decision.attachedConcerns.forEach((c, i) =>
      mustExist(optionIds, c.optionId, `bundle.decision.attachedConcerns[${i}].optionId`, 'option'),
    );
  }
  mustExist(commitmentIds, bundle.delivery.commitmentId, 'bundle.delivery.commitmentId', 'commitment');
  checkDeliveryHistory(bundle.delivery, bundle.decision, 'bundle.delivery');
  if (bundle.decision) checkDecisionConsistency(bundle.decision, bundle, 'bundle.decision');
  bundle.commitments.forEach((c, i) => {
    if (c.responseRecorded !== (c.id === bundle.decision?.commitmentId)) {
      throw new S.SchemaError(`bundle.commitments[${i}].responseRecorded`, 'must be true exactly when this file records a decision on the commitment');
    }
  });
}

// "Fictional person" and "fictional expert role" labels are only believable on
// the built-in seed records, and there only with the built-in names. Anything
// else must carry the fixed "Participant in this browser" attribution.
const SEED_AUTHORS = new Map([...ASPIRATIONS, ...QUESTIONS, ...RESPONSES].map((r) => [r.id, r.author]));

export function expectedAuthor(recordId) {
  return SEED_AUTHORS.get(recordId) ?? LOCAL_AUTHOR;
}

function checkAttribution(bundle) {
  for (const name of ['aspirations', 'questions', 'responses']) {
    bundle[name].forEach((record, i) => {
      const expected = expectedAuthor(record.id);
      if (record.author.kind !== expected.kind || record.author.label !== expected.label) {
        const what = SEED_AUTHORS.has(record.id) ? 'the built-in fictional attribution' : `“${LOCAL_AUTHOR.label}”`;
        throw new S.SchemaError(`bundle.${name}[${i}].author`, `must be ${what}`);
      }
    });
  }
}

// Parses untrusted text. Never throws; returns a message suitable for display.
export function parseBundle(textInput) {
  if (typeof textInput !== 'string' || textInput.trim() === '') {
    return { ok: false, message: 'The file is empty. Choose a JSON file exported from the Unite demo.' };
  }
  const bytes = new TextEncoder().encode(textInput).length;
  if (bytes > S.LIMITS.bundleBytes) {
    return {
      ok: false,
      message: `The file is ${Math.ceil(bytes / 1024)} KB. Demo bundles must be under ${S.LIMITS.bundleBytes / 1024} KB.`,
    };
  }
  let value;
  try {
    value = JSON.parse(textInput);
  } catch {
    return { ok: false, message: 'The file is not valid JSON. Check that it is an unedited Unite demo export.' };
  }
  try {
    return { ok: true, bundle: validateBundle(value) };
  } catch (error) {
    if (error instanceof S.SchemaError) {
      return { ok: false, message: `The file does not match the Unite demo format. Problem at ${error.path}: ${error.detail}.` };
    }
    return { ok: false, message: 'The file could not be checked. Check that it is an unedited Unite demo export.' };
  }
}
