// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/circle/<id> — THE CIRCLE (design/v2 02 §2–4): the entire deliberation
// surface, as a chat. Everything below is thin over the engine:
//
//   utterance   → writeCircleMessage (UNGATED — the §2a gate split)
//   mirror      → lib/mirror-draft (deterministic; adopt / fix / discard)
//   adoption    → v2/adopt → the UNTOUCHED pod-society chokepoints (C4
//                 fail-closed; the C6 adoption invariant unrepresentable)
//   peer beat   → lib/deck routeDeck (the deck, dealt one card at a time)
//   reaction    → writeResonance (the same matrix as every v1 surface)
//
// The notetaker's lines are the static script engine (v2/script.ts) — pure
// functions of the circle state, never written to a pod, no LLM. The thread
// is an ARIA live region (polite); there are no timeouts anywhere (02 §9).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoForDeliberation } from "../../demo/pods.js";
import { routeDeck } from "../../lib/deck.js";
import type { Stance } from "../../lib/fut.js";
import { compressClaim, draftMirror, type MirrorDraftResult } from "../../lib/mirror-draft.js";
import type { Claim } from "../../lib/model-society.js";
import { useController } from "../../ui/auth.js";
import { avatarColor, initials } from "../../ui/format.js";
import type { AggregateState } from "../../ui/hooks.js";
import { displayName, writeSessionFor } from "../../ui/hooks.js";
import { type DeliberationConfig, sessionIdentity } from "../../ui/state.js";
import { adoptMirrorAtoms } from "../adopt.js";
import { type CircleMessage, readCircleMessages, writeCircleMessage } from "../circle-data.js";
import { demoCircleFor, demoCircleParticipants, ensureDemoCircleSeeded } from "../demo-circle.js";
import {
  adoptionReceipt,
  BOUNDARY_ACTIONS,
  COMPOSER_CHIPS,
  DISCARD_ACK,
  HANDSHAKE,
  MIRROR_ACTIONS,
  notetakerBeats,
  openingPrompt,
} from "../script.js";
import { Distribution } from "./Distribution.js";
import { Notetaker, NotetakerLine } from "./Notetaker.js";
import { ReactionRow } from "./ReactionRow.js";

