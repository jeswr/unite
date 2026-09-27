import * as M from '../js/model.js';

export const NOW = Date.parse('2026-09-26T10:00:00Z');

export function withDraft(state = M.emptyState(), overrides = {}) {
  return M.saveDraft(
    state,
    {
      hard: 'PRIVATE-HARD Every course I find runs while I am at work.',
      different: 'PRIVATE-DIFFERENT I can learn in the evening near home.',
      protect: 'PRIVATE-PROTECT my health condition must stay private.',
      topic: 'learning',
      horizon: 'year',
      inspiredBy: 'asp-evening-learning',
      ...overrides,
    },
    { now: NOW },
  );
}

export const validDecision = (overrides = {}) => ({
  outcome: 'option-learning-circles',
  owner: 'Example stewarding group (fictional)',
  reasons: 'Adults who missed out are reached first; disabled learners co-choose rooms and materials before the first circle.',
  decidedOn: '2026-10-15',
  fundingKind: 'budget',
  amount: '2000',
  ...overrides,
});

// A minimal in-memory Storage that can be told to fail.
export class FakeStorage {
  constructor({ failWrites = false } = {}) {
    this.map = new Map();
    this.failWrites = failWrites;
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}
