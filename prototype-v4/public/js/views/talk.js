// Talk with Unite: a private AI interview, one question at a time. The
// conversation lives only in this tab (memory plus sessionStorage); the
// server relays each turn to the Claude Code CLI and keeps nothing.

import { aiRequest, disclosure, giveConsent, hasConsent, withdrawConsent } from '../aiclient.js';
import { tabStore } from '../api.js';
import { h, uid } from '../dom.js';
import { joinPrompt } from '../ui.js';

const STORE_KEY = 'unite.v4.interview';
const MAX_MESSAGES = 40;
export const OPENER = 'Imagine an ordinary day you would love to live, not a special occasion. What is happening in one moment of it? If that is hard to picture, a recent moment you would like more of, or one small thing that would make tomorrow gentler, is just as good.';

const AIMS = [
  'One ordinary moment you would love to live',
  'Why it matters to you',
  'What is already good and worth keeping',
  'What gets in the way now',
  'What support you would want, if any, and from whom',
  'Who else it involves, and whose agreement it needs',
  'Later, if you like: ways it could come about',
];

// A conversation keeps the opening question it was started with, so answers
// saved in this tab before the opener changed are still shown (and sent to
// the AI) under the question they actually answered.
const EARLIER_OPENER = "What is one thing about your everyday life right now that you would most like to be different in ten years' time, for you or for people around you?";

function load() {
  try {
    const saved = JSON.parse(tabStore.get(STORE_KEY) ?? 'null');
    if (Array.isArray(saved?.messages)) {
      const messages = saved.messages.filter((m) => m && typeof m.text === 'string' && (m.role === 'interviewer' || m.role === 'participant'));
      const opener = [OPENER, EARLIER_OPENER].includes(saved.opener) ? saved.opener : messages.length ? EARLIER_OPENER : OPENER;
      return { messages, opener };
    }
  } catch {
    // start fresh
  }
  return { messages: [], opener: OPENER };
}

function save(ui) {
  tabStore.set(STORE_KEY, JSON.stringify({ messages: ui.messages, opener: ui.opener }));
}

export function renderTalk(ctx) {
  const ui = (ctx.ui.talk ??= { ...load(), busy: null, error: '', epoch: 0 });
  const ai = ctx.data.ai;
  return h('section', { class: 'view', 'aria-labelledby': 'talk-title' },
    h('header', { class: 'view-head' },
      h('p', { class: 'eyebrow' }, 'Private interview'),
      h('h1', { id: 'talk-title' }, 'Talk with Unite'),
      h('p', { class: 'lede intro' }, 'An AI interviewer asks about a day you would love to live, what matters in it and what gets in the way, one question at a time. Money, work or government are fine to mention in your own words. When you are ready, you can turn part of it into a public post. You review every word first.'),
    ),
    h('p', { class: 'scope-note' }, h('strong', null, 'Private to this tab. '), 'Stored only in this tab\'s session storage and cleared when the tab closes. Never added to the feed, to common-ground summaries or to the export. Share only what you are comfortable sending to the AI: you never need to name a health condition, a person or a place. “I need a step-free route” is enough.'),
    body(ctx, ui, ai),
    h('details', { class: 'card quiet', 'data-open-key': 'aims' },
      h('summary', null, 'What Unite asks about'),
      h('ul', { class: 'differences small' }, AIMS.map((aim) => h('li', null, aim))),
      h('p', { class: 'small muted' }, 'Inspired by Anthropic\'s large interview study, which paired fixed interview aims with adaptive follow-up questions. Answers here are self-selected and represent only the person giving them.')),
  );
}

function body(ctx, ui, ai) {
  if (!ai.enabled) {
    return h('div', { class: 'card' },
      h('h2', null, 'AI conversation is off on this server'),
      h('p', null, ai.reason),
      h('p', { class: 'small' }, 'Unite does not simulate replies, so nothing will pretend to be the AI. You can still post your thoughts directly in any room.'),
      h('p', null, h('a', { href: '#/room/future' }, 'Go to Imagining together')),
    );
  }
  if (!ctx.me) return joinPrompt(ctx, 'Join with a display name to start. Your display name is not sent to the AI.');
  if (!hasConsent()) return consentCard(ctx);
  return chat(ctx, ui);
}

// Stops any request in flight, makes a late reply be discarded, and removes
// private text from screen-reader announcements and error messages.
function forget(ctx, ui) {
  ui.epoch += 1;
  ui.busy?.controller.abort();
  ui.busy = null;
  ui.error = '';
  ctx.clearAnnouncements();
}

function consentCard(ctx) {
  return h('section', { class: 'card consent', 'aria-labelledby': 'consent-title' },
    h('h2', { id: 'consent-title' }, 'Before you start'),
    disclosure(ctx.data.ai.model),
    h('div', { class: 'row' }, h('button', {
      type: 'button', class: 'primary', 'data-focus': 'consent',
      onClick: () => { giveConsent(); ctx.rerender(); document.querySelector('[data-draft="talk:answer"]')?.focus(); },
    }, 'I understand, start the interview')),
  );
}

