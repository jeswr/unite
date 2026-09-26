// Read-only renderers shared by the demo app and the reader. They take plain
// public records (as found in a bundle) and return DOM nodes.

import { formatDate, formatDateTime, h } from './dom.js';
import { commitmentStatus } from './model.js';
import * as S from './schema.js';

const heading = (level, attrs, ...children) => h(`h${Math.min(Math.max(level, 2), 6)}`, attrs, ...children);

export function authorLine(author) {
  const kind = author.kind === 'local' ? 'user-authored' : author.kind === 'seed' ? 'fictional' : 'fictional role';
  return h('p', { class: 'byline' }, author.label, ' ', h('span', { class: 'tag tag--quiet' }, kind));
}

function textList(items) {
  return h('ul', { class: 'plain-list' }, items.map((item) => h('li', null, item)));
}

// What kind of change the option is: current provision, an experiment the
// example group can fund, or a recommendation others would have to adopt.
export function scopeLine(option) {
  return h('p', { class: `scope scope--${option.scope}` }, h('span', { class: 'tag' }, S.OPTION_SCOPES[option.scope]));
}

export function costLine(option) {
  const level = Object.keys(S.RELATIVE_COSTS).indexOf(option.relativeCost);
  return h(
    'div',
    { class: 'cost' },
    h(
      'p',
      { class: 'cost__label' },
      'Relative cost: ',
      h('strong', null, S.RELATIVE_COSTS[option.relativeCost]),
      h('span', { class: 'meter', 'aria-hidden': 'true', dataset: { level: String(level) } }, h('i'), h('i'), h('i')),
    ),
    h('p', { class: 'cost__estimate' }, option.costEstimate),
  );
}

export function optionDetails(option) {
  return h(
    'dl',
    { class: 'option-facts' },
    h('div', null, h('dt', null, 'Benefits'), h('dd', null, textList(option.benefits))),
    h('div', null, h('dt', null, 'Trade-offs'), h('dd', null, textList(option.tradeoffs))),
    h('div', null, h('dt', null, 'Evidence still needed'), h('dd', null, textList(option.evidenceNeeded))),
    h('div', null, h('dt', null, 'Who may be worse off'), h('dd', null, textList(option.worseOff))),
  );
}

function responseItem(response) {
  return h(
    'li',
    { class: `response response--${response.stance}` },
    h('p', null, response.reason || h('span', { class: 'muted' }, 'No reason given.')),
    authorLine(response.author),
  );
}

// Concerns are always listed first and separately; no counts or scores.
export function responsesFor(optionId, responses, level) {
  const mine = responses.filter((r) => r.optionId === optionId);
  const group = (stance, title, empty) => {
    const items = mine.filter((r) => r.stance === stance);
    return h(
      'div',
      { class: `responses responses--${stance}` },
      heading(level, { class: 'responses__title' }, title),
      items.length ? h('ul', { class: 'plain-list' }, items.map(responseItem)) : h('p', { class: 'muted' }, empty),
    );
  };
  return [
    group('concern', 'Concerns raised', 'No concerns recorded yet.'),
    group('info', 'Information requested', 'No information requests yet.'),
    group('support', 'Could support, and why', 'No supporting reasons recorded yet.'),
  ];
}

export function claimItem(claim) {
  return h(
    'li',
    { class: `claim claim--${claim.kind}` },
    h('p', { class: 'tag' }, S.CLAIM_KINDS[claim.kind]),
    h('p', { class: 'claim__text' }, claim.text),
    h('p', { class: 'claim__basis' }, h('span', { class: 'label' }, 'Basis: '), claim.basis),
  );
}

export function expertCard(expert, level) {
  return h(
    'article',
    { class: 'card expert' },
    heading(level, null, expert.role),
    h(
      'dl',
      { class: 'facts' },
      h('div', null, h('dt', null, 'Advises on'), h('dd', null, expert.advisesOn)),
      h('div', null, h('dt', null, 'Disclosed interest'), h('dd', null, expert.interest)),
    ),
  );
}

export function questionItem(question, { experts, options }) {
  const to = question.to === 'anyone' ? 'Anyone who can help' : experts.find((e) => e.id === question.to)?.role;
  const about = question.optionId ? options.find((o) => o.id === question.optionId)?.title : null;
  return h(
    'li',
    { class: 'question' },
    h('p', null, question.text),
    h(
      'p',
      { class: 'meta' },
      h('span', { class: 'tag tag--open' }, 'Open'),
      ` To: ${to}`,
      about ? ` · About: ${about}` : '',
    ),
    authorLine(question.author),
  );
}

export function aspirationBody(aspiration, allAspirations) {
  const source = aspiration.inspiredBy ? allAspirations.find((a) => a.id === aspiration.inspiredBy) : null;
  return [
    h(
      'p',
      { class: 'meta' },
      h('span', { class: 'tag' }, S.TOPICS[aspiration.topic]),
      ' ',
      aspiration.horizon === 'none' ? '' : h('span', { class: 'tag tag--quiet' }, S.HORIZONS[aspiration.horizon]),
    ),
    h(
      'dl',
      { class: 'facts' },
      h('div', null, h('dt', null, 'What is hard now'), h('dd', null, aspiration.hard)),
      h('div', null, h('dt', null, 'What should be different'), h('dd', null, aspiration.different)),
      aspiration.protect ? h('div', null, h('dt', null, 'What must be protected'), h('dd', null, aspiration.protect)) : null,
      source ? h('div', null, h('dt', null, 'Inspired by'), h('dd', null, source.title)) : null,
      aspiration.inspirationWithdrawn
        ? h('div', null, h('dt', null, 'Inspired by'), h('dd', { class: 'muted' }, 'A description that was later withdrawn'))
        : null,
    ),
    authorLine(aspiration.author),
  ];
}

