// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Content data for the v2 pitch page (`#/join-us`) — design/v2/06-vision-demo.md §6.
// Plain structured content only: no React, no JSX, no imports from the app. The v2
// UI surface renders this; keeping the words in one data module keeps the copy
// reviewable and the covenant walkthrough (design/v2/07 §5) pointed at one file.
//
// Register (design/v2/02): warm, plain (~grade 6–8) where the reader is the public;
// precise where the reader is a researcher, engineer, or funder. No exclamation
// marks. The honesty rules are load-bearing: this page never claims production
// readiness, representativeness, or "AI-mediated democracy" (see `nonClaims`), and
// the maintainer's charter forbids describing any of this as production-ready.

/** One "why that's checkable, not PR" grounding under the central claim. */
export interface PitchGround {
  readonly id: string;
  /** Short label, e.g. "Your words live in your own pod". */
  readonly label: string;
  /** Plain-language explanation of the ground. */
  readonly body: string;
  /** How a skeptic verifies it themselves — the checkability is the point. */
  readonly checkIt: string;
}

/** The central claim block: the bet, then why it is checkable rather than PR. */
export interface PitchClaim {
  readonly headline: string;
  readonly paragraphs: readonly string[];
  readonly groundsHeading: string;
  readonly groundsIntro: string;
  readonly grounds: readonly PitchGround[];
}

/** A piece of evidence a visitor can inspect today. */
export interface PitchEvidenceItem {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** Where to look — a route in this app or a path in the repository. */
  readonly pointer: string;
}

/** One concrete recruiting ask. */
export interface PitchAsk {
  readonly id: string;
  /** Who is being asked. */
  readonly audience: string;
  /** The one-sentence ask. */
  readonly ask: string;
  /** What saying yes actually involves, and why it is needed. */
  readonly detail: string;
}

/** A claim this page refuses to make, paired with the honest statement instead. */
export interface PitchNonClaim {
  readonly id: string;
  /** The claim we refuse. */
  readonly notThis: string;
  /** What is true instead, said plainly. */
  readonly instead: string;
}

/** A titled, introduced list section the page can map over. */
export interface PitchSection<T> {
  readonly heading: string;
  readonly intro: string;
  readonly items: readonly T[];
}

export interface PitchClosing {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  /** The public repository holding the code, fixtures, and design docs. */
  readonly repoUrl: string;
  /** How to reach the team — stated honestly (the demo's only outbound channel). */
  readonly contactNote: string;
}

/** The full pitch page, in render order. */
export interface PitchContent {
  readonly route: string;
  readonly title: string;
  readonly tagline: string;
  readonly intro: readonly string[];
  readonly claim: PitchClaim;
  readonly evidence: PitchSection<PitchEvidenceItem>;
  readonly asks: PitchSection<PitchAsk>;
  readonly nonClaims: PitchSection<PitchNonClaim>;
  readonly notBuilt: PitchSection<string>;
  readonly closing: PitchClosing;
}