function chat(ctx, ui) {
  const messages = [{ role: 'interviewer', text: ui.opener, opener: true }, ...ui.messages];
  const answerId = uid('answer');
  const textarea = h('textarea', { id: answerId, rows: 3, maxlength: 2000, 'data-draft': 'talk:answer', value: ctx.draft('talk:answer'), disabled: Boolean(ui.busy) });
  const full = ui.messages.length >= MAX_MESSAGES - 1;

  const send = async (mode) => {
    const text = textarea.value.trim();
    if (mode === 'question' && !text) {
      // An empty send retries after a failed turn; otherwise there is nothing to send.
      if (ui.messages.at(-1)?.role !== 'participant') return;
    } else if (mode === 'question') {
      ui.messages.push({ role: 'participant', text });
      ctx.clearDraft('talk:answer');
      save(ui);
    }
    const controller = new AbortController();
    const epoch = ui.epoch;
    ui.busy = { mode, controller };
    ui.error = '';
    ctx.rerender();
    try {
      const outgoing = [{ role: 'interviewer', text: ui.opener }, ...ui.messages].map(({ role, text: t }) => ({ role, text: t }));
      const result = await aiRequest('/api/interview', { mode, messages: outgoing }, controller.signal);
      // The conversation was cleared or consent withdrawn meanwhile: drop it.
      if (epoch !== ui.epoch) return;
      if (mode === 'question') {
        ui.messages.push({ role: 'interviewer', text: result.text });
        save(ui);
        ctx.announce(`Unite asks: ${result.text}`);
      } else {
        ctx.openPublish({
          text: result.text,
          title: 'Review your post before publishing',
          intro: 'The AI drafted this from your interview. It is asked to keep needs you described, such as a step-free route, and to leave out diagnoses, names and places. Check it says what you mean: change anything, or cancel. Nothing is public until you press Publish.',
        });
      }
    } catch (error) {
      if (epoch !== ui.epoch) return;
      ui.error = error.name === 'AbortError' ? 'Stopped. Nothing further was sent.' : error.message;
      if (error.status === 403 || error.code === 'disabled') await ctx.refresh();
    } finally {
      if (ui.busy?.controller === controller) ui.busy = null;
      ctx.rerender();
    }
  };

  const form = h('form', { class: 'card composer', 'aria-label': 'Your answer' },
    h('label', { for: answerId }, 'Your answer'),
    textarea,
    h('p', { class: 'hint' }, 'Press Send, or Ctrl/⌘ + Enter. Skip anything you would rather not answer.'),
    h('div', { class: 'row between' },
      h('span', { class: 'small muted' }, full ? 'This conversation is at its length limit. Draft a post or start again.' : ''),
      h('button', { type: 'submit', class: 'primary', disabled: Boolean(ui.busy) || full }, 'Send')),
  );
  form.addEventListener('submit', (event) => { event.preventDefault(); send('question'); });
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); form.requestSubmit(); }
  });

  const hasAnswers = ui.messages.some((m) => m.role === 'participant');
  const lastOwn = [...ui.messages].reverse().find((m) => m.role === 'participant');

  return h('div', { class: 'field' },
    h('ol', { class: 'chat', 'aria-label': 'Interview' },
      messages.map((m) => h('li', { class: `bubble ${m.role}` },
        h('span', { class: 'who' }, m.role === 'participant' ? 'You' : m.opener ? 'Unite · opening question written by the demo, not the AI' : 'Unite (AI)'),
        m.text))),
    ui.busy ? h('div', { class: 'row', role: 'status' },
      h('p', { class: 'thinking' }, ui.busy.mode === 'draft' ? 'Drafting a post from your interview…' : 'Unite is thinking… (up to two minutes)'),
      h('button', { type: 'button', class: 'small', 'data-focus': 'stop', onClick: () => ui.busy?.controller.abort() }, 'Stop')) : null,
    ui.error ? h('div', { class: 'alert row between', role: 'alert' }, ui.error,
      !ui.busy && ui.messages.at(-1)?.role === 'participant'
        ? h('button', { type: 'button', class: 'small', 'data-focus': 'retry', onClick: () => send('question') }, 'Try again')
        : null) : null,
    form,
    h('section', { class: 'card quiet', 'aria-labelledby': 'share-title' },
      h('h2', { id: 'share-title' }, 'Share something publicly'),
      h('p', { class: 'small' }, 'Choose what, if anything, to share. The AI can draft a short post from your interview, or you can start from your last answer. Either way you edit it and pick a room before it is published.'),
      h('div', { class: 'row' },
        h('button', { type: 'button', 'data-focus': 'draft-ai', disabled: !hasAnswers || Boolean(ui.busy), onClick: () => send('draft') }, 'Draft a post with AI'),
        h('button', {
          type: 'button', 'data-focus': 'draft-self', disabled: !lastOwn,
          onClick: () => ctx.openPublish({ text: lastOwn?.text.slice(0, 1200) ?? '', title: 'Publish part of your answer', intro: 'Edit this down to what you want to say publicly.' }),
        }, 'Start from my last answer'),
      )),
    h('div', { class: 'row' },
      h('button', {
        type: 'button', class: 'ghost small danger', disabled: Boolean(ui.busy) || !ui.messages.length,
        onClick: async () => {
          if (await ctx.confirm({ title: 'Clear this conversation?', body: 'It is deleted from this tab, including your unsent answer. Nothing public changes.', confirmLabel: 'Clear conversation' })) {
            forget(ctx, ui);
            ui.messages = [];
            ui.opener = OPENER;
            ctx.clearDraft('talk:answer');
            save(ui);
            ctx.rerender();
          }
        },
      }, 'Clear conversation'),
      h('button', {
        type: 'button', class: 'ghost small',
        onClick: () => { forget(ctx, ui); withdrawConsent(); ctx.rerender(); },
      }, 'Withdraw AI consent for this tab'),
    ),
  );
}
