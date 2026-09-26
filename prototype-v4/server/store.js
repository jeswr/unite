// In-memory public state and the rules that govern it. Nothing here is
// written to disk; a restart starts again from the fictional samples.
// Actors are participants resolved by the HTTP layer from a session token;
// request bodies are validated here, and every ID, version, snapshot and
// priority is decided by the server, never taken from the client.

import { createHash, randomBytes } from 'node:crypto';
import { ROOMS, ROOM_IDS, SAMPLE_POSTS, SAMPLE_STATEMENTS } from './seed.js';
import * as v from './validate.js';

const { HttpError, bad } = v;

export const LIMITS = {
  displayName: 40,
  post: 1200,
  reason: 400,
  statement: 800,
  difference: 240,
  differences: 6,
  sources: 12,
  title: 100,
  step: 300,
  institution: 100,
  check: 400,
  checkInDays: 365,
  maxParticipants: 500,
  maxPosts: 2000,
  maxActions: 200,
  maxVersions: 50,
  maxChecks: 20,
  maxUpdates: 50,
  maxReviews: 20,
  maxVolunteers: 100,
  // One budget for every record copied into history (closed-version
  // responses, snapshot concerns, concern history, next-step updates and
  // owner reviews). Each limit above is small on its own, but they multiply;
  // this caps the total. Reaching it refuses new history, never deletes any.
  archiveBudget: 20_000,
};

export const STANCES = ['support', 'concern', 'abstain'];
export const STATUSES = ['proposed', 'ready', 'doing', 'done'];
export const SCOPES = ['community', 'institutional'];
export const CHECK_KINDS = ['rights', 'access', 'dependency'];
export const MODEL_REFS = ['public-service', 'global-employer', 'mixed'];
export const MODEL_STANCES = ['agree', 'critique', 'question'];

// Owners move one step at a time; stepping back is always allowed.
export const TRANSITIONS = {
  proposed: ['ready'],
  ready: ['proposed', 'doing'],
  doing: ['ready', 'done'],
  done: ['doing'],
};

// What each status means, by scope. Statuses are the owner's own report.
// For an institutional proposal they track only the work of preparing and
// submitting the proposal: Unite never records, infers or verifies that an
// institution adopted or funded anything, whatever the status or name.
export const STATUS_MEANINGS = {
  community: {
    proposed: 'Proposed: not started yet.',
    ready: 'Ready: the owner reports it can start.',
    doing: 'Doing: the owner reports work on the next step.',
    done: 'Done: the owner reports the first step or experiment finished.',
  },
  institutional: {
    proposed: 'Proposal idea: the proposal is not drafted yet.',
    ready: 'Ready to prepare: the owner reports the proposal can be drafted.',
    doing: 'Preparing or submitting the proposal. Institutional adoption unconfirmed.',
    done: 'Proposal work completed; institutional adoption unconfirmed.',
  },
};
export const newId = (prefix) => `${prefix}_${randomBytes(9).toString('base64url')}`;

// Deliberately simple and shown in the UI: each input is 1 to 3, so the
// result is a whole number from 3 to 9, with lower effort scoring higher.
export const priorityOf = ({ impact, urgency, effort }) => impact + urgency + (4 - effort);

const notFound = (what) => new HttpError(404, `${what} not found.`);
const forbidden = (message) => new HttpError(403, message);
const conflict = (message) => new HttpError(409, message);

export class Store {
  constructor({ now = () => new Date(), makeId = newId } = {}) {
    this.now = now;
    this.makeId = makeId;
    this.rev = 1;
    this.bootId = makeId('b');
    this.participants = new Map();
    this.posts = new Map(); // insertion order is chronological
    this.grounds = new Map();
    this.actions = new Map();
    this.listeners = new Set();
    this.archived = 0;
    this.cached = { rev: 0, json: '' };
    this.#seed();
  }