export const PITCH: PitchContent = {
  route: "#/join-us",
  title: "Help build unite",
  tagline: "Warm on the surface, auditable underneath, owned by you.",

  intro: [
    "unite is a bet about how communities figure out what they want together. If you have five minutes, the demo makes the bet feel like something; if you have thirty, the curtain comes all the way back. This page is the rest: what we claim, what we can show you today, what we need, and — just as carefully — what we do not claim.",
  ],

  claim: {
    headline: "The claim",
    paragraphs: [
      "Media ranked for engagement divides people by design — the arithmetic rewards whatever splits a room. The tools built to do the opposite, deliberation platforms, mostly work and mostly stay small: procedural surfaces, ceremony at every step, and so the people who stay are the minority who enjoy instruments. Everyone else — the very diversity the mathematics needs — bounces off the ceremony.",
      "unite's bet is that the machinery of the second can wear the skin people actually inhabit: a small, warm conversation about what you want life around here to look like, with the opinion mapping, bridging ranking, and synthesis running underneath — disclosed once at the door, inspectable from every object it touches, and never in your face.",
      'A warm surface over quiet machinery is also how every manipulative product ever built describes itself. So the claim is not "trust us". The claim is that this is the rare architecture where "warm on the surface, auditable underneath, owned by you" is checkable, item by item:',
    ],
    groundsHeading: "Why that is checkable, not PR",
    groundsIntro:
      "Four structural facts, each one verifiable by a stranger with no goodwill toward us.",
    grounds: [
      {
        id: "own-pod",
        label: "Your words live in your own pod",
        body: "Everything unite hears from you — your messages, the notes it took from them, your reactions — is stored as resources in a data store you own, under a consent policy you set. There is no second copy to sell, subpoena, or forget to delete.",
        checkIt:
          "Open the notebook (#/notebook): every item shows the address it lives at. Delete one and watch the summaries recompute without it.",
      },
      {
        id: "no-server",
        label: "There is no server doing the profiling",
        body: "Cluster assignments, bridging scores, and room outcomes are recomputed in the client, on read, from participants' pods. They are never stored as profiles anywhere — there is nowhere for a shadow profile to live.",
        checkIt:
          "Watch the network tab while the demo runs — the computation happens in your browser. The read path is open code: lib/aggregate.ts into lib/ranking.ts.",
      },
      {
        id: "deterministic-engine",
        label: "The engine is deterministic, small, and open",
        body: 'Same reactions in, same map out: every module from clustering to routing is a pure function with pinned test fixtures. That is why unite\'s explanations can be exact — a "why am I seeing this?" restates the literal fields that chose it, instead of telling a plausible story about a black box.',
        checkIt:
          "Run the fixture suite in the repository. Passing it is our working definition of a conforming implementation — including one we didn't write.",
      },
      {
        id: "seams",
        label: "A seam on every machine-made object",
        body: 'Everything the machinery produces — a routed statement, a circle invitation, a summary line, a private nudge — carries a one-tap "why this?", answered from the engine\'s actual fields, with the long version one link deeper. Disclosure here is not a policy document; it is an affordance on the object itself.',
        checkIt:
          'Tap any seam in the demo, then open "See what was running the whole time" and find the exact field the seam restated.',
      },
    ],
  },

  evidence: {
    heading: "The evidence so far",
    intro: "Not promises — things you can hold up to the light today.",
    items: [
      {
        id: "working-demo",
        title: "A working demonstration",
        body: "The five-minute arc — speak, be mirrored, meet the community, see consequence — runs on the real pipeline: a staged neighbourhood of visibly fictional personas whose statements flow through the production aggregation, clustering, ranking, and synthesis, in your browser. The personas are staged; the computation is not. And your own free-text path runs un-tuned — nothing is choreographed to perform on cue.",
        pointer:
          'The demo itself, then "See what was running the whole time" (the behind-the-curtain view).',
      },
      {
        id: "fixtures",
        title: "A deterministic engine with its fixture set",
        body: "Every engine module is pure and characterization-tested: crafted inputs pinned to exact expected outputs, from clustering to mirror drafting to the k-threshold floors. The fixture set doubles as the conformance definition — an independent implementation that passes it counts, and ours holds no special status.",
        pointer: "app/src/lib/*.test.ts in the repository.",
      },
      {
        id: "kept-critiques",
        title: "The design documents, scars included",
        body: "The design is written against the deliberation, psychology, and HCI literature, sources named — and its adversarial self-critiques are kept in the repository, not cleaned up: every attack we found on our own design, what changed because of it, and the residuals we could not dissolve. If you want to know where this design is weakest, we have already written it down.",
        pointer: "design/ and design/v2/ in the repository — start with 08-critique.md.",
      },
    ],
  },

  asks: {
    heading: "What we're asking for",
    intro:
      "The prototype exists to recruit the people it cannot substitute for. Concretely, and in rough order of urgency:",
    items: [
      {
        id: "researchers",
        audience: "Deliberation and psychology researchers",
        ask: "Review the instrument before anyone pilots it.",
        detail:
          "The design ships with an expert-review checklist and a walkthrough of its presentation covenant. The items we most need adversarial eyes on are flagged in the docs: the re-sequencing of when distributions are shown (after your own reaction, not before), the machine-offered conversation openers, the unvalidated circle-composition procedure, and the design's biggest open empirical bet — whether conversational elicitation degrades the opinion matrix relative to explicit voting. That last one needs a measurement design, and designing it is the first piece of research this project offers.",
      },
      {
        id: "engineers",
        audience: "Two or three engineers",
        ask: "Build the parts the prototype honestly defers.",
        detail:
          "A live LLM listener behind the existing drafting seam (chosen per-community, its identity recorded on every draft it makes); real-time circle infrastructure over the notifications substrate; moderation and safety tooling beyond the current lexical screen. The deterministic engine itself stays as it is — small, fixture-tested, and deliberately boring.",
      },
      {
        id: "pilot-partner",
        audience: "A pilot community partner",
        ask: "Bring a real neighbourhood, carefully.",
        detail:
          "A neighbourhood organisation or civic-tech group to host a curated first cohort. The partner does the one thing the engine cannot: recruit demographic diversity. unite can guarantee every circle spans opinion clusters; only a human who knows the community can make the room look like the community.",
      },
      {
        id: "second-implementation",
        audience: "An independent implementer",
        ask: "Rebuild the engine from the fixtures, without reading our code.",
        detail:
          'A standing criterion of this project: the word "decentralised" stays off the table until an implementation we did not write passes the same fixture set. The fixtures are the spec; reproducing them is the proof.',
      },
      {
        id: "privacy-counsel",
        audience: "Privacy counsel",
        ask: "Own the pilot's DPIA and the explicit-consent entry flow.",
        detail:
          "People's political opinions are GDPR Article 9 special-category data. Before any pilot with real participants, this project needs a Data Protection Impact Assessment and one explicit, recorded consent act at entry — designed as a single warm affirmative moment, not a consent wall. Pods and per-person consent policies are genuinely strong data-protection-by-design material; they do not exempt the processing, and we will not pretend they do.",
      },
      {
        id: "designer",
        audience: "A visual and interaction designer",
        ask: "Carry the warmth the copy cannot.",
        detail:
          "The entire difference between unite's instrument surface and this one is a felt register, and words alone cannot hold it. The build track keeps a design-token seam open precisely so a professional pass is a re-theme, not a rebuild. Until a designer joins, the register runs at the team's competent-but-not-designer ceiling — said plainly here so nobody mistakes the ceiling for the design.",
      },
      {
        id: "funders",
        audience: "Funders and civic partners",
        ask: "Fund the next stage knowing exactly what we don't promise.",
        detail:
          "No grant-cliff promise. Community projects funded generously and then dropped do lasting damage — Every One Every Day is the lesson we name. Sustainability is an open design problem on this project's roadmap, not a solved line in a budget. Money here buys the deferred productionization, a careful pilot, and an honest public account of what happened — including if what happened is failure.",
      },
      {
        id: "credential-issuers",
        audience: "Professional bodies, employers, and past deliberation hosts",
        ask: 'Help solve who gets to sign "verified".',
        detail:
          "When an expert joins a conversation, their credential chip renders exactly the strength of what was actually verified — and today no general expertise-credential authority exists for it to lean on. We refuse to fake authority with an unbacked checkmark, so most experts appear as what they honestly are: invited practitioners with their own name behind their experience. Building a credible, decentralised expertise-issuance ecosystem is an open problem this design names and does not solve.",
      },
    ],
  },

  nonClaims: {
    heading: "What we are not claiming",
    intro:
      "These carry as much weight as the claims. If you catch this page — or anything in the demo — implying one of them, that is a bug; tell us.",
    items: [
      {
        id: "not-production",
        notThis: "This is production software.",
        instead:
          "It is a working prototype built to recruit a team, under active development. The deferred work is listed below, out loud, not hidden in a footnote.",
      },
      {
        id: "not-representative",
        notThis: "What this community concludes represents anywhere real.",
        instead:
          "The demo is a staged neighbourhood of fictional people, and any real cohort arrives through whoever invited them. Every published output carries its method label — a convenience sample is named as one, always.",
      },
      {
        id: "not-ai-democracy",
        notThis: "This is AI-mediated democracy.",
        instead:
          "Honestly named, it is opinion mapping, plus machine-drafted mirrors that people adopt, fix, or scrap, plus human ratification. No model decides anything; people ratify, and dissent is carried in full rather than averaged away.",
      },
      {
        id: "bootstrapping",
        notThis: "unite is decentralised.",
        instead:
          "unite is bootstrapping. One implementation, built by one team, is not decentralisation no matter where the data lives. The word waits until an independent implementation passes the fixtures and communities genuinely federate.",
      },
      {
        id: "diversity-ceiling",
        notThis: "unite makes rooms demographically diverse.",
        instead:
          "The engine sees exactly one axis of difference — how people read statements — and guarantees circles span it. It cannot see age, race, class, or disability, and it refuses to collect protected attributes to try. Demographic diversity is recruited by humans or not at all.",
      },
      {
        id: "not-gdpr-cleared",
        notThis: "The warm welcome at the door is a lawful basis for the real thing.",
        instead:
          "It is not. Political opinions are special-category data; a real deployment requires explicit recorded consent and a completed data-protection impact assessment first. This prototype is not GDPR-cleared for deployment, and says so.",
      },
    ],
  },

  notBuilt: {
    heading: "What the prototype defers, deliberately",
    intro:
      "The demo stages the full loop end-to-end on seeded data — the same honest-sandbox posture throughout — and it does not build:",
    items: [
      "Live multi-user circles — the demo is a single visitor among clearly labeled personas.",
      "Any LLM call — none ships anywhere in the demo; the mirror's drafter is a deterministic template behind a seam a live community would fill with its own choice.",
      "Production authentication beyond what the existing app already wires.",
      "A mobile app.",
      "Notification delivery.",
      "A real expert marketplace — the expert and consequence loops run end-to-end on seeded, labeled data.",
      "The GDPR prerequisites for a pilot with real people: the explicit-consent entry flow and the DPIA come before any real deployment, not after.",
    ],
  },

  closing: {
    heading: "Kick the tires",
    paragraphs: [
      "Run the demo. Tap the seams. Open \"See what was running the whole time\" and try to find something the handshake didn't tell you. Read the critiques — we wrote the attacks down so you wouldn't have to start from zero.",
      "Then, whichever of the people above you are — researcher, engineer, community partner, implementer, counsel, designer, funder, or skeptic — tell us what you found. Especially if what you found is a reason this shouldn't be built.",
    ],
    repoUrl: "https://github.com/jeswr/unite",
    contactNote:
      "The demo's feedback button is its only outbound channel, and it says where feedback goes. Otherwise: open an issue on the repository.",
  },
};
