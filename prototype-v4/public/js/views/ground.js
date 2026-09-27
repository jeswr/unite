// Common ground for one room: the current proposed statement, where local
// participants stand, your own changeable stance, revisions and history.
// Counts cover only people using this local demo. Nothing declares consensus.

import { aiRequest, ensureConsent } from '../aiclient.js';
import { post as send } from '../api.js';
import { excerpt, h, plural, timeEl, uid } from '../dom.js';
import { joinPrompt, personLabel, roomTabs } from '../ui.js';

const STANCE_LABELS = { support: 'Support', concern: 'Concern', abstain: 'Abstain' };

export function renderGround(ctx) {
  const room = ctx.room(ctx.route.roomId);
  if (!room) return h('section', { class: 'view' }, h('h1', null, 'Room not found'), h('p', null, h('a', { href: '#/' }, 'Back to conversations')));
  const ground = ctx.data.grounds[room.id];

  return h('section', { class: 'view', 'aria-labelledby': 'ground-title' },
    h('header', { class: 'view-head' },
      h('p', { class: 'eyebrow' }, room.name),
      h('h1', { id: 'ground-title' }, 'Common ground'),
      h('p', { class: 'lede intro' }, 'A proposed statement people here might share, with the differences that remain. Anyone can respond or propose a better version.'),
      roomTabs(ctx, room.id, 'ground'),
    ),
    statementCard(ctx, room, ground.current, { current: true }),
    standings(ctx, ground),
    yourStance(ctx, room, ground),
    changeSection(ctx, room, ground),
    history(ctx, room, ground),
  );
}

function statementCard(ctx, room, version, { current }) {
  const proposer = version.sampleDraft
    ? h('span', null, 'Sample starting draft, written by the demo authors from the sample posts')
    : h('span', null, 'Proposed by ', personLabel(ctx, version.proposedBy), ' · ', timeEl(version.createdAt));
  return h('section', { class: `card${current ? ' summary-card' : ' quiet'}`, 'aria-labelledby': current ? 'statement-title' : null },
    current ? h('h2', { class: 'eyebrow', id: 'statement-title' }, `Proposed statement · version ${version.version}`) : null,
    h('p', { class: 'statement' }, version.text),
    h('p', { class: 'small muted' }, proposer),
    version.aiAssisted ? h('p', { class: 'small' }, h('span', { class: 'badge violet' }, 'AI-assisted (declared by the proposer)'), ' The proposer says AI helped draft it, and chose to propose it; the AI decided nothing. Unite cannot verify how any text was written.') : null,
    h('h3', null, 'Unresolved differences'),
    version.differences.length
      ? h('ul', { class: 'differences' }, version.differences.map((d) => h('li', null, d)))
      : h('p', { class: 'small muted' }, 'None listed. That does not mean there are none.'),
    h('h3', null, 'Drawn from'),
    version.sources.length
      ? h('ul', { class: 'sources small' }, version.sources.map((s) => h('li', null, sourceLink(ctx, room, s))))
      : h('p', { class: 'small muted' }, 'No source posts were listed.'),
  );
}

function sourceLink(ctx, room, source) {
  const p = ctx.post(source.postId);
  if (!p || source.withdrawn) return h('span', { class: 'muted' }, 'A post later withdrawn by its author');
  return h('a', { href: `#/room/${room.id}/post/${p.id}` }, `${p.author.name}${p.sample ? ' (sample)' : ''}: “${excerpt(p.text, 70)}”`);
}

function standings(ctx, ground) {
  const { tally, coverage } = ground;
  const concerns = ground.stances.filter((s) => s.stance === 'concern');
  const others = ground.stances.filter((s) => s.stance !== 'concern' && s.reason);
  const notYet = Math.max(0, coverage.joined - coverage.respondents);
  return h('section', { class: 'card', 'aria-labelledby': 'standing-title' },
    h('h2', { id: 'standing-title' }, `Where people here stand on version ${ground.current.version}`),
    h('dl', { class: 'tally' },
      ['support', 'concern', 'abstain'].map((key) => h('div', { class: key }, h('dt', null, STANCE_LABELS[key]), h('dd', null, String(tally[key]))))),
    h('p', { class: 'small' },
      `${plural(coverage.respondents, 'person has', 'people have')} responded, out of ${plural(coverage.joined, 'person', 'people')} who joined this local demo since the server started. `,
      notYet ? `${notYet} have not responded. ` : '',
      coverage.postAuthorsWithoutStance ? `${plural(coverage.postAuthorsWithoutStance, 'person who posted', 'people who posted')} in this room ${coverage.postAuthorsWithoutStance === 1 ? 'has' : 'have'} not responded yet. ` : '',
      'Sample authors are fictional and never respond. These numbers say nothing about anyone outside this demo.'),
    h('h3', null, `Concerns (${concerns.length})`),
    concerns.length
      ? h('ul', { class: 'reasons' }, concerns.map((s) => reasonItem(ctx, s)))
      : h('p', { class: 'small muted' }, 'No concerns raised on this version yet.'),
    others.length ? [h('h3', null, 'Other reasons given'), h('ul', { class: 'reasons' }, others.map((s) => reasonItem(ctx, s)))] : null,
  );
}

