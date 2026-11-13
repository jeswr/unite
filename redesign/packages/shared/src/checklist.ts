import { DAY_MS } from './clock.js';
import { findLeadingPhrases } from './interviewer.js';
import { formatDate } from './text.js';
import type { Assembly, AssemblyStage, Pledge } from './schemas.js';
import { nextStage } from './stages.js';

/** One condition for moving an assembly on, in plain English, and whether it is met. */
export interface ChecklistItem {
  key: string;
  text: string;
  met: boolean;
  /** Extra plain detail, such as "31 of 48". */
  detail?: string;
}

export interface StageChecklist {
  stage: AssemblyStage;
  /** Undefined at the last stage. */
  next?: AssemblyStage;
  items: ChecklistItem[];
  /** True when every item is met and there is a next stage. */
  clear: boolean;
}

/**
 * The facts about an assembly that its checklist needs, counted from stored records by the server
 * (apps/server/src/services/stage.ts). Every count is of people unless it says otherwise.
 */
export interface StageFacts {
  /** People with a completed conversation in the assembly. */
  completedConversations: number;
  /** People with a completed conversation, by affected group key. */
  heardByGroup: Record<string, number>;
  openReports: number;
  /** Number of statements whose status is common_ground. */
  commonGroundStatements: number;
  /** Rooms not yet closed. */
  openRooms: number;
  openObjections: number;
  /** Invited participants (memberships with role participant and invited true). */
  invitedParticipants: number;
  /** People who have chosen at least one priority. */
  priorityChoosers: number;
  decisions: number;
  decisionsAwaitingAnswer: number;
  /** Accepted or changed decisions with no chosen plan or no delivery item. */
  acceptedWithoutPlan: number;
  /** Accepted or changed decisions with no check. */
  acceptedWithoutCheck: number;
  /**
   * Whether the question and each probe passed the leading-wording check. When absent, the
   * fallback phrase list is used.
   */
  leading?: { question: boolean; probes: boolean[] };
}

/** The ways a pledge is not yet complete, in plain English. Empty means complete. */
export function pledgeProblems(pledge: Pledge | null | undefined): string[] {
  if (!pledge) return ['There is no pledge yet'];
  const out: string[] = [];
  if (!pledge.setAside.trim()) out.push('The pledge does not say what is set aside');
  if (!pledge.remit.trim()) out.push('The pledge does not say what the host can act on');
  if (!pledge.offTable.trim()) out.push('The pledge does not say what is off the table');
  if (!(pledge.groupThreshold > 0 && pledge.groupThreshold <= 1)) out.push('The pledge does not set how much agreement is needed');
  if (pledge.minParticipants < 1) out.push('The pledge does not set how many people must take part');
  if (pledge.capacity < 1) out.push('The pledge does not say how many priorities the host will answer');
  if (!pledge.replyBy) out.push('The pledge has no reply date');
  if (pledge.checkBody === 'independent' && !pledge.checkBodyName?.trim()) out.push('The pledge does not name the independent body that will check delivery');
  if (pledge.reviewAfterDays < 1) out.push('The pledge has no review period');
  return out;
}

const of = (n: number, d: number) => `${n} of ${d}`;

/**
 * The plain-English conditions for moving an assembly from its current stage to the next, and
 * whether each is met (section 7). Pure: the server gathers `facts` from stored records.
 */
export function stageChecklist(assembly: Assembly, facts: StageFacts, now: Date): StageChecklist {
  const items: ChecklistItem[] = [];
  const p = assembly.pledge;
  const add = (key: string, text: string, met: boolean, detail?: string) => items.push({ key, text, met, ...(detail ? { detail } : {}) });

  switch (assembly.stage) {
    case 'proposed': {
      const problems = pledgeProblems(p);
      add('pledge_complete', 'The pledge is complete', problems.length === 0, problems.join('. ') || undefined);
      const leading = facts.leading ?? {
        question: findLeadingPhrases(assembly.question).length === 0,
        probes: assembly.probes.map((q) => findLeadingPhrases(q).length === 0),
      };
      const fair = assembly.question.trim().length > 0 && leading.question && leading.probes.every(Boolean);
      add('not_leading', 'The question and the host’s questions do not lead people toward an answer', fair);
      break;
    }
    case 'pledged': {
      const ends = p?.challengeEndsAt;
      add('challenge_over', 'The challenge period has ended', !!ends && new Date(ends).getTime() <= now.getTime(), ends ? `Ends on ${formatDate(ends)}` : 'No end date is set');
      break;
    }
    case 'listening': {
      const min = p?.minParticipants ?? 0;
      add('enough_people', `At least ${min} people have finished their conversation`, facts.completedConversations >= min, of(facts.completedConversations, min));
      for (const g of assembly.affectedGroups) {
        const half = Math.ceil(g.target / 2);
        const heard = facts.heardByGroup[g.key] ?? 0;
        add(`group_${g.key}`, `${g.label}: at least half of the ${g.target} hoped for have been heard`, heard >= half, of(heard, g.target));
      }
      break;
    }
    case 'picture':
      add('picture_confirmed', 'A steward has confirmed the picture is faithful', !!assembly.pictureConfirmedAt);
      add('no_open_reports', 'No report that the picture is wrong is still open', facts.openReports === 0, facts.openReports ? `${facts.openReports} open` : undefined);
      break;
    case 'deliberating':
      add('common_ground', 'At least one statement is common ground', facts.commonGroundStatements >= 1);
      add('rooms_closed', 'Every room has closed', facts.openRooms === 0, facts.openRooms ? `${facts.openRooms} still open` : undefined);
      add('objections_answered', 'Every objection has a reply', facts.openObjections === 0, facts.openObjections ? `${facts.openObjections} waiting` : undefined);
      break;
    case 'deciding': {
      const half = Math.ceil(facts.invitedParticipants / 2);
      const closeBy = p ? new Date(p.replyBy).getTime() - 14 * DAY_MS : Infinity;
      add(
        'priorities_chosen',
        'Half of the invited participants have chosen priorities, or the list has closed two weeks before the reply date',
        (facts.invitedParticipants > 0 && facts.priorityChoosers >= half) || now.getTime() >= closeBy,
        of(facts.priorityChoosers, facts.invitedParticipants),
      );
      add('decisions_created', 'The top priorities have been written up as decisions', facts.decisions >= 1);
      break;
    }
    case 'answered':
      add('all_answered', 'The host has answered every decision', facts.decisions > 0 && facts.decisionsAwaitingAnswer === 0, facts.decisionsAwaitingAnswer ? `${facts.decisionsAwaitingAnswer} waiting` : undefined);
      break;
    case 'delivering':
      add('plans_chosen', 'Every accepted or changed decision has a chosen plan and at least one delivery item', facts.acceptedWithoutPlan === 0, facts.acceptedWithoutPlan ? `${facts.acceptedWithoutPlan} without` : undefined);
      break;
    case 'checked':
      add('all_checked', 'Every accepted or changed decision has been checked', facts.acceptedWithoutCheck === 0, facts.acceptedWithoutCheck ? `${facts.acceptedWithoutCheck} not checked` : undefined);
      break;
    case 'review':
      break;
  }
  const next = nextStage(assembly.stage);
  return { stage: assembly.stage, ...(next ? { next } : {}), items, clear: !!next && items.every((i) => i.met) };
}
