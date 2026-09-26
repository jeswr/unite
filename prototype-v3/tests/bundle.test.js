import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPublicBundle, parseBundle } from '../js/bundle.js';
import * as M from '../js/model.js';
import * as S from '../js/schema.js';
import { LIMITS } from '../js/schema.js';
import { NOW, validDecision, withDraft } from './helpers.js';

function richState() {
  const { state, draft } = withDraft();
  let next = M.shareDraft(state, draft.id, {
    title: 'Sign-up I can finish myself',
    hard: 'Sign-up needs sighted help.',
    different: 'I can sign up with a keyboard.',
    protect: 'Keep human help available.',
    confirm: true,
  }).state;
  next = M.setResponse(next, {
    optionId: 'option-onboarding-kit',
    stance: 'concern',
    reason: 'Minority concern: rural users have slow connections.',
  });
  next = M.addQuestion(next, { text: 'Who maintains the fixes after six months?', to: 'expert-accessibility', optionId: '' }).state;
  next = M.recordDecision(next, validDecision(), { now: NOW });
  return M.advanceDelivery(next, 'Budget holder confirmed €18,000 release in November (simulated).', { now: NOW + 1000 });
}

const exported = () => buildPublicBundle(richState(), { now: NOW + 2000 });
const roundTrip = (bundle) => parseBundle(JSON.stringify(bundle));
const mutate = (fn) => {
  const bundle = structuredClone(exported());
  fn(bundle);
  return roundTrip(bundle);
};
const rejects = (result, fragment) => {
  assert.equal(result.ok, false, 'expected the import to be rejected');
  assert.match(result.message, fragment);
};

test('export → import round trip is lossless', () => {
  const bundle = exported();
  const result = roundTrip(bundle);
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(result.bundle, bundle);
});

test('round trip preserves dissent, provenance, attribution and decision authority', () => {
  const { bundle } = roundTrip(exported());
  const concerns = bundle.responses.filter((r) => r.stance === 'concern');
  assert.ok(concerns.some((c) => c.reason.startsWith('Minority concern')));
  assert.ok(concerns.some((c) => c.id === 'response-seed-sam'));

  const shared = bundle.aspirations.find((a) => a.author.kind === 'local');
  assert.equal(shared.inspiredBy, 'asp-screen-reader-signup');
  assert.equal(shared.author.label, 'Participant in this browser');

  assert.equal(bundle.decision.authority, 'Community pilot budget, not a public mandate');
  assert.equal(bundle.decision.owner, 'Pilot stewarding group (fictional)');
  const attached = bundle.decision.attachedConcerns.map((c) => c.responseId);
  for (const c of concerns) assert.ok(attached.includes(c.id), `concern ${c.id} detached from decision`);
  assert.deepEqual(
    bundle.delivery.history.map((h) => h.state),
    ['proposed', 'decision-recorded', 'resources-committed'],
  );
});

test('user text that looks like HTML is kept as inert text', () => {
  const result = mutate((b) => {
    b.questions.at(-1).text = '<img src=x onerror="alert(1)">';
  });
  assert.equal(result.ok, true);
  assert.equal(result.bundle.questions.at(-1).text, '<img src=x onerror="alert(1)">');
});

test('rejects input that is not a Unite bundle', () => {
  rejects(parseBundle(''), /empty/);
  rejects(parseBundle('{not json'), /not valid JSON/);
  rejects(parseBundle('[]'), /bundle: expected an object/);
  rejects(parseBundle('{"format":"something-else"}'), /bundle\.format/);
  rejects(mutate((b) => { b.schemaVersion = 2; }), /schemaVersion/);
});

test('rejects oversize files before parsing', () => {
  rejects(parseBundle(`"${'x'.repeat(LIMITS.bundleBytes + 1)}"`), /under 512 KB/);
});

test('rejects private or unknown top-level fields', () => {
  rejects(mutate((b) => { b.drafts = []; }), /bundle\.drafts: is not part of a public bundle/);
  rejects(parseBundle(JSON.stringify(exported()).replace('{', '{"__proto__":{"polluted":true},')), /__proto__/);
  assert.equal({}.polluted, undefined);
});

test('strips unknown fields inside records instead of passing them through', () => {
  const result = mutate((b) => { b.aspirations[0].secretNote = 'should vanish'; });
  assert.equal(result.ok, true);
  assert.ok(!('secretNote' in result.bundle.aspirations[0]));
});

