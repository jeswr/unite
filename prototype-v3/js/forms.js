// Accessible form feedback: an error summary that takes focus and links to
// each field, inline messages tied to controls with aria-describedby, and
// polite status messages.

import { h, renderRegion } from './dom.js';

const isEmpty = (control) =>
  control.type === 'radio'
    ? !control.form.querySelector(`input[name="${CSS.escape(control.name)}"]:checked`)
    : control.type === 'checkbox'
      ? !control.checked
      : control.value.trim() === '';

function placeError(control, message) {
  if (control.type === 'radio') control.closest('fieldset').querySelector('legend').after(message);
  else if (control.type === 'checkbox') control.parentElement.before(message);
  else control.before(message);
}

export function clearErrors(form, summary) {
  for (const el of form.querySelectorAll('.field-error')) el.remove();
  for (const control of form.querySelectorAll('[aria-invalid]')) {
    control.removeAttribute('aria-invalid');
    const base = control.dataset.baseDescribedby;
    if (base) control.setAttribute('aria-describedby', base);
    else control.removeAttribute('aria-describedby');
  }
  summary.hidden = true;
  summary.replaceChildren();
}

// errors: { name: detail }; fields: { name: { id, label, required?, message? } }
// `required` replaces the detail when the control is empty; `message` always does.
export function showErrors(form, summary, errors, fields) {
  clearErrors(form, summary);
  const links = Object.entries(errors).map(([name, detail]) => {
    const field = fields[name] ?? { id: form.querySelector('input, select, textarea').id, label: name };
    const control = document.getElementById(field.id);
    const message =
      field.message ?? (field.required && isEmpty(control) ? field.required : `${field.label} ${detail}.`);
    const errorId = `${field.id}-error`;
    placeError(control, h('p', { class: 'field-error', id: errorId }, h('span', { class: 'visually-hidden' }, 'Error: '), message));
    if (control.type !== 'radio') {
      if (control.dataset.baseDescribedby === undefined) {
        control.dataset.baseDescribedby = control.getAttribute('aria-describedby') ?? '';
      }
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', `${errorId} ${control.dataset.baseDescribedby}`.trim());
    }
    return h('li', null, h('a', { href: `#${field.id}`, dataset: { target: field.id } }, message));
  });
  renderRegion(summary, h('p', { class: 'error-summary__title' }, 'There is a problem'), h('ul', null, links));
  summary.hidden = false;
  summary.focus();
}

// Summary links move focus to the control, not just scroll to it.
document.addEventListener('click', (event) => {
  const link = event.target.closest('.error-summary a[data-target]');
  if (!link) return;
  event.preventDefault();
  document.getElementById(link.dataset.target)?.focus();
});

// Clearing first makes screen readers announce a repeated identical message.
export function setStatus(el, message) {
  el.textContent = '';
  setTimeout(() => {
    el.textContent = message;
  }, 60);
}
