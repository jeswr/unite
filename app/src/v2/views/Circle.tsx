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
import { demoWebId } from "../../demo/fixtures.js";
import { demoForDeliberation } from "../../demo/pods.js";
import { type DeckEntry, routeDeck } from "../../lib/deck.js";
import type { Stance } from "../../lib/fut.js";
import { routeGallery } from "../../lib/gallery.js";
import { compressClaim, draftMirror, type MirrorDraftResult } from "../../lib/mirror-draft.js";
import type { Claim } from "../../lib/model-society.js";
import type { ConversationTurn } from "../../lib/questions.js";
import { useController } from "../../ui/auth.js";
import { avatarColor, initials } from "../../ui/format.js";
import type { AggregateState } from "../../ui/hooks.js";
import { displayName, writeSessionFor } from "../../ui/hooks.js";
import { type DeliberationConfig, sessionIdentity } from "../../ui/state.js";
import { adoptMirrorAtoms } from "../adopt.js";
import { type CircleMessage, readCircleMessages, writeCircleMessage } from "../circle-data.js";
import { demoCircleFor, demoCircleParticipants, ensureDemoCircleSeeded } from "../demo-circle.js";
import { DEMO_VOICE_LABEL, personaMirrorFor, SCRIBE_SEAM } from "../demo-scribe.js";
import { MISSING_VOICE_INVITE, missingVoiceInvite, writePrivateTap } from "../private-tap.js";
import {
  adoptionReceipt,
  airtimeOpenDoor,
  BORROW_MEMORY,
  BORROW_MEMORY_LABEL,
  BOUNDARY_ACTIONS,
  COMPOSER_CHIPS,
  DISCARD_ACK,
  HANDSHAKE,
  hiddenProfileIntro,
  MIRROR_ACTIONS,
  notetakerBeats,
  openingPrompt,
  peerBeat,
  quietestVoice,
  STRESS_INVITE,
} from "../script.js";
import { deckBeatSeam, gallerySeam } from "../seams.js";
import { livingSummary } from "../summary.js";
import { Distribution } from "./Distribution.js";
import { ExpertMoment } from "./ExpertMoment.js";
import { Notetaker, NotetakerLine } from "./Notetaker.js";
import { NudgeCard } from "./NudgeCard.js";
import { ReactionRow } from "./ReactionRow.js";
import { SummaryPanel } from "./SummaryPanel.js";

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
  // The peer card the viewer reacted to — PINNED so it stays mounted through
  // the post-reaction distribution reveal (P4). Without this the card would
  // unmount the instant `reacted` flips (the deck advances / the fate beat
  // takes over) and the reveal would never show.
  const [reactedPeer, setReactedPeer] = useState<{ claim: Claim; entry: DeckEntry } | null>(null);
  // The private "actually, I don't" taps this session (03 §4): rendered ONLY
  // to the tapper; the write goes to the SEPARATE signal store and changes
  // nothing this view computes (no aggregate refresh — that is the point).
  const [privatelyTapped, setPrivatelyTapped] = useState<ReadonlySet<string>>(new Set());
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
      // The deck deals PEER statements — never the viewer's own, or an adopted
      // claim could be dealt back as "Here's how You put it" (a pseudo-peer).
      deckStatements: result.claims.filter((c) => c.creator !== identity).map((c) => c.id),
      resonances: result.resonances,
    });
    const top = queue[0];
    const claim = top ? claimById.get(top.statement) : undefined;
    if (!top || !claim) return null;
    return { entry: top, claim };
  }, [aggregate.result, identity, claimById]);

  // The living summary (02 §6): the circle's themes = statements authored by
  // circle MEMBERS; every verdict computed COMMUNITY-scale (v2/summary.ts).
  const summary = useMemo(() => {
    const result = aggregate.result;
    if (!result || !circle || !identity) return null;
    const memberIds = new Set(circle.members.map((key) => demoWebId(key)));
    return livingSummary({
      circleStatements: result.claims
        .filter((c) => memberIds.has(c.creator))
        .map((c) => ({ id: c.id, content: c.content, creator: c.creator })),
      participants: result.verified.map((v) => v.webId),
      needStatements: result.needs.map((n) => n.id),
      resonances: result.resonances,
      viewer: identity,
    });
  }, [aggregate.result, circle, identity]);

  // The conversation as TURNS (the lib/questions.ts shape) — the expert
  // question-inbox and the readiness scan both read exactly this.
  const turns = useMemo<ConversationTurn[]>(
    () =>
      messages.map((m) => ({
        id: m.id,
        author: m.author,
        text: m.content,
        created: m.published ?? "",
      })),
    [messages],
  );

  // AIRTIME EQUITY (04 §4) — the hidden health metric, repaired
  // conversationally: the open-door line is the ONLY rendered artifact; the
  // counts themselves never render anywhere.
  const openDoorFor = useMemo(() => {
    if (!circle || !identity) return null;
    const counts = new Map<string, number>();
    for (const key of circle.members) {
      const webId = demoWebId(key);
      if (webId === identity) continue; // the viewer gets the opening prompt
      counts.set(webId, 0);
    }
    for (const m of messages) {
      if (counts.has(m.author)) counts.set(m.author, (counts.get(m.author) ?? 0) + 1);
    }
    return quietestVoice([...counts.entries()], messages.length);
  }, [circle, identity, messages]);

  // The missing-voice invitation (03 §4): a SEEDED JITTER — a pure function
  // of circle id + message count, taking NO tap input, so its rendering is
  // literally indistinguishable between tap and no-tap.
  const missingVoice = circle !== null && missingVoiceInvite(circle.id, messages.length);

  // HIDDEN-PROFILE correction (04 §4): a cross-cluster story routed in as a
  // person (the gallery's contact prior) — after the visitor's loop closes.
  const galleryBeat = useMemo(() => {
    const result = aggregate.result;
    if (!result || !identity || result.visions.length === 0) return null;
    const entries = routeGallery({
      viewer: identity,
      participants: result.verified.map((v) => v.webId),
      needs: result.needs,
      visions: result.visions,
      resonances: result.resonances,
    });
    return entries[0] ?? null;
  }, [aggregate.result, identity]);

  // The card in front of the viewer. TWO independent paths:
  //   • the PINNED reacted card — stays mounted through the P4 distribution
  //     reveal regardless of anything else in flight;
  //   • the LIVE (unpinned) peer card — follows the notetaker's own sequencing
  //     (script.ts / notetakerBeats): it appears ONLY in the steady state —
  //     after the viewer has adopted at least once, with NO pending mirror /
  //     ask / boundary beat, and before they've reacted. A pending prompt takes
  //     precedence (the ask/boundary card must never show alongside the live
  //     peer reaction card).
  const livePeer = pending === null && reactedStance === null && adoptedCount > 0 ? peerCard : null;
  const activePeer = reactedPeer ?? livePeer;

  // Community-scale tally for the reacted statement (the Distribution's data).
  const reactedDistribution = useMemo(() => {
    const result = aggregate.result;
    if (!result || !activePeer || reactedStance === null) return null;
    let resonates = 0;
    let conflicts = 0;
    let unsure = 0;
    const latest = new Map<string, string>();
    for (const r of result.resonances) {
      if (r.onStatement !== activePeer.claim.id) continue;
      latest.set(r.creator, r.stance);
    }
    for (const stance of latest.values()) {
      if (stance.endsWith("Resonates")) resonates++;
      else if (stance.endsWith("Conflicts")) conflicts++;
      else unsure++;
    }
    return { resonates, conflicts, unsure };
  }, [aggregate.result, activePeer, reactedStance]);

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
      // Beat 3's honesty rule (06 §3): a CLEAN landing (adopted unedited)
      // earns an invitation to stress the drafter, not a bow.
      setNotice(claimText === null ? `${adoptionReceipt()} ${STRESS_INVITE}` : adoptionReceipt());
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

  // The private tap (03 §4): written to the SEPARATE signal store in the
  // tapper's own pod. Deliberately NO aggregate refresh and NO summary
  // recompute — a private tap changes no circle-visible state, at any count.
  async function privateTap(statement: string): Promise<void> {
    try {
      const session = await writeSessionFor(config, controller, null);
      await writePrivateTap(session.fetch, session.ownBase, {
        onStatement: statement,
        creator: session.identity ?? "",
        circle: circle?.id ?? "",
        created: new Date().toISOString(),
      });
      setPrivatelyTapped((prev) => new Set([...prev, statement]));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
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

      {summary !== null && (
        <SummaryPanel
          summary={summary}
          onPrivateTap={(s) => void privateTap(s)}
          privatelyTapped={privatelyTapped}
        />
      )}

      <div className="v2-thread" role="log" aria-live="polite" aria-label="circle conversation">
        <Notetaker text={HANDSHAKE} />
        <Notetaker text={openingPrompt(circle.prompt)} />
        {messages.map((m) => {
          const cannedMirror = m.author === identity ? null : personaMirrorFor(m.resource);
          return (
            <div key={m.id}>
              <PersonMessage author={m.author} you={m.author === identity}>
                {m.content}
              </PersonMessage>
              {/* The demo-scribe overlay (06 §4): canned persona mirrors ONLY —
                  labeled demo voice; a visitor's free text can never land here
                  (the overlay is keyed by seed name). */}
              {cannedMirror !== null && (
                <details className="v2-mirror">
                  <summary className="v2-seam">
                    the notetaker's mirror <span className="badge demo">{DEMO_VOICE_LABEL}</span>
                  </summary>
                  <NotetakerLine />
                  <p className="v2-msg-text">{cannedMirror}</p>
                  <p className="v2-seam-text">
                    This one was pre-written for the staged seat — {SCRIBE_SEAM}{" "}
                    <a href="#/how">the long version →</a>
                  </p>
                </details>
              )}
            </div>
          );
        })}

        {/* AIRTIME repair (04 §4): the gentle open-door — never a stat. */}
        {openDoorFor !== null && <Notetaker text={airtimeOpenDoor(displayName(openDoorFor))} />}

        {/* The missing-voice invitation (03 §4) — the jitter-masked beat. */}
        {missingVoice && <Notetaker text={MISSING_VOICE_INVITE} />}

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

        {/* The notetaker's trailing beats (ask / boundary / fate) — the PEER
            beat's text renders with the pinned peer card below, not here. */}
        {beats
          .filter((b) => b.kind !== "peer")
          .map((b) => (
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
            </div>
          ))}

        {/* The dealt peer statement + its reaction + the POST-REACTION
            distribution (P4). Rendered from the PINNED card so it stays
            mounted through the reveal — a reaction never unmounts it. */}
        {activePeer && identity && (
          <div className="v2-mirror">
            <Notetaker text={peerBeat(displayName(activePeer.claim.creator))} />
            <p className="v2-msg-text">“{activePeer.claim.content}”</p>
            <p className="v2-msg-who">— {displayName(activePeer.claim.creator)}</p>
            <SessionReaction
              statement={activePeer.claim.id}
              config={config}
              identity={identity}
              yours={reactedStance}
              onStance={(s) => {
                setReactedStance(s);
                setReactedPeer(activePeer);
              }}
              onReacted={aggregate.refresh}
            >
              <Distribution tally={reactedDistribution} viewerReacted={reactedStance !== null} />
            </SessionReaction>
            <p className="v2-seam-text">
              Why this one? {deckBeatSeam(activePeer.entry)} <a href="#/how">the long version →</a>
            </p>
          </div>
        )}

        {/* HIDDEN-PROFILE correction (04 §4): once the visitor's loop has
            closed, one cross-cluster story arrives as a PERSON — the gallery's
            contact prior, with its literal-fields seam. */}
        {galleryBeat !== null && adoptedCount > 0 && reactedStance !== null && (
          <div className="v2-mirror">
            <Notetaker text={hiddenProfileIntro(displayName(galleryBeat.vision.creator))} />
            {galleryBeat.vision.title !== undefined && (
              <p className="v2-msg-who">“{galleryBeat.vision.title}”</p>
            )}
            <p className="v2-msg-text">{galleryBeat.vision.content}</p>
            <p className="v2-msg-who">— {displayName(galleryBeat.vision.creator)}</p>
            <p className="v2-seam-text">
              Why this story?{" "}
              {gallerySeam(
                displayName(galleryBeat.vision.creator),
                galleryBeat.sharedNeedConcepts,
                galleryBeat.acrossTheDivide,
              )}{" "}
              <a href="#/how">the long version →</a>
            </p>
          </div>
        )}

        {/* THE EXPERT MOMENT (05 §1–2): exists only once the circle's own
            conversation holds a stable recurring question — and is sequenced
            AFTER the visitor has joined the room, so the in-context consent
            ask (02 §7) always PRECEDES the introduction, never retro-appears
            under an expert who was already reading. */}
        {identity && messages.some((m) => m.author === identity) && (
          <ExpertMoment
            turns={turns}
            identity={identity}
            config={config}
            aboutResource={lastUtteranceRef.current}
          />
        )}

        {notice && !pendingBoundary && <Notetaker text={notice} />}
      </div>

      {/* THE PRIVATE NUDGE (05 §3): renders ONLY to a named recipient. */}
      {identity && <NudgeCard identity={identity} turns={turns} />}

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
        {/* Beat 2's prop (06 §3): visibly a borrowed memory, never a rail. */}
        <button
          type="button"
          className="v2-chip"
          onClick={() => {
            setComposer((c) => (c.length > 0 ? c : BORROW_MEMORY));
            composerRef.current?.focus();
          }}
        >
          {BORROW_MEMORY_LABEL}
        </button>
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
      <p className="muted small">
        The crossing this circle raised already has a life of its own —{" "}
        <a href="#/story/maple-crossing">see what came of it</a>.
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
