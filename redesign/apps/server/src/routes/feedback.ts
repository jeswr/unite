import { Router, type Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { newId, type Feedback } from '@unite/shared';
import { z } from 'zod';
import { feedbackTurn, openingTurn } from '../ai/feedback.js';
import { currentPerson } from '../auth.js';
import type { Deps } from '../deps.js';
import { HttpError } from '../errors.js';
import { newToken, personView, planFor, refreshPublicIssue } from '../services/feedback/index.js';
import { feedbackLimiters } from '../services/feedback/limits.js';
import { loadReleases } from '../services/feedback/releases.js';
import { publicSummaryText, screenshotProblem } from '../services/feedback/text.js';
import { parseBody } from '../validate.js';

/**
 * Feedback on Unite (sections 6.5 and 7). No sign-in is needed: a person id is attached only when
 * a session already exists. The private token is the only key to a record.
 *
 *   POST /api/feedback — { path, mode, sinceVersion? }: returns the token and the first question
 *   POST /api/feedback/:token/turns — { text }: the next question (20 a minute per token and per address)
 *   PATCH /api/feedback/:token — answers, name, contact, screenshot, publicIssue
 *   POST /api/feedback/:token/submit — allowed with any number of answers
 *   GET /api/feedback/:token — your feedback and its status
 *   GET /api/releases — RELEASES.json, newest first
 */

const Version = z.string().regex(/^\d+\.\d+\.\d+$/, 'must be a version like 0.1.0');

const StartBody = z.strictObject({
  path: z.string().max(500).optional(),
  mode: z.enum(['guided', 'free', 'changes']),
  sinceVersion: Version.optional(),
});

const TurnBody = z.strictObject({ text: z.string().trim().min(1, 'is empty').max(4000) });

const PatchBody = z.strictObject({
  answers: z.array(z.strictObject({ index: z.number().int().min(0), answer: z.string().max(4000) })).max(100).optional(),
  name: z.string().trim().max(80).nullable().optional(),
  contact: z.string().trim().max(200).nullable().optional(),
  screenshot: z.string().nullable().optional(),
  publicIssue: z
    .strictObject({
      state: z.enum(['previewed', 'agreed', 'none', 'withdrawn']),
      /** With 'agreed': the exact text the person was shown. */
      text: z.string().optional(),
    })
    .optional(),
});

/** Only a path inside Unite is kept, so nobody can store a link to somewhere else. */
const cleanPath = (p: string | undefined) => (p && p.startsWith('/') && !p.startsWith('//') ? p : '/');
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const addressOf = (req: Request) => `ip:${ipKeyGenerator(req.ip ?? 'unknown')}`;

const tooMany = (message: string) => new HttpError(429, 'too_many', message);

export function feedbackRouter(deps: Deps): Router {
  const r = Router();
  const limits = feedbackLimiters(deps.clock);

  async function byToken(token: string | undefined): Promise<Feedback> {
    if (!token || !TOKEN.test(token)) throw new HttpError(404, 'not_found', 'We could not find feedback at this link.');
    const [fb] = await deps.store.list('feedback', { token }, { limit: 1 });
    if (!fb) throw new HttpError(404, 'not_found', 'We could not find feedback at this link.');
    return fb;
  }

  r.post('/feedback', async (req, res) => {
    const body = parseBody(StartBody, req.body);
    if (!limits.starts.take(addressOf(req)))
      throw tooMany('A lot of feedback has been started from here in the last hour. Please wait a while, or carry on with the one you have.');
    const person = await currentPerson(deps, req);
    const sinceVersion = body.mode === 'changes' ? body.sinceVersion : undefined;
    const plan = planFor({ mode: body.mode, sinceVersion });
    const { message, answer } = openingTurn(plan);
    const fb = await deps.store.put('feedback', {
      id: newId('fb'),
      token: newToken(),
      ...(person ? { personId: person.id } : {}),
      path: cleanPath(body.path),
      mode: body.mode,
      messages: [message],
      answers: [answer],
      status: 'draft',
      publicIssue: { state: 'none' },
      ...(sinceVersion ? { sinceVersion } : {}),
      createdAt: deps.clock.iso(),
    });
    res.status(201).json({ token: fb.token, question: message.text, feedback: personView(fb) });
  });

  r.post('/feedback/:token/turns', async (req, res) => {
    const fb = await byToken(req.params.token);
    const { text } = parseBody(TurnBody, req.body);
    if (fb.status !== 'draft') throw new HttpError(409, 'already_sent', 'This feedback has been sent. You can still change your answers.');
    if (!limits.turns.take(`token:${fb.token}`, addressOf(req)))
      throw tooMany('That was a lot of messages in a short time. Please wait a minute and try again.');
    const turn = await feedbackTurn(deps, fb, planFor(fb), text);
    const saved = await deps.store.transaction(async (tx) => {
      const now = await tx.get('feedback', fb.id);
      if (!now || now.messages.length !== fb.messages.length)
        throw new HttpError(409, 'changed', 'Another message arrived at the same time. Please send yours again.');
      const next: Feedback = {
        ...now,
        messages: [...now.messages, { role: 'person', text }, { role: 'interviewer', text: turn.reply }],
        answers: turn.answers,
      };
      return tx.put('feedback', { ...next, publicIssue: refreshPublicIssue(next) });
    });
    res.json({ reply: turn.reply, done: turn.done, feedback: personView(saved) });
  });

  r.patch('/feedback/:token', async (req, res) => {
    const found = await byToken(req.params.token);
    const body = parseBody(PatchBody, req.body);
    if (typeof body.screenshot === 'string') {
      const problem = screenshotProblem(body.screenshot);
      if (problem) throw new HttpError(400, 'bad_screenshot', problem);
    }
    const saved = await deps.store.transaction(async (tx) => {
      let fb = (await tx.get('feedback', found.id))!;
      if (body.answers?.length) {
        const answers = fb.answers.map((a) => ({ ...a }));
        for (const { index, answer } of body.answers) {
          const a = answers[index];
          if (!a) throw new HttpError(400, 'invalid', 'One of the answers you changed could not be found. Please reload the page.');
          a.answer = answer;
        }
        fb = { ...fb, answers };
        fb = { ...fb, publicIssue: refreshPublicIssue(fb) };
      }
      const set = <K extends 'name' | 'contact' | 'screenshot'>(key: K, v: string | null | undefined) => {
        if (v === undefined) return;
        const { [key]: _old, ...rest } = fb;
        void _old;
        fb = (v === null || v === '' ? rest : { ...rest, [key]: v }) as Feedback;
      };
      set('name', body.name);
      set('contact', body.contact);
      set('screenshot', body.screenshot);

      if (body.publicIssue) {
        const want = body.publicIssue.state;
        const prepared = publicSummaryText(fb.answers);
        if (want === 'previewed') {
          if (!prepared) throw new HttpError(400, 'nothing_to_publish', 'There is nothing to show yet. Answer a question first.');
          fb = { ...fb, publicIssue: { state: 'previewed', text: prepared } };
        } else if (want === 'agreed') {
          const shown = fb.publicIssue;
          if ((shown.state !== 'previewed' && shown.state !== 'agreed') || !prepared)
            throw new HttpError(409, 'not_previewed', 'Look at the summary as it would be published before agreeing to it.');
          if (body.publicIssue.text !== prepared || shown.text !== prepared)
            throw new HttpError(409, 'summary_changed', 'The summary has changed since you saw it. Please read it again before agreeing.');
          fb = { ...fb, publicIssue: { state: 'agreed', text: prepared } };
        } else if (want === 'withdrawn' || fb.publicIssue.state === 'agreed') {
          fb = { ...fb, publicIssue: { state: 'withdrawn' } };
        } else {
          fb = { ...fb, publicIssue: { state: 'none' } };
        }
      }
      return tx.put('feedback', fb);
    });
    res.json({ feedback: personView(saved) });
  });

  r.post('/feedback/:token/submit', async (req, res) => {
    const fb = await byToken(req.params.token);
    const saved = fb.status === 'draft' ? await deps.store.put('feedback', { ...fb, status: 'received', submittedAt: deps.clock.iso() }) : fb;
    res.json({ feedback: personView(saved) });
  });

  r.get('/feedback/:token', async (req, res) => {
    res.json({ feedback: personView(await byToken(req.params.token)) });
  });

  r.get('/releases', (_req, res) => {
    res.json({ releases: loadReleases() });
  });

  return r;
}
