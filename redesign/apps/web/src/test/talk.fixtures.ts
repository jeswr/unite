import { vi } from 'vitest';
import type { Point, Turn } from '@unite/shared';
import type { ConversationView } from '@unite/shared';

export const CID = 'con_AAAAAAAAAAAA';

export function turn(id: string, role: Turn['role'], text: string, stage = 1): Turn {
  return { id: `trn_${id.padEnd(12, 'x')}`, conversationId: CID, role, text, stage, createdAt: '2026-11-13T09:00:00.000Z' };
}

export function point(id: string, over: Partial<Point> = {}): Point {
  return {
    id: `pt_${id.padEnd(12, 'x')}`,
    conversationId: CID,
    personId: 'per_AAAAAAAAAAAA',
    assemblyId: 'asm_AAAAAAAAAAAA',
    type: 'moment',
    text: 'I took the 5am bus home',
    draftText: 'I took the 5am bus home',
    sourceTurnIds: [],
    status: 'draft',
    visibility: 'anonymous',
    ...over,
  };
}

export function view(over: Partial<ConversationView['conversation']> = {}, rest: Partial<ConversationView> = {}): ConversationView {
  return {
    conversation: {
      id: CID,
      personId: 'per_AAAAAAAAAAAA',
      assemblyId: 'asm_AAAAAAAAAAAA',
      route: 'ai',
      mode: 'claude',
      promptVersion: 'test',
      language: 'en-GB',
      stage: 3,
      stageTurns: 0,
      status: 'active',
      consent: { conversation: true, at: '2026-11-13T09:00:00.000Z' },
      startedAt: '2026-11-13T09:00:00.000Z',
      ...over,
    },
    assembly: { slug: 'riverbend', title: 'Earning and learning', question: 'What would help?', isExample: false, isOpenListening: false },
    turns: [turn('a', 'interviewer', 'Tell me about yesterday?'), turn('b', 'person', 'I worked the night shift.')],
    points: [],
    questions: [],
    pending: null,
    ...rest,
  };
}

export interface Call {
  method: string;
  url: string;
  body: unknown;
}

/** Stubs fetch with a handler; records every call. */
export function mockApi(handler: (c: Call) => unknown) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const c = { method: init?.method ?? 'GET', url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined };
      calls.push(c);
      const out = handler(c);
      if (out instanceof Response) return out;
      return new Response(JSON.stringify(out ?? {}), { status: 200 });
    }),
  );
  return calls;
}