function reasonItem(ctx, s) {
  return h('li', { class: s.stance },
    h('span', { class: 'who' }, personLabel(ctx, s.participant), ` · ${STANCE_LABELS[s.stance].toLowerCase()}`),
    s.reason ? ` ${s.reason}` : '');
}

function yourStance(ctx, room, ground) {
  const version = ground.current.version;
  if (!ctx.me) {
    return h('section', { 'aria-label': 'Your response' }, joinPrompt(ctx, 'Join to support, raise a concern or abstain.'));
  }
  const mine = ground.stances.find((s) => ctx.isMe(s.participant));
  const key = `stance:${room.id}:v${version}`;
  const chosen = ctx.draft(`${key}:choice`, mine?.stance ?? '');
  const reasonId = uid('reason');
  const hintId = uid('hint');
  const reason = h('textarea', { id: reasonId, rows: 2, maxlength: 400, 'data-draft': `${key}:reason`, value: ctx.draft(`${key}:reason`, mine?.reason ?? ''), 'aria-describedby': hintId });
  const error = h('p', { class: 'error-text', role: 'alert' });
  const form = h('form', { class: 'card', 'aria-labelledby': 'stance-title' },
    h('h2', { id: 'stance-title' }, 'Your response'),
    mine ? h('p', { class: 'small' }, `You currently: ${STANCE_LABELS[mine.stance].toLowerCase()} (`, timeEl(mine.updatedAt), '). You can change it at any time.') : null,
    h('fieldset', null,
      h('legend', null, `Your stance on version ${version}`),
      h('div', { class: 'choices' }, ['support', 'concern', 'abstain'].map((value) => h('label', { class: `choice ${value}` },
        h('input', { type: 'radio', name: key, value, checked: chosen === value, 'data-draft': `${key}:choice`, required: true }),
        h('span', null, STANCE_LABELS[value])))),
    ),
    h('div', { class: 'field' },
      h('label', { for: reasonId }, 'Reason'),
      h('p', { class: 'hint', id: hintId }, 'Required for a concern, so others can respond to it. Optional otherwise. Public, with your display name.'),
      reason),
    error,
    h('div', { class: 'row end' }, h('button', { type: 'submit', class: 'primary' }, mine ? 'Update my response' : 'Save my response')),
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const stance = form.querySelector(`input[name="${key}"]:checked`)?.value;
    if (!stance) {
      error.textContent = 'Choose support, concern or abstain.';
      return;
    }
    const done = await ctx.run(() => send(`/api/rooms/${room.id}/stance`, { stance, reason: reason.value, expectedVersion: version }), { errorEl: error, success: 'Response saved.' });
    if (done) {
      ctx.clearDraft(`${key}:choice`);
      ctx.clearDraft(`${key}:reason`);
      ctx.rerender();
    }
  });
  return form;
}

function changeSection(ctx, room, ground) {
  const suggestions = (ctx.ui.suggestions ??= {});
  const state = suggestions[room.id];
  const ai = ctx.data.ai;

  const askAi = async () => {
    if (!ctx.me) return ctx.join(askAi);
    if (!(await ensureConsent(ctx))) return undefined;
    const controller = new AbortController();
    suggestions[room.id] = { status: 'busy', controller };
    ctx.rerender();
    try {
      const result = await aiRequest(`/api/rooms/${room.id}/synthesis`, {}, controller.signal);
      suggestions[room.id] = { status: 'done', result };
    } catch (error) {
      suggestions[room.id] = error.name === 'AbortError'
        ? { status: 'error', message: 'Stopped. Nothing was sent back.' }
        : { status: 'error', message: error.message };
    }
    ctx.rerender();
    return undefined;
  };

  return h('section', { class: 'card', 'aria-labelledby': 'change-title' },
    h('h2', { id: 'change-title' }, 'Improve it or act on it'),
    h('p', { class: 'small' }, `A new version starts with no responses. Version ${ground.current.version}, its responses and concerns move to the history below.`),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'primary', 'data-focus': 'propose', onClick: () => ctx.openStatementEditor(room.id) }, 'Propose a new version'),
      h('button', {
        type: 'button', 'data-focus': 'ask-ai', disabled: !ai.enabled || state?.status === 'busy', onClick: askAi,
        'aria-describedby': 'ai-help',
      }, 'Ask AI to suggest a synthesis'),
      h('button', { type: 'button', 'data-focus': 'to-action', onClick: () => ctx.openActionDialog(room.id) }, 'Turn this into an action'),
    ),
    h('p', { class: 'hint', id: 'ai-help' }, ai.enabled
      ? 'The AI reads only the public posts in this room and the current statement, never anyone\'s private interview. Its suggestion is shown only to you until you edit and propose it.'
      : `AI suggestions are unavailable: ${ai.reason}`),
    state ? suggestionPanel(ctx, room, state, suggestions) : null,
  );
}

