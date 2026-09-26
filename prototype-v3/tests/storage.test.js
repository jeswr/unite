import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as M from '../js/model.js';
import { STORAGE_KEY, UNREADABLE_KEY, clearState, loadState, resolveStorage, saveState } from '../js/storage.js';
import { FakeStorage, NOW, validDecision, withDraft } from './helpers.js';

test('state survives a save and load unchanged', () => {
  const storage = new FakeStorage();
  const { state } = withDraft();
  const decided = M.recordDecision(M.toggleBookmark(state, 'asp-first-day'), validDecision(), { now: NOW });
  assert.deepEqual(saveState(storage, decided), { ok: true });
  const loaded = loadState(storage);
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.skipped, 0);
  assert.deepEqual(loaded.state, decided);
});

test('first visit starts fresh', () => {
  assert.equal(loadState(new FakeStorage()).status, 'fresh');
});

test('unreadable storage starts fresh and keeps the unreadable text aside', () => {
  const storage = new FakeStorage();
  storage.setItem(STORAGE_KEY, '{"storageVersion":1, broken');
  const loaded = loadState(storage);
  assert.equal(loaded.status, 'unreadable');
  assert.deepEqual(loaded.state, M.emptyState());
  assert.equal(storage.getItem(UNREADABLE_KEY), '{"storageVersion":1, broken');

  storage.setItem(STORAGE_KEY, JSON.stringify({ storageVersion: 99 }));
  assert.equal(loadState(storage).status, 'unreadable');
});

test('blocked storage is detected and the demo runs in memory', () => {
  const blocked = () => {
    throw new Error('SecurityError');
  };
  assert.equal(resolveStorage(blocked), null);
  assert.equal(loadState(null).status, 'unavailable');
  assert.deepEqual(saveState(null, M.emptyState()), { ok: false, reason: 'unavailable' });
  assert.deepEqual(saveState(new FakeStorage({ failWrites: true }), M.emptyState()), { ok: false, reason: 'write-failed' });
});

test('tampered records are dropped individually; valid drafts survive', () => {
  const storage = new FakeStorage();
  const { state, draft } = withDraft();
  const tampered = {
    ...state,
    drafts: [...state.drafts, { id: 'draft-bad', hard: 42 }],
    shared: [
      { id: 'asp-first-day', title: 'Impersonates a seed', topic: 'onboarding', horizon: 'none', hard: 'h', different: 'd', protect: '', inspiredBy: null, author: M.LOCAL_AUTHOR },
      { id: 'asp-local-x1', title: 'Pretends to be seed', topic: 'onboarding', horizon: 'none', hard: 'h', different: 'd', protect: '', inspiredBy: null, author: { kind: 'seed', label: 'Fake (fictional)' } },
    ],
    bookmarks: ['asp-first-day', 'asp-does-not-exist'],
    responses: [
      { id: 'response-local-a1', optionId: 'option-missing', stance: 'support', reason: '', author: M.LOCAL_AUTHOR },
      { id: 'response-local-a2', optionId: 'option-keep-current', stance: 'concern', reason: 'kept', author: M.LOCAL_AUTHOR },
    ],
    delivery: { commitmentId: 'commitment-pilot-response', history: [{ state: 'delivered', at: '2026-09-01T09:00:00Z', evidence: 'skipped ahead' }] },
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(tampered));
  const loaded = loadState(storage);
  assert.equal(loaded.status, 'loaded');
  assert.deepEqual(loaded.state.drafts.map((d) => d.id), [draft.id]);
  assert.deepEqual(loaded.state.shared, []);
  assert.deepEqual(loaded.state.bookmarks, ['asp-first-day']);
  assert.deepEqual(loaded.state.responses.map((r) => r.id), ['response-local-a2']);
  assert.deepEqual(loaded.state.delivery, M.initialDelivery());
  assert.ok(loaded.skipped >= 5);
});

// ----- independent-review regressions ---------------------------------------

const share = (state, draftId, title) =>
  M.shareDraft(state, draftId, { title, hard: 'hard text', different: 'different text', protect: '', confirm: true });

