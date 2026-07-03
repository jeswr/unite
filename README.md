<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# unite

> ⚠️ **Design + a Stage-1 seed client — under active development, not
> production-ready.** This repository holds the founding *design proposal* for
> **unite**, a decentralised participatory-democracy platform, plus an initial
> **Stage-1 MVP seed client** in [`app/`](app/). It is AI-agent-authored (Claude
> Fable 5, @jeswr's PSS agent) from the maintainer's brief in
> [full-solid-ecosystem#15](https://github.com/jeswr/full-solid-ecosystem/issues/15),
> and is intended to be criticised, forked, and superseded.

**unite** combines **participatory democracy** with **value-centric design**:
everyone can describe their **ideal future**, their **current life**, and their
**wants and needs**; see others' descriptions for inspiration; and take part in
**psychology-informed convergence processes** that surface *shared* futures
rather than amplifying divergent ones — designed so its outputs can credibly
feed government and industry decision-making.

Two properties are **non-negotiable** and drive everything in the design:

1. **Decentralised with no single codebase and no single standards owner.**
   Either one would concentrate too much control. unite is specified as a set
   of data models and protocols over the Solid **data-model federation** stack
   ([solid-federation-vocab](https://github.com/jeswr/solid-federation-vocab),
   [federation-registry](https://github.com/jeswr/federation-registry),
   [federation-trust](https://github.com/jeswr/federation-trust)), where the
   data lives in participants' own pods and any conformant implementation can
   participate.
2. **Convergence over division, without manufacturing consensus.** The
   mechanism design is grounded in the deliberative-democracy and
   social-psychology literature (Pol.is opinion-space mapping, Fishkin's
   deliberative polling, bridging-based ranking, the "Habermas Machine",
   Max-Neef's needs/satisfiers distinction), and dissent is a first-class,
   permanently-carried artifact — never smoothed away.

## Roll-out stages

| Stage | Scope |
|---|---|
| **1** | Co-design the **Solid apps people want**: propose → articulate values/needs → converge on a shared spec → GenAI (the @jeswr agent suite) implements → the app ships into the ecosystem. unite bootstraps by building its own ecosystem. |
| **2** | Broader **standards-based public technology** — fediverse-style systems beyond Solid. |
| **3** | Participatory input into **governance** — government + industry decision-making. |

## The design

Read it in order — each part builds on the previous:

| Doc | Contents |
|---|---|
| [design/README.md](design/README.md) | Overview, design goals, and how the parts fit |
| [design/01-data-model.md](design/01-data-model.md) | The RDF vocabulary: vision statements, needs/satisfiers, value statements, resonance, convergence artifacts |
| [design/02-federation.md](design/02-federation.md) | Federation architecture: pods, communities, registries, trust — and why no component is a point of control |
| [design/03-convergence.md](design/03-convergence.md) | The convergence mechanism, grounded in the cited literature |
| [design/04-governance.md](design/04-governance.md) | How the spec itself is stewarded with no single owner |
| [design/05-stage1-mvp.md](design/05-stage1-mvp.md) | The Stage-1 MVP: the app-co-design instance, screens, flows, and the packages it composes |
| [design/06-critique.md](design/06-critique.md) | The adversarial self-critique this design was revised against — kept, not deleted |

## The Stage-1 seed client

[`app/`](app/) is the first implementation: a vite + React + TypeScript SPA
covering the Stage-1 MVP features (a)–(e) — join a deliberation, submit a
Max-Neef-classified need to your own pod, read the aggregated needs, express
tri-state resonance, and view needs ranked by cross-cluster (bridging)
agreement. The data layer (`app/src/lib`) is exhaustively tested (hostile-input
resilience + a deterministic bridging characterization fixture that seeds the
design's conformance set). Implementation choices + the answers to the design's
three open questions are recorded in
[decisions/0001-stage1-implementation-choices.md](decisions/0001-stage1-implementation-choices.md).
See [`app/README.md`](app/README.md) for run instructions, the EXPERT-REVIEW
checklist, and the production-wiring follow-ups.

## Why this repo exists (and why that's not a contradiction)

A platform whose constitution forbids a single home *starts* somewhere. This
repository is the **founding proposal**, not the standard: the governance
design ([design/04](design/04-governance.md)) specifies the concrete path by
which stewardship *leaves* this repository (immutable spec versions,
adoption-ratified change, a multi-steward circle with a hard cap on any one
organisation, forkability as a constitutional right). The Stage-1 exit
criteria explicitly require a **second, independent implementation** and a
**second steward organisation** — until those exist, unite is by its own
definition still bootstrapping.

## License

The design and any specification text in this repository are licensed
[CC BY 4.0](LICENSE) so they can be forked, mirrored, and re-homed without
permission — forkability is a design requirement, not an afterthought.
Implementations are expected to carry their own (open-source) licenses.
