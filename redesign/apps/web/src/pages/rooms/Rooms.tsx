import { Link, useParams } from 'react-router';
import type { EvidenceCard } from '@unite/shared';
import { useApi } from '../../lib/api';
import { useAssembly } from '../../lib/useAssembly';
import { useLive } from '../../lib/useLive';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';
import { Tag } from '../../ui/Tag';
import { answersInWords, EvidenceCardView, NotHeardOrError, OutcomeView } from './parts';
import type { RoomsResponse } from '@unite/shared';
import { timeLeftWords } from './time';

/** "Opens soon", "Running until 10:45 (31 minutes left)", or "Closed". */
function whenWords(r: { status: string; endsAt: string | null; minutes?: number }, now: number): string {
  if (r.status === 'scheduled') return r.minutes ? `Not open yet. It will run for ${r.minutes} minutes once it opens.` : 'Not open yet.';
  if (r.status === 'open' && r.endsAt) return `Open now. ${timeLeftWords(Date.parse(r.endsAt) - now)}.`;
  return 'Closed.';
}

export default function Rooms() {
  const { slug = '' } = useParams();
  const version = useLive(slug);
  const { data: view, reload: reloadView } = useAssembly(slug, version);
  const rooms = useApi<RoomsResponse>(`/api/assemblies/${encodeURIComponent(slug)}/rooms`, version);
  const evidence = useApi<{ evidence: EvidenceCard[] }>(rooms.data ? `/api/assemblies/${encodeURIComponent(slug)}/evidence` : null, version);
  const a = view?.assembly;
  const now = rooms.data ? Date.parse(rooms.data.now) : Date.now();

  return (
    <Layout title="Rooms" assembly={a} kicker={a?.question}>
      <p className="mb-6">
        Where people see a statement differently, a few of them are drawn by lot into a small room, mixed so that people who answered like you and people who answered differently are both there. An AI
        facilitator keeps time and turns and invites quieter people in; it never takes a side, gives facts, or sums up what the room thinks.
      </p>

      {rooms.error && !rooms.data && <NotHeardOrError error={rooms.error} slug={slug} what="the rooms and what they found" isExample={a?.isExample} onLookedAround={() => (reloadView(), rooms.reload())} />}
      {!rooms.data && !rooms.error && <p aria-live="polite">Loading the rooms…</p>}

      {rooms.data && (
        <>
          <section aria-labelledby="my-room" className="mb-8">
            <h2 id="my-room" className="mb-3">
              Your room
            </h2>
            {rooms.data.myRoom ? (
              <Card>
                <h3 className="mb-1">{rooms.data.myRoom.topic}</h3>
                <p className="mb-2">{whenWords(rooms.data.myRoom, now)}</p>
                <p className="mb-3">
                  <span className="font-bold">In the room: </span>
                  {rooms.data.myRoom.members.map((m) => (m.isMe ? 'you' : m.name)).join(', ')}
                </p>
                {rooms.data.myRoom.status === 'open' ? (
                  <Button to={`/a/${slug}/rooms/${rooms.data.myRoom.id}`}>Join the room</Button>
                ) : (
                  <Link to={`/a/${slug}/rooms/${rooms.data.myRoom.id}`}>Read the briefing</Link>
                )}
              </Card>
            ) : (
              <p className="text-muted">
                You have not been drawn for a room. If you are, it will appear here with its time and who is in it. Meanwhile you can read what other rooms found below.
              </p>
            )}
          </section>

          {rooms.data.others.length > 0 && (
            <section aria-labelledby="other-rooms" className="mb-8">
              <h2 id="other-rooms" className="mb-3">
                Other rooms running or coming up
              </h2>
              <ul className="space-y-2">
                {rooms.data.others.map((r) => (
                  <li key={r.id}>
                    <Card>
                      <h3 className="mb-1">
                        <Link to={`/a/${slug}/rooms/${r.id}`}>{r.topic}</Link>
                      </h3>
                      <p className="text-muted">
                        {r.size} people. {whenWords(r, now)}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="closed-rooms" className="mb-8">
            <h2 id="closed-rooms" className="mb-3">
              What rooms found
            </h2>
            {rooms.data.closed.length === 0 ? (
              <EmptyState title="No room has finished yet">
                <p>When a room closes, its reasons for and against and any new wording it proposed will be shown here.</p>
              </EmptyState>
            ) : (
              <ul className="space-y-4">
                {rooms.data.closed.map((r) => (
                  <li key={r.id}>
                    <Card>
                      <h3 className="mb-1">
                        <Link to={`/a/${slug}/rooms/${r.id}`}>{r.topic}</Link>
                      </h3>
                      {r.wasMine && (
                        <p className="mb-2">
                          <Tag tone="accent">You were in this room</Tag>
                        </p>
                      )}
                      <div className="mb-3">
                        <OutcomeView outcome={r.outcome} headingLevel={4} />
                      </div>
                      <p className="text-muted">{answersInWords(r.answers)}</p>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="evidence">
            <h2 id="evidence" className="mb-2">
              Evidence cards
            </h2>
            <p className="mb-3 text-muted">Experts answered questions people asked. Each card says how sure the expert is and what others dispute.</p>
            {evidence.data && evidence.data.evidence.length === 0 && (
              <EmptyState title="No evidence cards yet">
                <p>When experts answer a question that people or rooms asked, the answer will appear here with its sources.</p>
              </EmptyState>
            )}
            <ul className="space-y-3">
              {evidence.data?.evidence.map((c) => (
                <li key={c.id}>
                  <EvidenceCardView card={c} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </Layout>
  );
}
