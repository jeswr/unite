import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import type { Deps } from '../deps.js';
import { HttpError } from '../errors.js';
import { feedbackCsv, feedbackJson, stewardItem, stewardList } from '../services/feedback/index.js';
import { parseBody } from '../validate.js';

/**
 * Steward (feedback). Other steward actions live with their area.
 * Mounted under /api in app.ts. Endpoints that belong here (section 7):
 *
 *   GET /api/steward/feedback — list, counts, themes summary with sources
 *   PATCH /api/steward/feedback/:id — status and reason
 *   GET /api/steward/feedback/export — ?format=json|csv
 */
export function stewardRouter(deps: Deps): Router {
  const r = Router();
  mountStewardFeedback(r, deps);
  return r;
}

/* ===================================================================== */
/* Feedback lane: the steward's feedback endpoints. Everything below this */
/* line belongs to the feedback area.                                    */
/* ===================================================================== */

const FeedbackStatusBody = z.strictObject({
  status: z.enum(['received', 'planned', 'done', 'declined']),
  /** Required: the person sees it on their feedback page. */
  reason: z.string().trim().min(1, 'is needed: the person will see it').max(1000),
});

const ExportQuery = z.object({ format: z.enum(['json', 'csv']).default('json') });

function mountStewardFeedback(r: Router, deps: Deps): void {
  const steward = requireRole('steward');

  r.get('/steward/feedback', steward, async (_req, res) => {
    res.json(stewardList(await deps.store.list('feedback')));
  });

  r.get('/steward/feedback/export', steward, async (req, res) => {
    const { format } = parseBody(ExportQuery, req.query);
    const all = await deps.store.list('feedback');
    const day = deps.clock.iso().slice(0, 10);
    if (format === 'csv') {
      res.type('text/csv; charset=utf-8').attachment(`unite-feedback-${day}.csv`).send(feedbackCsv(all));
      return;
    }
    res.attachment(`unite-feedback-${day}.json`).json(feedbackJson(all));
  });

  r.patch('/steward/feedback/:id', steward, async (req, res) => {
    const { status, reason } = parseBody(FeedbackStatusBody, req.body);
    const fb = await deps.store.get('feedback', req.params.id as string);
    if (!fb) throw new HttpError(404, 'not_found', 'That feedback could not be found.');
    if (fb.status === 'draft') throw new HttpError(409, 'not_sent', 'This feedback has not been sent yet.');
    const saved = await deps.store.put('feedback', { ...fb, status, statusReason: reason });
    res.json({ item: stewardItem(saved) });
  });
}
