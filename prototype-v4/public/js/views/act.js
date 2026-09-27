// Act next: proposals made from a room's common ground. Readiness (owner,
// open concerns, owner review of changed context, adoption) is shown before
// any score. The priority is computed by the server and explained; viewers
// pick the order. Statuses are the owner's report; for institutional
// proposals they cover only the proposal work, never adoption.

import { post as send } from '../api.js';
import { formatDate, h, plural, timeEl, uid } from '../dom.js';
import { personLabel } from '../ui.js';

const LANES = [
  ['proposed', 'Proposed', 'Suggested. Not started yet.'],
  ['ready', 'Ready', 'The owner reports it can start (for a proposal: can be drafted).'],
  ['doing', 'Doing', 'The owner reports work on the next step, or on preparing a proposal.'],
  ['done', 'Done', 'The first step or experiment finished, or the proposal work was completed. Never means an institution adopted it.'],
];
const HOLDS = ['open-concerns', 'context-review'];
const STATUS_NAMES = Object.fromEntries(LANES.map(([key, name]) => [key, name]));
const LEVEL = { 1: 'low', 2: 'medium', 3: 'high' };
const KIND = { rights: 'Rights', access: 'Access', dependency: 'Dependency' };

const ORDERS = {
  priority: ['Priority (highest first)', (a, b) => b.priority - a.priority],
  attention: ['Needs attention first', (a, b) => attention(b) - attention(a) || b.priority - a.priority],
  urgency: ['Urgency', (a, b) => b.urgency - a.urgency],
  impact: ['Impact', (a, b) => b.impact - a.impact],
  effort: ['Least effort first', (a, b) => a.effort - b.effort],
  checkin: ['Soonest check-in', (a, b) => a.checkIn.localeCompare(b.checkIn)],
  newest: ['Newest', () => 0],
};
const attention = (a) => a.openChecks * 2 + a.context.reviewNeeded.length * 2 + (a.stale.length ? 1 : 0) + (a.owner ? 0 : 1);

export function renderAct(ctx) {
  const ui = (ctx.ui.act ??= { order: 'priority', room: '', scope: '' });
  const board = h('div');
  const draw = () => board.replaceChildren(renderBoard(ctx, ui));
  draw();
  return h('section', { class: 'view', 'aria-labelledby': 'act-title' },
    h('header', { class: 'view-head' },
      h('p', { class: 'eyebrow' }, 'Act next'),
      h('h1', { id: 'act-title' }, 'Turn common ground into next steps'),
      h('p', { class: 'lede' }, 'Small, concrete proposals from people in this local demo, each able to say what it is meant to change in everyday life. No money moves here and nothing on this board carries any authority: statuses are owners\' own reports, intended changes are not measured results, and institutional proposals are never marked as adopted.'),
    ),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'primary', 'data-focus': 'new-action', onClick: () => ctx.openActionDialog(ui.room || 'work') }, 'New action from a room\'s statement')),
    controls(ctx, ui, draw),
    h('details', { class: 'card quiet', 'data-open-key': 'priority-help' },
      h('summary', null, 'How priority is computed, and what it is not'),
      h('div', { class: 'prose small' },
        h('p', null, 'Each proposer rates impact, urgency and effort as low (1), medium (2) or high (3). Priority = impact + urgency + (4 − effort), a whole number from 3 to 9. The server computes it; nobody can type a score.'),
        h('p', null, 'It is a rough, self-reported sort key, not a measurement or a vote. Change the order above to see the board another way. Open concerns and stale context are shown before the score on every card, and a high score never hides a concern.'),
      )),
    board,
  );
}

