// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Content data for the "How unite listens" page (`#/how`) — the full out-of-flow
// explanation the handshake promises (design/v2/02 §1, 03 §6/§8, 01 §3/§7).
// Plain structured content only: no React, no JSX, no imports from the app.
//
// This page IS the reveal test run in public: every mechanism the v2 surface
// carries is disclosed here — including the withholding mechanisms (a disclosure
// page that skipped elicit-before-expose would fail its own test). Register:
// warm, plain (~grade 6–8); the `source` pointers are precise so a technical
// reader can walk from any sentence here to the code or design doc behind it.
// Legible and contestable in tone: every section tells the reader how to check
// it or how to push back.

/** The page opening: the handshake recapped, then what this page is for. */
export interface HowIntro {
  readonly title: string;
  /** The sensing sentence from the door, quoted back — this page is its long version. */
  readonly handshakeRecap: string;
  readonly paragraphs: readonly string[];
}

/** One moment at which the system surfaces what it inferred. */
export interface InferenceMoment {
  readonly id: string;
  /** When — e.g. "When you arrive (once)". */
  readonly moment: string;
  /** What surfaces at that moment. */
  readonly what: string;
  /** How it shows up — the register. */
  readonly how: string;
}

/** The timing model: the moments inference surfaces, and what never renders. */
export interface WhenWeSurface {
  readonly heading: string;
  readonly intro: string;
  readonly moments: readonly InferenceMoment[];
  readonly neverHeading: string;
  readonly never: readonly string[];
}

/** The reveal test, stated plainly and quotably. */
export interface RevealTest {
  readonly heading: string;
  /** The rule itself — one quotable sentence pair. */
  readonly rule: string;
  readonly paragraphs: readonly string[];
  /** The standing invitation to call a failure. */
  readonly invitation: string;
}

export interface YourDataPoint {
  readonly id: string;
  readonly label: string;
  readonly body: string;
}

/** Why your data lives in your pod, under your consent — and what that buys. */
export interface YourData {
  readonly heading: string;
  readonly intro: readonly string[];
  readonly points: readonly YourDataPoint[];
}

export type MechanismGroupId =
  | "listening"
  | "mapping"
  | "routing"
  | "telling"
  | "people"
  | "consent";

export interface MechanismGroup {
  readonly id: MechanismGroupId;
  readonly label: string;
  readonly intro: string;
}

/** One disclosed mechanism: what it does, when you meet it, what it refuses. */
export interface Mechanism {
  readonly id: string;
  readonly group: MechanismGroupId;
  readonly name: string;
  /** What it does and why, in plain language. */
  readonly plain: string;
  /** When you meet it. */
  readonly when?: string;
  /** The guard rails — what it never does. */
  readonly never?: string;
  /** Where it lives: the module and/or design section a technical reader can check. */
  readonly source: string;
}

/** An honest residual: a limit disclosure does not dissolve, named anyway. */
export interface HonestResidual {
  readonly id: string;
  readonly name: string;
  readonly body: string;
}