test('rejects bad enums, identifiers and text', () => {
  rejects(mutate((b) => { b.responses[0].stance = 'vote'; }), /responses\[0\]\.stance/);
  rejects(mutate((b) => { b.responses[0].id = 'Has Spaces'; }), /responses\[0\]\.id/);
  rejects(mutate((b) => { b.claims[0].kind = 'truth'; }), /claims\[0\]\.kind/);
  rejects(mutate((b) => { b.aspirations[0].title = ''; }), /must not be empty/);
  rejects(mutate((b) => { b.aspirations[0].title = 'x'.repeat(LIMITS.title + 1); }), /at most/);
  rejects(mutate((b) => { b.aspirations[0].hard = 'bell\u0007'; }), /control or text-direction/);
  rejects(mutate((b) => { b.aspirations[0].hard = 'evil‮txt.exe'; }), /control or text-direction/);
  rejects(mutate((b) => { b.aspirations[0].hard = 42; }), /expected text/);
  rejects(mutate((b) => { b.responses = Array(LIMITS.records + 1).fill(b.responses[0]); }), /more than/);
});

test('rejects broken references and duplicate identifiers', () => {
  rejects(mutate((b) => { b.responses[0].optionId = 'option-missing'; }), /unknown option/);
  rejects(mutate((b) => { b.questions[0].to = 'expert-missing'; }), /unknown expert role/);
  rejects(mutate((b) => { b.aspirations.at(-1).inspiredBy = 'asp-missing'; }), /unknown aspiration/);
  rejects(mutate((b) => { b.responses[1].id = b.responses[0].id; }), /used more than once/);
});

test('rejects decisions and delivery trails that break the rules', () => {
  rejects(mutate((b) => { delete b.decision.owner; }), /decision\.owner/);
  rejects(mutate((b) => { b.decision.reasons = 'too short'; }), /at least 20/);
  rejects(mutate((b) => { b.decision.outcome = 'defer'; }), /deferred decision cannot allocate a budget/);
  rejects(mutate((b) => { b.decision.funding = { kind: 'budget', amount: -5 }; }), /whole number/);
  rejects(mutate((b) => { b.delivery.history.splice(1, 1); }), /cannot be skipped/);
  rejects(mutate((b) => { b.decision = null; }), /no decision is recorded/);
  rejects(
    mutate((b) => { b.decision.funding = { kind: 'none', amount: null }; }),
    /confirms funds although the decision allocated no budget/,
  );
});

// ----- independent-review regressions ---------------------------------------

const concernIndexes = (b) => b.responses.flatMap((r, i) => (r.stance === 'concern' ? [i] : []));

test('decision and concern responses must match both ways', () => {
  rejects(
    mutate((b) => {
      b.responses = b.responses.filter((r) => r.stance !== 'concern');
    }),
    /attachedConcerns\[0\]\.responseId: .* is not a concern in this record/,
  );
  rejects(mutate((b) => { b.decision.attachedConcerns = []; }), /is missing the concern/);
  rejects(mutate((b) => { b.decision.attachedConcerns[0].responseId = 'response-ghost'; }), /not a concern in this record/);
  rejects(mutate((b) => { b.decision.attachedConcerns.push({ ...b.decision.attachedConcerns[0] }); }), /attached more than once/);
  rejects(mutate((b) => { b.decision.attachedConcerns[0].reason = 'Softened wording.'; }), /differs from the concern it was copied from/);
  rejects(mutate((b) => { b.responses[concernIndexes(b)[0]].reason = 'Edited after the decision.'; }), /differs from the concern/);
  rejects(mutate((b) => { b.responses[concernIndexes(b)[0]].stance = 'support'; }), /not a concern in this record/);
});

test('without signatures, deleting every concern and every attachment together cannot be detected', () => {
  // Documented limit, not a guarantee: the record is still self-consistent.
  const result = mutate((b) => {
    b.responses = b.responses.filter((r) => r.stance !== 'concern');
    b.decision.attachedConcerns = [];
  });
  assert.equal(result.ok, true, result.message);
});

