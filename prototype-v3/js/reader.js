// The read-only reader: validates an exported bundle and renders it using
// only what the file contains.

import { NOTICE, parseBundle } from './bundle.js';
import { formatDateTime, h, renderRegion, todayISO } from './dom.js';
import { clearErrors, setStatus, showErrors } from './forms.js';
import { LIMITS } from './schema.js';
import * as V from './views.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#reader-form');
const output = $('#reader-output');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = form.elements.file.files[0];
  const pasted = form.elements.paste.value;
  let text;
  if (file) {
    if (file.size > LIMITS.bundleBytes) {
      return fail('file', `The file is ${Math.ceil(file.size / 1024)} KB. Demo bundles must be under ${LIMITS.bundleBytes / 1024} KB.`);
    }
    try {
      text = await file.text();
    } catch {
      return fail('file', 'The file could not be read. Try choosing it again.');
    }
  } else if (pasted.trim()) {
    text = pasted;
  } else {
    return fail('file', 'Choose an exported JSON file, or paste its contents.');
  }
  const result = parseBundle(text);
  if (!result.ok) return fail(file ? 'file' : 'paste', result.message);

  clearErrors(form, $('#reader-errors'));
  renderBundle(result.bundle);
  output.focus();
  setStatus($('#reader-status'), 'The file passed the checks. Its record is shown below.');
});

function fail(field, message) {
  renderRegion(output);
  const ids = { file: 'reader-file', paste: 'reader-paste' };
  showErrors(form, $('#reader-errors'), { [field]: message }, { [field]: { id: ids[field], message } });
  setStatus($('#reader-status'), '');
}

const section = (id, title, ...children) =>
  h(
    'section',
    { class: 'section section--reader', 'aria-labelledby': id },
    h('div', { class: 'wrap' }, h('h2', { id }, title), ...children),
  );

function renderBundle(bundle) {
  const { proposal } = bundle;
  const options = proposal.options;
  const userAuthored = bundle.aspirations.filter((a) => a.author.kind === 'local').length;
  const today = todayISO();

  renderRegion(
    output,
    section(
      'file-about',
      'About this file',
      h(
        'dl',
        { class: 'facts facts--compact' },
        h('div', null, h('dt', null, 'Format'), h('dd', null, `${bundle.format}, version ${bundle.schemaVersion}`)),
        h('div', null, h('dt', null, 'Currency'), h('dd', null, `${bundle.currency} (fictional amounts)`)),
        h('div', null, h('dt', null, 'Exported'), h('dd', null, formatDateTime(bundle.exportedAt))),
        h('div', null, h('dt', null, 'Contents'), h('dd', null, `${bundle.aspirations.length} descriptions (${userAuthored} user-authored), ${bundle.responses.length} responses, ${bundle.questions.length} open questions`)),
      ),
      h('h3', null, 'Demo disclosures'),
      h('p', { class: 'muted' }, 'Built into this reader. Files whose disclosures differ are not opened.'),
      h('ul', { class: 'notice-list' }, [NOTICE.fictionalSeed, NOTICE.userAuthored, NOTICE.scope].map((t) => h('li', null, t))),
    ),
    section(
      'file-proposal',
      proposal.title,
      h('p', { class: 'question' }, proposal.question),
      h('p', { class: 'remit' }, h('strong', null, 'What this example group can decide: '), proposal.remit),
      h(
        'ul',
        { class: 'option-grid' },
        options.map((option, index) =>
          h(
            'li',
            null,
            h(
              'article',
              { class: 'card option', 'aria-labelledby': `r-option-${option.id}` },
              h('p', { class: 'eyebrow' }, `Option ${index + 1}`),
              h('h3', { id: `r-option-${option.id}` }, option.title),
              V.scopeLine(option),
              h('p', null, option.summary),
              V.costLine(option),
              V.optionDetails(option),
              h('div', { class: 'option__responses' }, V.responsesFor(option.id, bundle.responses, 4)),
            ),
          ),
        ),
      ),
    ),
    section(
      'file-evidence',
      'Evidence and open questions',
      h('ul', { class: 'claim-grid' }, bundle.claims.map(V.claimItem)),
      h('div', { class: 'card-grid card-grid--two' }, bundle.experts.map((e) => V.expertCard(e, 3))),
      h('h3', null, 'Open questions'),
      h('ul', { class: 'plain-list stack' }, bundle.questions.map((q) => V.questionItem(q, { experts: bundle.experts, options }))),
    ),
    section(
      'file-decision',
      'Commitments, decision and delivery',
      h('div', { class: 'card-grid card-grid--two' }, bundle.commitments.map((c) => V.commitmentCard(c, bundle.decision, today, 3))),
      bundle.decision
        ? V.decisionRecord(bundle.decision, bundle.delivery, options, 3)
        : h('p', { class: 'panel muted' }, 'No decision is recorded in this file.'),
      h('h3', null, 'Delivery trail'),
      V.deliveryTrail(bundle.delivery, bundle.decision),
    ),
    section(
      'file-aspirations',
      'Shared descriptions',
      h(
        'ul',
        { class: 'card-grid' },
        bundle.aspirations.map((a) =>
          h(
            'li',
            null,
            h(
              'article',
              { class: 'card aspiration', 'aria-labelledby': `r-asp-${a.id}` },
              h('h3', { id: `r-asp-${a.id}` }, a.title),
              V.aspirationBody(a, bundle.aspirations),
            ),
          ),
        ),
      ),
    ),
  );
}
