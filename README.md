# Unite

Unite explores how people around the world can discuss the future they want, find common ground and turn shared priorities into useful work. Participation begins with an open conversation or a personal AI interview. People review the resulting proposals, preserve disagreements, choose next steps and learn from what happens.

The current experiment is **[prototype v4](prototype-v4/IMPLEMENTATION.md)**: a social feed with actual live updates between browser tabs, an opt-in Claude interviewer, versioned common-ground statements, an action queue and an interactive comparison of possible economic futures. The platform's long-term purpose is worldwide participatory design; no particular technical community or economic model is a prerequisite to participate.

## Try the local prototype

Node 20 or later; no package dependencies or installation step. From `prototype-v4/`:

```sh
node server/main.js
```

Open [the local demo](http://127.0.0.1:8769/). Open another tab to try a second participant. AI is off by default. To enable the optional bridge through an installed and already authenticated Claude Code CLI:

```sh
UNITE_AI=claude-cli node server/main.js
```

Each participant must still opt in before sending text to Anthropic. Calls use the computer's existing Claude account and may consume credits or usage limits. The bridge requests and verifies `claude-opus-5-5`; it has no tools or MCP access. See [run options and limits](prototype-v4/IMPLEMENTATION.md), including how to set the CLI path and port.

This is a local English-interface prototype. Sample people are fictional. Public server data is held in memory and is lost on restart; a public-only export is available. A tab's private interview is excluded from the public feed, synthesis input and export unless its participant explicitly publishes reviewed text. There are no verified identities, real funding, institutional commitments or public decision-making powers.

## Read the proposal and evidence

- [Current research and societal transition proposal](research/2026-09-restart/CONVERSATIONAL-UNITE.md): Anthropic's interview study, social psychology, discourse, prioritization, alternative public-service economies and migration from existing institutions.
- [Research index](research/2026-09-restart/README.md): political integration, expertise, governance, funding and the lean optional learning-cycle budget.
- [Implementation report](prototype-v4/IMPLEMENTATION.md), [engineering review](prototype-v4/REVIEW.md) and [verification](research/2026-09-restart/V4-VERIFICATION.md): actual capabilities, checks and production gaps.

All current prototype application code and tests were produced by the founder's requested Claude Opus 5.5. Codex supplied research, product direction and browser acceptance. The cheap cost of AI-assisted development is reflected in the planning assumptions; ongoing inference, participation and real-world delivery require separate accounting.

The aspiration remains multiple independent clients/operators and portable participation records, without one developer, host or standards owner controlling the system. This single local implementation does not yet deliver that federation or confer democratic legitimacy.

## Earlier work

[Historical README](README-HISTORICAL.md), [`app/`](app/), [`design/`](design/README.md) and [`prototype-v3/`](prototype-v3/IMPLEMENTATION.md) are preserved as earlier experiments. Their old starting points and product journeys are not requirements for the current direction.
