// Wires the demo page to the pure model. Static forms live in index.html;
// lists and records are rendered here from state after every change.

import { buildPublicBundle } from './bundle.js';
import { formatDateTime, h, hidden, renderRegion, todayISO } from './dom.js';
import { clearErrors, setStatus, showErrors } from './forms.js';
import * as M from './model.js';
import * as S from './schema.js';
import { ACCEPTANCE, CLAIMS, COMMITMENTS, EXPERTS, PROPOSAL, QUESTIONS } from './seed.js';
import { clearState, hasLegacyData, loadState, resolveStorage, saveState } from './storage.js';
import * as V from './views.js';

const $ = (selector) => document.querySelector(selector);
const storage = resolveStorage(() => window.localStorage);
const loaded = loadState(storage);
const legacy = hasLegacyData(storage);

let state = loaded.state;
const ui = { editingId: null, inspiredBy: null, shareDraftId: null, filter: { topic: 'all', savedOnly: false } };

// ----- shared plumbing -----------------------------------------------------

function commit(next) {
  state = next;
  const result = saveState(storage, state);
  if (!result.ok && result.reason === 'write-failed') {
    showStorageStatus('This browser refused to save the latest change (storage may be full). It will last until you close this tab.');
  }
  render();
}

function showStorageStatus(message) {
  const el = $('#storage-status');
  el.hidden = !message;
  el.textContent = message;
}

// Earlier-example data is explained, never shown, migrated or deleted.
const LEGACY_NOTE =
  'This browser also holds data from an earlier version of this demo, which used a different example with amounts in euros. It is left untouched and is not shown here, so none of its drafts, responses, decisions or budgets appear as if they belonged to this example. Resetting this demo does not remove it; your browser’s site-data settings can.';

function initialStorageMessage() {
  if (loaded.status === 'unavailable') {
    return 'Browser storage is not available here, so the demo is running in memory only. Everything is lost when you close or reload this tab.';
  }
  const notes = legacy ? [LEGACY_NOTE] : [];
  if (loaded.status === 'unreadable') {
    notes.push('Saved demo data in this browser could not be read, so the demo started fresh. The unreadable copy is kept aside until you reset the demo.');
  }
  if (loaded.skipped > 0) {
    notes.push(`${loaded.skipped} saved ${loaded.skipped === 1 ? 'record' : 'records'} could not be read and ${loaded.skipped === 1 ? 'was' : 'were'} skipped.`);
  }
  if (loaded.publicReset) {
    notes.push('The saved community records did not fit together, so shared copies, responses, questions and the decision were cleared. Private drafts were kept.');
  } else if (loaded.decisionDropped) {
    notes.push('The saved decision did not match its concerns, commitment or delivery trail, so it was removed and responses are open again.');
  }
  return notes.join(' ');
}