  // Refuses (503) a write that would push history past the shared budget.
  #reserve(records) {
    if (this.archived + records > LIMITS.archiveBudget) {
      throw new HttpError(503, 'This local demo has reached its history limit. Export the public data, then restart the server to clear it.');
    }
    this.archived += records;
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  #changed(kind) {
    this.rev += 1;
    for (const listener of this.listeners) listener(this.rev, kind);
  }

  #stamp() {
    return this.now().toISOString();
  }

  #seed() {
    const at = this.#stamp();
    const keyToId = new Map();
    for (const sample of SAMPLE_POSTS) {
      const id = this.makeId('p');
      keyToId.set(sample.key, id);
      this.posts.set(id, {
        id,
        roomId: sample.room,
        replyTo: sample.replyTo ? keyToId.get(sample.replyTo) : null,
        authorId: null,
        sampleAuthor: sample.author,
        text: sample.text,
        createdAt: at,
        withdrawn: false,
        modelRef: null,
        modelStance: null,
      });
    }
    for (const room of ROOMS) {
      const draft = SAMPLE_STATEMENTS[room.id];
      this.grounds.set(room.id, {
        versions: [{
          version: 1,
          text: draft.text,
          differences: [...draft.differences],
          sourcePostIds: draft.sources.map((key) => keyToId.get(key)),
          proposedBy: null,
          sampleDraft: true,
          aiAssisted: false,
          createdAt: at,
          closed: null,
        }],
        stances: new Map(),
      });
    }
  }

  // ---- participants -------------------------------------------------------

  join(body) {
    v.fields(body, ['displayName']);
    if (this.participants.size >= LIMITS.maxParticipants) {
      throw new HttpError(503, 'This local demo has reached its participant limit. Restart the server to clear it.');
    }
    const participant = {
      id: this.makeId('u'),
      displayName: v.text(body.displayName, { label: 'Display name', max: LIMITS.displayName }),
      joinedAt: this.#stamp(),
    };
    this.participants.set(participant.id, participant);
    this.#changed('participants');
    return participant;
  }

  rename(actor, body) {
    v.fields(body, ['displayName']);
    actor.displayName = v.text(body.displayName, { label: 'Display name', max: LIMITS.displayName });
    this.#changed('participants');
    return actor;
  }

  // ---- conversations ------------------------------------------------------

  createPost(actor, body) {
    v.fields(body, ['roomId', 'text'], ['replyTo', 'modelRef', 'modelStance']);
    const roomId = v.oneOf(body.roomId, ROOM_IDS, 'Room');
    const text = v.text(body.text, { label: 'Post', max: LIMITS.post, multiline: true });
    let replyTo = null;
    if (body.replyTo !== undefined && body.replyTo !== null) {
      replyTo = v.id(body.replyTo, 'Reply target');
      const parent = this.posts.get(replyTo);
      if (!parent || parent.roomId !== roomId) throw bad('The post you replied to is not in this room.');
      if (parent.replyTo) throw bad('Replies go under the original post, not under another reply.');
      if (parent.withdrawn) throw bad('That post was withdrawn by its author.');
    }
    const hasRef = body.modelRef !== undefined || body.modelStance !== undefined;
    let modelRef = null;
    let modelStance = null;
    if (hasRef) {
      if (replyTo) throw bad('Responses to a possible future start a new post.');
      modelRef = v.oneOf(body.modelRef, MODEL_REFS, 'Future model');
      modelStance = v.oneOf(body.modelStance, MODEL_STANCES, 'Response type');
    }
    if (this.posts.size >= LIMITS.maxPosts) {
      throw new HttpError(503, 'This local demo has reached its post limit. Export, then restart the server to clear it.');
    }
    const post = {
      id: this.makeId('p'),
      roomId,
      replyTo,
      authorId: actor.id,
      sampleAuthor: null,
      text,
      createdAt: this.#stamp(),
      withdrawn: false,
      modelRef,
      modelStance,
    };
    this.posts.set(post.id, post);
    this.#changed('posts');
    return post;
  }

  withdrawPost(actor, postId) {
    const post = this.posts.get(postId);
    if (!post) throw notFound('Post');
    if (post.authorId !== actor.id) throw forbidden('Only the author can withdraw a post.');
    if (post.withdrawn) throw conflict('This post is already withdrawn.');
    post.withdrawn = true;
    post.text = '';
    this.#changed('posts');
    return post;
  }

  // ---- common ground ------------------------------------------------------

  #ground(roomId) {
    const ground = this.grounds.get(roomId);
    if (!ground) throw notFound('Room');
    return ground;
  }

  #checkVersion(ground, expected) {
    const current = ground.versions.at(-1);
    v.integer(expected, { label: 'Expected version', min: 1, max: 10_000 });
    if (expected !== current.version) {
      throw conflict(`The statement has changed to version ${current.version}. Read it before responding.`);
    }
    return current;
  }

  setStance(actor, roomId, body) {
    v.fields(body, ['stance', 'expectedVersion'], ['reason']);
    const ground = this.#ground(roomId);
    this.#checkVersion(ground, body.expectedVersion);
    const stance = v.oneOf(body.stance, STANCES, 'Stance');
    const reason = stance === 'concern'
      ? v.text(body.reason, { label: 'Reason for your concern', min: 3, max: LIMITS.reason, multiline: true })
      : v.optionalText(body.reason, { label: 'Reason', max: LIMITS.reason, multiline: true });
    ground.stances.set(actor.id, { stance, reason, updatedAt: this.#stamp() });
    this.#changed('ground');
  }

  reviseStatement(actor, roomId, body) {
    v.fields(body, ['text', 'differences', 'sourcePostIds', 'expectedVersion'], ['aiAssisted']);
    const ground = this.#ground(roomId);
    const current = this.#checkVersion(ground, body.expectedVersion);
    const text = v.text(body.text, { label: 'Statement', min: 10, max: LIMITS.statement, multiline: true });
    const differences = v.list(body.differences, { label: 'Differences', max: LIMITS.differences })
      .map((item) => v.text(item, { label: 'Each difference', max: LIMITS.difference }));
    const sourcePostIds = v.list(body.sourcePostIds, { label: 'Sources', max: LIMITS.sources })
      .map((item) => v.id(item, 'Source'));
    if (new Set(sourcePostIds).size !== sourcePostIds.length) throw bad('Each source can be listed once.');
    for (const postId of sourcePostIds) {
      const post = this.posts.get(postId);
      if (!post || post.roomId !== roomId || post.withdrawn) {
        throw bad('Sources must be current public posts in this room.');
      }
    }
    const aiAssisted = body.aiAssisted === undefined ? false : v.boolean(body.aiAssisted, 'AI-assisted');
    if (text === current.text && JSON.stringify(differences) === JSON.stringify(current.differences)) {
      throw bad('The new version is identical to the current one.');
    }
    if (ground.versions.length >= LIMITS.maxVersions) {
      throw new HttpError(503, 'This room has reached its revision limit for the demo.');
    }
    this.#reserve(ground.stances.size);
    const at = this.#stamp();
    // Close the current version: its responses are kept in history and do
    // not carry over to the changed text.
    current.closed = {
      at,
      tally: tally(ground.stances),
      responses: [...ground.stances].map(([participantId, s]) => ({
        participantId,
        name: this.#name(participantId),
        stance: s.stance,
        reason: s.reason,
      })),
    };
    ground.stances = new Map();
    const next = {
      version: current.version + 1,
      text,
      differences,
      sourcePostIds,
      proposedBy: actor.id,
      sampleDraft: false,
      aiAssisted,
      createdAt: at,
      closed: null,
    };
    ground.versions.push(next);
    this.#changed('ground');
    return next;
  }

  // ---- actions ------------------------------------------------------------

  createAction(actor, body) {
    v.fields(
      body,
      ['roomId', 'expectedVersion', 'title', 'firstStep', 'ownership', 'checkIn', 'effort', 'impact', 'urgency', 'scope'],
      ['institution', 'concernKind', 'concernText'],
    );
    const roomId = v.oneOf(body.roomId, ROOM_IDS, 'Room');
    const ground = this.#ground(roomId);
    const current = this.#checkVersion(ground, body.expectedVersion);
    const scope = v.oneOf(body.scope, SCOPES, 'Scope');
    const institution = v.optionalText(body.institution, { label: 'Institution', max: LIMITS.institution });
    if (scope === 'institutional' && [...institution].length < 2) {
      throw bad('Name the institution that would need to adopt this proposal.');
    }
    if (scope === 'community' && institution) throw bad('Only institutional proposals name an institution.');
    const concernText = v.optionalText(body.concernText, { label: 'Concern', max: LIMITS.check, multiline: true });
    const concernKind = concernText ? v.oneOf(body.concernKind, CHECK_KINDS, 'Concern type') : null;
    if (!concernText && body.concernKind !== undefined && body.concernKind !== null && body.concernKind !== '') {
      throw bad('Describe the concern, or leave its type empty.');
    }
    const action = {
      id: this.makeId('a'),
      roomId,
      title: v.text(body.title, { label: 'Title', min: 3, max: LIMITS.title }),
      firstStep: v.text(body.firstStep, { label: 'First step', min: 5, max: LIMITS.step, multiline: true }),
      nextStep: null,
      updates: [],
      ownerId: v.oneOf(body.ownership, ['me', 'volunteer'], 'Ownership') === 'me' ? actor.id : null,
      createdBy: actor.id,
      volunteers: [],
      checkIn: v.dateWithin(body.checkIn, { label: 'Check-in date', from: this.now(), maxDays: LIMITS.checkInDays }),
      effort: v.integer(body.effort, { label: 'Effort', min: 1, max: 3 }),
      impact: v.integer(body.impact, { label: 'Impact', min: 1, max: 3 }),
      urgency: v.integer(body.urgency, { label: 'Urgency', min: 1, max: 3 }),
      scope,
      institution: scope === 'institutional' ? institution : null,
      status: 'proposed',
      checks: [],
      reviews: [],
      snapshot: this.#snapshot(ground, current),
      createdAt: this.#stamp(),
    };
    action.nextStep = action.firstStep;
    if (concernText) action.checks.push(this.#newCheck(actor, concernKind, concernText));
    if (this.actions.size >= LIMITS.maxActions) {
      throw new HttpError(503, 'This local demo has reached its action limit.');
    }
    this.#reserve(1 + action.snapshot.concerns.length + action.checks.length);
    this.actions.set(action.id, action);
    this.#changed('actions');
    return action;
  }

  #snapshot(ground, current) {
    return {
      version: current.version,
      text: current.text,
      differences: [...current.differences],
      tally: tally(ground.stances),
      concerns: [...ground.stances]
        .filter(([, s]) => s.stance === 'concern')
        .map(([participantId, s]) => ({ participantId, name: this.#name(participantId), reason: s.reason })),
    };
  }

  #newCheck(actor, kind, text) {
    return {
      id: this.makeId('c'),
      kind,
      text,
      raisedBy: actor.id,
      status: 'open',
      history: [{ op: 'raised', by: actor.id, text, at: this.#stamp() }],
    };
  }

  #action(actionId) {
    const action = this.actions.get(actionId);
    if (!action) throw notFound('Action');
    return action;
  }

  setVolunteer(actor, actionId, body) {
    v.fields(body, ['join']);
    const action = this.#action(actionId);
    const join = v.boolean(body.join, 'Join');
    const present = action.volunteers.includes(actor.id);
    if (join && !present) {
      if (action.ownerId === actor.id) throw conflict('You already own this action.');
      if (action.volunteers.length >= LIMITS.maxVolunteers) throw conflict('This action has enough volunteers listed.');
      action.volunteers.push(actor.id);
    } else if (!join && present) {
      action.volunteers = action.volunteers.filter((id) => id !== actor.id);
    } else {
      return action;
    }
    this.#changed('actions');
    return action;
  }

  takeOwnership(actor, actionId) {
    const action = this.#action(actionId);
    if (action.ownerId) throw conflict('This action already has an owner.');
    action.ownerId = actor.id;
    action.volunteers = action.volunteers.filter((id) => id !== actor.id);
    this.#changed('actions');
    return action;
  }

  updateNextStep(actor, actionId, body) {
    v.fields(body, ['text']);
    const action = this.#action(actionId);
    if (action.ownerId !== actor.id && !action.volunteers.includes(actor.id)) {
      throw forbidden('Volunteer or take ownership before updating the next step.');
    }
    if (action.updates.length >= LIMITS.maxUpdates) throw conflict('This action has reached its update limit for the demo.');
    const text = v.text(body.text, { label: 'Next step', min: 5, max: LIMITS.step, multiline: true });
    this.#reserve(1);
    action.nextStep = text;
    action.updates.push({ by: actor.id, text, at: this.#stamp() });
    this.#changed('actions');
    return action;
  }

  setStatus(actor, actionId, body) {
    v.fields(body, ['status']);
    const action = this.#action(actionId);
    const status = v.oneOf(body.status, STATUSES, 'Status');
    if (action.ownerId !== actor.id) throw forbidden('Only the owner can change the status.');
    if (!TRANSITIONS[action.status].includes(status)) {
      throw conflict(`An action cannot move from ${action.status} to ${status}.`);
    }
    const forward = STATUSES.indexOf(status) > STATUSES.indexOf(action.status);
    if (forward && action.checks.some((check) => check.status === 'open')) {
      throw conflict('Respond to the open concerns before moving this action forward.');
    }
    if (forward && this.#reviewNeeds(action, this.#context(action)).length) {
      throw conflict('Review the room\'s current statement and concerns before moving this action forward.');
    }
    action.status = status;
    this.#changed('actions');
    return action;
  }

  addCheck(actor, actionId, body) {
    v.fields(body, ['kind', 'text']);
    const action = this.#action(actionId);
    if (action.checks.length >= LIMITS.maxChecks) throw conflict('This action has reached its concern limit for the demo.');
    const kind = v.oneOf(body.kind, CHECK_KINDS, 'Concern type');
    const text = v.text(body.text, { label: 'Concern', min: 5, max: LIMITS.check, multiline: true });
    this.#reserve(1);
    const check = this.#newCheck(actor, kind, text);
    action.checks.push(check);
    this.#changed('actions');
    return check;
  }

  // A concern is never deleted. Anyone may record how it is handled, which
  // lets the action move again; the person who raised it may reopen it.
  // Every response leaves room in the history for one more reopen (both per
  // concern and in the shared archive budget), so a concern can never be
  // locked as "addressed" by a cap. At the cap it stays open.
  updateCheck(actor, actionId, checkId, body) {
    v.fields(body, ['op', 'text']);
    const action = this.#action(actionId);
    const check = action.checks.find((item) => item.id === checkId);
    if (!check) throw notFound('Concern');
    const op = v.oneOf(body.op, ['address', 'reopen'], 'Operation');
    const text = v.text(body.text, { label: op === 'address' ? 'Response' : 'Reason', min: 5, max: LIMITS.check, multiline: true });
    if (op === 'address') {
      if (check.status !== 'open') throw conflict('This concern already has a response.');
      if (check.history.length >= LIMITS.maxUpdates - 1) {
        throw conflict('This concern has reached its history limit for the demo, so it stays open. Discuss it in the room, or start a new action.');
      }
      this.#reserve(2); // this response, plus a possible reopen
      check.status = 'addressed';
    } else {
      if (check.raisedBy !== actor.id) throw forbidden('Only the person who raised a concern can reopen it.');
      if (check.status !== 'addressed') throw conflict('This concern is already open.');
      check.status = 'open'; // capacity was reserved by the response
    }
    check.history.push({ op, by: actor.id, text, at: this.#stamp() });
    this.#changed('actions');
    return check;
  }

  // The owner reads the room's current statement and concerns and records
  // why the action can still go ahead. This clears the review hold for
  // exactly the context reviewed (identified by `contextId`); a later
  // revision or a new or reworded concern needs a fresh review. Concerns
  // themselves stay on the statement and in the review record.
  reviewContext(actor, actionId, body) {
    v.fields(body, ['contextId', 'text']);
    const action = this.#action(actionId);
    if (action.ownerId !== actor.id) throw forbidden('Only the owner can review the context for this action.');
    const contextId = v.text(body.contextId, { label: 'Context', max: 40 });
    const text = v.text(body.text, { label: 'Reason', min: 5, max: LIMITS.check, multiline: true });
    const context = this.#context(action);
    if (contextId !== context.id) {
      throw conflict('The statement or its concerns changed while you were reviewing. Read the current version and review again.');
    }
    if (!this.#reviewNeeds(action, context).length) throw conflict('There is nothing new to review for this action.');
    if (action.reviews.length >= LIMITS.maxReviews) {
      throw conflict('This action has reached its review limit for the demo, so it stays on hold. Start a new action from the current statement.');
    }
    this.#reserve(1 + context.concerns.length);
    action.reviews.push({
      by: actor.id,
      text,
      contextId: context.id,
      version: context.version,
      concernKeys: context.keys,
      concerns: context.concerns.map((c) => ({ participantId: c.participantId, name: this.#name(c.participantId), reason: c.reason })),
      at: this.#stamp(),
    });
    this.#changed('actions');
    return action;
  }

  // The room context an action depends on: the current statement version and
  // the concern stances on it. Support and abstain responses are not part of
  // it, so new supportive responses never hold an action back.
  #context(action) {
    const ground = this.grounds.get(action.roomId);
    const version = ground.versions.at(-1).version;
    const concerns = [...ground.stances]
      .filter(([, s]) => s.stance === 'concern')
      .map(([participantId, s]) => ({ participantId, reason: s.reason }));
    const keys = concerns.map((c) => `${c.participantId}\n${c.reason}`).sort();
    const id = createHash('sha256').update(JSON.stringify([version, keys])).digest('base64url').slice(0, 22);
    return { id, version, concerns, keys };
  }

  // Why the owner must review before the next forward move. The baseline is
  // the last review, or else the creation snapshot with no concerns counted
  // as reviewed: concerns inherited at creation need one explicit review.
  // A concern that is withdrawn needs no review.
  #reviewNeeds(action, context) {
    const last = action.reviews.at(-1);
    const baseVersion = last ? last.version : action.snapshot.version;
    const reviewed = new Set(last ? last.concernKeys : []);
    const reasons = [];
    if (context.version !== baseVersion) {
      reasons.push(`The statement is now version ${context.version}; ${last ? 'the owner last reviewed' : 'this action was created from'} version ${baseVersion}.`);
    }
    const unreviewed = context.keys.filter((key) => !reviewed.has(key)).length;
    if (unreviewed) {
      reasons.push(`${unreviewed} ${unreviewed === 1 ? 'concern' : 'concerns'} on the statement ${unreviewed === 1 ? 'has' : 'have'} not been reviewed by the owner${last ? ' since the last review' : ''}.`);
    }
    return reasons;
  }

  // ---- public views -------------------------------------------------------

  #name(participantId) {
    return this.participants.get(participantId)?.displayName ?? 'Former participant';
  }

  #person(participantId) {
    if (!participantId) return null;
    return { id: participantId, name: this.#name(participantId), handle: participantId.slice(-4) };
  }

  #publicPost(post) {
    return {
      id: post.id,
      roomId: post.roomId,
      replyTo: post.replyTo,
      sample: post.sampleAuthor !== null,
      author: post.sampleAuthor !== null
        ? { id: null, name: post.sampleAuthor, handle: null }
        : this.#person(post.authorId),
      text: post.withdrawn ? '' : post.text,
      withdrawn: post.withdrawn,
      createdAt: post.createdAt,
      modelRef: post.modelRef,
      modelStance: post.modelStance,
    };
  }

  #publicVersion(version) {
    return {
      version: version.version,
      text: version.text,
      differences: [...version.differences],
      sources: version.sourcePostIds.map((postId) => {
        const post = this.posts.get(postId);
        return { postId, withdrawn: !post || post.withdrawn };
      }),
      proposedBy: this.#person(version.proposedBy),
      sampleDraft: version.sampleDraft,
      aiAssisted: version.aiAssisted,
      // The server cannot tell who or what wrote a text, so the label is
      // only ever the proposer's own declaration.
      aiAssistedSource: version.aiAssisted ? 'self-declared by the proposer, not verified' : null,
      createdAt: version.createdAt,
      closed: version.closed && {
        at: version.closed.at,
        tally: { ...version.closed.tally },
        responses: version.closed.responses.map((r) => ({ ...r })),
      },
    };
  }

  #publicGround(roomId) {
    const ground = this.grounds.get(roomId);
    const current = ground.versions.at(-1);
    const responders = new Set(ground.stances.keys());
    const authors = new Set();
    for (const post of this.posts.values()) {
      if (post.roomId === roomId && post.authorId && !post.withdrawn) authors.add(post.authorId);
    }
    return {
      current: this.#publicVersion(current),
      stances: [...ground.stances].map(([participantId, s]) => ({
        participant: this.#person(participantId),
        stance: s.stance,
        reason: s.reason,
        updatedAt: s.updatedAt,
      })),
      tally: tally(ground.stances),
      coverage: {
        respondents: responders.size,
        joined: this.participants.size,
        postAuthorsWithoutStance: [...authors].filter((id) => !responders.has(id)).length,
      },
      history: ground.versions.slice(0, -1).map((version) => this.#publicVersion(version)).reverse(),
    };
  }

  staleness(action) {
    const ground = this.grounds.get(action.roomId);
    const current = ground.versions.at(-1);
    const snap = action.snapshot;
    if (current.version !== snap.version) {
      return [`The room's statement was revised to version ${current.version} after this action was created from version ${snap.version}.`];
    }
    const now = tally(ground.stances);
    const reasons = [];
    if (STANCES.some((key) => now[key] !== snap.tally[key])) {
      reasons.push(`Responses to version ${snap.version} changed since this action was created: `
        + `support ${snap.tally.support}→${now.support}, concerns ${snap.tally.concern}→${now.concern}, `
        + `abstain ${snap.tally.abstain}→${now.abstain}.`);
    } else {
      const was = snap.concerns.map((c) => `${c.participantId}:${c.reason}`).sort().join('\n');
      const is = [...ground.stances]
        .filter(([, s]) => s.stance === 'concern')
        .map(([id, s]) => `${id}:${s.reason}`).sort().join('\n');
      if (was !== is) reasons.push('A concern on this statement was reworded or replaced since this action was created.');
    }
    return reasons;
  }

  #publicAction(action) {
    const openChecks = action.checks.filter((check) => check.status === 'open').length;
    const context = this.#context(action);
    const reviewNeeded = this.#reviewNeeds(action, context);
    const blockers = [];
    if (!action.ownerId) blockers.push('needs-owner');
    if (openChecks) blockers.push('open-concerns');
    if (reviewNeeded.length) blockers.push('context-review');
    return {
      id: action.id,
      roomId: action.roomId,
      title: action.title,
      firstStep: action.firstStep,
      nextStep: action.nextStep,
      updates: action.updates.map((u) => ({ by: this.#person(u.by), text: u.text, at: u.at })),
      owner: this.#person(action.ownerId),
      createdBy: this.#person(action.createdBy),
      volunteers: action.volunteers.map((id) => this.#person(id)),
      checkIn: action.checkIn,
      effort: action.effort,
      impact: action.impact,
      urgency: action.urgency,
      priority: priorityOf(action),
      scope: action.scope,
      institution: action.institution,
      // Always "unconfirmed" for institutional proposals: nothing in Unite can
      // change it, whatever the status or the institution's name.
      institutionalAdoption: action.scope === 'institutional' ? 'unconfirmed' : null,
      status: action.status,
      statusMeaning: STATUS_MEANINGS[action.scope][action.status],
      nextStatuses: TRANSITIONS[action.status],
      blockers,
      context: {
        id: context.id,
        version: context.version,
        concerns: context.concerns.length,
        reviewNeeded,
      },
      reviews: action.reviews.map((r) => ({
        by: this.#person(r.by),
        text: r.text,
        version: r.version,
        concerns: r.concerns.map((c) => ({ name: c.name, reason: c.reason })),
        at: r.at,
      })),
      checks: action.checks.map((check) => ({
        id: check.id,
        kind: check.kind,
        text: check.text,
        status: check.status,
        raisedBy: this.#person(check.raisedBy),
        history: check.history.map((h) => ({ op: h.op, by: this.#person(h.by), text: h.text, at: h.at })),
      })),
      openChecks,
      snapshot: {
        ...action.snapshot,
        differences: [...action.snapshot.differences],
        tally: { ...action.snapshot.tally },
        concerns: action.snapshot.concerns.map((c) => ({ ...c })),
      },
      stale: this.staleness(action),
      createdAt: action.createdAt,
    };
  }

  publicState() {
    return {
      rev: this.rev,
      bootId: this.bootId,
      rooms: ROOMS.map((room) => ({ ...room })),
      posts: [...this.posts.values()].map((post) => this.#publicPost(post)),
      grounds: Object.fromEntries(ROOM_IDS.map((roomId) => [roomId, this.#publicGround(roomId)])),
      actions: [...this.actions.values()].map((action) => this.#publicAction(action)),
      joined: this.participants.size,
    };
  }

  // Serialised public state, built once per revision however many tabs ask.
  // Every change goes through #changed(), which moves the revision.
  publicStateJson() {
    if (this.cached.rev !== this.rev) this.cached = { rev: this.rev, json: JSON.stringify(this.publicState()) };
    return this.cached.json;
  }

  // Public posts for one room, oldest first, for AI synthesis prompts.
  roomPostsForSynthesis(roomId, max) {
    this.#ground(roomId);
    return [...this.posts.values()]
      .filter((post) => post.roomId === roomId && !post.withdrawn)
      .slice(-max)
      .map((post) => ({ id: post.id, text: post.text, sample: post.sampleAuthor !== null }));
  }

  currentStatement(roomId) {
    const current = this.#ground(roomId).versions.at(-1);
    return { version: current.version, text: current.text, differences: [...current.differences] };
  }

  isRoomPost(roomId, postId) {
    const post = this.posts.get(postId);
    return Boolean(post && post.roomId === roomId && !post.withdrawn);
  }
}

export function tally(stances) {
  const counts = { support: 0, concern: 0, abstain: 0 };
  for (const s of stances.values()) counts[s.stance] += 1;
  return counts;
}

export const EXPORT_NOTICE = 'Public data from a local Unite demo server. Sample people are fictional. '
  + 'Counts describe only participants of this local demo and are not a measure of any wider opinion. '
  + 'Action statuses are reported by their owners. For institutional proposals they describe only the work of '
  + 'preparing and submitting the proposal: institutional adoption is never recorded and is always unconfirmed, '
  + 'and naming an institution gives no authority. No money or funding is modelled. '
  + '"aiAssisted" on a statement version is declared by its proposer and is not verified. '
  + 'Private interview conversations are never stored on the server and are not included.';

export function publicExport(store) {
  const { rev, bootId, ...state } = store.publicState();
  return {
    format: 'unite-v4-public-export',
    formatVersion: 1,
    exportedAt: store.now().toISOString(),
    notice: EXPORT_NOTICE,
    ...state,
  };
}
