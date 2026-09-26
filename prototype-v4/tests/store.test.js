import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SAMPLE_POSTS } from '../server/seed.js';
import { LIMITS, Store, priorityOf, publicExport } from '../server/store.js';
import { fixedClock } from './helpers.js';

const setup = () => {
  const now = fixedClock();
  const store = new Store({ now });
  const alice = store.join({ displayName: 'Alice' });
  const bob = store.join({ displayName: 'Bob' });
  return { store, now, alice, bob };
};

const expectStatus = (fn, status, pattern) => assert.throws(fn, (error) => {
  assert.equal(error.status, status, error.message);
  if (pattern) assert.match(error.message, pattern);
  return true;
});

const actionBody = (overrides = {}) => ({
  roomId: 'work',
  expectedVersion: 1,
  title: 'Try a shift-swap board',
  firstStep: 'Ask the depot manager for a noticeboard',
  ownership: 'me',
  checkIn: '2026-10-10',
  effort: 1,
  impact: 3,
  urgency: 2,
  scope: 'community',
  ...overrides,
});

describe('samples', () => {
  it('seeds at least six labelled sample posts with no stances or actions', () => {
    const { store } = setup();
    const state = store.publicState();
    const samples = state.posts.filter((p) => p.sample);
    assert.ok(samples.length >= 6);
    assert.equal(samples.length, SAMPLE_POSTS.length);
    assert.ok(samples.every((p) => p.author.id === null));
    for (const ground of Object.values(state.grounds)) {
      assert.deepEqual(ground.tally, { support: 0, concern: 0, abstain: 0 });
      assert.equal(ground.current.sampleDraft, true);
      assert.ok(ground.current.sources.length > 0);
    }
    assert.equal(state.actions.length, 0);
  });
});

describe('posts and replies', () => {
  it('records the server-side author and rejects client-supplied authorship', () => {
    const { store, alice } = setup();
    const post = store.createPost(alice, { roomId: 'care', text: '  Care is work.  ' });
    assert.equal(post.authorId, alice.id);
    assert.equal(post.text, 'Care is work.');
    expectStatus(() => store.createPost(alice, { roomId: 'care', text: 'x', authorId: 'u_someoneelse' }), 400, /Unknown field "authorId"/);
  });

  it('only lets the author withdraw a post, and keeps replies', () => {
    const { store, alice, bob } = setup();
    const post = store.createPost(alice, { roomId: 'work', text: 'Four-day weeks?' });
    const reply = store.createPost(bob, { roomId: 'work', text: 'For whom?', replyTo: post.id });
    expectStatus(() => store.withdrawPost(bob, post.id), 403);
    store.withdrawPost(alice, post.id);
    const view = store.publicState().posts.find((p) => p.id === post.id);
    assert.equal(view.withdrawn, true);
    assert.equal(view.text, '');
    assert.ok(store.publicState().posts.some((p) => p.id === reply.id));
    expectStatus(() => store.withdrawPost(alice, post.id), 409);
  });

  it('keeps replies one level deep and inside the same room', () => {
    const { store, alice, bob } = setup();
    const post = store.createPost(alice, { roomId: 'work', text: 'Parent' });
    const reply = store.createPost(bob, { roomId: 'work', text: 'Child', replyTo: post.id });
    expectStatus(() => store.createPost(alice, { roomId: 'work', text: 'Grandchild', replyTo: reply.id }), 400, /original post/);
    expectStatus(() => store.createPost(alice, { roomId: 'care', text: 'Elsewhere', replyTo: post.id }), 400, /not in this room/);
    expectStatus(() => store.createPost(alice, { roomId: 'work', text: 'Ghost', replyTo: 'p_doesnotexist' }), 400);
  });

  it('enforces text limits and rejects control and bidi-override characters', () => {
    const { store, alice } = setup();
    expectStatus(() => store.createPost(alice, { roomId: 'work', text: '   ' }), 400, /empty/);
    expectStatus(() => store.createPost(alice, { roomId: 'work', text: 'x'.repeat(LIMITS.post + 1) }), 400, /at most/);
    expectStatus(() => store.createPost(alice, { roomId: 'work', text: 'evil‮txt' }), 400, /control/);
    expectStatus(() => store.createPost(alice, { roomId: 'work', text: 'bell\u0007' }), 400, /control/);
    expectStatus(() => store.createPost(alice, { roomId: 'nowhere', text: 'hi' }), 400);
    expectStatus(() => store.join({ displayName: 'line\nbreak' }), 400, /single line/);
  });

  it('stores markup as literal text', () => {
    const { store, alice } = setup();
    const text = '<img src=x onerror=alert(1)> & "quotes"';
    store.createPost(alice, { roomId: 'work', text });
    assert.equal(store.publicState().posts.at(-1).text, text);
  });

  it('validates responses to a possible future', () => {
    const { store, alice } = setup();
    const post = store.createPost(alice, { roomId: 'future', text: 'Too much power.', modelRef: 'global-employer', modelStance: 'critique' });
    assert.equal(post.modelRef, 'global-employer');
    expectStatus(() => store.createPost(alice, { roomId: 'future', text: 'x', modelRef: 'utopia', modelStance: 'agree' }), 400);
    expectStatus(() => store.createPost(alice, { roomId: 'future', text: 'x', modelRef: 'mixed' }), 400);
  });
});