/** How to contest the record — the notebook as the control surface. */
export interface Contest {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export interface InstrumentLink {
  readonly label: string;
  readonly route: string;
  readonly note: string;
}

/** The v1 instrument views, reachable from here — hiding them would fail the test. */
export interface Instruments {
  readonly heading: string;
  readonly body: string;
  readonly links: readonly InstrumentLink[];
}

/** The full "How unite listens" page, in render order. */
export interface HowListensContent {
  readonly route: string;
  readonly intro: HowIntro;
  readonly whenWeSurface: WhenWeSurface;
  readonly revealTest: RevealTest;
  readonly yourData: YourData;
  readonly mechanismsHeading: string;
  readonly mechanismsIntro: string;
  readonly groups: readonly MechanismGroup[];
  readonly mechanisms: readonly Mechanism[];
  readonly residuals: {
    readonly heading: string;
    readonly intro: string;
    readonly items: readonly HonestResidual[];
  };
  readonly contest: Contest;
  readonly instruments: Instruments;
}

export const HOW_LISTENS: HowListensContent = {
  route: "#/how",

  intro: {
    title: "How unite listens",
    handshakeRecap:
      "As people chat, I listen for what matters to them and where they agree more than they'd guess.",
    paragraphs: [
      "That is what the notetaker told you at the door. This page is the long version — every piece of machinery behind that sentence, what each piece does, when it touches your words, and what it refuses to do.",
      "It is written to be checked, not believed. The engine underneath is open code and deterministic — the same inputs always produce the same outputs — so everything here can be stated exactly, and a technical reader can walk from any sentence on this page to the module or design document behind it. Nothing you could discover by digging should surprise you after reading it.",
      "It is also written to be pushed back on. If any part of what follows makes the conversation you just had feel different in a way you don't like, that is ours to fix — the rule we hold ourselves to is a few sections down.",
    ],
  },

  whenWeSurface: {
    heading: "What unite infers, and when you see it",
    intro:
      "unite never surfaces inference as ambient instrumentation over your words — no badges on messages, no scores, no spinners while you type. What it learns surfaces at four kinds of moment, each chosen because that is when the explanation can actually be answered:",
    moments: [
      {
        id: "arrival",
        moment: "When you arrive (once)",
        what: "That listening happens at all, and the promise about where everything lives.",
        how: "The handshake — two warm sentences at the door, with this page linked and never forced on you.",
      },
      {
        id: "adoption",
        moment: "When it reads you (a few times per conversation, sparingly)",
        what: "The system's actual reading of what you said — shown to you before it counts for anything.",
        how: "The mirror: one quiet line under your message. Adopt it, fix it, or scrap it; scrapped or ignored means nothing entered.",
      },
      {
        id: "reaction",
        moment: "When you react to someone's words",
        what: "The real spread of how others read that statement — after your own take is in, never before.",
        how: "Inline and quiet, once you've reacted. Why it waits for you is disclosed below (elicit-before-expose).",
      },
      {
        id: "use",
        moment: "Whenever an inference does something visible",
        what: "The one-sentence why: why this statement was shown to you, why this circle, why this phrasing, why this nudge.",
        how: 'A quiet "why this?" on the object itself, answered from the engine\'s actual fields, ending in a link back to the matching section of this page.',
      },
      {
        id: "rhythm",
        moment: "Monthly",
        what: "The slow synthesis: what emerged, where people genuinely differ in their own words, and what changed because people spoke.",
        how: "The letter — deliberately slow, dissent always carried, every synthesized line openable to the consented quotes behind it.",
      },
      {
        id: "on-demand",
        moment: "Whenever you ask",
        what: "Everything about you, and everything about the mechanism.",
        how: "Your notebook (#/notebook) holds the first; this page holds the second. Both are always one tap away.",
      },
    ],
    neverHeading: "And never",
    never: [
      "Live tallies or counters — nowhere, at any scale.",
      "Per-message AI badges or confidence scores over people's words (they measurably make people feel less heard, and they'd be wallpaper, not honesty).",
      '"Analyzing…" spinners or any visible instrumentation while you speak.',
      'Cluster labels on people — nobody is ever shown as "group B", and no cluster is ever given a political name.',
      "Engagement statistics, streaks, activity metrics, or re-engagement prompts.",
      'Any characterization of "the group" below the k-threshold, and any tally at all inside a circle.',
    ],
  },

  revealTest: {
    heading: "The rule we hold ourselves to",
    rule: "For every mechanism, write the complete public explanation. If a reasonable person reading it would feel tricked rather than respected, redesign the mechanism — not the explanation.",
    paragraphs: [
      "unite keeps its machinery quiet, and there is a hard line between quiet and covert. People who discover hidden curation on their own stop trusting everything they were shown, retroactively — the research on this is blunt. So nothing on this page was hidden from you: the listening was disclosed at the door before it did anything, and every object the machinery makes carries its own explanation.",
      "The opposite failure is wallpaper: consent walls, per-message badges, procedural chrome on every surface. That informs no one — it just makes talking feel like being processed. So the explanations live at the moments they can be answered, and in this page, which is complete rather than constant.",
      "This page is the reveal test being run on ourselves, in public. The behind-the-curtain view in the demo exists for the same reason: so that looking closer is a feature of unite, not a risk to it.",
    ],
    invitation:
      "If anything on this page makes the conversation you just had feel like a betrayal, we have failed — tell us which part.",
  },

  yourData: {
    heading: "Why your data lives in your pod",
    intro: [
      "unite has no server that learns about you. What it knows lives in exactly one place — a pod you own — and everything else is recomputed from people's pods each time it is needed, then let go. That is not a privacy setting; it is the architecture, and it is what makes the promises below structural rather than contractual.",
    ],
    points: [
      {
        id: "your-words",
        label: "Your words stay yours",
        body: "Messages, adopted notes, reactions: each is a resource in your pod, listed in your notebook with the address it lives at. The notebook is not a copy of some server record — there is no server record.",
      },
      {
        id: "your-consent",
        label: "Consent is a policy you hold, not a box you ticked",
        body: "Sensible defaults apply from the start: your contributions may feed the aggregate pictures, and may not be quoted verbatim or put to any government-bound use. The first time a real context change would happen — a quote in a summary, a line in the letter, a question to an expert, a signed report — you are asked then, specifically, and your answer is written into your own pod as a policy (an ODRL policy, for the technical reader) that the machinery obeys at every gate.",
      },
      {
        id: "deletion",
        label: "Deletion actually propagates",
        body: "Everything downstream is recomputed on read, so deleting an item removes it from every future computation structurally — not through a compliance workflow that promises to catch up. The one exception, artifacts a community already signed with your recorded consent, is named honestly below.",
      },
      {
        id: "your-position",
        label: "Your place on the map is ephemeral, and yours alone",
        body: "Where the map puts you is computed during a render, shown only to you in your notebook, and never written anywhere. There is no stored profile to leak, because there is no stored profile.",
      },
      {
        id: "leaving",
        label: "Leaving is real",
        body: "Export everything — it is your pod, so the export is genuine, not a courtesy file. Leave a circle, or leave unite. What persists (signed artifacts your consent already entered) is stated plainly before it exists, never discovered later.",
      },
    ],
  },

  mechanismsHeading: "Every mechanism, disclosed",
  mechanismsIntro:
    "What follows is the complete inventory of the machinery on this surface. Each entry says what the mechanism does, when you meet it, what it refuses to do, and where it lives in the open code or design — so nothing here has to be taken on faith. The withholding mechanisms are disclosed too, including the one that holds numbers back from you: a disclosure page that skipped those would fail its own test.",

  groups: [
    {
      id: "listening",
      label: "Listening — from your words to the shared picture",
      intro:
        "How what you say becomes a note in the shared picture — and what may never make that trip.",
    },
    {
      id: "mapping",
      label: "Mapping — from everyone's reactions to the map",
      intro:
        "How small reactions become a picture of where the community agrees more than it would guess.",
    },
    {
      id: "routing",
      label: "Choosing what you see, and when",
      intro:
        "Everything that decides exposure and order. This is the most consequential machinery here, which is why it carries the most seams.",
    },
    {
      id: "telling",
      label: "Telling the community about itself",
      intro:
        "The surfaces that speak for the group. All of them are computed, none of them editorial.",
    },
    {
      id: "people",
      label: "When other people enter",
      intro:
        "The machine moves that touch human-to-human speech and real-world action — governed hardest, because the stakes are highest.",
    },
    {
      id: "consent",
      label: "Consent and control",
      intro: "What you are asked, when — and the surface where you can always overrule the record.",
    },
  ],

  mechanisms: [
    // ── listening ───────────────────────────────────────────────────────────
    {
      id: "notetaker-mirror",
      group: "listening",
      name: "The notetaker and the mirror",
      plain:
        'After you say something substantial, the notetaker offers one line back: "Hearing you: … Close?" That line is the system\'s actual reading of what you said — a candidate note for the shared picture, shown to you before it counts for anything. Adopt it and it becomes yours; fix it and your correction becomes the note; scrap it and it is visibly discarded. Nothing you say enters the shared picture except through a mirror you adopted.',
      when: "A few times per conversation, at most — mirrors are punctuation, not surveillance. A mirror you ignore expires silently and enters nothing.",
      never:
        "The notetaker mirrors, asks, and summarizes; it never advocates, never opines, and never rephrases anyone toward agreement. It is a role, not a person, and it will not pretend otherwise.",
      source:
        "lib/mirror-draft.ts behind the lib/decompose.ts seam; adoption is the fut:adoptedBy invariant — unrepresentable to bypass (design/v2/03 §2).",
    },
    {
      id: "need-coding",
      group: "listening",
      name: "How your words get sorted, without you filling in a form",
      plain:
        'Under the hood, the engine files what statements are about against a fixed set of fundamental human needs — safety, having a say, belonging, getting by, and so on. You never see that as a form or a label; the mirror wears it as plain talk ("sounds like this is about feeling safe and having a say — right?"), and adopting the mirror is what confirms it. The machine does the filing so people never have to perform a taxonomy.',
      never:
        'The category is never shown as a classification ("filed under: Protection"), and a mirror that cannot honestly read you asks instead of guessing.',
      source:
        "The keyword-to-need table in lib/mirror-draft.ts, pinned by fixtures (design/v2/03 §2, step 3).",
    },
    {
      id: "sensitive-boundary",
      group: "listening",
      name: "The hard line around health and money details",
      plain:
        'What you say in your circle is your own speech and is never screened — "my disability makes this crossing terrifying" sends, stands, and is heard. The screen sits where the machine layer begins: a note that carries health or finance details is stopped by a hard data rule before it can enter the shared, aggregated picture. When that happens the notetaker says so plainly, offers a different line you actually wrote that is about the street rather than about you, or hands the pen back so you can write the shareable version yourself.',
      when: "Only at the moment something would move from your circle into the shared picture.",
      never:
        'It never rewrites a sensitive sentence into a "safe" one — a machine paraphrase would not be your speech, and laundering disclosures into aggregates is exactly what the rule exists to prevent. "Keep it just here" is a respected answer, never re-asked as if it were wrong.',
      source:
        "lib/sensitive.ts, enforced fail-closed at the adoption chokepoints; the utterance/machine-layer split is design/v2/03 §2a.",
    },
    {
      id: "demo-scribe",
      group: "listening",
      name: "Who drafts the mirror — in this demo",
      plain:
        "In this demo, mirrors are drafted by a small deterministic template: the same words in always produce the same mirror out. No AI model runs anywhere in the demo, no key ships with it, and nothing you type leaves your browser. A live community would choose its own helper — human or model — through the same seam, and that choice would be recorded on every draft it makes, so assistance is never invisible.",
      never:
        "The demo never dresses the template up as a mind. When it reads you clumsily, the fix button is the honest path — and the seam on every demo mirror says exactly what drafted it.",
      source: "lib/mirror-draft.ts; the per-community seam is lib/decompose.ts (design/v2/06 §4).",
    },

    // ── mapping ─────────────────────────────────────────────────────────────
    {
      id: "resonance-gestures",
      group: "mapping",
      name: "What your reactions become",
      plain:
        'When you tap "resonates", "not sure", or "I see it differently" on someone\'s words, that writes one small note in your own pod: you, that statement, that reading. Everyone\'s notes together are the raw material of the map. Your latest reaction to a statement is the one that counts, and you can revise any of them, any time, from your notebook.',
      never:
        "A reaction is never a public score on a person or a post, and no count of reactions renders live anywhere.",
      source:
        "fut:Resonance resources in the reactor's pod; latest-wins dedupe in lib/aggregate.ts (design/v2/03 §3).",
    },
    {
      id: "opinion-map",
      group: "mapping",
      name: "The map — where the system thinks you sit",
      plain:
        "From everyone's reactions, the engine sketches a map: people who tend to read statements the same way sit near each other on it. It is arithmetic, not insight — the same reactions always produce the same map — and it exists for one purpose: making sure the different parts of a community actually hear each other, rather than only their own side.",
      never:
        "Parts of the map are never named, never tagged with politics, and never shown attached to a person. Your own position is visible only to you, in your notebook, recomputed live — it is stored nowhere.",
      source:
        "lib/projection.ts (deterministic projection) + lib/ranking.ts (deterministic clustering).",
    },
    {
      id: "bridging-ranking",
      group: "mapping",
      name: 'What "rings true across the map" means',
      plain:
        "When unite says the community is circling agreement on something, that is computed, not felt: a statement ranks high only when every part of the map leans toward it, not when one loud part does. The full spread — who leaned which way, at community scale — is always attached to any rank, so agreement can never be asserted where the data shows a split.",
      never:
        "There is no engagement ranking anywhere in unite. Nothing rises for being clicked, argued over, or reacted to a lot.",
      source:
        "lib/ranking.ts — a smoothed product across clusters, distribution always returned with the rank.",
    },

    // ── routing ─────────────────────────────────────────────────────────────
    {
      id: "peer-routing",
      group: "routing",
      name: "Why you are shown someone's statement",
      plain:
        "When the notetaker says \"here's how someone across town put it — does it ring true for you?\", that statement was picked by a router, not by chance: statements your part of the map has not weighed in on come first, then ones that rang true for people who usually read things differently from you, spread out so nobody's words go unseen. The point is coverage and genuine cross-hearing, not stickiness.",
      when: "As conversational beats inside your circle — one at a time, never a feed.",
      never:
        "It never optimizes for your attention, and it never buries a statement for being unpopular.",
      source:
        "lib/deck.ts (routeDeck) — the seam on each beat restates its literal fields, ownClusterSeen and neighbourResonance (design/v2/03 §3, §6).",
    },
    {
      id: "circle-composition",
      group: "routing",
      name: "How your circle was put together",
      plain:
        "Circles of four to six people are composed to span the community's different ways of seeing a question — with rules against tokenism built into the arithmetic: nobody is ever seated as the lone voice of their part of the map (pairs or nothing), and a community whose mix cannot support a genuinely diverse circle gets a circle that says so plainly instead of one that quietly claims a diversity it lacks. Every invitation carries the seam that tells you which case yours is.",
      never:
        "Circles are never re-shuffled to chase a diversity score — people stay together, and only open seats get filled. The relationships are the point; the metric is only a proxy for them.",
      source:
        "lib/circles.ts over the clustering output; the composition rules and the honest fallback are design/v2/04 §2.",
    },
    {
      id: "elicit-before-expose",
      group: "routing",
      name: "Why you don't see the numbers until you've spoken",
      plain:
        "No surface shows you the group's shape on a topic before you have voiced your own take on it. This is deliberate withholding, and this page is where we disclose it: seeing the crowd first measurably bends what people then say — the herding effect — and your uninfluenced reading is exactly the contribution the group needs from you. The moment your reaction is in, the real spread appears. It was always going to be yours to see; it is sequenced, not hidden.",
      when: "On every statement you meet: your take first, then the distribution.",
      never:
        "The withholding never extends past your own contribution — after you react, nothing about the group's reception of that statement is kept from you.",
      source:
        "design/v2/03 §5 — the one place v2 re-sequences a v1 display rule, named and flagged for expert review.",
    },
    {
      id: "two-scale-k",
      group: "routing",
      name: "When the group gets counted — and when it refuses to",
      plain:
        'Anything phrased as "the group" — a distribution, a theme, a why-sentence — renders only when enough people stand behind it (the engine\'s k-threshold: five, today). Below that line, no counts render at all. Inside a circle the rule flips rather than fudges: a room of five is legible to itself, and blurred statistics at that size would be theater, so circle surfaces show no tallies and no splits whatsoever — only words people consented to share, with any "how this landed" phrasing computed from the wider community, never from a headcount of your room.',
      never:
        "No anonymous characterization of a group too small to hide you in — the protection is refusing the computation, not blurring its output.",
      source: "DEFAULT_K_THRESHOLD in lib/fut.ts; the two-scale rule is design/v2/03 §4.",
    },
    {
      id: "private-tap",
      group: "routing",
      name: 'The private "actually, I don\'t"',
      plain:
        "If the summary says \"we're circling agreement\" and you privately aren't, there is a quiet tap for that. It is engineered to be genuinely quiet: it never changes what your own circle sees, at any count — in a small room, even one visible ripple could give you away. Only when enough people across the whole community (the same k-threshold) have tapped the same statement does it move anything, and then only on community-wide surfaces, where the group is large enough to keep every tapper anonymous.",
      never:
        "It never renders as a tally, never enters your own circle's summary, and nothing anyone sees can reveal that you — or anyone — tapped.",
      source:
        "A separate signal store, folded in at community scale only, k-gated, by lib/digest.ts (design/v2/03 §4).",
    },

    // ── telling ─────────────────────────────────────────────────────────────
    {
      id: "living-summary",
      group: "telling",
      name: "The circle's living summary",
      plain:
        'The short "what this circle is figuring out" panel is assembled, not authored. Its themes come from what your circle actually said; its phrasing comes from computed reception — "circling agreement" and "where we genuinely differ" are verdicts the engine calculated from the community-wide data, and "still forming" literally means not enough has been said yet. It never means "agreement on the way".',
      never:
        'The "where we genuinely differ" section is never smoothed away — it is mandatory whenever disagreement is computed, and it renders with the same warmth as agreement. Disagreement here is the interesting part, not a failure state.',
      source:
        "lib/ranking.ts + lib/insights.ts (characterizeReception); one fixed verdict-to-phrasing map in the v2 surface (design/v2/03 §4).",
    },
    {
      id: "the-letter",
      group: "telling",
      name: "The monthly letter",
      plain:
        'Once a month, the notetaker writes the community a short letter: what emerged, where people genuinely differ — in their own words — what changed because people spoke, and one small invitation. Every synthesized line can be opened to the consented quotes it came from; nothing in it is the notetaker\'s own opinion, because it has none. Reading the letter is real participation: a one-tap "resonates" on a letter line feeds the same map as anything said in a circle.',
      never:
        "It never celebrates unanimity, never guilt-trips absence, and never arrives as a notification storm.",
      source:
        "lib/digest.ts — composition of engine outputs and consented quotes only, k-gated throughout (design/v2/03 §4).",
    },
    {
      id: "the-garden",
      group: "telling",
      name: "The garden — the ambient picture",
      plain:
        "The slow visual on the commons is the community's opinion map wearing no numbers: each part of the map is a bed, and each statement that rings true across beds is a bridge between them. It changes at the pace of a season, rewards a glance, and demands nothing. Tap a bridge and you get the statements it stands for, with their full reception — by then you are inspecting, not being led.",
      never:
        "No counts, no trends, no individual positions — yours included. A text description of the whole picture is always available.",
      source:
        "lib/projection.ts + lib/ranking.ts — the same data as the instrument map, rendered ambient (design/v2/02 §6).",
    },
    {
      id: "why-seams",
      group: "telling",
      name: 'The "why this?" on everything',
      plain:
        'Every machine-made object — a routed statement, an invitation, a summary line, a nudge — carries one quiet tap: "why this?". The answer is a restatement of the actual fields the engine used to make that object, not a story about a black box; the engine\'s determinism is what makes exactness possible. Every seam ends with a link to the matching section of this page.',
      never:
        'A seam never says more than the engine knows, and never says "trust us" — if a seam cannot state its reason from real fields, the mechanism behind it does not ship.',
      source: "The seam templates over engine fields (design/v2/03 §6 — the full table).",
    },

    // ── people ──────────────────────────────────────────────────────────────
    {
      id: "receptiveness-chips",
      group: "people",
      name: "The optional openers in your composer",
      plain:
        'When you are replying to someone across a mapped divide, your composer may offer optional opening phrases — "I get why you\'d…", "We both seem to want…". They are openers only: the machine never touches the substance of what you wrote. A chip is visibly a suggestion until you choose it, is never pre-inserted, and never auto-sends. Everyone has the same composer, and this page is where that mechanism is disclosed.',
      never:
        "The person reading your message sees exactly the same thing whether or not you used a chip, and nobody — them included — is told either way. The machine may scaffold how a person opens; it never speaks as them.",
      source:
        "Governed by covenant clause P6, the machine-suggested-speech clause (design/v2/01 §4); identical-render is fixture-pinned (design/v2/07 §5).",
    },
    {
      id: "experts",
      group: "people",
      name: "When an expert appears",
      plain:
        'Experts arrive late, summoned by the room\'s own recurring questions — never to open topics. They answer in the thread, in plain words, as options with trade-offs ("the cheap one floods in winter"), never as verdicts; asking, ranking, and voting simply do not exist on the expert\'s side of the surface. The "verified" chip renders exactly the strength of what was actually checked and names who checked it: an invited practitioner without an institutional credential is introduced as exactly that — invited by your stewards, their own name behind their experience.',
      when: "Only after a circle's question has stabilized, and only by steward invitation.",
      never:
        "An expert never sees your chat — only the circle's question and its consented summary. And a checkmark never renders stronger than its issuer.",
      source:
        "lib/trust.ts (fail-closed verification) + a reply-only expert role (design/v2/05 §2).",
    },
    {
      id: "action-nudge",
      group: "people",
      name: "The quiet nudge toward doing something",
      plain:
        'When a few people keep returning to the same idea and offer time or skill — "someone should…", "I could…" — the system may privately suggest one small, time-boxed first step to those two-to-four people, and nobody else. This is the most persuasion-shaped move unite makes, so it carries the strongest seam in the system: a "why me?" tap that shows the literal turns of yours that matched, each one linked. The detection is a plain, inspectable pattern scan — no model guessing at your intentions.',
      when: "Rarely, privately, and at most once per theme per person.",
      never:
        "Never a broadcast call-to-action, never a petition button, never public pledge counts. Saying no — or saying nothing — is final, invisible to everyone else, and never re-asked.",
      source:
        "lib/readiness.ts — a deterministic recurrence scan, no ML anywhere in it (design/v2/05 §3).",
    },

    // ── consent ─────────────────────────────────────────────────────────────
    {
      id: "consent-conversation",
      group: "consent",
      name: "Consent, asked when it matters",
      plain:
        "Nothing is asked at signup. The first time your words would travel further than where you said them — quoted in the circle's summary, included in the monthly letter, shown to an expert, entered into a signed report — you are asked at that moment, about that thing, in plain words. Your answer is written into your own pod as policy, and the machinery obeys it at every gate. One honesty line always accompanies the biggest step: once something is in a signed report, deleting your original will not unpublish the report — which is why your name only enters one if you say so, there and then.",
      never:
        'Consent moments are rare by design — context changes are rare — and a "no" is never re-asked as though it were a mistake.',
      source:
        "lib/consent.ts — ODRL policies in the author's pod, evaluated at every gate (design/v2/02 §7).",
    },
    {
      id: "the-notebook",
      group: "consent",
      name: "Your notebook — see it, fix it, delete it",
      plain:
        "One tap from anywhere: everything unite has heard from you. Your words and where each lives; what the machine took from them, in plain language; your reactions, each revisable; and where the map currently puts you — shown only to you. Every item is editable or deletable, and deleting is real: there is no server copy, so the next time anything is computed, a deleted item simply is not in it.",
      never:
        "The notebook never shows you a simplified précis of some fuller hidden record. It is the record.",
      source:
        "Your own pod, read directly; recompute-on-read is the architecture (design/v2/03 §7).",
    },
  ],

  residuals: {
    heading: "The honest residuals",
    intro:
      "Limits that disclosure does not dissolve. We name them anyway, because a page like this that only listed the reassuring parts would be advertising.",
    items: [
      {
        id: "gdpr",
        name: "This demo is not cleared for real people's political opinions",
        body: 'What unite works with — people\'s political opinions — is special-category data under GDPR (Article 9), and no architecture choice dissolves that. The demo sidesteps it honestly: its personas are fictional, and anything you type evaporates in your browser when you close the tab. A real deployment cannot sidestep it. It requires one explicit, recorded consent act at entry and a completed data-protection impact assessment before any pilot — and pods, for all they genuinely help with data minimization and real deletion, do not exempt the processing. We say "not GDPR-cleared for deployment" out loud rather than letting the warm welcome pass for a legal basis.',
      },
      {
        id: "diversity",
        name: '"Diverse" means across opinion clusters — and only that',
        body: "The engine can see exactly one kind of difference: how people read statements. It guarantees every circle spans that. It cannot see age, race, class, disability, or who never walked in the door — and it refuses to collect protected attributes in order to try. Making a room look like its community is a human recruiting job, named as such in the pilot plan, and nothing downstream ever claims a representativeness the intake cannot deliver.",
      },
      {
        id: "demo-scribe",
        name: "The demo's listener is a template, not a mind",
        body: "The mirrors in this demo come from a small deterministic template, and it will sometimes read you clumsily. The fix button is doing the work a subtler listener would — and a graceful correction is itself most of what feeling heard is made of. The ceiling belongs to the demo, not the design: the drafter sits behind a seam a live community would fill with its own chosen helper, recorded on every draft. We would rather show you an honest template than fake a mind.",
      },
      {
        id: "signed-artifacts",
        name: "Deleting your original does not unpublish a signed report",
        body: "Deletion propagates through everything unite recomputes — which is everything live. The one exception is an artifact a community already signed and published: it recorded consent as it stood at signing, and unsigning the past is not in anyone's power. That is why the consent ask before any signed artifact carries this exact sentence, before your words enter one — never discovered after.",
      },
      {
        id: "circle-legibility",
        name: "Your circle reads your words",
        body: "A circle is four to six people. What you say there, they see, with your name on it — that is what a circle is for, and no privacy mathematics can make five people un-know who said what. unite's guarantees begin at the circle's edge: nothing leaves it attributed to you without your consent, and no anonymous statistics are ever computed over a room too small to hide you in.",
      },
      {
        id: "wont-check",
        name: "Most people will never read this page",
        body: "We know. One warm handshake plus a page nobody is forced through is not the same as everyone understanding the machinery. Two things are true at once: the system re-teaches what it is through ordinary use — the mirror shows you its inference itself, the notebook shows you the whole record in your own words — and the machinery a passive participant never consciously meets decides only the order in which things reach them, never what is said or who said it. Whether that is enough is a fair question, and one we expect reviewers to keep asking us.",
      },
    ],
  },

  contest: {
    heading: "If we got you wrong",
    paragraphs: [
      "Correcting unite is not a support ticket. Everything the engine believes about you is either a resource in your pod or recomputed live from those resources — so your notebook is the control surface, not a complaints form. Edit the note and the record is the edit; revise the reaction and the map moves; delete the item and the next computation simply no longer contains it.",
      "That includes where the map puts you: \"that's not me\" links straight to the reactions that produced your position, each one revisable. Contesting the inference is editing the engine's actual input — there is no shadow copy your correction fails to reach.",
    ],
  },

  instruments: {
    heading: "The instruments, undressed",
    body: "Everything above is also visible the way unite's first surface showed it — as instruments, numbers on display. Those views still exist, unchanged, reading the same engine state as the warm surface; hiding them would fail the rule this page is built on. If the two ever disagree, that is a bug we want reported loudly.",
    links: [
      {
        label: "The needs board",
        route: "#/board",
        note: "Every statement with its bridging rank and full per-cluster reception.",
      },
      {
        label: "The opinion map",
        route: "#/bridge",
        note: "The clusters and bridges the garden renders ambiently — with the numbers on.",
      },
      {
        label: "The convergence room",
        route: "#/room",
        note: "Candidate statements, critique rounds, and computed reception — the letter's slow loop, as machinery.",
      },
      {
        label: "The resonance deck",
        route: "#/deck",
        note: "The router dealt as cards — the same routing that picks your conversational beats.",
      },
      {
        label: "Published futures",
        route: "#/published-futures",
        note: "The signed artifacts, dissent annex first-class, exactly as they leave the community.",
      },
    ],
  },
};
