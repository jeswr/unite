// Conversations: chronological posts and replies, with explicit filters.
// No ranking by reactions, no follower counts.

import { post as send } from '../api.js';
import { h, plural, timeEl, uid } from '../dom.js';
import { MODEL_NAMES, MODEL_STANCE_NAMES, avatar, charCounter, joinPrompt, personLabel, roomTabs } from '../ui.js';

export function renderFeed(ctx) {
  const { roomId, postId } = ctx.route;
  const room = roomId ? ctx.room(roomId) : null;
  if (roomId && !room) {
    return h('section', { class: 'view' }, h('h1', null, 'Room not found'), h('p', null, h('a', { href: '#/' }, 'Back to all conversations')));
  }
  const ui = (ctx.ui.feed ??= { q: '', room: '', show: 'all', replying: new Set() });
  const list = h('div');
  const drawList = () => list.replaceChildren(feedList(ctx, ui, roomId, postId));
  drawList();

  return h('section', { class: 'view', 'aria-labelledby': 'feed-title' },
    h('header', { class: 'view-head' },
      h('p', { class: 'eyebrow' }, room ? 'Room' : 'Conversations'),
      h('h1', { id: 'feed-title' }, room ? room.name : 'Talk about the future we share'),
      h('p', { class: 'lede' }, room
        ? room.prompt
        : 'Short posts from people using this local demo, newest first. Say what you want, disagree well, and help shape what happens next.'),
      room ? roomTabs(ctx, room.id, 'feed') : null,
    ),
    room ? groundSummary(ctx, room) : null,
    composer(ctx, roomId),
    filters(ctx, ui, roomId, drawList),
    list,
  );
}

function groundSummary(ctx, room) {
  const ground = ctx.data.grounds[room.id];
  const { tally, coverage } = ground;
  return h('section', { class: 'card summary-card', 'aria-labelledby': 'summary-title' },
    h('p', { class: 'eyebrow', id: 'summary-title' }, `Proposed common ground · version ${ground.current.version}`),
    h('p', { class: 'statement' }, ground.current.text),
    h('p', { class: 'small muted' },
      `${tally.support} support · ${tally.concern} concern · ${tally.abstain} abstain, from ${plural(coverage.respondents, 'local respondent')}. `,
      'Not a measure of anyone outside this demo.'),
    h('p', null, h('a', { href: `#/room/${room.id}/ground` }, 'Read, respond or propose a new version')),
  );
}

function composer(ctx, roomId) {
  if (!ctx.me) return joinPrompt(ctx, 'Join with a display name to post. Reading needs no name.');
  const key = `compose:${roomId ?? 'all'}`;
  const textareaId = uid('compose');
  const textarea = h('textarea', { id: textareaId, rows: 3, maxlength: 1200, 'data-draft': key, value: ctx.draft(key) });
  const roomSelect = roomId ? null : h('select', { 'data-draft': 'compose:room', 'aria-label': 'Room for your post' },
    ctx.data.rooms.map((room) => h('option', { value: room.id, selected: ctx.draft('compose:room', 'work') === room.id }, room.name)));
  const error = h('p', { class: 'error-text', role: 'alert' });
  const form = h('form', { class: 'card composer', 'aria-label': 'New post' },
    h('label', { for: textareaId }, roomId ? `Share a thought in ${ctx.roomName(roomId)}` : 'Share a thought'),
    textarea,
    error,
    h('div', { class: 'row between' },
      h('div', { class: 'row' }, roomSelect, charCounter(textarea, 1200)),
      h('button', { type: 'submit', class: 'primary' }, 'Post')),
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const target = roomId ?? roomSelect.value;
    const done = await ctx.run(() => send('/api/posts', { roomId: target, text: textarea.value }), { errorEl: error });
    if (done) {
      ctx.clearDraft(key);
      ctx.toast(`Posted in ${ctx.roomName(target)}.`);
      ctx.rerender();
    }
  });
  return form;
}

function filters(ctx, ui, roomId, drawList) {
  const q = h('input', { type: 'search', id: 'feed-q', value: ui.q, 'data-focus': 'feed-q', autocomplete: 'off' });
  q.addEventListener('input', () => { ui.q = q.value; drawList(); });
  const show = h('select', { id: 'feed-show', 'data-focus': 'feed-show' },
    [['all', 'Everyone'], ['people', 'People here (no samples)'], ['samples', 'Samples only'], ['mine', 'My posts']]
      .map(([value, label]) => h('option', { value, selected: ui.show === value }, label)));
  show.addEventListener('change', () => { ui.show = show.value; drawList(); });
  let roomFilter = null;
  if (!roomId) {
    const select = h('select', { id: 'feed-room', 'data-focus': 'feed-room' },
      h('option', { value: '' }, 'All rooms'),
      ctx.data.rooms.map((room) => h('option', { value: room.id, selected: ui.room === room.id }, room.name)));
    select.addEventListener('change', () => { ui.room = select.value; drawList(); });
    roomFilter = h('div', { class: 'field' }, h('label', { for: 'feed-room' }, 'Room'), select);
  }
  return h('search', { class: 'filters', 'aria-label': 'Filter posts' },
    h('div', { class: 'field' }, h('label', { for: 'feed-q' }, 'Search posts and replies'), q),
    roomFilter,
    h('div', { class: 'field' }, h('label', { for: 'feed-show' }, 'Show'), show),
  );
}

function matches(ctx, ui, item) {
  if (ui.show === 'people' && item.sample) return false;
  if (ui.show === 'samples' && !item.sample) return false;
  if (ui.show === 'mine' && !ctx.isMe(item.author)) return false;
  if (!ui.q.trim()) return true;
  const q = ui.q.trim().toLocaleLowerCase();
  return item.text.toLocaleLowerCase().includes(q) || item.author.name.toLocaleLowerCase().includes(q);
}

