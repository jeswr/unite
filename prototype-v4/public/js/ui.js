// Shared pieces: who-said-it labels, the join prompt, and the short dialogs
// (join, publish, propose a statement version, create an action, confirm).

import { post } from './api.js';
import { appendAll, excerpt, h, uid } from './dom.js';

// ---- small shared components -----------------------------------------------

const AVATAR_TONES = ['', 'alt1', 'alt2', 'alt3'];

export function avatar(person, sample) {
  const name = person?.name ?? '?';
  const seed = [...(person?.id ?? name)].reduce((sum, ch) => sum + ch.codePointAt(0), 0);
  const tone = sample ? 'sample' : AVATAR_TONES[seed % AVATAR_TONES.length];
  return h('span', { class: `avatar ${tone}`, 'aria-hidden': 'true' }, [...name][0]?.toUpperCase() ?? '?');
}

export function personLabel(ctx, person, { sample = false } = {}) {
  if (!person) return h('span', { class: 'muted' }, 'nobody yet');
  return h('span', null,
    h('span', { class: 'author' }, person.name),
    person.handle ? [' ', h('span', { class: 'handle muted' }, `#${person.handle}`)] : null,
    sample ? [' ', h('span', { class: 'badge sample' }, 'Sample · fictional')] : null,
    ctx.isMe(person) ? [' ', h('span', { class: 'badge you' }, 'You')] : null,
  );
}

export function joinPrompt(ctx, message) {
  return h('div', { class: 'card quiet row between' },
    h('p', null, message),
    h('button', { type: 'button', class: 'primary', onClick: () => ctx.join() }, 'Join with a display name'),
  );
}

export function roomTabs(ctx, roomId, active) {
  return h('nav', { 'aria-label': 'Room sections' },
    h('ul', { class: 'tabs' },
      h('li', null, h('a', { href: `#/room/${roomId}`, 'aria-current': active === 'feed' ? 'page' : null }, 'Discussion')),
      h('li', null, h('a', { href: `#/room/${roomId}/ground`, 'aria-current': active === 'ground' ? 'page' : null }, 'Common ground')),
      h('li', null, h('a', { href: '#/act' }, 'Act next')),
    ),
  );
}

export function charCounter(textarea, max) {
  const out = h('span', { class: 'count', 'aria-live': 'off' });
  const update = () => { out.textContent = `${[...textarea.value].length} / ${max}`; };
  textarea.addEventListener('input', update);
  update();
  return out;
}

// ---- dialog scaffold -------------------------------------------------------

function modal(title, build, { onSubmit, onClose } = {}) {
  const titleId = uid('dlg');
  const error = h('p', { class: 'error-text', role: 'alert' });
  const dialog = h('dialog', { 'aria-labelledby': titleId });
  const opener = document.activeElement;
  let closed = false;
  // One path for Cancel, submit and Escape. Removal is explicit rather than
  // relying only on the `close` event.
  const close = () => {
    if (closed) return;
    closed = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    onClose?.();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };
  const form = h('form', { novalidate: true });
  appendAll(form, [h('h2', { id: titleId }, title), build({ close, error, dialog, form })]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!onSubmit) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    error.textContent = '';
    try {
      await onSubmit({ close, error, form });
    } catch (err) {
      error.textContent = err.message;
    } finally {
      if (submit) submit.disabled = false;
    }
  });
  dialog.append(form);
  dialog.addEventListener('close', close);
  document.getElementById('dialogs').append(dialog);
  dialog.showModal();
  return dialog;
}

const actions = (close, submitLabel) => h('div', { class: 'row end' },
  h('button', { type: 'button', onClick: close }, 'Cancel'),
  h('button', { type: 'submit', class: 'primary' }, submitLabel),
);

function field(labelText, control, hint) {
  const id = control.id || uid('in');
  control.id = id;
  let hintEl = null;
  if (hint) {
    hintEl = h('p', { class: 'hint', id: `${id}-hint` }, hint);
    control.setAttribute('aria-describedby', hintEl.id);
  }
  return h('div', { class: 'field' }, h('label', { for: id }, labelText), hintEl, control);
}

// ---- join ------------------------------------------------------------------