function focusKey(key) {
  document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`)?.focus();
}

function confirmAction({ title, body, confirmLabel }) {
  const dialog = $('#confirm-dialog');
  $('#confirm-title').textContent = title;
  $('#confirm-body').textContent = body;
  $('#confirm-ok').textContent = confirmLabel;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
  });
}

// Runs a model operation; routes field errors to the form, other errors to status.
function attempt(fn, { form, summary, fields, status }) {
  try {
    const result = fn();
    if (form) clearErrors(form, summary);
    return result;
  } catch (error) {
    if (error instanceof M.FieldErrors && form) showErrors(form, summary, error.errors, fields);
    else if (error instanceof Error && status) setStatus(status, error.message);
    else throw error;
    return undefined;
  }
}

const fillSelect = (select, entries) => {
  for (const [value, label] of entries) select.append(h('option', { value }, label));
};

const actionButton = (label, context, attrs) =>
  h('button', { type: 'button', class: 'button button--small', ...attrs }, label, hidden(` ${context}`));

const excerpt = (text, max = 70) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

// ----- 1. describe ---------------------------------------------------------

const describeFields = {
  hard: { id: 'd-hard', label: 'What is hard now', required: 'Describe what is hard now.' },
  different: { id: 'd-different', label: 'What should be different', required: 'Describe what should be different.' },
  protect: { id: 'd-protect', label: 'What must be protected' },
  topic: { id: 'd-topic', label: 'Topic', required: 'Choose a topic.' },
  horizon: { id: 'd-horizon', label: 'Time horizon' },
  inspiredBy: { id: 'inspiration-clear', label: 'The inspiration link' },
};

function initDescribe() {
  const form = $('#describe-form');
  fillSelect($('#d-topic'), Object.entries(S.TOPICS));
  fillSelect($('#d-horizon'), Object.entries(S.HORIZONS));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const wasEditing = ui.editingId;
    const result = attempt(
      () => M.saveDraft(state, { ...values, inspiredBy: ui.inspiredBy }, { editingId: ui.editingId }),
      { form, summary: $('#describe-errors'), fields: describeFields, status: $('#describe-status') },
    );
    if (!result) return;
    commit(result.state);
    resetDescribeForm();
    setStatus(
      $('#describe-status'),
      wasEditing ? 'Draft updated. It is still private.' : 'Private draft saved in this browser. It has not been shared.',
    );
  });

  $('#describe-cancel').addEventListener('click', () => {
    resetDescribeForm();
    setStatus($('#describe-status'), 'Editing cancelled. The saved draft is unchanged.');
    $('#d-hard').focus();
  });

  $('#inspiration-clear').addEventListener('click', () => {
    setInspiration(null);
    setStatus($('#describe-status'), 'Inspiration link removed.');
    $('#d-hard').focus();
  });

  $('#drafts').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const draft = state.drafts.find((d) => d.id === button.dataset.id);
    if (!draft) return;
    ({ edit: editDraft, delete: removeDraft, share: openShare, withdraw: withdrawCopy })[button.dataset.action](draft);
  });

  initShareDialog();
}

function setInspiration(aspirationId) {
  const source = aspirationId && M.allAspirations(state).find((a) => a.id === aspirationId);
  ui.inspiredBy = source ? aspirationId : null;
  $('#inspiration-note').hidden = !source;
  $('#inspiration-title').textContent = source ? source.title : '';
}

function resetDescribeForm() {
  const form = $('#describe-form');
  form.reset();
  clearErrors(form, $('#describe-errors'));
  ui.editingId = null;
  setInspiration(null);
  $('#describe-form-title').textContent = 'Your private draft';
  $('#describe-submit').textContent = 'Save private draft';
  $('#describe-cancel').hidden = true;
}

function editDraft(draft) {
  const form = $('#describe-form');
  resetDescribeForm();
  ui.editingId = draft.id;
  for (const name of ['hard', 'different', 'protect', 'topic', 'horizon']) form.elements[name].value = draft[name];
  setInspiration(draft.inspiredBy);
  $('#describe-form-title').textContent = 'Edit your private draft';
  $('#describe-submit').textContent = 'Save changes';
  $('#describe-cancel').hidden = false;
  $('#d-hard').focus();
  setStatus($('#describe-status'), 'Editing a private draft. Changes do not affect any shared copy.');
}

async function removeDraft(draft) {
  const note = draft.sharedId
    ? ' The separate copy you added to the demo community stays until you withdraw it.'
    : '';
  const ok = await confirmAction({
    title: 'Delete this private draft?',
    body: `The draft is removed from this browser.${note} Other demo data is not affected.`,
    confirmLabel: 'Delete draft',
  });
  if (!ok) return;
  if (ui.editingId === draft.id) resetDescribeForm();
  commit(M.deleteDraft(state, draft.id));
  $('#drafts-title').focus();
  setStatus($('#describe-status'), 'Private draft deleted.');
}

async function withdrawCopy(draft) {
  const ok = await confirmAction({
    title: 'Withdraw your shared copy?',
    body: 'It is removed from Explore and from future exports in this browser. In a real shared service, copies that other people had already received could not be guaranteed to disappear.',
    confirmLabel: 'Withdraw copy',
  });
  if (!ok) return;
  if (ui.inspiredBy === draft.sharedId) setInspiration(null);
  commit(M.withdrawShared(state, draft.sharedId));
  focusKey(`share-${draft.id}`);
  setStatus($('#describe-status'), 'Shared copy withdrawn. Your private draft is unchanged.');
}

const shareFields = {
  title: { id: 's-title', label: 'Public title', required: 'Give the shared copy a public title.' },
  hard: { id: 's-hard', label: 'What is hard now', required: 'Describe what is hard now.' },
  different: { id: 's-different', label: 'What should be different', required: 'Describe what should be different.' },
  protect: { id: 's-protect', label: 'What must be protected' },
  confirm: { id: 's-confirm', label: 'Confirmation', required: 'Confirm that you understand this copy will be visible.' },
};

function openShare(draft) {
  const form = $('#share-form');
  form.reset();
  clearErrors(form, $('#share-errors'));
  ui.shareDraftId = draft.id;
  form.elements.hard.value = draft.hard;
  form.elements.different.value = draft.different;
  // Topic, horizon and the inspiration link are copied as they are, so they
  // are shown here rather than shared unseen.
  const source = draft.inspiredBy ? M.allAspirations(state).find((a) => a.id === draft.inspiredBy) : null;
  renderRegion(
    $('#share-copied'),
    h('div', null, h('dt', null, 'Topic'), h('dd', null, S.TOPICS[draft.topic])),
    h('div', null, h('dt', null, 'Time horizon'), h('dd', null, S.HORIZONS[draft.horizon])),
    h('div', null, h('dt', null, 'Inspired by'), h('dd', null, source ? `“${source.title}” (shown as a link to that description)` : 'Nothing')),
  );
  $('#share-dialog').showModal();
}

function initShareDialog() {
  const dialog = $('#share-dialog');
  const form = $('#share-form');
  dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = { ...Object.fromEntries(new FormData(form)), confirm: form.elements.confirm.checked };
    const draftId = ui.shareDraftId;
    const result = attempt(() => M.shareDraft(state, draftId, values), {
      form,
      summary: $('#share-errors'),
      fields: shareFields,
      status: $('#describe-status'),
    });
    if (!result) return;
    dialog.close();
    commit(result.state);
    focusKey(`withdraw-${draftId}`);
    setStatus($('#describe-status'), `Added “${result.record.title}” to this demo community as a separate copy. Your private draft has not changed.`);
  });
}

function renderDrafts() {
  if (state.drafts.length === 0) {
    renderRegion($('#drafts'), h('p', { class: 'muted' }, 'No private drafts yet. Anything you save appears here, visible only in this browser.'));
    return;
  }
  const publicById = new Map(M.allAspirations(state).map((a) => [a.id, a]));
  renderRegion(
    $('#drafts'),
    h(
      'ul',
      { class: 'plain-list stack' },
      state.drafts.map((draft) => {
        const titleId = `draft-title-${draft.id}`;
        const context = `: ${excerpt(draft.hard, 40)}`;
        const shared = draft.sharedId ? publicById.get(draft.sharedId) : null;
        const source = draft.inspiredBy ? publicById.get(draft.inspiredBy) : null;
        return h(
          'li',
          null,
          h(
            'article',
            { class: 'card card--private', 'aria-labelledby': titleId },
            h('p', { class: 'meta' }, h('span', { class: 'tag tag--private' }, 'Private, only in this browser'), ` ${S.TOPICS[draft.topic]} · updated ${formatDateTime(draft.updatedAt)}`),
            h('h4', { id: titleId }, excerpt(draft.hard)),
            h(
              'dl',
              { class: 'facts' },
              h('div', null, h('dt', null, 'What is hard now'), h('dd', null, draft.hard)),
              h('div', null, h('dt', null, 'What should be different'), h('dd', null, draft.different)),
              draft.protect ? h('div', null, h('dt', null, 'What must be protected'), h('dd', null, draft.protect)) : null,
              draft.horizon !== 'none' ? h('div', null, h('dt', null, 'When'), h('dd', null, S.HORIZONS[draft.horizon])) : null,
              source ? h('div', null, h('dt', null, 'Inspired by'), h('dd', null, source.title)) : null,
            ),
            shared
              ? h('p', { class: 'shared-note' }, 'A separate copy titled “', shared.title, '” is in the demo community.')
              : null,
            h(
              'p',
              { class: 'actions' },
              actionButton('Edit', context, { dataset: { action: 'edit', id: draft.id, focusKey: `edit-${draft.id}` } }),
              actionButton('Delete', context, { class: 'button button--small button--quiet', dataset: { action: 'delete', id: draft.id, focusKey: `delete-${draft.id}` } }),
              shared
                ? actionButton('Withdraw shared copy', context, { dataset: { action: 'withdraw', id: draft.id, focusKey: `withdraw-${draft.id}` } })
                : actionButton('Add to this demo community…', context, { dataset: { action: 'share', id: draft.id, focusKey: `share-${draft.id}` } }),
            ),
          ),
        );
      }),
    ),
  );
}

// ----- 2. explore ----------------------------------------------------------

function initExplore() {
  fillSelect($('#filter-topic'), Object.entries(S.TOPICS));
  const update = () => {
    ui.filter = { topic: $('#filter-topic').value, savedOnly: $('#filter-saved').checked };
    renderExplore();
    setStatus($('#explore-status'), exploreCountText());
  };
  $('#filter-topic').addEventListener('change', update);
  $('#filter-saved').addEventListener('change', update);

  $('#aspirations').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const aspiration = M.allAspirations(state).find((a) => a.id === button.dataset.id);
    if (!aspiration) return;
    if (button.dataset.action === 'bookmark') {
      const saving = !state.bookmarks.includes(aspiration.id);
      commit(M.toggleBookmark(state, aspiration.id));
      if (!document.activeElement || document.activeElement === document.body) $('#filter-saved').focus();
      setStatus($('#explore-status'), saving ? `Saved “${aspiration.title}” in this browser.` : `Removed “${aspiration.title}” from your saved list.`);
    } else {
      setInspiration(aspiration.id);
      location.hash = '#describe';
      $('#d-hard').focus();
      setStatus($('#describe-status'), `Starting a new description inspired by “${aspiration.title}”. Write it in your own words; the link is kept as provenance.`);
    }
  });
}

function exploreCountText() {
  const shown = M.filterAspirations(state, ui.filter).length;
  const total = M.allAspirations(state).length;
  return `Showing ${shown} of ${total} descriptions.`;
}

// Share, withdraw, delete, import and reset change the totals without touching
// the filters, so every render refreshes the count when it has changed. An
// unchanged count leaves the region alone so a bookmark message is not clobbered.
let lastExploreCount = '';

function renderExplore() {
  const all = M.allAspirations(state);
  const shown = M.filterAspirations(state, ui.filter);
  const count = exploreCountText();
  if (count !== lastExploreCount) {
    lastExploreCount = count;
    $('#explore-status').textContent = count;
  }
  if (shown.length === 0) {
    renderRegion($('#aspirations'), h('li', { class: 'empty' }, 'No descriptions match. Try another topic, or clear “Only show descriptions I saved”.'));
    return;
  }
  renderRegion(
    $('#aspirations'),
    shown.map((a) => {
      const titleId = `asp-title-${a.id}`;
      const saved = state.bookmarks.includes(a.id);
      return h(
        'li',
        null,
        h(
          'article',
          { class: `card aspiration${a.author.kind === 'local' ? ' aspiration--mine' : ''}`, 'aria-labelledby': titleId },
          h('h3', { id: titleId }, a.title),
          V.aspirationBody(a, all),
          saved ? h('p', { class: 'tag tag--saved' }, 'Saved') : null,
          h(
            'p',
            { class: 'actions' },
            actionButton('Save', `“${a.title}”`, { 'aria-pressed': String(saved), dataset: { action: 'bookmark', id: a.id, focusKey: `bookmark-${a.id}` } }),
            actionButton('Start my own from this', `“${a.title}”`, { class: 'button button--small button--quiet', dataset: { action: 'inspire', id: a.id, focusKey: `inspire-${a.id}` } }),
          ),
        ),
      );
    }),
  );
}

// ----- 3. options and responses --------------------------------------------

function initProposal() {
  $('#proposal-question').textContent = PROPOSAL.question;
  $('#proposal-remit').textContent = PROPOSAL.remit;
  const list = $('#options');
  PROPOSAL.options.forEach((option, index) => list.append(optionCard(option, index)));
  list.addEventListener('submit', onResponseSubmit);
  list.addEventListener('click', onResponseRemove);
  PROPOSAL.options.forEach((o) => syncResponseForm(o.id));
}

function optionCard(option, index) {
  const titleId = `option-title-${option.id}`;
  const radio = (stance) =>
    h(
      'div',
      { class: 'field--check' },
      h('input', { type: 'radio', id: `r-${option.id}-${stance}`, name: 'stance', value: stance }),
      h('label', { for: `r-${option.id}-${stance}` }, S.STANCES[stance]),
    );
  return h(
    'li',
    null,
    h(
      'article',
      { class: 'card option', 'aria-labelledby': titleId },
      h('p', { class: 'eyebrow' }, `Option ${index + 1}`),
      h('h3', { id: titleId }, option.title),
      V.scopeLine(option),
      h('p', null, option.summary),
      V.costLine(option),
      V.optionDetails(option),
      h('div', { class: 'option__responses', id: `responses-${option.id}` }),
      h(
        'form',
        { class: 'response-form', novalidate: true, dataset: { optionId: option.id } },
        h('div', { class: 'error-summary', id: `r-${option.id}-errors`, tabindex: '-1', hidden: true }),
        h(
          'fieldset',
          null,
          h('legend', null, 'Your response to “', option.title, '”'),
          radio('support'),
          radio('concern'),
          radio('info'),
          h(
            'div',
            { class: 'field' },
            h('label', { for: `r-${option.id}-reason` }, 'Reason (optional)'),
            h('textarea', { id: `r-${option.id}-reason`, name: 'reason', rows: '2' }),
          ),
          h('p', { class: 'storage-note' }, 'Shown in this demo’s community view and the public export as “Participant in this browser”.'),
          h('p', { class: 'current', id: `current-${option.id}` }),
          h(
            'p',
            { class: 'actions' },
            h('button', { type: 'submit', class: 'button button--small button--primary' }, 'Save response', hidden(` to ${option.title}`)),
            h('button', { type: 'button', class: 'button button--small button--quiet', dataset: { action: 'remove-response', optionId: option.id } }, 'Remove my response', hidden(` to ${option.title}`)),
          ),
        ),
        h('p', { class: 'closed-note', hidden: true }, 'Responses closed when the decision was recorded.'),
      ),
    ),
  );
}

function syncResponseForm(optionId) {
  const form = document.querySelector(`form[data-option-id="${optionId}"]`);
  const mine = state.responses.find((r) => r.optionId === optionId);
  for (const radio of form.elements.stance) radio.checked = radio.value === mine?.stance;
  form.elements.reason.value = mine?.reason ?? '';
}

function onResponseSubmit(event) {
  const form = event.target.closest('form[data-option-id]');
  if (!form) return;
  event.preventDefault();
  const optionId = form.dataset.optionId;
  const title = PROPOSAL.options.find((o) => o.id === optionId).title;
  const summary = form.querySelector('.error-summary');
  const stance = form.elements.stance.value;
  if (!stance) {
    showErrors(form, summary, { stance: 'must be chosen' }, { stance: { id: `r-${optionId}-support`, label: 'Response', required: 'Choose how you respond to this option.' } });
    return;
  }
  const next = attempt(() => M.setResponse(state, { optionId, stance, reason: form.elements.reason.value }), {
    form,
    summary,
    fields: { reason: { id: `r-${optionId}-reason`, label: 'Reason' } },
    status: $('#proposal-status'),
  });
  if (!next) return;
  commit(next);
  syncResponseForm(optionId);
  setStatus($('#proposal-status'), `Saved your response to “${title}”: ${S.STANCES[stance].toLowerCase()}. You can change or remove it.`);
}

function onResponseRemove(event) {
  const button = event.target.closest('button[data-action="remove-response"]');
  if (!button) return;
  const { optionId } = button.dataset;
  const next = attempt(() => M.removeResponse(state, optionId), { status: $('#proposal-status') });
  if (!next) return;
  commit(next);
  syncResponseForm(optionId);
  document.querySelector(`form[data-option-id="${optionId}"] input[name="stance"]`).focus();
  setStatus($('#proposal-status'), `Removed your response to “${PROPOSAL.options.find((o) => o.id === optionId).title}”.`);
}

function renderOptions() {
  const responses = M.allResponses(state);
  for (const option of PROPOSAL.options) {
    renderRegion($(`#responses-${option.id}`), V.responsesFor(option.id, responses, 4));
    const mine = state.responses.find((r) => r.optionId === option.id);
    $(`#current-${option.id}`).textContent = mine
      ? `Your saved response: ${S.STANCES[mine.stance]}${mine.reason ? `, “${excerpt(mine.reason, 80)}”` : ''}.`
      : 'You have not responded to this option.';
    const form = document.querySelector(`form[data-option-id="${option.id}"]`);
    form.querySelector('fieldset').disabled = Boolean(state.decision);
    form.querySelector('.closed-note').hidden = !state.decision;
    form.querySelector('[data-action="remove-response"]').disabled = !mine || Boolean(state.decision);
  }
}

