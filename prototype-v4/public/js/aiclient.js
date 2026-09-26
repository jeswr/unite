// Consent and request helpers for the opt-in AI features. Consent is kept
// for this tab only and every request states it explicitly.

import { post, tabStore } from './api.js';
import { h } from './dom.js';

const CONSENT_KEY = 'unite.v4.aiConsent';

export const hasConsent = () => tabStore.get(CONSENT_KEY) === 'yes';
export const giveConsent = () => tabStore.set(CONSENT_KEY, 'yes');
export const withdrawConsent = () => tabStore.remove(CONSENT_KEY);

export function disclosure(model = 'claude-opus-5-5') {
  return h('ul', { class: 'disclosure' },
    h('li', null, `What you send goes through this local Unite server to Anthropic, using the Claude Code account signed in on this computer (model ${model}). It may use that account's credits or usage limits.`),
    h('li', null, 'The Unite server passes it on without saving or logging it.'),
    h('li', null, 'Your private interview is never added to the public feed, to common-ground summaries or to the export. Only text you review and choose to publish becomes public.'),
    h('li', null, 'AI replies can be wrong. Unite never simulates a reply: if the AI is unavailable, you will see an error instead.'),
  );
}

// Asks once per tab, before the first thing is sent.
export async function ensureConsent(ctx) {
  if (hasConsent()) return true;
  const ok = await ctx.confirm({
    title: 'Before anything is sent to the AI',
    body: disclosure(ctx.data.ai.model),
    confirmLabel: 'I understand, continue',
  });
  if (ok) giveConsent();
  return ok;
}

export function aiRequest(path, body, signal) {
  return post(path, { ...body, consent: hasConsent() }, { signal });
}
