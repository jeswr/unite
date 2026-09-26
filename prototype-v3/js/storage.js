// Local persistence. Storage may be missing, full, blocked or hold data that
// was edited by hand; none of those should break the demo.

import * as S from './schema.js';
import { buildPublicBundle } from './bundle.js';
import {
  ANYONE,
  LOCAL_AUTHOR,
  checkDecisionConsistency,
  checkDeliveryHistory,
  emptyState,
  initialDelivery,
  markInspirationWithdrawn,
} from './model.js';
import { ASPIRATIONS, CLAIMS, COMMITMENTS, EXPERTS, MAIN_COMMITMENT_ID, PROPOSAL, QUESTIONS, RESPONSES } from './seed.js';

// The learning example uses its own keys. Data saved by the earlier example
// (different options, amounts in euros) stays under the legacy keys, untouched:
// it is never read into this example, rewritten or deleted, not even by reset.
export const STORAGE_KEY = 'unite-demo-learning-example';
export const UNREADABLE_KEY = 'unite-demo-learning-example-unreadable';
export const LEGACY_KEYS = Object.freeze(['unite-demo-v3', 'unite-demo-v3-unreadable']);

// Only checks whether earlier-example data exists, so the page can explain
// why it is not shown. Never parses or changes it.
export function hasLegacyData(storage) {
  if (!storage) return false;
  try {
    return LEGACY_KEYS.some((key) => storage.getItem(key) !== null);
  } catch {
    return false;
  }
}

