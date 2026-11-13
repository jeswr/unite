import { Router } from 'express';
import { DECISION_LEVELS, RULES, type PromptsResponse, type RulesResponse } from '@unite/shared';
import * as prompts from '../ai/prompts.js';
import type { Deps } from '../deps.js';
import { notBuilt } from './notBuilt.js';

/** Every export of prompts.ts, published as it is. */
export function publishedPrompts(): PromptsResponse['prompts'] {
  const out: PromptsResponse['prompts'] = [];
  for (const [name, value] of Object.entries(prompts)) {
    if (name === 'PROMPT_VERSION') continue;
    if (typeof value === 'string') out.push({ name, kind: 'text', text: value });
    else if (typeof value === 'function' && name === 'interviewerStageMessage')
      out.push({
        name,
        kind: 'template',
        text: prompts.interviewerStageMessage({
          stage: 1,
          assemblyQuestion: '<the assembly question>',
          probe: "<the host's question>",
          personTurnsInStage: 0,
          minTurns: 2,
          maxTurns: 3,
          repair: '<the rule that was broken>',
        }),
      });
    else if (typeof value === 'function') out.push({ name, kind: 'template', text: String(value) });
    else out.push({ name, kind: 'data', text: JSON.stringify(value, null, 2) });
  }
  return out;
}

/**
 * GET /api/how/prompts; GET /api/how/rules.
 * Stub for another part of the build: GET /api/assemblies/:slug/export (the pledge, picture,
 * statements with support, decisions, register entries; no transcripts, no person ids).
 */
export function howRouter(deps: Deps): Router {
  const r = Router();

  r.get('/how/prompts', (_req, res) => {
    const body: PromptsResponse = {
      promptVersion: prompts.PROMPT_VERSION,
      model: deps.ai.model,
      mode: deps.ai.enabled ? 'claude' : 'scripted',
      prompts: publishedPrompts(),
    };
    res.json(body);
  });

  r.get('/how/rules', (_req, res) => {
    const body: RulesResponse = { rules: [...RULES], levels: [...DECISION_LEVELS] };
    res.json(body);
  });

  r.get('/assemblies/:slug/export', notBuilt);

  return r;
}