function suggestionPanel(ctx, room, state, suggestions) {
  if (state.status === 'busy') {
    return h('div', { class: 'card suggestion', role: 'status' },
      h('p', { class: 'thinking' }, 'Asking the AI for a suggestion. This can take up to two minutes.'),
      h('div', { class: 'row' }, h('button', { type: 'button', 'data-focus': 'stop-ai', onClick: () => state.controller.abort() }, 'Stop')));
  }
  const discard = () => { delete suggestions[room.id]; ctx.rerender(); };
  if (state.status === 'error') {
    return h('div', { class: 'alert', role: 'alert' }, state.message, ' ', h('button', { type: 'button', class: 'ghost small', onClick: discard }, 'Dismiss'));
  }
  const { suggestion, basedOnVersion } = state.result;
  const outdated = basedOnVersion !== ctx.data.grounds[room.id].current.version;
  return h('div', { class: 'card suggestion' },
    h('p', { class: 'eyebrow' }, 'Private AI suggestion · only you can see this'),
    outdated ? h('p', { class: 'alert' }, `The statement changed after this suggestion was made (it was based on version ${basedOnVersion}).`) : null,
    h('p', { class: 'statement' }, suggestion.statement),
    h('h3', null, 'Differences it lists'),
    suggestion.differences.length ? h('ul', { class: 'differences' }, suggestion.differences.map((d) => h('li', null, d))) : h('p', { class: 'small muted' }, 'None listed.'),
    h('h3', null, 'Posts it cites'),
    suggestion.sourcePostIds.length
      ? h('ul', { class: 'sources small' }, suggestion.sourcePostIds.map((postId) => h('li', null, sourceLink(ctx, room, { postId, withdrawn: false }))))
      : h('p', { class: 'small muted' }, 'None.'),
    suggestion.droppedSources ? h('p', { class: 'small muted' }, `It also cited ${plural(suggestion.droppedSources, 'reference')} that did not match a current post here; ${suggestion.droppedSources === 1 ? 'it was' : 'they were'} left out.`) : null,
    h('p', { class: 'small' }, 'It is not a decision and not a count of agreement. Check it against the posts before using it.'),
    h('div', { class: 'row' },
      h('button', {
        type: 'button', class: 'primary',
        onClick: () => ctx.openStatementEditor(room.id, {
          text: suggestion.statement, differences: suggestion.differences, sourcePostIds: suggestion.sourcePostIds, aiAssisted: true,
        }),
      }, 'Edit and propose as a new version'),
      h('button', { type: 'button', onClick: discard }, 'Discard'),
    ),
  );
}

function history(ctx, room, ground) {
  if (!ground.history.length) return null;
  return h('section', { 'aria-labelledby': 'history-title', class: 'history' },
    h('h2', { id: 'history-title' }, 'Earlier versions'),
    ground.history.map((version) => {
      const closed = version.closed;
      const concerns = closed.responses.filter((r) => r.stance === 'concern');
      return h('details', { 'data-open-key': `history:${room.id}:${version.version}` },
        h('summary', null, `Version ${version.version} · ${closed.tally.support} support, ${closed.tally.concern} concern, ${closed.tally.abstain} abstain when replaced`),
        statementCard(ctx, room, version, { current: false }),
        h('h3', null, `Concerns at the time (${concerns.length})`),
        concerns.length
          ? h('ul', { class: 'reasons' }, concerns.map((r) => h('li', { class: 'concern' }, h('span', { class: 'who' }, r.name), r.reason)))
          : h('p', { class: 'small muted' }, 'None.'),
      );
    }),
  );
}