// Returns a usable Storage, or null when the browser blocks it.
export function resolveStorage(getStorage) {
  try {
    const storage = getStorage();
    const probe = `${STORAGE_KEY}-probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

// status: 'unavailable' | 'fresh' | 'loaded' | 'unreadable'
// skipped: number of stored records dropped because they failed validation.
export function loadState(storage) {
  if (!storage) return { state: emptyState(), status: 'unavailable', skipped: 0 };
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: emptyState(), status: 'unavailable', skipped: 0 };
  }
  if (raw === null) return { state: emptyState(), status: 'fresh', skipped: 0 };
  try {
    const parsed = JSON.parse(raw);
    if (!S.isPlainObject(parsed) || parsed.storageVersion !== S.STORAGE_VERSION) throw new Error('unknown shape');
    return { ...normalizeStoredState(parsed), status: 'loaded' };
  } catch {
    // Keep the unreadable text aside so it is not silently destroyed by the
    // next save; a reset removes it.
    try {
      storage.setItem(UNREADABLE_KEY, raw);
    } catch {
      /* nothing more we can do */
    }
    return { state: emptyState(), status: 'unreadable', skipped: 0 };
  }
}

export function saveState(storage, state) {
  if (!storage) return { ok: false, reason: 'unavailable' };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'write-failed' };
  }
}

export function clearState(storage) {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(UNREADABLE_KEY);
  } catch {
    /* storage vanished; the in-memory state is reset anyway */
  }
}

function keepValid(value, validate) {
  if (!Array.isArray(value)) return { kept: [], skipped: 0 };
  const kept = [];
  let skipped = 0;
  for (const item of value.slice(0, S.LIMITS.records)) {
    try {
      kept.push(validate(item, 'stored'));
    } catch {
      skipped += 1;
    }
  }
  return { kept, skipped: skipped + Math.max(0, value.length - S.LIMITS.records) };
}

// Rebuilds state from stored JSON, dropping anything invalid or dangling.
// decisionDropped: a stored decision failed its consistency checks.
// publicReset: the last-resort check failed and all public records were cleared.
export function normalizeStoredState(parsed) {
  const state = emptyState();
  let skipped = 0;
  let decisionDropped = false;
  let publicReset = false;
  const take = (key, validate) => {
    const result = keepValid(parsed[key], validate);
    skipped += result.skipped;
    return result.kept;
  };
  const seedIds = new Set(seedRecordIds());
  const localIds = new Set();
  const localAuthorOnly = (validate) => (item, path) => {
    const record = validate(item, path);
    if (record.author.kind !== LOCAL_AUTHOR.kind || record.author.label !== LOCAL_AUTHOR.label) {
      throw new S.SchemaError(path, 'is not attributed to this browser');
    }
    if (seedIds.has(record.id)) throw new S.SchemaError(path, 'reuses a seed identifier');
    if (localIds.has(record.id)) throw new S.SchemaError(path, 'reuses an identifier');
    localIds.add(record.id);
    return record;
  };

  state.shared = take('shared', localAuthorOnly(S.aspiration));
  const publicIds = new Set([...ASPIRATIONS, ...state.shared].map((a) => a.id));
  const sharedIds = new Set(state.shared.map((a) => a.id));
  const optionIds = new Set(PROPOSAL.options.map((o) => o.id));
  // A link to a description that is no longer here (withdrawn under an older
  // version of the demo) is repaired, not a reason to drop the record.
  for (const a of state.shared) if (a.inspiredBy && !publicIds.has(a.inspiredBy)) markInspirationWithdrawn(a, a.inspiredBy);

  state.drafts = take('drafts', S.draft).map((d) => ({
    ...d,
    inspiredBy: d.inspiredBy && publicIds.has(d.inspiredBy) ? d.inspiredBy : null,
    sharedId: d.sharedId && sharedIds.has(d.sharedId) ? d.sharedId : null,
  }));
  const bookmarks = take('bookmarks', S.id);
  state.bookmarks = [...new Set(bookmarks)].filter((b) => publicIds.has(b));
  skipped += bookmarks.length - state.bookmarks.length;

  const seenOptions = new Set();
  const responses = take('responses', localAuthorOnly(S.response));
  state.responses = responses.filter((r) => {
    if (!optionIds.has(r.optionId) || seenOptions.has(r.optionId)) return false;
    seenOptions.add(r.optionId);
    return true;
  });
  skipped += responses.length - state.responses.length;
  const recipients = new Set([...EXPERTS.map((e) => e.id), ANYONE]);
  const questions = take('questions', localAuthorOnly(S.question));
  state.questions = questions.filter((q) => recipients.has(q.to) && (q.optionId === null || optionIds.has(q.optionId)));
  skipped += questions.length - state.questions.length;

  try {
    state.decision = parsed.decision === null || parsed.decision === undefined ? null : S.decision(parsed.decision, 'stored');
    state.delivery = S.delivery(parsed.delivery, 'stored');
    if (state.delivery.commitmentId !== MAIN_COMMITMENT_ID) throw new S.SchemaError('stored.delivery', 'follows another commitment');
    checkDeliveryHistory(state.delivery, state.decision);
    if (state.decision) {
      checkDecisionConsistency(state.decision, {
        proposal: PROPOSAL,
        commitments: COMMITMENTS,
        responses: [...RESPONSES, ...state.responses],
        delivery: state.delivery,
      });
    }
  } catch {
    decisionDropped = parsed.decision !== null && parsed.decision !== undefined;
    state.decision = null;
    state.delivery = initialDelivery();
    skipped += 1;
  }

  // Last resort, reached only if the repairs above missed something: whatever
  // survived must still form a valid public bundle, otherwise export would
  // fail later. Private drafts are kept, and the reset is reported.
  try {
    buildPublicBundle(state);
  } catch {
    publicReset = true;
    decisionDropped ||= Boolean(state.decision);
    skipped += state.shared.length + state.responses.length + state.questions.length + (state.decision ? 1 : 0);
    Object.assign(state, { shared: [], responses: [], questions: [], bookmarks: [], decision: null, delivery: initialDelivery() });
    state.drafts = state.drafts.map((d) => ({ ...d, sharedId: null }));
  }
  return { state, skipped, decisionDropped, publicReset };
}

function seedRecordIds() {
  return [PROPOSAL, ...PROPOSAL.options, ...ASPIRATIONS, ...CLAIMS, ...EXPERTS, ...QUESTIONS, ...RESPONSES, ...COMMITMENTS].map(
    (r) => r.id,
  );
}