/** One rendered person message. */
function PersonMessage({
  author,
  you,
  children,
}: {
  author: string;
  you: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const name = displayName(author);
  return (
    <div className={you ? "v2-msg you" : "v2-msg"}>
      <span className="avatar" style={{ background: avatarColor(author) }} aria-hidden="true">
        {initials(name)}
      </span>
      <div className="v2-msg-body">
        <p className="v2-msg-who">{you ? "You" : name}</p>
        <p className="v2-msg-text">{children}</p>
      </div>
    </div>
  );
}

export function Circle({
  circleSlug,
  aggregate,
  config,
}: {
  circleSlug: string;
  aggregate: AggregateState;
  config: DeliberationConfig;
}): React.JSX.Element {
  const controller = useController();
  const circle = demoCircleFor(circleSlug);
  const identity = sessionIdentity(config, null);

  const [messages, setMessages] = useState<readonly CircleMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<MirrorDraftResult | null>(null);
  const [pendingClaimEdit, setPendingClaimEdit] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adoptedCount, setAdoptedCount] = useState(0);
  const [adoptedPhrase, setAdoptedPhrase] = useState<string | null>(null);
  const [reactedStance, setReactedStance] = useState<Stance | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const lastUtteranceRef = useRef<string | null>(null);

  const refreshMessages = useCallback(async () => {
    if (!circle) return;
    try {
      const demo = await demoForDeliberation(config.deliberation);
      if (!demo) throw new Error("the v2 circle runs on the demo deliberation (V0–V2)");
      await ensureDemoCircleSeeded(demo);
      setMessages(await readCircleMessages(demo.fetch, demoCircleParticipants(demo), circle.id));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [circle, config.deliberation]);

  useEffect(() => {
    void refreshMessages();
  }, [refreshMessages]);

  // The deck's top card for this viewer (beat 4) — claims only, community-wide.
  const claimById = useMemo(() => {
    const m = new Map<string, Claim>();
    for (const c of aggregate.result?.claims ?? []) m.set(c.id, c);
    return m;
  }, [aggregate.result]);

  const peerCard = useMemo(() => {
    const result = aggregate.result;
    if (!result || !identity) return null;
    const queue = routeDeck({
      viewer: identity,
      participants: result.verified.map((v) => v.webId),
      needStatements: result.needs.map((n) => n.id),
      deckStatements: result.claims.map((c) => c.id),
      resonances: result.resonances,
    });
    const top = queue[0];
    const claim = top ? claimById.get(top.statement) : undefined;
    if (!top || !claim) return null;
    return { entry: top, claim };
  }, [aggregate.result, identity, claimById]);

  // Community-scale tally for the reacted statement (the Distribution's data).
  const reactedDistribution = useMemo(() => {
    const result = aggregate.result;
    if (!result || !peerCard || reactedStance === null) return null;
    let resonates = 0;
    let conflicts = 0;
    let unsure = 0;
    const latest = new Map<string, string>();
    for (const r of result.resonances) {
      if (r.onStatement !== peerCard.claim.id) continue;
      latest.set(r.creator, r.stance);
    }
    for (const stance of latest.values()) {
      if (stance.endsWith("Resonates")) resonates++;
      else if (stance.endsWith("Conflicts")) conflicts++;
      else unsure++;
    }
    return { resonates, conflicts, unsure };
  }, [aggregate.result, peerCard, reactedStance]);

  if (!circle) {
    return (
      <section className="view">
        <div className="card">
          <h2>That circle isn't here</h2>
          <p className="muted">
            The demo has one circle so far — <a href="#/circle/maple-mornings">Maple mornings</a>.
          </p>
        </div>
      </section>
    );
  }

  async function send(text: string): Promise<void> {
    const content = text.trim();
    if (content.length === 0 || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const demo = await demoForDeliberation(config.deliberation);
      if (!demo || !circle) throw new Error("the v2 circle runs on the demo deliberation");
      const session = await writeSessionFor(config, controller, null);
      // UNGATED (§2a): the person's own words, their own pod, their circle.
      const { url } = await writeCircleMessage(session.fetch, session.ownBase, {
        author: session.identity ?? demo.you.webId,
        content,
        circle: circle.id,
        published: new Date().toISOString(),
      });
      lastUtteranceRef.current = url;
      setComposer("");
      await refreshMessages();
      // The mirror pipeline: deterministic drafter over the utterance.
      const draft = draftMirror(content);
      setPending(draft.kind === "nothing" ? null : draft);
      setPendingClaimEdit(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function adopt(): Promise<void> {
    if (pending?.kind !== "draft" || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const session = await writeSessionFor(config, controller, null);
      const claimText = pendingClaimEdit;
      const atoms =
        claimText === null
          ? pending.atoms
          : pending.atoms.map((a) =>
              a.kind === "claim" || a.kind === "need" ? { ...a, content: claimText } : a,
            );
      const first = atoms[0];
      await adoptMirrorAtoms({
        fetchFn: session.fetch,
        base: session.ownBase,
        creator: session.identity ?? "",
        deliberation: config.deliberation,
        atoms,
        provenance: pending.provenance,
        ...(lastUtteranceRef.current !== null ? { derivedFrom: lastUtteranceRef.current } : {}),
      });
      setAdoptedCount((n) => n + 1);
      if (first !== undefined) setAdoptedPhrase(compressClaim(first.content));
      setPending(null);
      setPendingClaimEdit(null);
      setNotice(adoptionReceipt());
      await aggregate.refresh();
    } catch (e) {
      // The fail-closed chokepoint spoke (e.g. an edit re-introduced sensitive
      // text): render its plain-language refusal — nothing was written.
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function discard(): void {
    setPending(null);
    setPendingClaimEdit(null);
    setNotice(DISCARD_ACK);
  }

  const beats = notetakerBeats({
    visitorMessageCount: messages.filter((m) => m.author === identity).length,
    pending:
      pending !== null && (pending.kind === "ask" || pending.kind === "boundary")
        ? pending.kind
        : null,
    boundaryHit: pending?.boundary ?? null,
    adoptedCount,
    reacted: reactedStance !== null,
    peerCard: peerCard
      ? { statement: peerCard.claim.id, authorName: displayName(peerCard.claim.creator) }
      : null,
    summaryPhrase: adoptedPhrase,
  });

  const pendingBoundary = pending?.kind === "boundary" || pending?.kind === "ask";

  return (
    <section className="view">
      <h2>{circle.name}</h2>
      <p className="muted small">
        A few people, a notetaker, and what mornings here should be like. {messages.length} message
        {messages.length === 1 ? "" : "s"} so far.
      </p>
      {loadError && <p className="notice error">{loadError}</p>}

      <div className="v2-thread" role="log" aria-live="polite" aria-label="circle conversation">
        <Notetaker text={HANDSHAKE} />
        <Notetaker text={openingPrompt(circle.prompt)} />
        {messages.map((m) => (
          <PersonMessage key={m.id} author={m.author} you={m.author === identity}>
            {m.content}
          </PersonMessage>
        ))}

        {/* The mirror: attached quietly under the person's message (02 §4). */}
        {pending?.kind === "draft" && pending.mirror !== null && (
          <div className="v2-mirror">
            <NotetakerLine />
            {pendingClaimEdit === null ? (
              <p className="v2-msg-text">{pending.mirror}</p>
            ) : (
              <textarea
                aria-label="fix the notetaker's mirror"
                value={pendingClaimEdit}
                onChange={(e) => setPendingClaimEdit(e.target.value)}
                rows={2}
                style={{ width: "100%" }}
              />
            )}
            <div className="v2-mirror-actions">
              <button type="button" className="v2-chip" disabled={busy} onClick={adopt}>
                {pendingClaimEdit === null ? MIRROR_ACTIONS.adopt : "Adopt my wording"}
              </button>
              {pendingClaimEdit === null && (
                <button
                  type="button"
                  className="v2-chip"
                  disabled={busy}
                  onClick={() => {
                    const claim = pending.atoms.find((a) => a.kind === "claim");
                    setPendingClaimEdit(claim?.content ?? "");
                  }}
                >
                  {MIRROR_ACTIONS.fix}
                </button>
              )}
              <button type="button" className="v2-chip" disabled={busy} onClick={discard}>
                {MIRROR_ACTIONS.discard}
              </button>
            </div>
            <p className="v2-seam-text">
              Drafted by the notetaker's deterministic listener ({pending.provenance.plan}) — yours
              only if you adopt it. <a href="#/how">the long version →</a>
            </p>
          </div>
        )}

        {/* The notetaker's trailing beats (ask / boundary / peer / fate). */}
        {beats.map((b) => (
          <div key={b.kind}>
            <Notetaker text={b.text} />
            {b.kind === "boundary" && (
              <div className="v2-chips" style={{ marginLeft: "2.2rem" }}>
                <button type="button" className="v2-chip" onClick={() => setPending(null)}>
                  {BOUNDARY_ACTIONS.keep}
                </button>
                <button
                  type="button"
                  className="v2-chip"
                  onClick={() => {
                    setPending(null);
                    composerRef.current?.focus();
                  }}
                >
                  {BOUNDARY_ACTIONS.reword}
                </button>
              </div>
            )}
            {b.kind === "peer" && peerCard && identity && (
              <div className="v2-mirror">
                <p className="v2-msg-text">“{peerCard.claim.content}”</p>
                <p className="v2-msg-who">— {displayName(peerCard.claim.creator)}</p>
                <SessionReaction
                  statement={peerCard.claim.id}
                  config={config}
                  identity={identity}
                  yours={reactedStance}
                  onStance={setReactedStance}
                  onReacted={aggregate.refresh}
                >
                  <Distribution
                    tally={reactedDistribution}
                    viewerReacted={reactedStance !== null}
                  />
                </SessionReaction>
                <p className="v2-seam-text">
                  Why this one? People in your part of the map haven't weighed in on it
                  {peerCard.entry.neighbourResonance > 0.5
                    ? ", and people who usually read the street differently found it rang true"
                    : ""}
                  . <a href="#/how">the long version →</a>
                </p>
              </div>
            )}
          </div>
        ))}

        {notice && !pendingBoundary && <Notetaker text={notice} />}
      </div>

      <div className="v2-chips">
        {COMPOSER_CHIPS.map((chip) => (
          <button
            type="button"
            key={chip}
            className="v2-chip"
            onClick={() => {
              setComposer((c) => (c.length > 0 ? c : `${chip}: `));
              composerRef.current?.focus();
            }}
          >
            {chip}
          </button>
        ))}
      </div>
      <div className="v2-composer">
        <textarea
          ref={composerRef}
          aria-label="say it your way"
          placeholder="Say it your way — a memory, a wish, a gripe…"
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          disabled={busy || composer.trim().length === 0}
          onClick={() => void send(composer)}
        >
          Send
        </button>
      </div>
      <p className="muted small">
        Your words stay in your own pod, visible to this circle. Nothing enters the shared picture
        unless you adopt it.
      </p>
    </section>
  );
}

/** The reaction row wired to the session write path (demo: the sandbox pod). */
function SessionReaction({
  statement,
  config,
  identity,
  yours,
  onStance,
  onReacted,
  children,
}: {
  statement: string;
  config: DeliberationConfig;
  identity: string;
  yours: Stance | null;
  onStance: (s: Stance) => void;
  onReacted: () => Promise<void>;
  children?: React.ReactNode;
}): React.JSX.Element | null {
  const controller = useController();
  const [session, setSession] = useState<{ fetch: typeof fetch; ownBase: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void writeSessionFor(config, controller, null).then((s) => {
      if (!cancelled) setSession({ fetch: s.fetch, ownBase: s.ownBase });
    });
    return () => {
      cancelled = true;
    };
  }, [config, controller]);
  if (!session) return null;
  return (
    <ReactionRow
      statement={statement}
      fetchFn={session.fetch}
      ownBase={session.ownBase}
      identity={identity}
      deliberation={config.deliberation}
      yours={yours}
      onStanceChosen={onStance}
      onReacted={onReacted}
    >
      {children}
    </ReactionRow>
  );
}