function controls(ctx, ui, draw) {
  const make = (id, label, value, options, onPick) => {
    const select = h('select', { id, 'data-focus': id }, options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
    select.addEventListener('change', () => { onPick(select.value); draw(); });
    return h('div', { class: 'field' }, h('label', { for: id }, label), select);
  };
  return h('search', { class: 'filters', 'aria-label': 'Order and filter actions' },
    make('act-order', 'Order by', ui.order, Object.entries(ORDERS).map(([k, [l]]) => [k, l]), (v) => { ui.order = v; }),
    make('act-room', 'Room', ui.room, [['', 'All rooms'], ...ctx.data.rooms.map((r) => [r.id, r.name])], (v) => { ui.room = v; }),
    make('act-scope', 'Scope', ui.scope, [['', 'All scopes'], ['community', 'Community experiments'], ['institutional', 'Institutional proposals']], (v) => { ui.scope = v; }),
  );
}

function renderBoard(ctx, ui) {
  const newestFirst = [...ctx.data.actions].reverse();
  const items = newestFirst
    .filter((a) => (!ui.room || a.roomId === ui.room) && (!ui.scope || a.scope === ui.scope))
    .sort(ORDERS[ui.order][1]);
  if (!ctx.data.actions.length) {
    return h('p', { class: 'empty' }, 'No actions yet. Open a room\'s common ground and choose “Turn this into an action”, or use the button above.');
  }
  return h('div', { class: 'board' }, LANES.map(([key, name, description]) => {
    const lane = items.filter((a) => a.status === key);
    const titleId = `lane-${key}`;
    return h('section', { class: 'lane', 'aria-labelledby': titleId },
      h('header', null, h('h2', { id: titleId }, `${name} (${lane.length})`), h('p', null, description)),
      lane.length ? h('ol', null, lane.map((a) => h('li', null, actionCard(ctx, a)))) : h('p', { class: 'small muted' }, 'Nothing here.'),
    );
  }));
}

function actionCard(ctx, a) {
  const titleId = `action-${a.id}`;
  return h('article', { class: 'action', 'aria-labelledby': titleId },
    h('h3', { id: titleId }, a.title),
    h('p', { class: 'row small' },
      h('a', { class: 'chip', href: `#/room/${a.roomId}/ground` }, ctx.roomName(a.roomId)),
      h('span', { class: `badge ${a.scope === 'community' ? 'green' : 'violet'}` }, a.scope === 'community' ? 'Community experiment' : 'Institutional proposal')),
    h('p', { class: 'small status-meaning' }, a.statusMeaning),
    readiness(a),
    h('dl', null,
      a.lifeChange ? [h('dt', null, 'Intended change in everyday life'), h('dd', null, a.lifeChange)] : null,
      a.lifeSigns ? [h('dt', null, 'How people will know it helped (intended, not measured)'), h('dd', null, a.lifeSigns)] : null,
      h('dt', null, 'Next step'), h('dd', null, a.nextStep),
      h('dt', null, 'Owner'), h('dd', null, a.owner ? personLabel(ctx, a.owner) : 'Needs a volunteer to own it'),
      h('dt', null, 'Volunteers'), h('dd', null, a.volunteers.length ? a.volunteers.map((v, i) => [i ? ', ' : '', v.name]) : 'None yet'),
      h('dt', null, 'Check-in'), h('dd', null, formatDate(a.checkIn)),
    ),
    h('p', { class: 'priority' },
      h('strong', null, `Priority ${a.priority}`),
      ` = impact ${a.impact} (${LEVEL[a.impact]}) + urgency ${a.urgency} (${LEVEL[a.urgency]}) + ease ${4 - a.effort} (effort ${LEVEL[a.effort]})`),
    details(ctx, a),
  );
}

function readiness(a) {
  const notes = [];
  if (a.openChecks) {
    const kinds = [...new Set(a.checks.filter((c) => c.status === 'open').map((c) => KIND[c.kind].toLowerCase()))].join(', ');
    notes.push(h('p', null, `${plural(a.openChecks, 'open concern')} (${kinds}). Someone must record how it is handled before this moves forward.`));
  }
  if (!a.owner) notes.push(h('p', null, 'Needs an owner before it can be ready.'));
  for (const reason of a.context.reviewNeeded) {
    notes.push(h('p', null, `Owner review needed: ${reason}`));
  }
  if (a.snapshot.concerns.length) notes.push(h('p', { class: 'stale' }, `Created while ${plural(a.snapshot.concerns.length, 'concern')} on the statement remained.`));
  // Changes that need no review (for example new support) are information only.
  if (!a.context.reviewNeeded.length) {
    for (const reason of a.stale) notes.push(h('p', { class: 'stale' }, `Changed since creation: ${reason}`));
  }
  if (a.scope === 'institutional') {
    notes.push(h('p', { class: 'adoption' }, `Would need adoption by ${a.institution}. Adoption unconfirmed: Unite never records adoption, and naming an institution gives no authority.`));
  }
  return notes.length ? h('div', { class: 'readiness' }, notes) : null;
}

// The owner compares the room's current statement and concerns with the
// action and records why it can still go ahead. The server accepts it only
// for exactly the context shown here (`a.context.id`).
function reviewSection(ctx, a) {
  const ground = ctx.data.grounds[a.roomId];
  const concerns = ground.stances.filter((s) => s.stance === 'concern');
  const canReview = ctx.isMe(a.owner) && a.context.reviewNeeded.length > 0;
  return h('section', { 'aria-label': 'Owner review of the room context' },
    h('h4', null, 'Room context now'),
    h('div', { class: 'snapshot' },
      h('p', { class: 'eyebrow' }, `${ctx.roomName(a.roomId)} statement version ${ground.current.version}`),
      h('p', { class: 'statement' }, ground.current.text),
      concerns.length
        ? h('ul', { class: 'differences small' }, concerns.map((c) => h('li', null, `${c.participant.name}: ${c.reason}`)))
        : h('p', { class: 'small muted' }, 'No concerns on this version.'),
      h('p', { class: 'small' }, h('a', { href: `#/room/${a.roomId}/ground` }, 'Open this common ground'))),
    canReview ? inlineForm(ctx, {
      key: `review:${a.id}`,
      label: 'You own this action. Having read the statement and concerns above, why can it still go ahead? The concerns stay on record.',
      button: 'Record my review',
      submit: (text) => send(`/api/actions/${a.id}/review`, { contextId: a.context.id, text }),
    }) : null,
    a.reviews.length ? h('ul', { class: 'checks' }, a.reviews.slice().reverse().map((r) => h('li', null,
      h('span', { class: 'small' }, 'Reviewed by ', personLabel(ctx, r.by), ' · ', timeEl(r.at),
        ` · version ${r.version} with ${plural(r.concerns.length, 'concern')}`),
      r.text,
      r.concerns.length ? h('ul', { class: 'small' }, r.concerns.map((c) => h('li', null, `${c.name}: ${c.reason}`))) : null))) : null,
  );
}

function details(ctx, a) {
  return h('details', { 'data-open-key': `action:${a.id}` },
    h('summary', null, 'Concerns, context and updates'),
    h('div', null,
      checksSection(ctx, a),
      reviewSection(ctx, a),
      snapshotSection(ctx, a),
      a.updates.length ? h('section', { 'aria-label': 'Next-step updates' },
        h('h4', null, 'Next-step updates'),
        h('ul', { class: 'checks' }, a.updates.slice().reverse().map((u) => h('li', null, h('span', { class: 'small' }, personLabel(ctx, u.by), ' · ', timeEl(u.at)), u.text)))) : null,
      h('p', { class: 'small muted' }, 'Proposed by ', personLabel(ctx, a.createdBy), ' · ', timeEl(a.createdAt), `. First step: ${a.firstStep}`),
      participation(ctx, a),
    ),
  );
}

function checksSection(ctx, a) {
  return h('section', { 'aria-label': 'Rights, access and dependency concerns' },
    h('h4', null, 'Rights, access and dependency concerns'),
    a.checks.length ? h('ul', { class: 'checks' }, a.checks.map((c) => checkItem(ctx, a, c))) : h('p', { class: 'small muted' }, 'None raised yet.'),
    ctx.me ? addCheckForm(ctx, a) : null,
  );
}

function checkItem(ctx, a, c) {
  const last = c.history.at(-1);
  const canReopen = c.status === 'addressed' && ctx.isMe(c.raisedBy);
  const op = c.status === 'open' ? 'address' : canReopen ? 'reopen' : null;
  return h('li', { class: c.status },
    h('p', { class: 'small' }, h('strong', null, `${KIND[c.kind]} · ${c.status === 'open' ? 'open' : 'response recorded'}`), ' · raised by ', personLabel(ctx, c.raisedBy)),
    h('p', null, c.text),
    c.history.length > 1 ? h('ul', { class: 'small' }, c.history.slice(1).map((e) => h('li', null,
      `${e.op === 'address' ? 'Response' : 'Reopened'} by `, personLabel(ctx, e.by), `: ${e.text}`))) : null,
    op && ctx.me ? inlineForm(ctx, {
      key: `check:${c.id}:${op}:${last.at}`,
      label: op === 'address' ? 'How will this be handled?' : 'Why reopen it?',
      button: op === 'address' ? 'Record response' : 'Reopen concern',
      submit: (text) => send(`/api/actions/${a.id}/checks/${c.id}`, { op, text }),
    }) : null,
  );
}

function addCheckForm(ctx, a) {
  const key = `newcheck:${a.id}`;
  const kindId = uid('kind');
  const kind = h('select', { id: kindId, 'data-draft': `${key}:kind` },
    Object.entries(KIND).map(([value, label]) => h('option', { value, selected: ctx.draft(`${key}:kind`, 'access') === value }, label)));
  return inlineForm(ctx, {
    key,
    label: 'Raise a concern',
    button: 'Add concern',
    extra: h('div', { class: 'field' }, h('label', { for: kindId }, 'Type'), kind),
    submit: (text) => send(`/api/actions/${a.id}/checks`, { kind: kind.value, text }),
  });
}

function snapshotSection(ctx, a) {
  const s = a.snapshot;
  return h('section', { class: 'snapshot', 'aria-label': 'Statement this action was based on' },
    h('p', { class: 'eyebrow' }, `Based on ${ctx.roomName(a.roomId)} statement version ${s.version}, as it stood then`),
    h('p', { class: 'statement' }, s.text),
    h('p', { class: 'small' }, `Local responses then: ${s.tally.support} support · ${s.tally.concern} concern · ${s.tally.abstain} abstain.`),
    s.concerns.length ? h('ul', { class: 'differences small' }, s.concerns.map((c) => h('li', null, `${c.name}: ${c.reason}`))) : null,
    s.differences.length ? h('p', { class: 'small' }, `Unresolved differences then: ${s.differences.join(' · ')}`) : null,
  );
}

function participation(ctx, a) {
  if (!ctx.me) {
    return h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary small', onClick: () => ctx.join() }, 'Join to volunteer'));
  }
  const isOwner = ctx.isMe(a.owner);
  const isVolunteer = a.volunteers.some((v) => ctx.isMe(v));
  const controls = [];
  if (!a.owner) controls.push(button(ctx, `own:${a.id}`, 'Take ownership', () => send(`/api/actions/${a.id}/own`), 'You now own this action.'));
  if (!isOwner) {
    controls.push(button(ctx, `vol:${a.id}`, isVolunteer ? 'Stop volunteering' : 'Volunteer',
      () => send(`/api/actions/${a.id}/volunteer`, { join: !isVolunteer }), isVolunteer ? 'You are no longer listed.' : 'Thanks, you are listed as a volunteer.'));
  }
  if (isOwner) {
    for (const status of a.nextStatuses) {
      const forward = LANES.findIndex(([k]) => k === status) > LANES.findIndex(([k]) => k === a.status);
      const blocked = forward && a.blockers.some((b) => HOLDS.includes(b));
      controls.push(button(ctx, `status:${a.id}:${status}`, `Move to ${STATUS_NAMES[status]}`,
        () => send(`/api/actions/${a.id}/status`, { status }), `Moved to ${STATUS_NAMES[status]}.`, blocked));
    }
  }
  const holds = [
    a.openChecks ? 'each open concern has a recorded response' : null,
    a.context.reviewNeeded.length ? 'you record a review of the room context above' : null,
  ].filter(Boolean);
  return h('div', { class: 'field' },
    h('div', { class: 'row' }, controls),
    isOwner && holds.length ? h('p', { class: 'hint' }, `Moving forward is disabled until ${holds.join(' and ')}.`) : null,
    isOwner || isVolunteer ? inlineForm(ctx, {
      key: `next:${a.id}`,
      label: 'Update the next step',
      button: 'Save next step',
      submit: (text) => send(`/api/actions/${a.id}/next-step`, { text }),
    }) : null,
  );
}

function button(ctx, focusKey, label, task, success, disabled = false) {
  return h('button', {
    type: 'button', class: 'small', 'data-focus': focusKey, disabled,
    onClick: () => ctx.run(task, { success }),
  }, label);
}

function inlineForm(ctx, { key, label, button: buttonLabel, submit, extra = null }) {
  const id = uid('inline');
  const textarea = h('textarea', { id, rows: 2, maxlength: 400, 'data-draft': key, value: ctx.draft(key) });
  const error = h('p', { class: 'error-text', role: 'alert' });
  const form = h('form', { class: 'mini-form' },
    extra, h('label', { for: id, class: 'small' }, label), textarea, error,
    h('div', { class: 'row end' }, h('button', { type: 'submit', class: 'small' }, buttonLabel)));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const done = await ctx.run(() => submit(textarea.value), { errorEl: error });
    if (done) {
      ctx.clearDraft(key);
      ctx.rerender();
    }
  });
  return form;
}
