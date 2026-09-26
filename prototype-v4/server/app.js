// The Unite HTTP service: static app, JSON API and server-sent events on one
// loopback origin. Every request must carry an expected Host header (DNS
// rebinding defence). Mutations also need a matching Origin, a JSON content
// type, the X-Unite-Client header (which forces a CORS preflight that this
// server never approves) and, except for joining, a valid session token.

import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { ClaudeBridge, AiError } from './ai.js';
import { EventHub } from './events.js';
import { SECURITY_HEADERS, indexStatic, readJson, sendJson, sendText } from './http.js';
import { DRAFT_SYSTEM, INTERVIEW_SYSTEM, SYNTHESIS_MAX_POSTS, SYNTHESIS_SYSTEM, interviewPrompt, parseSynthesis, synthesisPrompt, validateInterview } from './prompts.js';
import { ROOMS, ROOM_IDS } from './seed.js';
import { RateLimiter, Sessions } from './sessions.js';
import { LIMITS, Store, publicExport } from './store.js';
import { HttpError, fields, id, oneOf } from './validate.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const BODY_LIMIT = 16 * 1024;
const INTERVIEW_BODY_LIMIT = 96 * 1024;

export function createUniteServer({
  store = new Store(),
  sessions = new Sessions(),
  bridge = new ClaudeBridge(),
  hub = new EventHub(),
  publicDir = PUBLIC_DIR,
  limits = {},
} = {}) {
  const files = indexStatic(publicDir);
  const joinLimiter = new RateLimiter({ limit: limits.joinsPerMinute ?? 20, windowMs: 60_000 });
  const writeLimiter = new RateLimiter({ limit: limits.writesPerMinute ?? 60, windowMs: 60_000 });
  const aiLimiter = new RateLimiter({ limit: limits.aiPerTenMinutes ?? 20, windowMs: 600_000 });
  const aiActive = new Set();

  store.onChange((rev, kind) => hub.broadcast(rev, store.bootId, kind));

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => fail(res, error));
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 180_000;
  server.keepAliveTimeout = 5_000;
  server.on('close', () => hub.close());

  const allowedHosts = () => {
    const { port } = server.address();
    return [`127.0.0.1:${port}`, `localhost:${port}`];
  };

  function fail(res, error) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    if (error instanceof HttpError || error instanceof AiError) {
      sendJson(res, error.status, { error: error.message, code: error.code });
      return;
    }
    console.error(`[unite] unexpected ${error?.name ?? 'error'}`);
    sendJson(res, 500, { error: 'Something went wrong on the server.' });
  }

  async function handle(req, res) {
    if (!req.url.startsWith('/')) return sendText(res, 400, 'Bad request.');
    if (!allowedHosts().includes(req.headers.host)) return sendText(res, 421, 'Unexpected Host header.');
    const origin = req.headers.origin;
    if (origin !== undefined && !allowedHosts().some((host) => origin === `http://${host}`)) {
      return sendText(res, 403, 'Cross-origin requests are not accepted.');
    }
    const { pathname } = new URL(req.url, 'http://unite.invalid');

    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method not allowed.');
      const file = files.get(pathname);
      if (!file) return sendText(res, 404, 'Not found.');
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': file.type, 'Cache-Control': 'no-cache', 'Content-Length': file.body.length });
      return res.end(req.method === 'HEAD' ? undefined : file.body);
    }

    const site = req.headers['sec-fetch-site'];
    if (site !== undefined && site !== 'same-origin' && site !== 'none') {
      throw new HttpError(403, 'Cross-site requests are not accepted.');
    }

    if (req.method === 'GET') return get(req, res, pathname);
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

    if (origin === undefined) throw new HttpError(403, 'Missing Origin header.');
    if (req.headers['x-unite-client'] !== '1') throw new HttpError(403, 'Missing client header.');
    if (!/^application\/json(;|$)/.test(req.headers['content-type'] ?? '')) {
      throw new HttpError(415, 'Send JSON with Content-Type: application/json.');
    }
    return post(req, res, pathname);
  }

  function actorFrom(req) {
    const participantId = sessions.resolve(req.headers['x-unite-session']);
    const actor = participantId && store.participants.get(participantId);
    if (!actor) throw new HttpError(401, 'Join with a display name first (or join again if the server restarted).');
    return actor;
  }

  function get(req, res, pathname) {
    switch (pathname) {
      case '/api/state':
        return sendJson(res, 200, { ...store.publicState(), ai: bridge.status() });
      case '/api/export': {
        const date = store.now().toISOString().slice(0, 10);
        return sendJson(res, 200, publicExport(store), {
          'Content-Disposition': `attachment; filename="unite-public-${date}.json"`,
        });
      }
      case '/api/session': {
        const actor = actorFrom(req);
        return sendJson(res, 200, { participant: publicParticipant(actor) });
      }
      case '/api/events':
        if (!hub.attach(req, res, store, SECURITY_HEADERS)) {
          throw new HttpError(503, 'Too many live connections to this local server.');
        }
        return undefined;
      default:
        throw new HttpError(404, 'Not found.');
    }
  }

  async function post(req, res, pathname) {
    const isInterview = pathname === '/api/interview';
    const body = await readJson(req, isInterview ? INTERVIEW_BODY_LIMIT : BODY_LIMIT);

    if (pathname === '/api/session') {
      if (!joinLimiter.allow('join')) throw new HttpError(429, 'Too many people joined in the last minute. Try again shortly.');
      const participant = store.join(body);
      const token = sessions.create(participant.id);
      if (!token) throw new HttpError(503, 'Too many open sessions on this local server.');
      return sendJson(res, 201, { token, participant: publicParticipant(participant) });
    }

    const actor = actorFrom(req);

    if (isInterview || /^\/api\/rooms\/[^/]+\/synthesis$/.test(pathname)) {
      return ai(req, res, pathname, actor, body);
    }

    if (!writeLimiter.allow(actor.id)) throw new HttpError(429, 'You are doing that a lot. Wait a minute and try again.');
    const result = mutate(pathname, actor, body);
    return sendJson(res, 200, { ok: true, rev: store.rev, ...result });
  }

  function mutate(pathname, actor, body) {
    const parts = pathname.split('/').slice(2); // after "/api/"
    const [collection, target, verb, sub] = parts;
    const empty = () => fields(body, []);

    if (collection === 'session' && target === 'name' && parts.length === 2) {
      return { participant: publicParticipant(store.rename(actor, body)) };
    }
    if (collection === 'posts') {
      if (parts.length === 1) return { id: store.createPost(actor, body).id };
      if (verb === 'withdraw' && parts.length === 3) {
        empty();
        return { id: store.withdrawPost(actor, id(target, 'Post')).id };
      }
    }
    if (collection === 'rooms' && parts.length === 3) {
      const roomId = oneOf(target, ROOM_IDS, 'Room');
      if (verb === 'stance') {
        store.setStance(actor, roomId, body);
        return {};
      }
      if (verb === 'statement') return { version: store.reviseStatement(actor, roomId, body).version };
    }
    if (collection === 'actions') {
      if (parts.length === 1) return { id: store.createAction(actor, body).id };
      const actionId = id(target, 'Action');
      if (parts.length === 3) {
        if (verb === 'volunteer') return { id: store.setVolunteer(actor, actionId, body).id };
        if (verb === 'own') {
          empty();
          return { id: store.takeOwnership(actor, actionId).id };
        }
        if (verb === 'next-step') return { id: store.updateNextStep(actor, actionId, body).id };
        if (verb === 'status') return { id: store.setStatus(actor, actionId, body).id };
        if (verb === 'checks') return { id: store.addCheck(actor, actionId, body).id };
      }
      if (parts.length === 4 && verb === 'checks') {
        return { id: store.updateCheck(actor, actionId, id(sub, 'Concern'), body).id };
      }
    }
    throw new HttpError(404, 'Not found.');
  }

  async function ai(req, res, pathname, actor, body) {
    let request;
    if (pathname === '/api/interview') {
      const input = validateInterview(body);
      request = {
        system: input.mode === 'question' ? INTERVIEW_SYSTEM : DRAFT_SYSTEM,
        prompt: interviewPrompt(input),
        finish: (result) => {
          if (input.mode === 'draft' && [...result.text].length > LIMITS.post) {
            throw new AiError('too-long', 'The AI draft was longer than a post allows. Nothing was substituted.');
          }
          return { text: result.text, model: result.model, mode: input.mode };
        },
      };
    } else {
      const roomId = oneOf(pathname.split('/')[3], ROOM_IDS, 'Room');
      fields(body, ['consent']);
      if (body.consent !== true) throw new HttpError(400, 'Confirm the AI disclosure before sending anything.');
      const statement = store.currentStatement(roomId);
      const posts = store.roomPostsForSynthesis(roomId, SYNTHESIS_MAX_POSTS);
      request = {
        system: SYNTHESIS_SYSTEM,
        prompt: synthesisPrompt({ roomName: ROOMS.find((room) => room.id === roomId).name, statement, posts }),
        finish: (result) => ({
          model: result.model,
          basedOnVersion: statement.version,
          suggestion: parseSynthesis(result.text, (postId) => store.isRoomPost(roomId, postId)),
        }),
      };
    }

    if (!bridge.enabled) throw new AiError('disabled', bridge.status().reason, 503);
    if (aiActive.has(actor.id)) throw new HttpError(429, 'You already have an AI request running in this session.');
    if (!aiLimiter.allow(actor.id)) throw new HttpError(429, 'You have reached the AI request limit for now. Try again in a few minutes.');

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    aiActive.add(actor.id);
    try {
      const result = await bridge.complete({ system: request.system, prompt: request.prompt, signal: controller.signal });
      if (controller.signal.aborted) return undefined;
      return sendJson(res, 200, request.finish(result));
    } finally {
      aiActive.delete(actor.id);
    }
  }

  return server;
}

function publicParticipant(participant) {
  return { id: participant.id, name: participant.displayName, handle: participant.id.slice(-4) };
}