// ----- 4. evidence and questions -------------------------------------------

const questionFields = {
  text: { id: 'q-text', label: 'Your question', required: 'Write your question.' },
  to: { id: 'q-to', label: 'Addressed to' },
  optionId: { id: 'q-option', label: 'Option' },
};

function initEvidence() {
  renderRegion($('#claims'), CLAIMS.map(V.claimItem));
  renderRegion($('#experts'), EXPERTS.map((e) => V.expertCard(e, 4)));
  fillSelect($('#q-to'), [[M.ANYONE, 'Anyone who can help'], ...EXPERTS.map((e) => [e.id, e.role])]);
  fillSelect($('#q-option'), [['none', 'Not about a specific option'], ...PROPOSAL.options.map((o) => [o.id, o.title])]);

  const form = $('#question-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = attempt(() => M.addQuestion(state, Object.fromEntries(new FormData(form))), {
      form,
      summary: $('#question-errors'),
      fields: questionFields,
      status: $('#question-status'),
    });
    if (!result) return;
    commit(result.state);
    form.reset();
    setStatus($('#question-status'), 'Question added to the demo record. It stays open: nobody is routed to answer it in this demo.');
  });
}

function renderQuestions() {
  const context = { experts: EXPERTS, options: PROPOSAL.options };
  renderRegion($('#questions'), [...QUESTIONS, ...state.questions].map((q) => V.questionItem(q, context)));
}

