// Controller: loads public state, keeps it live over server-sent events,
// routes between views and re-renders without losing what people are typing.

import { api, connectLive, token } from './api.js';
import { h, relTime } from './dom.js';
import * as dialogs from './ui.js';
import { renderAbout } from './views/about.js';
import { renderAct } from './views/act.js';
import { renderFeed } from './views/feed.js';
import { renderFutures } from './views/futures.js';
import { renderGround } from './views/ground.js';
import { renderTalk } from './views/talk.js';

const main = document.getElementById('main');
const liveEl = document.getElementById('live');
const toastEl = document.getElementById('toast');

const app = {
  data: null,
  me: null,
  live: 'connecting',
  drafts: new Map(),
  ui: {}, // per-view ephemeral state (filters, open replies, AI suggestions)
};

// ---- routing ---------------------------------------------------------------

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [first, second, third, fourth] = parts;
  if (first === 'room' && second) {
    if (third === 'ground') return { view: 'ground', roomId: second };
    if (third === 'post' && fourth) return { view: 'feed', roomId: second, postId: fourth };
    return { view: 'feed', roomId: second };
  }
  if (first === 'talk') return { view: 'talk' };
  if (first === 'act') return { view: 'act' };
  if (first === 'futures') return { view: 'futures', model: second ?? null };
  if (first === 'about') return { view: 'about' };
  return { view: 'feed', roomId: null };
}

const VIEWS = { feed: renderFeed, ground: renderGround, talk: renderTalk, act: renderAct, futures: renderFutures, about: renderAbout };

// ---- context handed to views -----------------------------------------------

const ctx = {
  get data() { return app.data; },
  get me() { return app.me; },
  get ui() { return app.ui; },
  route: parseRoute(),

  room: (roomId) => app.data.rooms.find((room) => room.id === roomId) ?? null,
  roomName: (roomId) => app.data.rooms.find((room) => room.id === roomId)?.name ?? roomId,
  post: (postId) => app.data.posts.find((post) => post.id === postId) ?? null,
  isMe: (person) => Boolean(app.me && person && person.id === app.me.id),

  // Form controls tagged with a draft key keep their value across re-renders.
  draft: (key, fallback = '') => (app.drafts.has(key) ? app.drafts.get(key) : fallback),
  setDraft: (key, value) => app.drafts.set(key, value),
  clearDraft: (key) => app.drafts.delete(key),

  rerender: () => render({ live: true }),
  toast,
  announce,
  clearAnnouncements,
  refresh,

  // Runs a server mutation and reports failures in the given status element
  // (or as a toast). Returns the response, or null if it failed.
  async run(task, { errorEl, success } = {}) {
    if (errorEl) errorEl.textContent = '';
    try {
      const result = await task();
      if (success) toast(success);
      await refresh();
      return result;
    } catch (error) {
      if (error.status === 401) await checkSession();
      if (errorEl) errorEl.textContent = error.message;
      else toast(error.message);
      return null;
    }
  },

  join: (then) => dialogs.openJoin(ctx, async (participant, newToken) => {
    await onJoined(participant, newToken);
    then?.();
  }),
  ...Object.fromEntries(['openPublish', 'openStatementEditor', 'openActionDialog', 'confirm'].map((name) => [name, (...args) => dialogs[name](ctx, ...args)])),
};

async function onJoined(participant, newToken) {
  if (newToken) token.set(newToken);
  app.me = participant;
  renderMe();
  await refresh();
  render({ live: true });
}

// ---- rendering -------------------------------------------------------------

function captureFocus() {
  const el = document.activeElement;
  if (!el || !main.contains(el)) return null;
  const key = el.dataset.draft ?? el.dataset.focus;
  if (!key) return null;
  const snapshot = { key, value: el.type === 'radio' ? el.value : null };
  if (typeof el.selectionStart === 'number') {
    snapshot.start = el.selectionStart;
    snapshot.end = el.selectionEnd;
  }
  return snapshot;
}

function restoreFocus(snapshot) {
  if (!snapshot) return;
  const candidates = main.querySelectorAll('[data-draft], [data-focus]');
  const el = [...candidates].find((item) => (item.dataset.draft ?? item.dataset.focus) === snapshot.key
    && (snapshot.value === null || item.value === snapshot.value));
  if (!el) return;
  el.focus({ preventScroll: true });
  if (snapshot.start !== undefined && typeof el.setSelectionRange === 'function') {
    try {
      el.setSelectionRange(snapshot.start, snapshot.end);
    } catch {
      // not a text control
    }
  }
}

function render({ live = false } = {}) {
  if (!app.data) return;
  const focus = live ? captureFocus() : null;
  const openKeys = new Set([...main.querySelectorAll('details[open][data-open-key]')].map((el) => el.dataset.openKey));
  const view = (VIEWS[ctx.route.view] ?? renderFeed)(ctx);
  main.replaceChildren(view);
  for (const details of main.querySelectorAll('details[data-open-key]')) {
    if (openKeys.has(details.dataset.openKey)) details.open = true;
  }
  if (live) restoreFocus(focus);
  updateNav();
}

