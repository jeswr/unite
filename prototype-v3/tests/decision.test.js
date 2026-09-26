import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as M from '../js/model.js';
import * as S from '../js/schema.js';
import { COMMITMENTS } from '../js/seed.js';
import { NOW, validDecision } from './helpers.js';

const fieldErrors = (fn) => {
  try {
    fn();
  } catch (error) {
    if (error instanceof M.FieldErrors) return Object.keys(error.errors).sort();
    throw error;
  }
  assert.fail('expected FieldErrors');
};

test('a decision needs owner, reasons, date and an explicit funding position', () => {
  const missing = fieldErrors(() =>
    M.recordDecision(M.emptyState(), { outcome: 'option-keep-current', owner: '', reasons: '', decidedOn: '', fundingKind: '' }),
  );
  assert.deepEqual(missing, ['decidedOn', 'fundingKind', 'owner', 'reasons']);
  assert.deepEqual(fieldErrors(() => M.recordDecision(M.emptyState(), validDecision({ amount: '' }))), ['amount']);
  assert.deepEqual(fieldErrors(() => M.recordDecision(M.emptyState(), validDecision({ amount: '12.5' }))), ['amount']);
  assert.deepEqual(fieldErrors(() => M.recordDecision(M.emptyState(), validDecision({ outcome: 'defer' }))), ['fundingKind']);
});

test('recording a decision attaches every concern, including minority ones', () => {
  let state = M.setResponse(M.emptyState(), { optionId: 'option-switching-tool', stance: 'concern', reason: 'Only I worry about this.' });
  state = M.recordDecision(state, validDecision(), { now: NOW });
  const attached = state.decision.attachedConcerns;
  assert.ok(attached.some((c) => c.reason === 'Only I worry about this.'));
  assert.ok(attached.some((c) => c.responseId === 'response-seed-sam'));
  assert.equal(state.decision.authority, 'Community pilot budget, not a public mandate');
  assert.equal(M.currentDeliveryState(state.delivery), 'decision-recorded');
});

test('responses close once a decision is recorded, so attached concerns cannot drift', () => {
  const state = M.recordDecision(M.emptyState(), validDecision(), { now: NOW });
  assert.throws(() => M.setResponse(state, { optionId: 'option-keep-current', stance: 'support' }), /closed/);
  assert.throws(() => M.removeResponse(state, 'option-keep-current'), /closed/);
  assert.throws(() => M.recordDecision(state, validDecision(), { now: NOW }), /already recorded/);
});

test('selected is not funded: a no-funding decision stops the trail', () => {
  const state = M.recordDecision(M.emptyState(), validDecision({ fundingKind: 'none', amount: '' }), { now: NOW });
  assert.equal(state.decision.funding.amount, null);
  assert.equal(M.nextDeliveryStep(state.delivery, state.decision).next, null);
  assert.throws(() => M.advanceDelivery(state, 'Trying to skip ahead anyway', { now: NOW }), /No budget was allocated/);
});

test('allocating a budget is recorded as an allocation, not as confirmed funds', () => {
  const state = M.recordDecision(M.emptyState(), validDecision(), { now: NOW });
  assert.equal(M.currentDeliveryState(state.delivery), 'decision-recorded');
  assert.match(state.delivery.history[1].evidence, /€18,000 allocated; release still to be confirmed/);
  assert.equal(M.nextDeliveryStep(state.delivery, state.decision).next, 'resources-committed');
  assert.equal(S.DELIVERY_STATES['resources-committed'], 'Funds confirmed');
  assert.equal(S.FUNDING_KINDS.budget, 'Budget allocated');
});

test('a deferred decision does not move delivery forward', () => {
  const state = M.recordDecision(M.emptyState(), validDecision({ outcome: 'defer', fundingKind: 'none' }), { now: NOW });
  assert.match(M.nextDeliveryStep(state.delivery, state.decision).reason, /deferred/);
});

test('delivery advances one state at a time, each with acceptance evidence', () => {
  assert.throws(() => M.advanceDelivery(M.emptyState(), 'evidence text here', { now: NOW }), /No decision/);
  let state = M.recordDecision(M.emptyState(), validDecision(), { now: NOW });
  assert.throws(() => M.advanceDelivery(state, 'short', { now: NOW }), M.FieldErrors);
  const seen = [];
  for (let i = 1; i <= 4; i += 1) {
    state = M.advanceDelivery(state, `Acceptance evidence for step ${i}`, { now: NOW + i * 1000 });
    seen.push(M.currentDeliveryState(state.delivery));
  }
  assert.deepEqual(seen, ['resources-committed', 'in-progress', 'delivered', 'evaluated']);
  assert.throws(() => M.advanceDelivery(state, 'Nothing left to do here', { now: NOW }), /complete/);
});

test('a missed response date is reported as overdue, not hidden', () => {
  const translation = COMMITMENTS.find((c) => c.id === 'commitment-translated-guide');
  assert.deepEqual(M.commitmentStatus(translation, null, '2026-09-26'), { kind: 'overdue', days: 26 });
  const main = M.mainCommitment();
  assert.deepEqual(M.commitmentStatus(main, null, '2026-11-20'), { kind: 'awaiting', days: 10 });
  const decided = M.recordDecision(M.emptyState(), validDecision(), { now: NOW });
  assert.deepEqual(M.commitmentStatus(main, decided.decision, '2026-12-25'), { kind: 'responded' });
});