export function openJoin(ctx, onJoined, existing = null) {
  const input = h('input', { type: 'text', maxlength: 40, required: true, autocomplete: 'nickname', value: existing?.name ?? '' });
  modal(existing ? 'Change your display name' : 'Join the conversation', ({ close, error }) => [
    h('p', { class: 'note' }, 'A display name is a label, not an account. Anyone could choose the same name, so a short code such as #x7k2 appears next to it. Your session lasts while this tab is open.'),
    field('Display name', input, 'Up to 40 characters. Avoid your full name if you prefer.'),
    error,
    actions(close, existing ? 'Save name' : 'Join'),
  ], {
    onSubmit: async ({ close }) => {
      const displayName = input.value;
      const result = existing
        ? await post('/api/session/name', { displayName })
        : await post('/api/session', { displayName });
      close();
      await onJoined(result.participant, result.token);
    },
  });
  input.focus();
}

// ---- publish (from the interview or a possible future) --------------------

export const MODEL_NAMES = {
  'public-service': 'Universal public-service economy',
  'global-employer': 'One global public employer',
  mixed: 'Mixed economy with stronger guarantees',
};
export const MODEL_STANCE_NAMES = { agree: 'agrees', critique: 'critique', question: 'question' };

export function openPublish(ctx, { text = '', roomId = 'future', modelRef, modelStance, title = 'Publish to a room', intro } = {}) {
  if (!ctx.me) {
    ctx.join(() => openPublish(ctx, { text, roomId, modelRef, modelStance, title, intro }));
    return;
  }
  const select = h('select', null, ctx.data.rooms.map((room) => h('option', { value: room.id, selected: room.id === roomId }, room.name)));
  const textarea = h('textarea', { rows: 7, maxlength: 1200, required: true, value: text });
  modal(title, ({ close, error }) => [
    intro ? h('p', { class: 'note' }, intro) : null,
    modelRef ? h('p', { class: 'ref' }, `Responding to: ${MODEL_NAMES[modelRef]} · ${MODEL_STANCE_NAMES[modelStance]}`) : null,
    field('Room', select),
    field('Your post', textarea, 'Public: everyone using this local server can read it, and it is included in the public export. Edit it until it says what you mean.'),
    h('div', { class: 'row end' }, charCounter(textarea, 1200)),
    error,
    actions(close, 'Publish'),
  ], {
    onSubmit: async ({ close }) => {
      const body = { roomId: select.value, text: textarea.value };
      if (modelRef) Object.assign(body, { modelRef, modelStance });
      const result = await post('/api/posts', body);
      close();
      ctx.toast(`Published in ${ctx.roomName(body.roomId)}.`);
      await ctx.refresh();
      location.hash = `#/room/${body.roomId}/post/${result.id}`;
    },
  });
  textarea.focus();
}

// ---- propose a new statement version ---------------------------------------

export function openStatementEditor(ctx, roomId, prefill = null) {
  if (!ctx.me) {
    ctx.join(() => openStatementEditor(ctx, roomId, prefill));
    return;
  }
  const ground = ctx.data.grounds[roomId];
  const expectedVersion = ground.current.version;
  const start = prefill ?? {
    text: ground.current.text,
    differences: ground.current.differences,
    sourcePostIds: ground.current.sources.filter((s) => !s.withdrawn).map((s) => s.postId),
    aiAssisted: false,
  };
  const textarea = h('textarea', { rows: 5, maxlength: 800, required: true, value: start.text });
  const diffs = h('textarea', { rows: 4, value: start.differences.join('\n') });
  const candidates = ctx.data.posts.filter((p) => p.roomId === roomId && !p.withdrawn).slice(-30).reverse();
  const chosen = new Set(start.sourcePostIds);
  const boxes = candidates.map((p) => {
    const id = uid('src');
    return h('div', { class: 'row' },
      h('input', { type: 'checkbox', id, value: p.id, checked: chosen.has(p.id) }),
      h('label', { for: id, class: 'small' }, `${p.author.name}${p.sample ? ' (sample)' : ''}: “${excerpt(p.text, 80)}”`),
    );
  });
  modal(`Propose version ${expectedVersion + 1} for ${ctx.roomName(roomId)}`, ({ close, error }) => [
    h('p', { class: 'note' }, `A new version starts with no responses: support given to version ${expectedVersion} does not carry over to changed text. Version ${expectedVersion}, its responses and its concerns stay in the history.`),
    start.aiAssisted ? h('p', { class: 'alert info' }, 'Starting from a private AI suggestion. Edit it freely; once proposed it is labelled “drafted with AI help” with you as the proposer.') : null,
    field('Statement', textarea, 'What people here might be able to accept. 10–800 characters.'),
    field('Unresolved differences', diffs, 'One per line, up to 6. Keep minority concerns visible here.'),
    h('fieldset', null, h('legend', null, 'Drawn from these public posts'), boxes.length ? boxes : h('p', { class: 'muted small' }, 'No posts in this room yet.')),
    error,
    actions(close, 'Propose new version'),
  ], {
    onSubmit: async ({ close }) => {
      const differences = diffs.value.split('\n').map((line) => line.trim()).filter(Boolean);
      const sourcePostIds = boxes.map((row) => row.querySelector('input')).filter((box) => box.checked).map((box) => box.value);
      await post(`/api/rooms/${roomId}/statement`, {
        text: textarea.value, differences, sourcePostIds, expectedVersion, aiAssisted: Boolean(start.aiAssisted),
      });
      close();
      if (start.aiAssisted) delete ctx.ui.suggestions?.[roomId];
      ctx.toast(`Version ${expectedVersion + 1} proposed. Responses start again from zero.`);
      await ctx.refresh();
    },
  });
  textarea.focus();
}

