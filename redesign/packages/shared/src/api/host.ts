import type { AssemblyKind, Intake, Pledge } from '../schemas.js';

/** Response shapes of the host console endpoints. */

/** The draft the intake ends with. Text fields are the host's answers, word for word. */
export interface IntakeDraft {
  question: string;
  /** Who is affected, as the host said it. */
  affected: string;
  /** The same, split into groups at commas, semicolons and new lines, for the editor to start from. */
  groups: string[];
  /** How the host wants it decided, as they said it. */
  rule: string;
  kind: Extract<AssemblyKind, 'advisory' | 'codecided'>;
  /** The pledge so far. Numbers are starting values the host is asked to confirm or change. */
  pledge: Partial<Pledge>;
}

/** POST /api/host/intake and POST /api/host/intake/:id/turns */
export interface IntakeView {
  intake: Pick<Intake, 'id' | 'messages' | 'answers' | 'status'>;
  /** The question to answer next; null when the interview is over. */
  question: string | null;
  topic: { n: number; of: number };
  done: boolean;
  draft: IntakeDraft | null;
  source: 'ai' | 'fallback';
}

/** The leading-wording check for a host's question and probes. */
export interface LeadingCheck {
  leading: boolean;
  why: string;
  suggestion: string;
}

/** POST /api/check-leading */
export interface LeadingCheckResponse extends LeadingCheck {
  source: 'ai' | 'fallback';
}