// ----- 5. decision and delivery --------------------------------------------

const decisionFields = {
  outcome: { id: 'dec-outcome', label: 'Outcome', required: 'Choose an outcome.' },
  owner: { id: 'dec-owner', label: 'Decision owner', required: 'Enter who is responsible for the decision.' },
  reasons: { id: 'dec-reasons', label: 'Public reasons', required: 'Give the public reasons for the decision.' },
  decidedOn: { id: 'dec-date', label: 'Decision date', required: 'Enter the decision date.' },
  fundingKind: { id: 'dec-funding-budget', label: 'Funding', required: 'Choose whether a budget is allocated.' },
  amount: { id: 'dec-amount', label: 'Amount', required: 'Enter the budget in whole US dollars, or choose “No budget allocated”.' },
};

function initDecision() {
  const commitment = M.mainCommitment();
  $('#dec-owner-hint').textContent = `The body named on the commitment: ${commitment.owner}.`;
  $('#dec-funding-hint').textContent = `The decision allocates up to ${S.formatMoney(commitment.proposedBudget)}, and only to the community experiment. A recommendation is published for others to adopt and fund. Confirming that allocated money will be released is a separate, later step on the delivery trail.`;
  fillSelect($('#dec-outcome'), [['', 'Choose an outcome'], ...PROPOSAL.options.map((o) => [o.id, o.title]), [S.DEFER, 'Defer: no decision yet']]);
  const form = $('#decision-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = attempt(() => M.recordDecision(state, Object.fromEntries(new FormData(form))), {
      form,
      summary: $('#decision-errors'),
      fields: decisionFields,
      status: $('#decision-status'),
    });
    if (!next) return;
    commit(next);
    form.reset();
    $('#decision-record h3')?.focus();
    const count = next.decision.attachedConcerns.length;
    setStatus($('#decision-status'), `Decision recorded with ${count} ${count === 1 ? 'concern' : 'concerns'} attached. Responses to the options are now closed.`);
  });

  const advance = $('#advance-form');
  advance.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = attempt(() => M.advanceDelivery(state, advance.elements.evidence.value), {
      form: advance,
      summary: $('#advance-errors'),
      fields: { evidence: { id: 'adv-evidence', label: 'Acceptance evidence', required: 'Describe the acceptance evidence for this step.' } },
      status: $('#advance-status'),
    });
    if (!next) return;
    commit(next);
    advance.reset();
    const reached = S.DELIVERY_STATES[M.currentDeliveryState(state.delivery)];
    if (advance.hidden) $('#advance-blocked').focus();
    setStatus($('#advance-status'), `Delivery trail now at “${reached}”.`);
  });
}

