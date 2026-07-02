<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# unite — design overview

**Status:** founding design proposal (v0.1, 2026-07-02). Authored by the PSS
design agent (Claude Fable 5) from the maintainer's brief in
[full-solid-ecosystem#15](https://github.com/jeswr/full-solid-ecosystem/issues/15).
Design only — no implementation exists. Everything here is open to revision;
the [adversarial self-critique](06-critique.md) that already reshaped it is
kept in the repo deliberately.

**Home decision** (per the proceed-without-greenlight rule): a dedicated
public repo `jeswr/unite` rather than `full-solid-ecosystem/docs/unite/`,
because (a) unite is a multi-stage initiative that will accrete artifacts
beyond a docs tree — vocabulary drafts, SHACL profiles, conformance fixtures,
a governance charter — and those need one linkable, forkable home; (b) the
governance design requires the spec text to be publicly mirrorable under CC
BY, which a repo boundary makes clean; (c) `full-solid-ecosystem` is a
multi-agent working repo, a poor place for a fast-evolving public-facing
design tree. The single-home irony this creates is confronted head-on in
[06-critique.md](06-critique.md) C10 and scheduled away in
[04-governance.md](04-governance.md) §6.

## The problem, in one paragraph

Existing social platforms optimise for engagement, which in practice amplifies
division: the content that spreads is the content that provokes. Existing
participation mechanisms (elections, consultations, petitions) are
low-bandwidth: they let people choose between options others framed, not
describe the future they actually want. unite inverts both: its primitive is a
person's **own description of their ideal future, current life, and needs**;
its social mechanic is **resonance across difference** rather than engagement;
and its output is **convergence artifacts** — shared-future statements with
explicit provenance, endorsement evidence, and carried dissent — legible
enough for governments and industry to act on.

## Design goals (and the tensions between them)

| # | Goal | In tension with |
|---|---|---|
| G1 | **No single point of control** — not one codebase, not one standards owner, not one operator, not one moderator | G6 (someone must run the convergence machinery); bootstrap reality (one author today) |
| G2 | **Personal sovereignty** — a person's statements live in *their* pod, under *their* access control, revocable | G5 (aggregation needs access); G7 (governance legitimacy wants attributable input) |
| G3 | **Honest expression** — people must be able to describe their real lives and futures, which requires pseudonymity options | G4 (sybil resistance); G7 (legitimacy) |
| G4 | **Sybil-resistant convergence** — a synthesis must reflect people, not bots or brigades | G3 (pseudonymity) |
| G5 | **Convergence on shared futures** — the mechanism surfaces common ground | G8 (must not manufacture consensus or suppress legitimate conflict) |
| G6 | **Actionable output** — Stage 1: implementable app specs; Stage 3: governance-grade input | G1 (actionability pressures toward central curation) |
| G7 | **Legitimacy** — output that decision-makers can defensibly use | G3, and self-selection bias |
| G8 | **Dissent is data** — disagreement is preserved, first-class, never smoothed away | naïve reading of G5 |

The design does not pretend these tensions dissolve; each doc names which ones
it is trading off and how. The critique doc audits the trades.

## Architecture in one diagram

```
 person's pod (WAC/ACP)                     community (a deliberation space)
 ┌──────────────────────────┐               ┌────────────────────────────────┐
 │ fut:VisionStatement      │  as:Announce  │ fedreg:Registry (members,      │
 │ fut:LifeContext          │──────────────▶│   apps, peer communities)      │
 │ fut:Need / fut:Satisfier │   (LDN inbox) │ inbox + live index (a CACHE —  │
 │ fut:ValueStatement       │               │   pods stay source of truth)   │
 │ fut:Resonance (votes)    │◀──────────────│ facilitation services:         │
 │ odrl:hasPolicy (use-     │  notifications│   opinion-space mapping,       │
 │   consent per statement) │  (WSChannel   │   bridging ranking, synthesis  │
 └──────────────────────────┘   2023)       │   drafting (GenAI or human)    │
        ▲                                   └────────────────────────────────┘
        │ any conformant app                     ▲            ▲
        │ (≥2 independent codebases —            │ peering    │ trust
        │  a Stage-1 exit criterion)             ▼            ▼
 ┌──────────────────────────┐               other communities; federation-trust
 │ unite client(s)          │               VCs (signed memberships); NO root
 └──────────────────────────┘               registry, NO global moderator
```

Convergence artifacts (`fut:SharedFuture`) are derived — with full PROV-O
provenance and signed with Data Integrity proofs — from statements whose
authors consented (ODRL) to that use; they carry per-cluster endorsement
evidence and a mandatory dissent annex.

## How the docs fit together

1. **[01-data-model.md](01-data-model.md)** defines *what exists*: the
   `fut:` (futures) sector vocabulary in the suite's fed-vocab pattern —
   including the load-bearing **needs vs satisfiers** split (Max-Neef) that
   makes convergence structurally possible, and the ODRL consent layer.
2. **[02-federation.md](02-federation.md)** defines *where it lives and how it
   moves*: pods, communities, registries, trust, propagation — and a
   function-by-function analysis of why no component can capture the system.
3. **[03-convergence.md](03-convergence.md)** defines *how shared futures
   emerge*: the elicitation → resonance → mapping → synthesis → deliberation
   pipeline, each step grounded in cited literature, with anti-manufactured-
   consensus guardrails.
4. **[04-governance.md](04-governance.md)** defines *who stewards the spec*:
   adoption-ratified change, the steward circle, forkability, and the
   bootstrap-deficit exit criteria.
5. **[05-stage1-mvp.md](05-stage1-mvp.md)** makes it concrete: the
   app-co-design instance, its screens and flows, and the existing @jeswr
   packages it composes.
6. **[06-critique.md](06-critique.md)** attacks all of the above and records
   which attacks changed the design.

## Relationship to the wider @jeswr suite

unite is the ultimate demonstration of the suite's agentic vision (Data
Integrity + PROV + ODRL + data federations —
[full-solid-ecosystem#14](https://github.com/jeswr/full-solid-ecosystem/issues/14)):
every statement is provenance-tracked, every use is policy-governed, every
synthesis is signed and attributable, and the GenAI implementation engine of
Stage 1 *is* this agent suite operating under its existing gating discipline.