function feedList(ctx, ui, roomId, highlightId) {
  const inRoom = ctx.data.posts.filter((p) => (roomId ? p.roomId === roomId : !ui.room || p.roomId === ui.room));
  const replies = new Map();
  for (const p of inRoom) {
    if (p.replyTo) replies.set(p.replyTo, [...(replies.get(p.replyTo) ?? []), p]);
  }
  const threads = inRoom.filter((p) => !p.replyTo).reverse()
    .filter((p) => matches(ctx, ui, p) || (replies.get(p.id) ?? []).some((r) => matches(ctx, ui, r)));
  const filtered = ui.q.trim() || ui.show !== 'all';
  return h('div', { class: 'field' },
    h('p', { class: 'small muted', role: 'status' },
      `${plural(threads.length, 'conversation')}${filtered ? ' match your filters' : ''}, newest first.`),
    threads.length
      ? h('ol', { class: 'feed' }, threads.map((p) => h('li', null, postCard(ctx, ui, p, replies.get(p.id) ?? [], { showRoom: !roomId, highlightId }))))
      : h('p', { class: 'empty' }, filtered ? 'Nothing matches. Try clearing the search or filters.' : 'No posts yet. Start the conversation.'),
  );
}

function postHead(ctx, p, showRoom) {
  return h('header', { class: 'post-head' },
    avatar(p.author, p.sample),
    personLabel(ctx, p.author, { sample: p.sample }),
    showRoom ? [h('span', { 'aria-hidden': 'true' }, '·'), h('a', { class: 'chip', href: `#/room/${p.roomId}` }, ctx.roomName(p.roomId))] : null,
    h('span', { 'aria-hidden': 'true' }, '·'),
    p.sample ? h('span', null, 'written for this demo') : timeEl(p.createdAt),
  );
}

function postBody(p) {
  return p.withdrawn
    ? h('p', { class: 'post-body withdrawn' }, 'Withdrawn by its author.')
    : h('p', { class: 'post-body' }, p.text);
}

function postCard(ctx, ui, p, replies, { showRoom, highlightId }) {
  const replying = ui.replying.has(p.id);
  const toggleReply = () => {
    if (!ctx.me) {
      ctx.join(() => { ui.replying.add(p.id); ctx.rerender(); });
      return;
    }
    if (replying) ui.replying.delete(p.id);
    else ui.replying.add(p.id);
    ctx.rerender();
    if (!replying) document.querySelector(`[data-draft="reply:${p.id}"]`)?.focus();
  };
  return h('article', { class: `post${highlightId === p.id ? ' highlight' : ''}`, id: `post-${p.id}` },
    postHead(ctx, p, showRoom),
    p.modelRef ? h('p', { class: 'ref' }, `On “${MODEL_NAMES[p.modelRef]}” · ${MODEL_STANCE_NAMES[p.modelStance]}`) : null,
    postBody(p),
    h('div', { class: 'post-actions' },
      p.withdrawn ? null : h('button', {
        type: 'button', class: 'ghost small', 'aria-expanded': String(replying), 'data-focus': `reply-btn:${p.id}`,
        'aria-label': `${replying ? 'Cancel reply' : 'Reply'} to ${p.author.name}`, onClick: toggleReply,
      }, replying ? 'Cancel reply' : 'Reply'),
      replies.length ? h('span', { class: 'small muted' }, plural(replies.length, 'reply', 'replies')) : null,
      withdrawButton(ctx, p),
    ),
    replies.length ? h('ol', { class: 'replies', 'aria-label': `Replies to ${p.author.name}` }, replies.map((r) => h('li', null,
      h('article', { class: `post${highlightId === r.id ? ' highlight' : ''}`, id: `post-${r.id}` },
        postHead(ctx, r, false), postBody(r), h('div', { class: 'post-actions' }, withdrawButton(ctx, r)))))) : null,
    replying ? replyForm(ctx, ui, p) : null,
  );
}

function withdrawButton(ctx, p) {
  if (p.withdrawn || !ctx.isMe(p.author)) return null;
  return h('button', {
    type: 'button', class: 'ghost small danger', 'data-focus': `withdraw:${p.id}`,
    onClick: async () => {
      const ok = await ctx.confirm({
        title: 'Withdraw this post?',
        body: 'Its text is removed for everyone connected to this server. Replies stay. Anyone who already exported the public data keeps their copy.',
        confirmLabel: 'Withdraw post',
      });
      if (ok) await ctx.run(() => send(`/api/posts/${p.id}/withdraw`), { success: 'Post withdrawn.' });
    },
  }, 'Withdraw');
}

function replyForm(ctx, ui, parent) {
  const key = `reply:${parent.id}`;
  const id = uid('reply');
  const textarea = h('textarea', { id, rows: 2, maxlength: 1200, 'data-draft': key, value: ctx.draft(key) });
  const error = h('p', { class: 'error-text', role: 'alert' });
  const form = h('form', { class: 'composer' },
    h('label', { for: id, class: 'small' }, `Reply to ${parent.author.name}`),
    textarea, error,
    h('div', { class: 'row end' }, h('button', { type: 'submit', class: 'primary small' }, 'Post reply')),
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const done = await ctx.run(() => send('/api/posts', { roomId: parent.roomId, text: textarea.value, replyTo: parent.id }), { errorEl: error });
    if (done) {
      ctx.clearDraft(key);
      ui.replying.delete(parent.id);
      ctx.rerender();
    }
  });
  return form;
}