describe('common ground', () => {
  it('keeps one current stance per participant and lets it change', () => {
    const { store, alice, bob } = setup();
    store.setStance(alice, 'work', { stance: 'support', expectedVersion: 1 });
    store.setStance(alice, 'work', { stance: 'concern', reason: 'Small firms need a say.', expectedVersion: 1 });
    store.setStance(bob, 'work', { stance: 'support', expectedVersion: 1 });
    const ground = store.publicState().grounds.work;
    assert.deepEqual(ground.tally, { support: 1, concern: 1, abstain: 0 });
    assert.equal(ground.stances.length, 2);
    assert.equal(ground.coverage.respondents, 2);
    assert.equal(ground.coverage.joined, 2);
  });

  it('requires a reason for a concern and the current version', () => {
    const { store, alice } = setup();
    expectStatus(() => store.setStance(alice, 'work', { stance: 'concern', expectedVersion: 1 }), 400);
    expectStatus(() => store.setStance(alice, 'work', { stance: 'support', expectedVersion: 2 }), 409, /version 1/);
    expectStatus(() => store.setStance(alice, 'work', { stance: 'support', expectedVersion: 1, count: 50 }), 400, /Unknown field/);
    expectStatus(() => store.setStance(alice, 'work', { stance: 'veto', expectedVersion: 1 }), 400);
  });

  it('reports post authors who have not responded', () => {
    const { store, alice, bob } = setup();
    store.createPost(alice, { roomId: 'care', text: 'Respite matters.' });
    store.createPost(bob, { roomId: 'care', text: 'So do pensions.' });
    store.setStance(bob, 'care', { stance: 'abstain', expectedVersion: 1 });
    assert.equal(store.publicState().grounds.care.coverage.postAuthorsWithoutStance, 1);
  });

  it('resets responses on revision and keeps the old version and its concerns in history', () => {
    const { store, alice, bob } = setup();
    const source = store.createPost(alice, { roomId: 'work', text: 'Predictable hours first.' });
    store.setStance(alice, 'work', { stance: 'support', expectedVersion: 1 });
    store.setStance(bob, 'work', { stance: 'concern', reason: 'Ignores the self-employed.', expectedVersion: 1 });
    const next = store.reviseStatement(bob, 'work', {
      text: 'Predictable, fairly paid work for employees and the self-employed alike.',
      differences: ['Jobs or income?'],
      sourcePostIds: [source.id],
      expectedVersion: 1,
    });
    assert.equal(next.version, 2);
    const ground = store.publicState().grounds.work;
    assert.deepEqual(ground.tally, { support: 0, concern: 0, abstain: 0 });
    assert.equal(ground.current.proposedBy.id, bob.id);
    assert.equal(ground.history.length, 1);
    const old = ground.history[0];
    assert.equal(old.version, 1);
    assert.deepEqual(old.closed.tally, { support: 1, concern: 1, abstain: 0 });
    assert.ok(old.closed.responses.some((r) => r.stance === 'concern' && r.reason === 'Ignores the self-employed.'));
    // A stance aimed at the old version is refused rather than applied to changed text.
    expectStatus(() => store.setStance(alice, 'work', { stance: 'support', expectedVersion: 1 }), 409);
  });

  it('only accepts current public posts from the same room as sources', () => {
    const { store, alice } = setup();
    const elsewhere = store.createPost(alice, { roomId: 'care', text: 'Other room' });
    const gone = store.createPost(alice, { roomId: 'work', text: 'Soon withdrawn' });
    store.withdrawPost(alice, gone.id);
    const base = { text: 'A new statement text.', differences: [], expectedVersion: 1 };
    expectStatus(() => store.reviseStatement(alice, 'work', { ...base, sourcePostIds: [elsewhere.id] }), 400, /Sources/);
    expectStatus(() => store.reviseStatement(alice, 'work', { ...base, sourcePostIds: [gone.id] }), 400, /Sources/);
    expectStatus(() => store.reviseStatement(alice, 'work', { ...base, sourcePostIds: ['p_notarealpost'] }), 400);
    expectStatus(() => store.reviseStatement(alice, 'work', { ...base, sourcePostIds: [], differences: Array(7).fill('d') }), 400);
  });

  it('labels AI-assisted revisions', () => {
    const { store, alice } = setup();
    store.reviseStatement(alice, 'places', { text: 'Heat protection for renters first.', differences: [], sourcePostIds: [], expectedVersion: 1, aiAssisted: true });
    assert.equal(store.publicState().grounds.places.current.aiAssisted, true);
  });
});

