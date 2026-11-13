/**
 * Response shape of GET and PUT /api/assemblies/:slug/priorities, as the server sends it
 * (apps/server/src/services/deciding/priorities.ts). Kept here until it moves to packages/shared.
 */
export type ChoosableStatus = 'common_ground' | 'decided';

export interface PrioritiesResponse {
  statements: { id: string; text: string; status: ChoosableStatus | string }[];
  ranked: { statementId: string; text: string; status: string; round: number; score: number }[];
  myChoices: string[];
  myChoicesCount: boolean;
  chosen: number;
  invited: number;
  uninvitedChosen: number;
  capacity: number | null;
  replyBy: string | null;
  closed: boolean;
}
