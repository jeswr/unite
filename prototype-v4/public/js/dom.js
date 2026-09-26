// Text-only DOM builder. Strings always become text nodes or attribute
// values; nothing is ever parsed as HTML.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  let value;
  for (const [key, prop] of Object.entries(props ?? {})) {
    if (prop === null || prop === undefined || prop === false) continue;
    if (key.startsWith('on') && typeof prop === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), prop);
    } else if (key === 'class') {
      el.className = prop;
    } else if (key === 'value') {
      value = prop; // set after children so a <select> can pick its option
    } else if (key === 'checked' || key === 'selected') {
      el[key] = Boolean(prop);
    } else {
      el.setAttribute(key, prop === true ? '' : String(prop));
    }
  }
  appendAll(el, children);
  if (value !== undefined) el.value = value;
  return el;
}

export function appendAll(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export function relTime(iso, now = Date.now()) {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function timeEl(iso) {
  return h('time', { datetime: iso, title: new Date(iso).toLocaleString('en-GB'), 'data-rel': iso }, relTime(iso));
}

export function formatDate(ymd) {
  const date = new Date(`${ymd}T12:00:00Z`);
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function excerpt(text, max = 90) {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

let idCounter = 0;
export const uid = (prefix = 'f') => `${prefix}-${++idCounter}`;
