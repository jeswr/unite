// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// #/how — "HOW UNITE LISTENS" (design/v2 03 §6 second layer, 07 §3 V2): the
// full out-of-flow explanation — plain-language mechanism write-up, the
// drafter's honest limits, the boundary rule, the k rules, deletion, and the
// instruments themselves (linking the v1 views IN PLACE — same session, same
// demo pods, same engine; hiding them would fail the reveal test). Every
// in-flow seam's "the long version →" lands on this page.

import { MIRROR_DRAFT_PLAN } from "../../lib/mirror-draft.js";
import { SURFACES, surfaceHref } from "../../scope/surface.js";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="v2-letter-section" id={id}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function How(): React.JSX.Element {
  const loc = typeof window === "undefined" ? null : window.location;
  // v2→v1 must carry the v2 surface's forced scope (society) so the instrument
  // views land in the SAME deliberation, not the default apps scope.
  const v1 = (hash: string) => surfaceHref("v1", loc?.search, hash, SURFACES.v2.forcesScope);
  return (
    <section className="view">
      <h2>How unite listens</h2>
      <p className="muted small">
        The whole mechanism, in plain words. Nothing on this page is a secret held back elsewhere —
        if reading it makes anything feel like a trick, that is a bug in unite, not in you.
      </p>

      <Section id="notetaker" title="The notetaker is a program, and a small one">
        <p className="muted small">
          The notetaker is not a person and not a large language model. In this demo every line it
          says comes from a fixed script, and every mirror it drafts comes from a deterministic
          word-list ({MIRROR_DRAFT_PLAN}): it looks for phrases like “I want”, “unsafe”, “I
          remember”, picks the sentence that carries the most of them, and matches everyday words
          (“crossing”, “afford”, “a say”) to a fixed set of nine human needs. Same words in, same
          mirror out, every time. When your message carries none of its cues, it asks instead of
          guessing — a word-list must never pretend it understood you.
        </p>
      </Section>

      <Section id="adoption" title="Nothing is yours until you adopt it">
        <p className="muted small">
          A mirror is an offer. Only “that's it” (or your own edit) writes anything into the shared
          picture — and what it writes lands in <em>your</em> pod, marked as adopted by you, with a
          note recording that the notetaker's drafter proposed it. Scrapped or ignored mirrors write
          nothing at all. This is enforced in the data model itself: a statement adopted by anyone
          other than its author cannot be written, read, or counted.
        </p>
      </Section>

      <Section id="boundary" title="The boundary: what the shared picture won't carry">
        <p className="muted small">
          Your own words in your own circle are never screened — you can say anything about your
          life here. What the machine layer will not carry into summaries and letters is personal
          health- or money-grade detail; until privacy machinery exists that deserves such data,
          that is a hard line, checked twice (once when drafting, once at the write itself, so even
          a bug in this page's buttons cannot leak past it). When the line bites, the notetaker says
          so and offers two honest paths: keep it here, or reword it yourself. It will never rewrite
          your words for you.
        </p>
      </Section>

      <Section id="reactions" title="Reactions, the map, and bridges">
        <p className="muted small">
          Every “resonates / not sure / I see it differently” is a small record in your pod. Read
          together, the reactions place people on a map with (today) two broad regions — computed
          fresh every time, stored nowhere, never labelled with politics. A statement becomes common
          ground only when <em>every</em> region leans toward it — being loud in one corner counts
          for nothing. That same rule picks what the notetaker shows you next: statements your part
          of the map hasn't weighed, that other parts found true.
        </p>
      </Section>

      <Section id="elicit" title="You speak first">
        <p className="muted small">
          You never see how the group voted on something before you've voiced your own take —
          numbers shown first pull people toward them, so unite sequences: your signal, then the
          real distribution, always. And no group number renders at all until at least five people
          are behind it; below that, counting would be false precision about identifiable people.
          Inside a small circle no anonymous statistics are shown ever — five people can spot
          themselves in any tally, so pretending otherwise would be the lie.
        </p>
      </Section>

      <Section id="deletion" title="Deleting actually deletes">
        <p className="muted small">
          Summaries, letters, and the garden are recomputed from people's pods every time they are
          read — there is no other copy. Remove something in your notebook and the next read simply
          no longer contains it. The one honest exception: anything already carried into a signed,
          published record under your explicit consent stays in that record — and unite says that
          before it happens, not after.
        </p>
      </Section>

      <Section id="instruments" title="See the instruments">
        <p className="muted small">
          Everything above runs on the same engine the v1 surface wears openly. Same session, same
          demo data — inspect it whenever you like:
        </p>
        <p className="muted small">
          <a href={v1("#/bridge")}>the opinion map + common ground</a> ·{" "}
          <a href={v1("#/board")}>the needs board</a> ·{" "}
          <a href={v1("#/deck")}>the resonance deck</a> ·{" "}
          <a href={v1("#/room")}>the convergence room</a> ·{" "}
          <a href={v1("#/published-futures")}>published futures</a>
        </p>
        <p className="muted small">
          The engine is open source — the code, its tests, and this design are in the{" "}
          <a href="https://github.com/jeswr/unite" rel="noreferrer">
            unite repository
          </a>
          .
        </p>
      </Section>
    </section>
  );
}
