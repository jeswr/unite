import * as M from '../js/model.js';

export const NOW = Date.parse('2026-09-26T10:00:00Z');

export function withDraft(state = M.emptyState(), overrides = {}) {
  return M.saveDraft(
    state,
    {
      hard: 'PRIVATE-HARD I cannot finish sign-up alone.',
      different: 'PRIVATE-DIFFERENT I can set up without help.',
      protect: 'PRIVATE-PROTECT my health condition must stay private.',
      topic: 'accessibility',
      horizon: 'year',
      inspiredBy: 'asp-screen-reader-signup',
      ...overrides,
    },
    { now: NOW },
  );
}

export const validDecision = (overrides = {}) => ({
  outcome: 'option-onboarding-kit',
  owner: 'Pilot stewarding group (fictional)',
  reasons: 'Newcomers are the biggest group affected; concerns from blind users are addressed by co-selecting the apps.',
  decidedOn: '2026-10-15',
  fundingKind: 'budget',
  amount: '18000',
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