test('decision, commitment and delivery trail must agree', () => {
  rejects(mutate((b) => { b.decision.commitmentId = 'commitment-translated-guide'; }), /not the commitment the delivery trail follows/);
  rejects(mutate((b) => { b.decision.authority = 'Binding public mandate'; }), /does not match the authority named on the commitment/);
  rejects(mutate((b) => { b.delivery.history.splice(1); }), /no “decision-recorded” step/);
  rejects(mutate((b) => { b.delivery.history[1].at = '2026-09-26T09:59:00Z'; }), /does not match when the decision was recorded/);
  rejects(mutate((b) => { b.commitments[1].responseRecorded = true; }), /commitments\[1\]\.responseRecorded/);
  rejects(mutate((b) => { b.commitments[0].responseRecorded = false; }), /commitments\[0\]\.responseRecorded/);
  // "Responded" without any decision in the file.
  rejects(
    mutate((b) => {
      b.decision = null;
      b.delivery.history.splice(1);
    }),
    /commitments\[0\]\.responseRecorded/,
  );
});

test('disclosures and attribution in a file cannot be forged', () => {
  rejects(mutate((b) => { b.notice.scope = 'This is an official binding vote.'; }), /notice\.scope: differs from the built-in demo disclosure/);
  rejects(mutate((b) => { b.notice.fictionalSeed = 'All people named here are real.'; }), /notice\.fictionalSeed/);
  rejects(mutate((b) => { delete b.notice.userAuthored; }), /notice\.userAuthored/);
  const local = (b) => b.aspirations.findIndex((a) => a.author.kind === 'local');
  rejects(mutate((b) => { b.aspirations[local(b)].author.label = 'Sam (fictional)'; }), /must be “Participant in this browser”/);
  rejects(mutate((b) => { b.aspirations[local(b)].author = { kind: 'seed', label: 'Sam (fictional)' }; }), /must be “Participant in this browser”/);
  rejects(mutate((b) => { b.questions.at(-1).author = { kind: 'expert-role', label: 'Accessibility auditor (fictional role)' }; }), /questions\[3\]\.author/);
  rejects(mutate((b) => { b.responses[0].author.label = 'A Real Person'; }), /built-in fictional attribution/);
  rejects(mutate((b) => { b.aspirations[0].author = { kind: 'local', label: 'Participant in this browser' }; }), /built-in fictional attribution/);
});

test('impossible calendar dates and times are rejected', () => {
  rejects(mutate((b) => { b.decision.decidedOn = '2026-02-31'; }), /decision\.decidedOn: must be a date/);
  rejects(mutate((b) => { b.commitments[0].responseDue = '2026-04-31'; }), /responseDue/);
  rejects(mutate((b) => { b.exportedAt = '2026-02-29T10:00:00Z'; }), /exportedAt/);
  rejects(mutate((b) => { b.exportedAt = '2026-01-01T24:00:00Z'; }), /exportedAt/);
  assert.equal(S.date('2028-02-29', 'd'), '2028-02-29');
  assert.equal(S.datetime('2026-09-26T23:59:59.5Z', 't'), '2026-09-26T23:59:59.5Z');
});

test('withdrawing an inspiration keeps the decision and the export valid', () => {
  const share = (state, draftId, title) =>
    M.shareDraft(state, draftId, { title, hard: 'hard text', different: 'different text', protect: '', confirm: true });
  const a = withDraft();
  const sharedA = share(a.state, a.draft.id, 'Shared A');
  const b = withDraft(sharedA.state, { inspiredBy: sharedA.record.id });
  const sharedB = share(b.state, b.draft.id, 'Shared B');
  let state = M.setResponse(sharedB.state, { optionId: 'option-onboarding-kit', stance: 'concern', reason: 'Local concern' });
  state = M.recordDecision(state, validDecision(), { now: NOW });
  state = M.withdrawShared(state, sharedA.record.id);

  const result = roundTrip(buildPublicBundle(state, { now: NOW }));
  assert.equal(result.ok, true, result.message);
  const kept = result.bundle.aspirations.find((x) => x.id === sharedB.record.id);
  assert.equal(kept.inspiredBy, null);
  assert.equal(kept.inspirationWithdrawn, true);
  assert.ok(!JSON.stringify(result.bundle).includes(sharedA.record.id));
  assert.equal(result.bundle.decision.id, state.decision.id);
  assert.equal(result.bundle.decision.attachedConcerns.length, 4);
  rejects(mutate((x) => { x.aspirations.at(-1).inspirationWithdrawn = true; }), /inspirationWithdrawn: cannot be true/);
});
