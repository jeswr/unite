// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// BL.1 cross-pod channel aggregator — the structural sibling of aggregate.test.ts.
// The membership gate is enforced HERE; cross-pod authorship is verified (a pod
// cannot stuff a thread/message as someone else, and an agent turn cannot claim a
// human author); the message feed is edit-folded ORDER-INDEPENDENTLY (a newest-first
// read cannot overwrite a newer edit); a hostile/broken/out-of-scope source degrades
// that source alone. Fixtures round-trip through the REAL shared-suite serialisers
// (`@jeswr/solid-task-model`, `@jeswr/solid-chat-interop`) so the parse contract is
// exactly what a producing app writes; adversarial cases surgically inject the one
// hostile value into an otherwise-valid document.

import type { CanonicalMessage, TaskState } from "@jeswr/solid-chat-interop";
import { as2MessageSubject, serializeAs2 } from "@jeswr/solid-chat-interop";
import type { TaskData } from "@jeswr/solid-task-model/task";
import { serializeTask } from "@jeswr/solid-task-model/task";
import { serializeTracker, trackerSubject } from "@jeswr/solid-task-model/tracker";
import { describe, expect, it } from "vitest";
import {
  aggregateChannel,
  BUILD_MESSAGES_DIR,
  BUILD_THREADS_DIR,
  type ChannelResult,
} from "./channel.js";
import {
  type MembershipResult,
  type MembershipVerifier,
  StubMembershipVerifier,
} from "./membership.js";
import { StaticRegistry } from "./registry.js";

const CHANNEL = "https://community.example/build/chan-a";
const CHANNEL_SUBJECT = trackerSubject(CHANNEL); // https://community.example/build/chan-a#this
const OTHER_CHANNEL_SUBJECT = "https://community.example/build/chan-b#this";

const ALICE = "https://alice.example/profile#me";
const BOB = "https://bob.example/profile#me";
const AGENT = "https://agent.example/card#bot";
const ALICE_BASE = "https://alice.example/u/chan-a/";
const BOB_BASE = "https://bob.example/u/chan-a/";
const AGENT_BASE = "https://agent.example/u/chan-a/";

const LDP = "@prefix ldp: <http://www.w3.org/ns/ldp#> .";
function containerTtl(url: string, members: string[]): string {
  const contains = members.map((m) => `<${m}>`).join(", ");
  return `${LDP}\n<${url}> a ldp:Container, ldp:BasicContainer ${
    members.length ? `; ldp:contains ${contains}` : ""
  } .`;
}

const threadUrl = (base: string, name: string) => `${base}${BUILD_THREADS_DIR}/${name}.ttl`;
const messageUrl = (base: string, name: string) => `${base}${BUILD_MESSAGES_DIR}/${name}.ttl`;
/** The `as:context`/`wf:tracker`-style subject a message's `room` names for a thread. */
const threadSubject = (base: string, name: string) => `${threadUrl(base, name)}#it`;

type ThreadSpec = { name: string; task: Partial<TaskData> & { title: string; state: TaskState } };
type MsgSpec = {
  name: string;
  msg: Omit<CanonicalMessage, "mediaType"> & { mediaType?: string };
  /** Surgically transform the serialised turtle to inject one hostile value. */
  mutate?: (ttl: string) => string;
};
interface PodSpec {
  base: string;
  threads?: ThreadSpec[];
  messages?: MsgSpec[];
  rawThreads?: { name: string; ttl: string }[];
  rawMessages?: { name: string; ttl: string }[];
  /** Container members that are NOT real resources (SSRF / out-of-scope refs). */
  extraThreadMembers?: string[];
  extraMessageMembers?: string[];
}