function decidedAfterWithdrawal() {
  const a = withDraft();
  const sharedA = share(a.state, a.draft.id, 'Shared A');
  const b = withDraft(sharedA.state, { inspiredBy: sharedA.record.id });
  const sharedB = share(b.state, b.draft.id, 'Shared B');
  let state = M.setResponse(sharedB.state, { optionId: 'option-onboarding-kit', stance: 'concern', reason: 'Local concern' });
  state = M.recordDecision(state, validDecision(), { now: NOW });
  return { state, withdrawnId: sharedA.record.id, keptId: sharedB.record.id };
}

test('withdraw → save → reload keeps the decision, concerns, trail and public records', () => {
  const { state, withdrawnId, keptId } = decidedAfterWithdrawal();
  const withdrawn = M.withdrawShared(state, withdrawnId);
  const storage = new FakeStorage();
  saveState(storage, withdrawn);
  const loaded = loadState(storage);
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.skipped, 0);
  assert.equal(loaded.decisionDropped, false);
  assert.equal(loaded.publicReset, false);
  assert.deepEqual(loaded.state, withdrawn);
  assert.equal(loaded.state.decision.attachedConcerns.length, 4);
  assert.deepEqual(loaded.state.shared.map((x) => [x.id, x.inspiredBy, x.inspirationWithdrawn]), [[keptId, null, true]]);
});

test('a dangling inspiration link saved by an older version is repaired, not wiped', () => {
  const { state, withdrawnId, keptId } = decidedAfterWithdrawal();
  // Simulate the old bug: A removed, B still pointing at it.
  const legacy = structuredClone(state);
  legacy.shared = legacy.shared.filter((x) => x.id !== withdrawnId);
  delete legacy.shared[0].inspirationWithdrawn;
  const storage = new FakeStorage();
  saveState(storage, legacy);
  const loaded = loadState(storage);
  assert.equal(loaded.skipped, 0);
  assert.equal(loaded.publicReset, false);
  assert.equal(loaded.state.decision.id, state.decision.id);
  assert.equal(loaded.state.responses.length, 1);
  assert.equal(loaded.state.shared[0].id, keptId);
  assert.equal(loaded.state.shared[0].inspiredBy, null);
  assert.equal(loaded.state.shared[0].inspirationWithdrawn, true);
});

test('stored records with forged labels or reused identifiers are dropped individually', () => {
  const { state } = decidedAfterWithdrawal();
  const forged = structuredClone(state);
  forged.questions = [
    { id: 'question-local-a1', text: 'A forged question text', to: 'anyone', optionId: null, status: 'open', author: { kind: 'local', label: 'Sam (fictional)' } },
    { id: 'question-local-a2', text: 'A genuine question text', to: 'anyone', optionId: null, status: 'open', author: M.LOCAL_AUTHOR },
    { id: 'question-local-a2', text: 'Duplicate identifier', to: 'anyone', optionId: null, status: 'open', author: M.LOCAL_AUTHOR },
  ];
  const storage = new FakeStorage();
  saveState(storage, forged);
  const loaded = loadState(storage);
  assert.deepEqual(loaded.state.questions.map((q) => q.text), ['A genuine question text']);
  assert.equal(loaded.skipped, 2);
  assert.ok(loaded.state.decision, 'the decision is unaffected');
});

test('a stored decision that disagrees with its concerns is removed and reported, other records kept', () => {
  const { state } = decidedAfterWithdrawal();
  const tampered = structuredClone(state);
  tampered.decision.attachedConcerns.pop();
  const storage = new FakeStorage();
  saveState(storage, tampered);
  const loaded = loadState(storage);
  assert.equal(loaded.decisionDropped, true);
  assert.equal(loaded.publicReset, false);
  assert.equal(loaded.state.decision, null);
  assert.deepEqual(loaded.state.delivery, M.initialDelivery());
  assert.equal(loaded.state.shared.length, 2);
  assert.equal(loaded.state.responses.length, 1);
});

test('reset clears both the demo state and any unreadable copy', () => {
  const storage = new FakeStorage();
  storage.setItem(STORAGE_KEY, 'x');
  storage.setItem(UNREADABLE_KEY, 'y');
  storage.setItem('someone-else', 'z');
  clearState(storage);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem(UNREADABLE_KEY), null);
  assert.equal(storage.getItem('someone-else'), 'z', 'reset only touches this demo');
});