describe('actions', () => {
  it('snapshots the statement version and remaining concerns server-side', () => {
    const { store, alice, bob } = setup();
    store.setStance(bob, 'work', { stance: 'concern', reason: 'Who pays for the board?', expectedVersion: 1 });
    const action = store.createAction(alice, actionBody());
    const view = store.publicState().actions[0];
    assert.equal(action.ownerId, alice.id);
    assert.equal(view.snapshot.version, 1);
    assert.equal(view.snapshot.concerns.length, 1);
    assert.equal(view.snapshot.concerns[0].reason, 'Who pays for the board?');
    assert.equal(view.status, 'proposed');
    assert.deepEqual(view.stale, []);
  });

  it('computes priority on the server and accepts no client-supplied score', () => {
    const { store, alice } = setup();
    assert.equal(priorityOf({ impact: 3, urgency: 2, effort: 1 }), 8);
    assert.equal(priorityOf({ impact: 1, urgency: 1, effort: 3 }), 3);
    store.createAction(alice, actionBody());
    assert.equal(store.publicState().actions[0].priority, 8);
    expectStatus(() => store.createAction(alice, actionBody({ priority: 99 })), 400, /Unknown field "priority"/);
    expectStatus(() => store.createAction(alice, actionBody({ effort: 4 })), 400);
    expectStatus(() => store.createAction(alice, actionBody({ impact: 2.5 })), 400);
  });

  it('flags stale context after a revision or changed responses', () => {
    const { store, alice, bob } = setup();
    store.createAction(alice, actionBody());
    store.setStance(bob, 'work', { stance: 'concern', reason: 'Night shifts are left out.', expectedVersion: 1 });
    let [view] = store.publicState().actions;
    assert.equal(view.stale.length, 1);
    assert.match(view.stale[0], /concerns 0→1/);
    store.reviseStatement(bob, 'work', { text: 'Revised statement about work.', differences: [], sourcePostIds: [], expectedVersion: 1 });
    [view] = store.publicState().actions;
    assert.match(view.stale[0], /revised to version 2/);
    assert.equal(view.snapshot.version, 1);
  });

  it('refuses actions against an outdated statement version', () => {
    const { store, alice } = setup();
    store.reviseStatement(alice, 'work', { text: 'Version two of the statement.', differences: [], sourcePostIds: [], expectedVersion: 1 });
    expectStatus(() => store.createAction(alice, actionBody({ expectedVersion: 1 })), 409);
  });

  it('requires an institution for institutional proposals, and only for them', () => {
    const { store, alice } = setup();
    expectStatus(() => store.createAction(alice, actionBody({ scope: 'institutional' })), 400, /institution/);
    expectStatus(() => store.createAction(alice, actionBody({ institution: 'City council' })), 400);
    store.createAction(alice, actionBody({ scope: 'institutional', institution: 'City council' }));
    assert.equal(store.publicState().actions[0].institution, 'City council');
  });

  it('validates the check-in date', () => {
    const { store, alice } = setup();
    expectStatus(() => store.createAction(alice, actionBody({ checkIn: '2026-02-31' })), 400, /real calendar/);
    expectStatus(() => store.createAction(alice, actionBody({ checkIn: '2026-09-01' })), 400, /between today/);
    expectStatus(() => store.createAction(alice, actionBody({ checkIn: '2030-01-01' })), 400);
  });

  it('moves one step at a time, only by the owner, and holds forward moves on open concerns', () => {
    const { store, alice, bob } = setup();
    const action = store.createAction(bob, actionBody({ ownership: 'volunteer', concernKind: 'access', concernText: 'The depot has no step-free entrance.' }));
    expectStatus(() => store.setStatus(bob, action.id, { status: 'ready' }), 403);
    store.takeOwnership(alice, action.id);
    expectStatus(() => store.takeOwnership(bob, action.id), 409);
    expectStatus(() => store.setStatus(alice, action.id, { status: 'doing' }), 409, /cannot move/);
    expectStatus(() => store.setStatus(alice, action.id, { status: 'ready' }), 409, /open concerns/);
    const [check] = action.checks;
    store.updateCheck(bob, action.id, check.id, { op: 'address', text: 'Meet in the canteen, which is step-free.' });
    store.setStatus(alice, action.id, { status: 'ready' });
    store.setStatus(alice, action.id, { status: 'doing' });
    // A new concern does not reverse progress, but holds the next forward move.
    store.addCheck(bob, action.id, { kind: 'rights', text: 'Agency staff may not be allowed to join.' });
    expectStatus(() => store.setStatus(alice, action.id, { status: 'done' }), 409);
    store.setStatus(alice, action.id, { status: 'ready' });
    expectStatus(() => store.setStatus(alice, action.id, { status: 'funded' }), 400);
  });

  it('lets only the person who raised a concern reopen it, and keeps its history', () => {
    const { store, alice, bob } = setup();
    const action = store.createAction(alice, actionBody());
    const check = store.addCheck(bob, action.id, { kind: 'dependency', text: 'Needs the manager to agree.' });
    store.updateCheck(alice, action.id, check.id, { op: 'address', text: 'Manager agreed by email.' });
    expectStatus(() => store.updateCheck(alice, action.id, check.id, { op: 'reopen', text: 'I changed my mind.' }), 403);
    store.updateCheck(bob, action.id, check.id, { op: 'reopen', text: 'Only verbally, not in writing.' });
    const view = store.publicState().actions[0].checks[0];
    assert.equal(view.status, 'open');
    assert.deepEqual(view.history.map((h) => h.op), ['raised', 'address', 'reopen']);
  });

  it('lets volunteers and owners, but nobody else, update the next step', () => {
    const { store, alice, bob } = setup();
    const carol = store.join({ displayName: 'Carol' });
    const action = store.createAction(alice, actionBody());
    expectStatus(() => store.updateNextStep(bob, action.id, { text: 'Book the room' }), 403);
    store.setVolunteer(bob, action.id, { join: true });
    store.setVolunteer(bob, action.id, { join: true });
    store.updateNextStep(bob, action.id, { text: 'Book the room for Thursday' });
    const view = store.publicState().actions[0];
    assert.equal(view.volunteers.length, 1);
    assert.equal(view.nextStep, 'Book the room for Thursday');
    assert.equal(view.firstStep, 'Ask the depot manager for a noticeboard');
    expectStatus(() => store.updateNextStep(carol, action.id, { text: 'Hijack it' }), 403);
  });
});

describe('public export', () => {
  it('has a fixed notice and no session tokens or private fields', () => {
    const { store, alice } = setup();
    store.createPost(alice, { roomId: 'work', text: 'Public words.' });
    const exported = publicExport(store);
    assert.equal(exported.format, 'unite-v4-public-export');
    assert.match(exported.notice, /not a measure/);
    assert.equal(exported.bootId, undefined);
    const json = JSON.stringify(exported);
    assert.doesNotMatch(json, /token/i);
    assert.doesNotMatch(json, /"messages"/);
  });
});
