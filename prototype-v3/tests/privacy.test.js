import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPublicBundle } from '../js/bundle.js';
import * as M from '../js/model.js';
import { NOW, withDraft } from './helpers.js';

const exportText = (state) => JSON.stringify(buildPublicBundle(state, { now: NOW }));

test('a private draft never appears in the public export', () => {
  const { state, draft } = withDraft();
  const text = exportText(state);
  for (const secret of ['PRIVATE-HARD', 'PRIVATE-DIFFERENT', 'PRIVATE-PROTECT', draft.id]) {
    assert.ok(!text.includes(secret), `export leaked ${secret}`);
  }
});

test('bookmarks stay private and are not exported', () => {
  const state = M.toggleBookmark(M.emptyState(), 'asp-first-day');
  assert.deepEqual(state.bookmarks, ['asp-first-day']);
  assert.ok(!exportText(state).includes('bookmark'));
});

test('sharing creates a separate record containing only the reviewed text', () => {
  const { state, draft } = withDraft();
  const { state: shared, record } = M.shareDraft(state, draft.id, {
    title: 'Sign-up I can finish myself',
    hard: 'Sign-up needs sighted help.',
    different: 'I can sign up with a keyboard.',
    protect: '',
    confirm: true,
  });
  assert.notEqual(record.id, draft.id);
  assert.equal(record.inspiredBy, 'asp-screen-reader-signup', 'public provenance is kept');
  assert.deepEqual(record.author, M.LOCAL_AUTHOR);

  const text = exportText(shared);
  assert.ok(text.includes('Sign-up I can finish myself'));
  for (const secret of ['PRIVATE-HARD', 'PRIVATE-PROTECT', draft.id]) assert.ok(!text.includes(secret));

  // Later edits to the private draft do not flow into the shared copy.
  const { state: edited } = M.saveDraft(
    shared,
    { ...draft, hard: 'PRIVATE-EDIT something new' },
    { now: NOW, editingId: draft.id },
  );
  assert.ok(!exportText(edited).includes('PRIVATE-EDIT'));
});

test('sharing requires explicit confirmation', () => {
  const { state, draft } = withDraft();
  assert.throws(
    () => M.shareDraft(state, draft.id, { title: 'T', hard: 'h', different: 'd', protect: '', confirm: false }),
    (e) => e instanceof M.FieldErrors && 'confirm' in e.errors,
  );
});

test('deleting one draft keeps other demo state; withdrawing removes the shared copy from export', () => {
  const first = withDraft();
  const second = withDraft(first.state, { hard: 'Second draft about hosting', topic: 'hosting', inspiredBy: null });
  const { state: shared, record } = M.shareDraft(second.state, first.draft.id, {
    title: 'Shared title',
    hard: 'h text',
    different: 'd text',
    protect: '',
    confirm: true,
  });
  const withResponse = M.setResponse(shared, { optionId: 'option-keep-current', stance: 'support', reason: '' });

  const afterDelete = M.deleteDraft(withResponse, first.draft.id);
  assert.deepEqual(afterDelete.drafts.map((d) => d.id), [second.draft.id]);
  assert.equal(afterDelete.shared.length, 1, 'the separate shared record is not silently deleted');
  assert.equal(afterDelete.responses.length, 1);

  const withdrawn = M.withdrawShared(afterDelete, record.id);
  assert.ok(!exportText(withdrawn).includes(record.id));
});

test('withdrawing a shared copy that inspired another keeps the export valid', () => {
  const share = (state, draftId, title) =>
    M.shareDraft(state, draftId, { title, hard: 'hard text', different: 'different text', protect: '', confirm: true });
  const first = withDraft();
  const x = share(first.state, first.draft.id, 'First shared');
  const second = withDraft(x.state, { inspiredBy: x.record.id });
  const y = share(second.state, second.draft.id, 'Second shared');
  assert.equal(y.record.inspiredBy, x.record.id);

  const withdrawn = M.withdrawShared(y.state, x.record.id);
  assert.equal(withdrawn.shared[0].inspiredBy, null);
  assert.equal(withdrawn.shared[0].inspirationWithdrawn, true, 'the withdrawal is shown, not hidden');
  assert.doesNotThrow(() => buildPublicBundle(withdrawn, { now: NOW }));
});

test('draft validation reports each missing field', () => {
  assert.throws(
    () => M.saveDraft(M.emptyState(), { hard: '  ', different: '', topic: 'nonsense' }),
    (e) => e instanceof M.FieldErrors && ['hard', 'different', 'topic'].every((k) => k in e.errors),
  );
});