function renderUnresolved() {
  const bundle = buildPublicBundle(state);
  const context = { experts: bundle.experts, options: bundle.proposal.options };
  renderRegion(
    $('#unresolved'),
    h('h4', null, `Open questions (${bundle.questions.length})`),
    h('ul', { class: 'plain-list stack' }, bundle.questions.map((q) => V.questionItem(q, context))),
    h('h4', null, 'Concerns, by option'),
    h('p', { class: 'muted' }, 'Every concern is listed in full. Nothing is merged or dropped because few people raised it.'),
    h(
      'dl',
      { class: 'facts facts--stacked' },
      bundle.proposal.options.map((option) => {
        const concerns = bundle.responses.filter((r) => r.optionId === option.id && r.stance === 'concern');
        return h(
          'div',
          null,
          h('dt', null, option.title),
          h(
            'dd',
            null,
            concerns.length
              ? h('ul', { class: 'plain-list' }, concerns.map((c) => h('li', null, c.reason || 'No reason given.', ' — ', c.author.label)))
              : h('span', { class: 'muted' }, 'No concerns recorded.'),
          ),
        );
      }),
    ),
  );
}

function renderDecision() {
  const today = todayISO();
  const commitment = M.mainCommitment();
  renderRegion($('#main-commitment'), V.commitmentCard(commitment, state.decision, today, 3));
  $('#decision-form').hidden = Boolean(state.decision);
  renderRegion(
    $('#decision-record'),
    state.decision ? V.decisionRecord(state.decision, state.delivery, PROPOSAL.options, 3) : null,
  );
  $('#decision-record h3')?.setAttribute('tabindex', '-1');

  renderRegion($('#trail'), V.deliveryTrail(state.delivery, state.decision, ACCEPTANCE));
  const step = M.nextDeliveryStep(state.delivery, state.decision);
  $('#advance-form').hidden = !step.next;
  $('#advance-blocked').hidden = Boolean(step.next);
  $('#advance-blocked').textContent = step.reason ?? '';
  if (step.next) {
    const label = S.DELIVERY_STATES[step.next];
    $('#advance-title').textContent = `Record the next step: ${label}`;
    $('#advance-criteria').textContent = `Acceptance evidence expected: ${ACCEPTANCE[step.next]}`;
    $('#advance-submit').textContent = `Mark as “${label}”`;
  }

  renderRegion(
    $('#other-commitments'),
    COMMITMENTS.filter((c) => c.id !== commitment.id).map((c) => V.commitmentCard(c, state.decision, today, 4)),
  );
}