export function statusText(status, commitment) {
  if (status.kind === 'responded') return 'Public response recorded.';
  if (status.kind === 'overdue') {
    return `Overdue: no public response ${status.days} ${status.days === 1 ? 'day' : 'days'} after the ${formatDate(commitment.responseDue)} due date.`;
  }
  return `Awaiting response: due ${formatDate(commitment.responseDue)} (${status.days} ${status.days === 1 ? 'day' : 'days'} left).`;
}

export function commitmentCard(commitment, decision, today, level) {
  const status = commitmentStatus(commitment, decision, today);
  const budget =
    commitment.proposedBudget === null
      ? 'No budget attached'
      : `${S.formatMoney(commitment.proposedBudget)} available (fictional; no real money)`;
  return h(
    'article',
    { class: `card commitment commitment--${status.kind}` },
    heading(level, null, commitment.title),
    h('p', { class: `status-pill status-pill--${status.kind}` }, statusText(status, commitment)),
    h(
      'dl',
      { class: 'facts' },
      h('div', null, h('dt', null, 'Decision owner'), h('dd', null, commitment.owner)),
      h('div', null, h('dt', null, 'Authority'), h('dd', null, commitment.authority)),
      h('div', null, h('dt', null, 'Budget'), h('dd', null, budget)),
      h('div', null, h('dt', null, 'Response due'), h('dd', null, formatDate(commitment.responseDue))),
      h('div', null, h('dt', null, 'Decision rule'), h('dd', null, commitment.decisionRule)),
    ),
  );
}

export function outcomeLabel(outcome, options) {
  return outcome === S.DEFER ? 'Decision deferred' : options.find((o) => o.id === outcome)?.title;
}

// Allocating a budget (the decision) and confirming its release (a later
// delivery step) are shown separately so the record never contradicts the trail.
function fundingFacts(decision, delivery) {
  if (decision.funding.kind !== 'budget') {
    return h('div', null, h('dt', null, 'Budget allocated'), h('dd', null, 'None. Nothing moves to delivery.'));
  }
  const confirmed = delivery.history.find((step) => step.state === 'resources-committed');
  return [
    h('div', null, h('dt', null, 'Budget allocated'), h('dd', null, `${S.formatMoney(decision.funding.amount)} (fictional; no real money)`)),
    h(
      'div',
      null,
      h('dt', null, S.DELIVERY_STATES['resources-committed']),
      h('dd', null, confirmed ? `Yes, ${formatDateTime(confirmed.at)}` : 'Not yet. The budget holder confirms release as the next delivery step.'),
    ),
  ];
}

export function decisionRecord(decision, delivery, options, level) {
  return h(
    'article',
    { class: 'card decision' },
    heading(level, null, 'Recorded decision: ', outcomeLabel(decision.outcome, options)),
    h(
      'dl',
      { class: 'facts' },
      h('div', null, h('dt', null, 'Decided by'), h('dd', null, decision.owner)),
      h('div', null, h('dt', null, 'Authority'), h('dd', null, decision.authority)),
      h('div', null, h('dt', null, 'Decision date'), h('dd', null, formatDate(decision.decidedOn))),
      fundingFacts(decision, delivery),
      h('div', null, h('dt', null, 'Public reasons'), h('dd', null, decision.reasons)),
    ),
    heading(level + 1, null, 'Concerns attached to this decision'),
    decision.attachedConcerns.length
      ? h(
          'ul',
          { class: 'plain-list' },
          decision.attachedConcerns.map((c) =>
            h(
              'li',
              { class: 'response response--concern' },
              h('p', null, c.reason || h('span', { class: 'muted' }, 'No reason given.')),
              h('p', { class: 'meta' }, 'On: ', outcomeLabel(c.optionId, options)),
              authorLine(c.author),
            ),
          ),
        )
      : h('p', { class: 'muted' }, 'No concerns had been raised when this decision was recorded.'),
  );
}

// The trail shows every state, marking which are done, current or blocked.
export function deliveryTrail(delivery, decision, acceptance = {}) {
  const reached = new Map(delivery.history.map((step) => [step.state, step]));
  const current = delivery.history.at(-1).state;
  const stopped =
    decision && (decision.outcome === S.DEFER || decision.funding.kind === 'none') ? 'decision-recorded' : null;
  return h(
    'ol',
    { class: 'trail' },
    S.DELIVERY_ORDER.map((state) => {
      const step = reached.get(state);
      const blocked = !step && stopped && S.DELIVERY_ORDER.indexOf(state) > S.DELIVERY_ORDER.indexOf(stopped);
      const kind = step ? (state === current ? 'current' : 'done') : blocked ? 'blocked' : 'upcoming';
      const statusWord = { current: 'Current', done: 'Done', blocked: 'Not applicable', upcoming: 'Not yet' }[kind];
      return h(
        'li',
        { class: `trail__step trail__step--${kind}`, 'aria-current': kind === 'current' ? 'step' : null },
        h('p', { class: 'trail__name' }, S.DELIVERY_STATES[state], ' ', h('span', { class: 'tag tag--quiet' }, statusWord)),
        step
          ? [h('p', null, step.evidence), h('p', { class: 'meta' }, 'Recorded ', formatDateTime(step.at))]
          : acceptance[state]
            ? h('p', { class: 'muted' }, 'Acceptance evidence: ', acceptance[state])
            : null,
      );
    }),
  );
}
