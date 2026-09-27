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

  it('records optional intended everyday-life changes as the proposer wrote them', () => {
    const { store, alice } = setup();
    const markup = '<img src=x onerror="alert(1)"> Parents can eat breakfast together.\nNobody loses support.';
    store.createAction(alice, actionBody({ lifeChange: `  ${markup}  `, lifeSigns: 'The parents say mornings changed.' }));
    let [view] = store.publicState().actions;
    // Kept verbatim (trimmed): the browser renders it as a text node, never as HTML.
    assert.equal(view.lifeChange, markup);
    assert.equal(view.lifeSigns, 'The parents say mornings changed.');
    const exported = publicExport(store);
    assert.equal(exported.actions[0].lifeChange, markup);
    assert.match(exported.notice, /intentions for everyday life, not measured results/);

    // Omitted, empty, whitespace-only and null all mean "not stated".
    store.createAction(alice, actionBody());
    store.createAction(alice, actionBody({ lifeChange: '', lifeSigns: '   ' }));
    store.createAction(alice, actionBody({ lifeChange: null }));
    for (view of store.publicState().actions.slice(1)) {
      assert.equal(view.lifeChange, null);
      assert.equal(view.lifeSigns, null);
    }
  });

  it('bounds the intended-change fields and rejects unknown or non-text values', () => {
    const { store, alice } = setup();
    store.createAction(alice, actionBody({ lifeChange: '🌍'.repeat(LIMITS.intention), lifeSigns: 'x'.repeat(LIMITS.intention) }));
    expectStatus(() => store.createAction(alice, actionBody({ lifeChange: 'x'.repeat(LIMITS.intention + 1) })), 400, /everyday life can be at most 500/);
    expectStatus(() => store.createAction(alice, actionBody({ lifeSigns: 'x'.repeat(LIMITS.intention + 1) })), 400, /know it helped can be at most 500/);
    expectStatus(() => store.createAction(alice, actionBody({ lifeChange: 5 })), 400, /must be text/);
    expectStatus(() => store.createAction(alice, actionBody({ lifeSigns: ['a'] })), 400, /must be text/);
    expectStatus(() => store.createAction(alice, actionBody({ lifeChange: 'Calmer ‮evenings' })), 400, /direction-override/);
    expectStatus(() => store.createAction(alice, actionBody({ lifeOutcome: 'measured' })), 400, /Unknown field "lifeOutcome"/);
    assert.equal(store.publicState().actions.length, 1);
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

describe('owner review of the room context (F1)', () => {
  const view = (store) => store.publicState().actions[0];
  const review = (store, actor, id, text = 'Read the concerns; the pilot is small and reversible.') => store.reviewContext(actor, id, { contextId: view(store).context.id, text });

  it('holds an action created while a room concern remains until the owner reviews it', () => {
    const { store, alice, bob } = setup();
    store.setStance(bob, 'work', { stance: 'concern', reason: 'Who covers night shifts?', expectedVersion: 1 });
    const action = store.createAction(alice, actionBody());
    assert.ok(view(store).blockers.includes('context-review'));
    assert.match(view(store).context.reviewNeeded[0], /1 concern/);
    expectStatus(() => store.setStatus(alice, action.id, { status: 'ready' }), 409, /Review the room/);
    review(store, alice, action.id);
    store.setStatus(alice, action.id, { status: 'ready' });
    // The concern and the review record both remain.
    assert.equal(store.publicState().grounds.work.tally.concern, 1);
    const [record] = view(store).reviews;
    assert.equal(record.by.id, alice.id);
    assert.deepEqual(record.concerns, [{ name: 'Bob', reason: 'Who covers night shifts?' }]);
  });

  it('is not needed for new support, but is for a new, reworded or revised context', () => {
    const { store, alice, bob } = setup();
    const carol = store.join({ displayName: 'Carol' });
    const action = store.createAction(alice, actionBody());
    store.setStance(bob, 'work', { stance: 'support', expectedVersion: 1 });
    assert.deepEqual(view(store).context.reviewNeeded, []);
    assert.equal(view(store).stale.length, 1, 'the change is still shown as information');
    store.setStatus(alice, action.id, { status: 'ready' });

    store.setStance(carol, 'work', { stance: 'concern', reason: 'Agency staff are left out.', expectedVersion: 1 });
    expectStatus(() => store.setStatus(alice, action.id, { status: 'doing' }), 409);
    store.setStatus(alice, action.id, { status: 'proposed' }); // stepping back is always allowed
    review(store, alice, action.id);
    store.setStatus(alice, action.id, { status: 'ready' });

    store.setStance(carol, 'work', { stance: 'concern', reason: 'Agency and zero-hours staff are left out.', expectedVersion: 1 });
    assert.ok(view(store).blockers.includes('context-review'), 'a reworded concern needs a fresh review');
    review(store, alice, action.id);
    store.setStance(carol, 'work', { stance: 'support', expectedVersion: 1 });
    assert.deepEqual(view(store).context.reviewNeeded, [], 'a withdrawn concern needs no review');

    store.reviseStatement(bob, 'work', { text: 'Predictable hours for everyone, agency staff included.', differences: [], sourcePostIds: [], expectedVersion: 1 });
    assert.match(view(store).context.reviewNeeded[0], /version 2; the owner last reviewed version 1/);
    expectStatus(() => store.setStatus(alice, action.id, { status: 'doing' }), 409);
    review(store, alice, action.id);
    store.setStatus(alice, action.id, { status: 'doing' });
  });

  it('refuses a review of a context that changed concurrently, and only the owner may review', () => {
    const { store, alice, bob } = setup();
    store.setStance(bob, 'work', { stance: 'concern', reason: 'No budget for the board.', expectedVersion: 1 });
    const action = store.createAction(alice, actionBody());
    const seen = view(store).context.id;
    expectStatus(() => store.reviewContext(bob, action.id, { contextId: seen, text: 'Looks fine to me.' }), 403);
    // Someone adds a concern after the owner loaded the page, before they submit.
    const carol = store.join({ displayName: 'Carol' });
    store.setStance(carol, 'work', { stance: 'concern', reason: 'Excludes remote workers.', expectedVersion: 1 });
    expectStatus(() => store.reviewContext(alice, action.id, { contextId: seen, text: 'Reviewed the budget concern.' }), 409, /changed while you were reviewing/);
    assert.equal(view(store).reviews.length, 0);
    review(store, alice, action.id);
    assert.equal(view(store).reviews[0].concerns.length, 2);
    expectStatus(() => review(store, alice, action.id), 409, /nothing new/);
    expectStatus(() => store.reviewContext(alice, action.id, { contextId: 'x', text: 'ok', extra: 1 }), 400, /Unknown field/);
  });
});

describe('institutional proposals (F2)', () => {
  it('can complete proposal work while adoption stays unconfirmed', () => {
    const { store, alice } = setup();
    const action = store.createAction(alice, actionBody({ scope: 'institutional', institution: 'City council' }));
    for (const status of ['ready', 'doing', 'done']) store.setStatus(alice, action.id, { status });
    const view = store.publicState().actions[0];
    assert.equal(view.status, 'done');
    assert.equal(view.institutionalAdoption, 'unconfirmed');
    assert.equal(view.statusMeaning, 'Proposal work completed; institutional adoption unconfirmed.');
    const exported = publicExport(store);
    assert.equal(exported.actions[0].institutionalAdoption, 'unconfirmed');
    assert.match(exported.notice, /adoption is never recorded and is always unconfirmed/);
  });

  it('never accepts a client claim of adoption and describes community work differently', () => {
    const { store, alice } = setup();
    expectStatus(() => store.createAction(alice, actionBody({ scope: 'institutional', institution: 'City council', institutionalAdoption: 'adopted' })), 400, /Unknown field/);
    const action = store.createAction(alice, actionBody());
    expectStatus(() => store.setStatus(alice, action.id, { status: 'adopted' }), 400);
    const view = store.publicState().actions[0];
    assert.equal(view.institutionalAdoption, null);
    assert.match(view.statusMeaning, /^Proposed/);
  });
});

describe('concern history cap (F4)', () => {
  it('always leaves room for the raiser to reopen, so the cap ends with the concern open', () => {
    const { store, alice, bob } = setup();
    const action = store.createAction(alice, actionBody());
    const check = store.addCheck(bob, action.id, { kind: 'access', text: 'No step-free access.' });
    let rounds = 0;
    for (;;) {
      try {
        store.updateCheck(alice, action.id, check.id, { op: 'address', text: `Response number ${rounds}` });
      } catch (error) {
        assert.equal(error.status, 409);
        assert.match(error.message, /stays open/);
        break;
      }
      store.updateCheck(bob, action.id, check.id, { op: 'reopen', text: `Still not solved ${rounds}` });
      rounds += 1;
    }
    const final = store.publicState().actions[0].checks[0];
    assert.equal(final.status, 'open');
    assert.equal(final.history.length, LIMITS.maxUpdates - 1);
    assert.equal(final.history.at(-1).op, 'reopen');
    expectStatus(() => store.setStatus(alice, action.id, { status: 'ready' }), 409, /open concerns/);
  });
});

describe('check-in dates across time zones (F5)', () => {
  it('accepts the local "today" of any time zone near the UTC date change', () => {
    // 18:00 on 26 September in UTC−7 is 01:00 on 27 September in UTC.
    const late = new Store({ now: fixedClock('2026-09-27T01:00:00Z') });
    const west = late.join({ displayName: 'West' });
    late.createAction(west, actionBody({ checkIn: '2026-09-26' }));
    expectStatus(() => late.createAction(west, actionBody({ checkIn: '2026-09-25' })), 400, /between today and 365 days/);
    // 09:30 on 27 September in UTC+14 is 19:30 on 26 September in UTC.
    const early = new Store({ now: fixedClock('2026-09-26T19:30:00Z') });
    const east = early.join({ displayName: 'East' });
    early.createAction(east, actionBody({ checkIn: '2027-09-27' }));
    expectStatus(() => early.createAction(east, actionBody({ checkIn: '2027-09-28' })), 400);
  });
});

describe('aggregate limits (F6)', () => {
  it('refuses new history past the shared budget instead of deleting anything', () => {
    const saved = LIMITS.archiveBudget;
    try {
      const { store, alice, bob } = setup();
      LIMITS.archiveBudget = store.archived + 3;
      store.setStance(bob, 'work', { stance: 'concern', reason: 'Keep this concern.', expectedVersion: 1 });
      const action = store.createAction(alice, actionBody()); // 1 action + 1 snapshot concern
      store.addCheck(bob, action.id, { kind: 'rights', text: 'Check contracts first.' });
      expectStatus(() => store.addCheck(bob, action.id, { kind: 'rights', text: 'One more concern.' }), 503, /history limit/);
      expectStatus(() => store.reviseStatement(alice, 'work', { text: 'A different statement.', differences: [], sourcePostIds: [], expectedVersion: 1 }), 503);
      const state = store.publicState();
      assert.equal(state.grounds.work.tally.concern, 1);
      assert.equal(state.grounds.work.current.version, 1);
      assert.equal(state.actions[0].checks.length, 1);
      assert.equal(state.joined, 2);
    } finally {
      LIMITS.archiveBudget = saved;
    }
  });

  it('serialises public state once per revision', () => {
    const { store, alice } = setup();
    const first = store.publicStateJson();
    assert.equal(store.publicStateJson(), first);
    store.createPost(alice, { roomId: 'work', text: 'New words' });
    const second = store.publicStateJson();
    assert.notEqual(second, first);
    assert.deepEqual(JSON.parse(second), store.publicState());
  });
});

describe('AI-assisted label (F7)', () => {
  it('is published as self-declared', () => {
    const { store, alice } = setup();
    store.reviseStatement(alice, 'care', { text: 'Care is work that deserves pay.', differences: [], sourcePostIds: [], expectedVersion: 1, aiAssisted: true });
    const current = store.publicState().grounds.care.current;
    assert.equal(current.aiAssisted, true);
    assert.match(current.aiAssistedSource, /self-declared/);
    assert.match(publicExport(store).notice, /declared by its proposer and is not verified/);
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