// ---- create an action (two short steps) -----------------------------------

const LEVELS = [[1, 'Low'], [2, 'Medium'], [3, 'High']];

function choiceGroup(legend, name, options, checkedValue, hint) {
  const hintId = hint ? uid('hint') : null;
  return h('fieldset', { 'aria-describedby': hintId },
    h('legend', null, legend),
    hint ? h('p', { class: 'hint', id: hintId }, hint) : null,
    h('div', { class: 'choices' }, options.map(([value, label]) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name, value: String(value), checked: String(value) === String(checkedValue) }),
      h('span', null, label)))),
  );
}

const picked = (form, name) => form.querySelector(`input[name="${name}"]:checked`)?.value;

function isoInDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function openActionDialog(ctx, roomId = 'work') {
  if (!ctx.me) {
    ctx.join(() => openActionDialog(ctx, roomId));
    return;
  }
  const g = uid('act');
  const roomSelect = h('select', null, ctx.data.rooms.map((room) => h('option', { value: room.id, selected: room.id === roomId }, room.name)));
  const basis = h('div', { class: 'snapshot small' });
  let expectedVersion = null;
  const showBasis = () => {
    const ground = ctx.data.grounds[roomSelect.value];
    expectedVersion = ground.current.version;
    const concerns = ground.stances.filter((s) => s.stance === 'concern');
    basis.replaceChildren(
      h('p', { class: 'eyebrow' }, `Based on common ground version ${expectedVersion}`),
      h('p', { class: 'statement' }, ground.current.text),
      h('p', null, `Local responses so far: ${ground.tally.support} support · ${ground.tally.concern} concern · ${ground.tally.abstain} abstain.`),
      concerns.length
        ? h('ul', { class: 'differences' }, concerns.map((c) => h('li', null, `${c.participant.name}: ${c.reason}`)))
        : null,
      concerns.length ? h('p', { class: 'hint' }, 'You can still propose an action. These concerns are saved with it and shown on the board.') : null,
    );
  };
  roomSelect.addEventListener('change', showBasis);
  showBasis();

  const title = h('input', { type: 'text', maxlength: 100, required: true });
  const firstStep = h('textarea', { rows: 3, maxlength: 300, required: true });
  const checkIn = h('input', { type: 'date', required: true, value: isoInDays(14), min: isoInDays(0), max: isoInDays(365) });
  const institution = h('input', { type: 'text', maxlength: 100 });
  const institutionField = field('Institution that would need to adopt it', institution, 'Naming an institution here does not give this proposal any authority. It shows who would have to agree.');
  const concernKind = h('select', null, [['access', 'Access'], ['rights', 'Rights'], ['dependency', 'Dependency']].map(([v, l]) => h('option', { value: v }, l)));
  const concernText = h('textarea', { rows: 2, maxlength: 400 });
  const preview = h('p', { class: 'priority', 'aria-live': 'polite' });

  const step1 = h('div', { class: 'field' },
    h('p', { class: 'steps' }, 'Step 1 of 2 · What and who'),
    field('Room', roomSelect), basis,
    field('Short title', title),
    field('Concrete first step', firstStep, 'Something one person could start this week, e.g. “Ask the library for a room on Thursday evenings”.'),
    choiceGroup('Who owns the first step?', `${g}-owner`, [['me', 'I will'], ['volunteer', 'Needs a volunteer']], 'me'),
    field('Check-in date', checkIn),
  );
  const step2 = h('div', { class: 'field', hidden: true },
    h('p', { class: 'steps' }, 'Step 2 of 2 · Scope, concerns, then size'),
    choiceGroup('Scope', `${g}-scope`, [['community', 'Community experiment'], ['institutional', 'Institutional proposal']], 'community',
      'A community experiment is something people here can try themselves. An institutional proposal needs an institution to adopt it.'),
    institutionField,
    h('fieldset', null,
      h('legend', null, 'Rights, access or dependency concerns to check first (optional)'),
      field('Type', concernKind),
      field('Concern', concernText, 'For example: “The venue has stairs only”. An open concern stops the action moving forward until someone records how it is handled.')),
    choiceGroup('Impact if it works', `${g}-impact`, LEVELS, 2),
    choiceGroup('Urgency', `${g}-urgency`, LEVELS, 2),
    choiceGroup('Effort', `${g}-effort`, LEVELS, 2),
    preview,
  );
  institutionField.hidden = true;

  let step = 1;
  const back = h('button', { type: 'button', hidden: true }, 'Back');
  const next = h('button', { type: 'button', class: 'primary' }, 'Next');
  const submit = h('button', { type: 'submit', class: 'primary', hidden: true }, 'Create proposal');
  const show = (n) => {
    step = n;
    step1.hidden = n !== 1;
    step2.hidden = n !== 2;
    back.hidden = n !== 2;
    next.hidden = n !== 1;
    submit.hidden = n !== 2;
  };

  const dialog = modal('Turn common ground into an action', ({ close, error, form }) => {
    const updatePreview = () => {
      const scope = picked(form, `${g}-scope`);
      institutionField.hidden = scope !== 'institutional';
      const [i, u, e] = ['impact', 'urgency', 'effort'].map((k) => Number(picked(form, `${g}-${k}`)));
      preview.textContent = `Priority ${i + u + (4 - e)} = impact ${i} + urgency ${u} + ease ${4 - e} (4 − effort ${e}). The server computes the saved value the same way.`;
    };
    form.addEventListener('change', updatePreview);
    queueMicrotask(updatePreview);
    back.addEventListener('click', () => show(1));
    next.addEventListener('click', () => {
      error.textContent = '';
      if (!title.value.trim() || !firstStep.value.trim() || !checkIn.value) {
        error.textContent = 'Add a title, a concrete first step and a check-in date.';
        return;
      }
      show(2);
      step2.querySelector('input')?.focus();
    });
    return [step1, step2, error, h('div', { class: 'row end' }, h('button', { type: 'button', onClick: close }, 'Cancel'), back, next, submit)];
  }, {
    onSubmit: async ({ close, form }) => {
      if (step !== 2) return;
      const scope = picked(form, `${g}-scope`);
      const body = {
        roomId: roomSelect.value,
        expectedVersion,
        title: title.value,
        firstStep: firstStep.value,
        ownership: picked(form, `${g}-owner`),
        checkIn: checkIn.value,
        impact: Number(picked(form, `${g}-impact`)),
        urgency: Number(picked(form, `${g}-urgency`)),
        effort: Number(picked(form, `${g}-effort`)),
        scope,
      };
      if (scope === 'institutional') body.institution = institution.value;
      if (concernText.value.trim()) Object.assign(body, { concernKind: concernKind.value, concernText: concernText.value });
      await post('/api/actions', body);
      close();
      ctx.toast('Action proposed. It is on the board under Proposed.');
      await ctx.refresh();
      if (location.hash !== '#/act') location.hash = '#/act';
    },
  });
  dialog.querySelector('input, select, textarea')?.focus();
}

// ---- confirm ---------------------------------------------------------------

export function confirm(ctx, { title, body, confirmLabel }) {
  return new Promise((resolve) => {
    let answered = false;
    modal(title, ({ close }) => [
      body instanceof Node ? body : h('p', null, body),
      actions(close, confirmLabel),
    ], {
      onSubmit: async ({ close }) => {
        answered = true;
        close();
      },
      onClose: () => resolve(answered),
    });
  });
}