/** Assemble an in-memory url→turtle pod from participant specs (real serialisers). */
async function podFrom(
  specs: PodSpec[],
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const pod: Record<string, string> = { ...extra };
  for (const s of specs) {
    // Threads container + members.
    const threadMembers: string[] = [];
    for (const t of s.threads ?? []) {
      const url = threadUrl(s.base, t.name);
      threadMembers.push(url);
      pod[url] = await serializeTask(url, { creator: ALICE, project: CHANNEL_SUBJECT, ...t.task });
    }
    for (const t of s.rawThreads ?? []) {
      const url = threadUrl(s.base, t.name);
      threadMembers.push(url);
      pod[url] = t.ttl;
    }
    threadMembers.push(...(s.extraThreadMembers ?? []));
    pod[`${s.base}${BUILD_THREADS_DIR}/`] = containerTtl(
      `${s.base}${BUILD_THREADS_DIR}/`,
      threadMembers,
    );

    // Messages container + members.
    const msgMembers: string[] = [];
    for (const m of s.messages ?? []) {
      const url = messageUrl(s.base, m.name);
      msgMembers.push(url);
      let ttl = await serializeAs2(
        { mediaType: "text/plain", ...m.msg } as CanonicalMessage,
        as2MessageSubject(url),
      );
      if (m.mutate) ttl = m.mutate(ttl);
      pod[url] = ttl;
    }
    for (const m of s.rawMessages ?? []) {
      const url = messageUrl(s.base, m.name);
      msgMembers.push(url);
      pod[url] = m.ttl;
    }
    msgMembers.push(...(s.extraMessageMembers ?? []));
    pod[`${s.base}${BUILD_MESSAGES_DIR}/`] = containerTtl(
      `${s.base}${BUILD_MESSAGES_DIR}/`,
      msgMembers,
    );
  }
  return pod;
}

/** A fake fetch over an in-memory url→turtle pod (missing → 404). */
function podFetch(pod: Record<string, string>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = pod[url];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(body, { status: 200, headers: { "content-type": "text/turtle" } });
  }) as unknown as typeof fetch;
}

const trackerDoc = () => serializeTracker(CHANNEL, { title: "Build Channel A" });
const registryOf = (parts: { webId: string; base: string }[]) => new StaticRegistry(CHANNEL, parts);

const run = (opts: {
  pod: Record<string, string>;
  parts: { webId: string; base: string }[];
  vouched: string[];
  fetch?: typeof fetch;
  maxBodyBytes?: number;
}): Promise<ChannelResult> =>
  aggregateChannel({
    channel: CHANNEL,
    registry: registryOf(opts.parts),
    verifier: new StubMembershipVerifier(opts.vouched),
    fetch: opts.fetch ?? podFetch(opts.pod),
    ...(opts.maxBodyBytes !== undefined ? { maxBodyBytes: opts.maxBodyBytes } : {}),
  });

