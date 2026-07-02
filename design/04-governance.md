<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 04 — Spec governance: stewardship with no single owner

The brief's hardest constraint: the standards that define how ideas travel
across the network **may not be owned by any single body** — a standards
owner is as much a control point as a platform operator. This doc specifies a
governance model whose *mechanisms* (not promises) prevent single ownership,
and is honest about the bootstrap deficit: today, one author (the @jeswr agent
suite) wrote everything, and the model below is precisely the schedule for
that ceasing to be true.

## 1. What is governed (and what deliberately isn't)

**Governed:** the `fut:` vocabulary + SHACL profile, the protocol profile
(02 §7), the ODRL consent profile, the conformance fixture set, and the seed
need/value schemes. **Not governed — ever:** implementations, communities,
who may participate, what people may say, which facilitation models a
community uses. The spec constrains *wire artifacts only*. A governance body
whose remit is data contracts cannot become a content authority; scope
creep past the wire is constitutionally out of order.

## 2. Change is adoption-ratified, not decree-ratified

The core mechanism, inherited from how the internet actually governs itself
(IETF's "rough consensus and running code") and made concrete with machinery
the suite already ships:

1. **Spec versions are immutable.** Every version has a permanent
   `owl:versionIRI` (`…/sectors/futures/0.1.0`). Nothing is ever edited in
   place; there is only *publishing new versions*.
2. **Anyone may propose** a new version (a spec PR + a reference
   implementation of the delta — running code required).
3. The steward circle (§3) reviews for coherence and issues a
   *recommendation* — **which is all it can do**.
4. A version becomes **Current** not when the circle blesses it but when the
   adoption bar is met: **≥ 2 independent implementations** interoperating on
   it **and ≥ 2 independent communities** advertising it via
   `fedreg:acceptsSpec`. Adoption is *measured on the wire*, not declared.
5. Old versions never die by fiat: the `fedreg:acceptsSpec`
   dual-advertisement window (the suite's asynchronous-schema-migration
   substrate) means every party upgrades on its own clock, and a version
   sunsets only when nothing advertises it.

Consequence: even a fully captured steward circle cannot force a change onto
the network (implementations just don't adopt it) and cannot block one the
network wants (the circle's recommendation is advisory; adoption is what
counts). The circle's real product is coordination and editorial quality, not
authority.

## 3. The steward circle

- **Composition:** implementers, community operators, psychology/deliberation
  researchers, and participant representatives. **Hard cap: no single
  organisation (or set of affiliated organisations) holds more than 1/3 of
  seats** — and quorum for any recommendation requires members from ≥ 3
  unaffiliated organisations, so a two-org room can't act.
- **Editorship rotates** per release cycle; editors assemble, they don't
  decide.
- **Decisions by rough consensus**, recorded publicly with objections carried
  (the same dissent-is-data discipline the platform itself uses — governance
  eats its own cooking).
- **Venue:** once ≥ 3 unaffiliated organisations exist, charter a W3C
  **Community Group** ("Unite CG") as the working venue — CGs provide IPR
  hygiene (CLA), openness norms, and zero W3C ownership of outcomes. W3C is a
  *venue*, not an owner: the adoption rule (§2) still governs what's real,
  and the spec text remains CC-BY and multi-homed (§4). Should the CG ever
  fail or be captured, the spec walks (that's what §4 is for).

## 4. Forkability as a constitutional right

Capture-resistance ultimately rests on credible exit:

- **License:** all spec text, schemas, shapes, and fixtures are **CC BY 4.0**
  — anyone can republish, modify, re-home.
- **Multi-homing:** the canonical text lives in ≥ 2 mirrored repositories
  under different administrative control (bootstrap: `jeswr/unite` + the
  first independent steward's mirror; the sync is content-hash-verified,
  like the suite's `skills-lock.json` pattern).
- **Namespace:** term IRIs migrate from the seed `w3id.org/jeswr/sectors/futures#`
  to **`w3id.org/unite/`** once the circle exists. w3id.org is itself a
  community-operated permanent-identifier service governed by public pull
  requests with multiple maintainers — not owned by any unite party — and the
  redirect target change is a PR the circle (not one person) controls.
  Old-namespace IRIs remain valid forever (immutability) with
  `owl:sameAs`/`skos:exactMatch` bridges published.
- **Fork coexistence is a wire feature, not a schism:** a fork is just another
  spec-version lineage; `fedreg:acceptsSpec` lets communities advertise
  versions from *both* lineages during divergence, and bridges can be
  published as alignment files. The cost of forking is kept low **on
  purpose** — a cheap fork is the standing check on every other mechanism
  here.

## 5. The seed schemes are defaults, not law

The Max-Neef need scheme and Schwartz value scheme (01, 03 §2) are the most
tempting soft-power point: whoever controls the categories frames every
deliberation. Therefore: the schemes are versioned spec artifacts like
everything else; any community may publish its own `skos:ConceptScheme` and
participate fully (mapping via `skos:closeMatch` is a SHOULD for
comparability, never a MUST for participation); and convergence math treats
scheme concepts as *features*, not *filters* — an unmapped community's
statements still cluster and synthesise, they just compare less crisply
across communities (a real cost, weighed in critique C9).

## 6. Bootstrap deficit and the dissolution schedule

Honesty section. Today: one author, one repo, one namespace, zero
implementations. That is a fully centralised artifact *describing* a
decentralised system. The exit is scheduled, measurable, and blocking:

| Milestone | Requirement (blocking — Stage-1 "done" claims are invalid without them) |
|---|---|
| **B1** | Spec text + fixtures published CC-BY; conformance fixture set runnable by third parties |
| **B2** | **Second independent implementation** (different authors, different stack) passing the fixtures — the brief's "no single codebase" made testable |
| **B3** | **Second steward organisation**; mirror repo established; circle charter signed; `w3id.org/unite` namespace live |
| **B4** | First adoption-ratified spec change (§2) executed end-to-end — proving the process, not just the document |
| **B5** | Seed author (the @jeswr suite) demonstrably **loses a recommendation vote and the network follows the adoption rule anyway** — or equivalent evidence the seed no longer holds de-facto veto. Until B5, describe unite's governance as "bootstrapping", never "decentralised" |

The GenAI-implementation engine of Stage 1 creates a specific bootstrap
hazard: if *one* agent suite implements everything, "two implementations"
can be cosmetic. B2 therefore requires **organisationally independent**
implementers — different humans accountable, different toolchains — not two
outputs of the same agent fleet (critique C7).