function updateNav() {
  const { view, roomId } = ctx.route;
  const navKey = view === 'ground' ? 'feed' : view;
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === navKey && !(navKey === 'feed' && roomId)) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  for (const link of document.querySelectorAll('#room-links a')) {
    if (link.dataset.room === roomId) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function renderRoomLinks() {
  document.getElementById('room-links').replaceChildren(
    ...app.data.rooms.map((room) => h('li', null, h('a', { href: `#/room/${room.id}`, 'data-room': room.id }, room.name))),
  );
}

function renderMe() {
  const box = document.getElementById('me');
  if (app.me) {
    box.replaceChildren(
      h('p', null, h('span', { class: 'muted small me-label' }, 'Posting as '), h('span', { class: 'who' }, app.me.name), ' ', h('span', { class: 'handle muted' }, `#${app.me.handle}`)),
      h('button', { type: 'button', class: 'small', onClick: () => dialogs.openJoin(ctx, onJoined, app.me) }, 'Change name'),
    );
  } else {
    box.replaceChildren(
      h('p', { class: 'small me-hint' }, 'Read freely. Join with a display name to post and respond.'),
      h('button', { type: 'button', class: 'primary small', onClick: ctx.join }, 'Join'),
    );
  }
}

// ---- data ------------------------------------------------------------------

// One state fetch at a time. A refresh requested while one is in flight
// (a live event, or a mutation that just finished) runs another fetch
// afterwards, so a response that left the server before the change can
// never be the last word.
let inflight = null;
let again = false;
function refresh() {
  if (inflight) {
    again = true;
    return inflight;
  }
  inflight = (async () => {
    try {
      do {
        again = false;
        await load();
      } while (again);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function load() {
  try {
    const next = await api('/api/state');
    const restarted = app.data && next.bootId !== app.data.bootId;
    if (!app.data || restarted || next.rev >= app.data.rev) {
      const first = !app.data;
      app.data = next;
      if (first) renderRoomLinks();
      if (restarted) {
        await checkSession();
        toast('The local server restarted, so public posts were reset to the samples.');
      }
      render({ live: !first });
      if (first) scrollToRouteTarget();
    }
  } catch (error) {
    if (!app.data) main.replaceChildren(h('p', { class: 'alert' }, error.message));
  }
}

async function checkSession() {
  if (!token.get()) {
    app.me = null;
    renderMe();
    return;
  }
  try {
    const { participant } = await api('/api/session');
    app.me = participant;
  } catch (error) {
    if (error.status === 401) {
      token.clear();
      if (app.me) toast('Your session ended (the server may have restarted). Join again to post.');
      app.me = null;
    }
  }
  renderMe();
}

function setLive(state) {
  app.live = state;
  liveEl.dataset.state = state;
  liveEl.textContent = {
    live: 'Live',
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting…',
    offline: 'Server unreachable',
    paused: 'Paused while hidden',
    polling: 'Checking every few seconds',
    limited: 'Many tabs open: checking every few seconds',
  }[state];
  liveEl.title = state === 'polling' || state === 'limited'
    ? 'To leave browser connections free, only the window you are using keeps a live stream. Others check for changes every few seconds.'
    : '';
}

// Screen-reader announcements. The live region is emptied shortly after
// each message, so private text (such as an interview question) does not
// stay in the page, and clearAnnouncements() cancels one that is pending.
const announcer = document.getElementById('announcer');
let announceTimer = null;
function announce(message) {
  clearTimeout(announceTimer);
  announcer.textContent = message;
  announceTimer = setTimeout(clearAnnouncements, 8000);
}
function clearAnnouncements() {
  clearTimeout(announceTimer);
  announcer.textContent = '';
}

let toastTimer = null;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4200);
}

function scrollToRouteTarget() {
  if (ctx.route.postId) {
    document.getElementById(`post-${ctx.route.postId}`)?.scrollIntoView({ block: 'center' });
  }
}

// ---- wiring ----------------------------------------------------------------

document.addEventListener('input', (event) => {
  const key = event.target.dataset?.draft;
  if (key && event.target.type !== 'radio') app.drafts.set(key, event.target.value);
});
document.addEventListener('change', (event) => {
  const key = event.target.dataset?.draft;
  if (key) app.drafts.set(key, event.target.value);
});

window.addEventListener('hashchange', () => {
  ctx.route = parseRoute();
  render();
  if (ctx.route.postId) scrollToRouteTarget();
  else {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
});

setInterval(() => {
  for (const el of document.querySelectorAll('time[data-rel]')) el.textContent = relTime(el.dataset.rel);
}, 30_000);

setLive('connecting');
renderMe();
await checkSession();
await refresh();
connectLive({
  onStatus: setLive,
  onSync: ({ rev, bootId }) => {
    if (!app.data || bootId !== app.data.bootId || rev > app.data.rev) refresh();
  },
});