// ----- 6. export and reset -------------------------------------------------

function exportText() {
  return JSON.stringify(buildPublicBundle(state), null, 2);
}

function initExport() {
  $('#export-download').addEventListener('click', () => {
    const name = `unite-demo-learning-example-v${S.SCHEMA_VERSION}-${todayISO()}.json`;
    const url = URL.createObjectURL(new Blob([exportText()], { type: 'application/json' }));
    const link = h('a', { href: url, download: name, hidden: true });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus($('#export-status'), `Downloaded ${name}. It contains no private drafts or bookmarks.`);
  });
  $('#export-preview').addEventListener('toggle', renderExportPreview);

  $('#reset-button').addEventListener('click', async () => {
    const ok = await confirmAction({
      title: 'Reset the whole demo?',
      body: 'This deletes everything this demo stored in this browser for the current example: private drafts, shared demo records, bookmarks, responses, questions, the decision and delivery progress. Files you exported and data from earlier versions of the demo are not affected. This cannot be undone.',
      confirmLabel: 'Reset demo',
    });
    if (!ok) return;
    clearState(storage);
    state = M.emptyState();
    resetDescribeForm();
    for (const form of document.querySelectorAll('#question-form, #decision-form, #advance-form')) form.reset();
    render();
    PROPOSAL.options.forEach((o) => syncResponseForm(o.id));
    showStorageStatus(loaded.status === 'unavailable' ? initialStorageMessage() : legacy ? LEGACY_NOTE : '');
    setStatus($('#reset-status'), 'The demo was reset. Everything it stored in this browser for the current example was removed.');
  });
}

function renderExportPreview() {
  if ($('#export-preview').open) $('#export-json').textContent = exportText();
}

// ----- boot ----------------------------------------------------------------

// The scope explainer is collapsed by default; links to it open it.
function openAboutIfTargeted() {
  if (location.hash === '#about-demo') $('#about-demo-details').open = true;
}
window.addEventListener('hashchange', openAboutIfTargeted);
document.addEventListener('click', (event) => {
  if (event.target.closest('a[href="#about-demo"]')) $('#about-demo-details').open = true;
});
openAboutIfTargeted();

function render() {
  renderDrafts();
  renderExplore();
  renderOptions();
  renderQuestions();
  renderUnresolved();
  renderDecision();
  renderExportPreview();
}

initDescribe();
initExplore();
initProposal();
initEvidence();
initDecision();
initExport();
render();
showStorageStatus(initialStorageMessage());
