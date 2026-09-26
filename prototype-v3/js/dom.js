// Minimal DOM helpers. All text goes through text nodes; nothing here ever
// assigns HTML strings, so user-authored or imported text stays inert.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

function append(parent, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// Replaces a region's content. If focus was inside it on an element with a
// data-focus-key, focus returns to the matching element after re-rendering.
export function renderRegion(container, ...children) {
  const active = document.activeElement;
  const key = active && container.contains(active) ? active.dataset.focusKey : undefined;
  container.replaceChildren();
  append(container, children);
  if (key) container.querySelector(`[data-focus-key="${CSS.escape(key)}"]`)?.focus();
}

export const hidden = (text) => h('span', { class: 'visually-hidden' }, text);

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export const formatDate = (isoDate) => dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
export const formatDateTime = (iso) => dateTimeFormat.format(new Date(iso));
export const formatEuro = (amount) => `€${amount.toLocaleString('en-GB')}`;
export function todayISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