describe("aggregateChannel", () => {
  it("aggregates the tracker + threads + cross-pod messages into an ordered timeline", async () => {
    const t1 = threadSubject(ALICE_BASE, "t1");
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "t1", task: { title: "Feature X", state: "open", creator: ALICE } }],
          messages: [
            {
              name: "m1",
              msg: {
                content: "kick off",
                author: ALICE,
                room: t1,
                published: "2026-07-01T09:00:00Z",
              },
            },
          ],
        },
        {
          base: BOB_BASE,
          messages: [
            {
              name: "m1",
              msg: { content: "on it", author: BOB, room: t1, published: "2026-07-01T10:00:00Z" },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [
        { webId: ALICE, base: ALICE_BASE },
        { webId: BOB, base: BOB_BASE },
      ],
      vouched: [ALICE, BOB],
    });

    expect(result.tracker?.title).toBe("Build Channel A");
    expect(result.threads.map((t) => t.id)).toEqual([t1]);
    expect(result.timeline.map((m) => m.message.content)).toEqual(["kick off", "on it"]); // oldest→newest
    expect(result.timeline.map((m) => m.author)).toEqual([ALICE, BOB]);
    expect(result.threads[0]?.messages.map((m) => m.message.content)).toEqual([
      "kick off",
      "on it",
    ]);
    expect(result.participants.map((p) => p.webId).sort()).toEqual([ALICE, BOB].sort());
    expect(result.errors).toEqual([]);
    expect(result.unverified).toEqual([]);
  });

  it("EXCLUDES an unverified participant's threads + messages (the gate)", async () => {
    const t1 = threadSubject(ALICE_BASE, "t1");
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: ALICE } }],
          messages: [
            {
              name: "m1",
              msg: { content: "hi", author: ALICE, room: t1, published: "2026-07-01T09:00:00Z" },
            },
          ],
        },
        {
          base: BOB_BASE,
          messages: [
            {
              name: "m1",
              msg: { content: "sneaky", author: BOB, room: t1, published: "2026-07-01T10:00:00Z" },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [
        { webId: ALICE, base: ALICE_BASE },
        { webId: BOB, base: BOB_BASE },
      ],
      vouched: [ALICE],
    });
    expect(result.timeline.map((m) => m.message.content)).toEqual(["hi"]);
    expect(result.unverified).toEqual([
      { webId: BOB, reason: expect.stringContaining("dev stub") },
    ]);
  });

  it("drops a thread whose creator ≠ the pod owner (anti-spoof)", async () => {
    // Alice's pod hosts a task CLAIMING creator = BOB — must be dropped.
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "spoof", task: { title: "X", state: "open", creator: BOB } }],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
    });
    expect(result.threads).toEqual([]);
  });

  it("drops a thread that does not name this channel (wrong wf:tracker)", async () => {
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [
            {
              name: "t1",
              task: { title: "X", state: "open", creator: ALICE, project: OTHER_CHANNEL_SUBJECT },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
    });
    expect(result.threads).toEqual([]);
  });

  it("drops a message whose author ≠ the pod owner (anti-spoof)", async () => {
    const t1 = threadSubject(ALICE_BASE, "t1");
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: ALICE } }],
          // Alice's pod hosts a message claiming author = BOB.
          messages: [
            {
              name: "m1",
              msg: { content: "forged", author: BOB, room: t1, published: "2026-07-01T09:00:00Z" },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
    });
    expect(result.timeline).toEqual([]);
  });

  it("keeps a legit AGENT message (PROV attribution) but DROPS an agent turn that also claims a human author", async () => {
    const t1 = threadSubject(AGENT_BASE, "t1");
    const pod = await podFrom(
      [
        {
          base: AGENT_BASE,
          threads: [{ name: "t1", task: { title: "Build it", state: "open", creator: AGENT } }],
          messages: [
            // legit agent turn: attributed to the AGENT (the pod owner), no human author.
            {
              name: "ok",
              msg: {
                content: "PR opened",
                provenance: { attributedTo: AGENT },
                room: t1,
                published: "2026-07-01T09:00:00Z",
              },
            },
            // spoof: an agent turn ALSO claiming a human author (owner) — agents never post as humans.
            {
              name: "spoof",
              msg: {
                content: "trust me",
                author: AGENT,
                provenance: { attributedTo: "https://other.example/#x" },
                room: t1,
                published: "2026-07-01T10:00:00Z",
              },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: AGENT, base: AGENT_BASE }],
      vouched: [AGENT],
    });
    expect(result.timeline.map((m) => m.message.content)).toEqual(["PR opened"]);
    expect(result.timeline[0]?.isAgent).toBe(true);
  });

  it("a malformed message literal DROPS THE FIELD, never aborts the fold", async () => {
    const t1 = threadSubject(ALICE_BASE, "t1");
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: ALICE } }],
          messages: [
            {
              name: "m1",
              msg: {
                content: "still here",
                author: ALICE,
                room: t1,
                published: "2026-07-01T09:00:00Z",
              },
              // corrupt the xsd:dateTime literal — the package drops `published`, keeps the message.
              mutate: (ttl) => ttl.replace(/as:published "[^"]*"/, 'as:published "not-a-date"'),
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
    });
    expect(result.timeline.map((m) => m.message.content)).toEqual(["still here"]);
    expect(result.timeline[0]?.published).toBeUndefined(); // field dropped, not fatal
    expect(result.errors).toEqual([]);
  });

  it("a non-http(s) author IRI is filtered → the message is fail-closed dropped", async () => {
    const t1 = threadSubject(ALICE_BASE, "t1");
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: ALICE } }],
          messages: [
            {
              name: "m1",
              msg: { content: "xss?", author: ALICE, room: t1, published: "2026-07-01T09:00:00Z" },
              // replace the sole authoring IRI with a hostile non-http(s) scheme.
              mutate: (ttl) => ttl.replace(`<${ALICE}>`, "<javascript:alert(1)>"),
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
    });
    expect(result.timeline).toEqual([]); // author dropped by parser → no owner assertion → dropped
  });

  it("SSRF: skips a container member outside the participant's base, never fetches it", async () => {
    const t1 = threadSubject(ALICE_BASE, "t1");
    const evil = "https://evil.example/internal/secret.ttl";
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: ALICE } }],
          messages: [
            {
              name: "good",
              msg: {
                content: "in scope",
                author: ALICE,
                room: t1,
                published: "2026-07-01T09:00:00Z",
              },
            },
          ],
          extraMessageMembers: [evil],
        },
      ],
      {
        [CHANNEL]: await trackerDoc(),
        // even if evil served a matching message it must never be fetched:
        [evil]: await serializeAs2(
          {
            content: "exfil",
            mediaType: "text/plain",
            author: ALICE,
            room: t1,
          } as CanonicalMessage,
          as2MessageSubject(evil),
        ),
      },
    );
    const fetched: string[] = [];
    const base = podFetch(pod);
    const spy = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetched.push(typeof input === "string" ? input : input.toString());
      return base(input as string, init);
    }) as unknown as typeof fetch;
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
      fetch: spy,
    });
    expect(result.timeline.map((m) => m.message.content)).toEqual(["in scope"]);
    expect(fetched).not.toContain(evil);
    expect(result.errors.some((e) => e.resource === evil && e.stage === "messages")).toBe(true);
  });

  it("records a per-source error for a malformed container, still aggregating others", async () => {
    const t1 = threadSubject(BOB_BASE, "t1");
    const pod = await podFrom(
      [
        {
          base: BOB_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: BOB } }],
          messages: [
            {
              name: "m1",
              msg: { content: "ok", author: BOB, room: t1, published: "2026-07-01T09:00:00Z" },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    // Break Alice's messages container listing.
    pod[`${ALICE_BASE}${BUILD_MESSAGES_DIR}/`] = "@@@ not turtle @@@";
    pod[`${ALICE_BASE}${BUILD_THREADS_DIR}/`] = containerTtl(
      `${ALICE_BASE}${BUILD_THREADS_DIR}/`,
      [],
    );
    const result = await run({
      pod,
      parts: [
        { webId: ALICE, base: ALICE_BASE },
        { webId: BOB, base: BOB_BASE },
      ],
      vouched: [ALICE, BOB],
    });
    expect(result.timeline.map((m) => m.message.content)).toEqual(["ok"]); // bob survives
    expect(result.errors.some((e) => e.webId === ALICE && e.stage === "messages")).toBe(true);
  });

  it("isolates ONE bad member: keeps the valid sibling, records the bad one", async () => {
    const t1 = threadSubject(ALICE_BASE, "t1");
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: ALICE } }],
          messages: [
            {
              name: "good",
              msg: { content: "good", author: ALICE, room: t1, published: "2026-07-01T09:00:00Z" },
            },
          ],
          rawMessages: [{ name: "bad", ttl: "@@@ not turtle @@@" }],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
    });
    expect(result.timeline.map((m) => m.message.content)).toEqual(["good"]);
    expect(
      result.errors.some(
        (e) => e.resource === messageUrl(ALICE_BASE, "bad") && e.stage === "messages",
      ),
    ).toBe(true);
  });

  it("records a per-source error for an oversize resource body", async () => {
    const t1 = threadSubject(ALICE_BASE, "t1");
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: ALICE } }],
          messages: [
            {
              name: "big",
              msg: {
                content: "x".repeat(500),
                author: ALICE,
                room: t1,
                published: "2026-07-01T09:00:00Z",
              },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
      maxBodyBytes: 80,
    });
    expect(result.timeline).toEqual([]);
    expect(result.errors.some((e) => e.stage === "messages")).toBe(true);
  });

  it("deterministic edit-fold: a newest-first read cannot overwrite a newer edit (supersede)", async () => {
    const t1 = threadSubject(ALICE_BASE, "t1");
    const m2sub = as2MessageSubject(messageUrl(ALICE_BASE, "m2"));
    // m1 is superseded BY m2 (the edit). Build both, then run with BOTH container
    // orderings and assert the same result — folding is order-independent.
    const build = async (order: "old-first" | "new-first") =>
      podFrom(
        [
          {
            base: ALICE_BASE,
            threads: [{ name: "t1", task: { title: "X", state: "open", creator: ALICE } }],
            messages:
              order === "old-first"
                ? [
                    {
                      name: "m1",
                      msg: {
                        content: "helo",
                        author: ALICE,
                        room: t1,
                        replacedBy: m2sub,
                        published: "2026-07-01T09:00:00Z",
                      },
                    },
                    {
                      name: "m2",
                      msg: {
                        content: "hello (edited)",
                        author: ALICE,
                        room: t1,
                        published: "2026-07-01T09:05:00Z",
                      },
                    },
                  ]
                : [
                    {
                      name: "m2",
                      msg: {
                        content: "hello (edited)",
                        author: ALICE,
                        room: t1,
                        published: "2026-07-01T09:05:00Z",
                      },
                    },
                    {
                      name: "m1",
                      msg: {
                        content: "helo",
                        author: ALICE,
                        room: t1,
                        replacedBy: m2sub,
                        published: "2026-07-01T09:00:00Z",
                      },
                    },
                  ],
          },
        ],
        { [CHANNEL]: await trackerDoc() },
      );
    for (const order of ["old-first", "new-first"] as const) {
      const result = await run({
        pod: await build(order),
        parts: [{ webId: ALICE, base: ALICE_BASE }],
        vouched: [ALICE],
      });
      expect(result.timeline.map((m) => m.message.content)).toEqual(["hello (edited)"]);
    }
  });

  it("excludes a tombstoned (schema:dateDeleted) message from the timeline", async () => {
    const t1 = threadSubject(ALICE_BASE, "t1");
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: ALICE } }],
          messages: [
            {
              name: "live",
              msg: { content: "live", author: ALICE, room: t1, published: "2026-07-01T09:00:00Z" },
            },
            {
              name: "gone",
              msg: {
                content: "gone",
                author: ALICE,
                room: t1,
                published: "2026-07-01T10:00:00Z",
                deletedAt: "2026-07-01T11:00:00Z",
              },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
    });
    expect(result.timeline.map((m) => m.message.content)).toEqual(["live"]);
  });

  it("a HIDDEN (tombstoned) replacement does NOT erase the still-valid original", async () => {
    // m1 is replacedBy m2, but m2 is itself tombstoned → not eligible, so it must
    // never hide m1 (the roborev Medium: supersession only by a SURVIVING replacement).
    const t1 = threadSubject(ALICE_BASE, "t1");
    const m2sub = as2MessageSubject(messageUrl(ALICE_BASE, "m2"));
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: ALICE } }],
          messages: [
            {
              name: "m1",
              msg: {
                content: "original",
                author: ALICE,
                room: t1,
                replacedBy: m2sub,
                published: "2026-07-01T09:00:00Z",
              },
            },
            {
              name: "m2",
              msg: {
                content: "edit",
                author: ALICE,
                room: t1,
                published: "2026-07-01T09:05:00Z",
                deletedAt: "2026-07-01T09:06:00Z",
              },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
    });
    expect(result.timeline.map((m) => m.message.content)).toEqual(["original"]);
  });

  it("an ORPHAN-room replacement does NOT erase the original either", async () => {
    // m1 (in-thread) replacedBy m2, but m2's room is out-of-channel → m2 excluded,
    // so m1 must still stand rather than both vanishing.
    const t1 = threadSubject(ALICE_BASE, "t1");
    const m2sub = as2MessageSubject(messageUrl(ALICE_BASE, "m2"));
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: ALICE } }],
          messages: [
            {
              name: "m1",
              msg: {
                content: "original",
                author: ALICE,
                room: t1,
                replacedBy: m2sub,
                published: "2026-07-01T09:00:00Z",
              },
            },
            {
              name: "m2",
              msg: {
                content: "edit",
                author: ALICE,
                room: "https://elsewhere.example/thread#it",
                published: "2026-07-01T09:05:00Z",
              },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
    });
    expect(result.timeline.map((m) => m.message.content)).toEqual(["original"]);
  });

  it("rejects a message asserting BOTH a human author AND an agent attribution (even both = owner)", async () => {
    // The forbidden both-set shape (roborev Low): a message is a human note XOR an
    // agent turn, never both — dropped even when both name the pod owner.
    const t1 = threadSubject(AGENT_BASE, "t1");
    const pod = await podFrom(
      [
        {
          base: AGENT_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: AGENT } }],
          messages: [
            {
              name: "m1",
              msg: {
                content: "both",
                author: AGENT,
                provenance: { attributedTo: AGENT },
                room: t1,
                published: "2026-07-01T09:00:00Z",
              },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: AGENT, base: AGENT_BASE }],
      vouched: [AGENT],
    });
    expect(result.timeline).toEqual([]);
  });

  it("drops an orphan message whose room is neither the channel nor a known thread", async () => {
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          threads: [{ name: "t1", task: { title: "X", state: "open", creator: ALICE } }],
          messages: [
            {
              name: "m1",
              msg: {
                content: "orphan",
                author: ALICE,
                room: "https://elsewhere.example/thread#it",
                published: "2026-07-01T09:00:00Z",
              },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
    });
    expect(result.timeline).toEqual([]);
  });

  it("keeps a channel-root message (room = the tracker subject) in the timeline", async () => {
    const pod = await podFrom(
      [
        {
          base: ALICE_BASE,
          messages: [
            {
              name: "m1",
              msg: {
                content: "welcome to the channel",
                author: ALICE,
                room: CHANNEL_SUBJECT,
                published: "2026-07-01T09:00:00Z",
              },
            },
          ],
        },
      ],
      { [CHANNEL]: await trackerDoc() },
    );
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
    });
    expect(result.timeline.map((m) => m.message.content)).toEqual(["welcome to the channel"]);
    expect(result.threads).toEqual([]); // a channel-root message attaches to no thread
  });

  it("empty / missing channel → empty timeline, not an error", async () => {
    // No tracker doc, empty containers.
    const pod = await podFrom([{ base: ALICE_BASE }], {});
    const result = await run({
      pod,
      parts: [{ webId: ALICE, base: ALICE_BASE }],
      vouched: [ALICE],
    });
    expect(result.tracker).toBeUndefined();
    expect(result.threads).toEqual([]);
    expect(result.timeline).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("empty registry → empty result, no throw", async () => {
    const result = await run({ pod: {}, parts: [], vouched: [] });
    expect(result.timeline).toEqual([]);
    expect(result.participants).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("propagates a verifier throw as a membership source error", async () => {
    const throwing: MembershipVerifier = {
      verify(): Promise<MembershipResult> {
        return Promise.reject(new Error("verifier down"));
      },
    };
    const result = await aggregateChannel({
      channel: CHANNEL,
      registry: registryOf([{ webId: ALICE, base: ALICE_BASE }]),
      verifier: throwing,
      fetch: podFetch({ [CHANNEL]: await trackerDoc() }),
    });
    expect(result.errors[0]?.stage).toBe("membership");
    expect(result.timeline).toEqual([]);
  });

  it("records a channel error for a non-http(s) channel IRI, never fetching it", async () => {
    const fetched: string[] = [];
    const spy = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      fetched.push(url);
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;
    const result = await aggregateChannel({
      channel: "urn:not-a-web-iri",
      registry: new StaticRegistry("https://community.example/build/chan-a", []),
      verifier: new StubMembershipVerifier([]),
      fetch: spy,
    });
    expect(result.tracker).toBeUndefined();
    expect(result.errors.some((e) => e.stage === "channel")).toBe(true);
    expect(fetched).toEqual([]); // no fetch of a non-http(s) target
  });
});
