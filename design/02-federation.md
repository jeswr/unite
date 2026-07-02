<!-- AUTHORED-BY Claude Fable 5 (PSS design agent) -->

# 02 — Federation architecture: no component is a point of control

unite is not an application; it is a **data-model federation** in the sense
the @jeswr suite already builds for Solid apps: independent parties agree on
*data contracts* (the `fut:` sector + a thin protocol profile), and everything
else — code, hosting, identity, curation — is plural by construction. This doc
defines the moving parts and then audits, function by function, why none of
them can capture the system.

## 1. The parties

| Party | What it is | How many |
|---|---|---|
| **Person** | A WebID + a pod. Owns their statements and resonances. | millions, any Solid-OIDC issuer + any pod provider |
| **Community** | A *deliberation space*: a `fedreg:Registry`, an LDN inbox, a live index (cache), and facilitation services. Anyone can stand one up. | unbounded; a person joins many |
| **Client** | Any app implementing the unite profile, self-described via `fedapp:` in its Client Identifier Document. | ≥2 independent codebases is a Stage-1 **exit criterion** |
| **Facilitation service** | Opinion-space mapping, bridging ranking, synthesis mediation (GenAI or human) run *for a community, by that community's choice*. | per community, swappable |
| **Steward circle** | Governs the spec text (04) — NOT the network. | one circle, capped composition, forkable |

There is deliberately **no "unite server"**. A community is a set of
conventional Solid resources (registry document, inbox container, index
container) hostable on any pod/LDP server — including a plain
prod-solid-server pod. Facilitation services are clients with a service
account, not privileged infrastructure.

## 2. Where data lives (sovereignty)

- **Statements and resonances live in their author's pod** under WAC/ACP
  (01 §Access-control tiers). Deleting your statement deletes the source of
  truth; ODRL policies (01) govern what derived artifacts may persist.
- **Community indexes are caches, never authoritative** — the same
  architectural invariant as prod-solid-server's "the cache is never
  authoritative": an index entry is a pointer + snapshot ETag; consumers
  re-resolve to the pod for the current text, and an index that lies is
  detectable (the pod is the check). A community that dies loses nothing but
  its own syntheses; participants' data survives in their pods.
- **Convergence artifacts (`fut:SharedFuture`) live in the community's space**,
  signed (Data Integrity) and replicated freely — they are meant to be copied,
  cited, and carried into other communities; the signature, not the location,
  carries their authority.

## 3. Discovery and membership (the fedreg pattern, applied to communities)

Exactly the two-layer split the suite's federation stack already enforces:

- **Self-assertion** (`fedapp:`): a client app publishes the sectors it
  operates in (`fedapp:sector <…/sectors/futures#sector>`), the access modes
  it requests, and the shapes it consumes/produces — readable *before* a user
  or community grants anything. Never trusted as membership.
- **Registry assertion** (`fedreg:`): a community's `fedreg:Registry` lists
  member **apps** and — new in the unite profile — member **peer communities**
  and **facilitation services**, each via `fedreg:Membership` (status
  Proposed/Active/Suspended/Revoked, `assertedBy`, timestamp). Suspension/
  revocation is the community's recovery lever against a misbehaving client or
  service.
- **Signed membership** ([federation-trust](https://github.com/jeswr/federation-trust)):
  memberships that matter across trust boundaries (a peer community, a
  facilitation service handling personal data) are backed by
  `fedtrust:MembershipCredential` VCs, verified against **trust anchors each
  community chooses for itself**. There is no global anchor set.
- **Spec-version negotiation** (`fedreg:StorageDescription` /
  `fedreg:acceptsSpec`): communities and clients advertise which immutable
  `fut:` spec versions they accept, giving the whole network **asynchronous
  schema migration** — the mechanism that makes both spec evolution *and*
  forks survivable (04).

**Bootstrapping without a root:** there is no registry-of-all-registries.
Discovery composes: (a) communities list peer communities they vouch for
(`fedreg:Membership` on a community, forming a browsable web), (b) any number
of parties may publish curated community lists (which are just registries —
plural, competing), (c) links travel socially (a community IRI is a URL).
This mirrors how the fediverse actually bootstraps, minus the flagship-
instance centralisation — because a person's data and identity are **not held
by the community** (they're in the pod), the largest community holds no
gravitational lock-in (see §6, "exit costs").

## 4. Propagation (how an idea travels without a central server)

1. Author creates a statement in their own pod (tier: community/federated).
2. Author's client POSTs an `as:Announce` (LDN) to each chosen community's
   inbox — the suite's existing cross-app announcement pattern (tm:).
3. The community's indexer verifies the announce (fetches the pod resource,
   checks the author's WAC actually exposes it, evaluates its ODRL policy),
   then indexes the pointer.
4. Subscribers receive Solid Notifications (WebSocketChannel2023) from the
   index container; clients hydrate from pods.
5. Cross-community spread = the author (or, with `fut:aggregate` consent, the
   community) announces to peer communities. Syntheses spread by copying the
   signed artifact.
6. **Stage 2 — fediverse bridge:** a community MAY run an ActivityPub bridge
   service (an ordinary facilitation service) mirroring announces to/from
   Mastodon-compatible servers: `fut:Claim` → `as:Note` with a link back to
   the pod resource; inbound AP objects become *unadopted* candidate
   statements a person may claim into their pod. The bridge is per-community,
   optional, and replaceable — the AP network is a **transport**, never the
   source of truth.

## 5. Identity, pseudonymity, and personhood tiers

WebID login (Solid-OIDC + DPoP) throughout. Three participation tiers,
because G3 (honest expression) and G4 (sybil resistance) genuinely conflict
and the resolution is *transparency about tier composition*, not forcing one
trade on everyone:

| Tier | Mechanism | What it's worth |
|---|---|---|
| **T0 pseudonymous** | any WebID; or a secondary pseudonymous WebID whose link to the primary never leaves the person's pod (01 tier 4) | full expression + resonance rights; counted separately in metrics |
| **T1 community-vouched** | ≥ n existing members vouch (a `fedtrust` VC, web-of-trust) | default weighting in convergence math |
| **T2 personhood-verified** | a **unique-personhood credential** — a VC asserting "one human, not previously enrolled in this deliberation" *without revealing identity*: the [@jeswr/solid-vc](https://github.com/jeswr/solid-vc) pluggable proof-suite seam is exactly where a ZK personhood proof (the SPARQ ZK track) plugs in; interim: community-run verification ceremonies | required for Stage-3-bound deliberations; metrics report per-tier |

Every `fut:ConvergenceMetrics` publication reports participation **by tier**,
and syntheses destined for governance use (Stage 3) MUST be computed over
T1+/T2 cohorts with the T0 cohort shown alongside, never silently mixed —
the anti-astroturfing posture (critique C3) is *stratify and disclose*, not
*exclude*.

## 6. The capture audit — function by function

The non-negotiable is that neither a codebase nor a standards owner (nor
anything else) is a single point of control. Audit:

| Function | Would-be captor | Why capture fails |
|---|---|---|
| **Code** | a dominant client vendor | data contract is the spec, not the app; `fedapp:` self-description + ≥2-implementation exit criterion + pods mean users switch clients without moving data |
| **Standards** | a spec owner (incl. this repo's author) | 04: immutable spec versions; change is **adoption-ratified** (≥2 independent implementations + ≥2 registries), not decree-ratified; CC-BY forkable text; `fedreg:acceptsSpec` lets forks coexist on the wire |
| **Identity** | an IdP | any Solid-OIDC issuer; issuer-agnostic verification is already the suite's auth invariant |
| **Storage** | a pod host | pods are portable; statements are plain LDP resources |
| **Community/curation** | a flagship community | communities hold indexes (caches) + syntheses, not people's data; exit = stop announcing there; peer-vouching web means no community controls discovery |
| **Facilitation/AI** | a synthesis-model vendor | mediation is attributed (PROV `hadPlan`), per-community swappable, and **advisory**: a synthesis has zero standing until it wins cross-cluster human endorsement (03 §5). Multiple-model and human-mediated paths are conformance-required options (critique C7 forced this from SHOULD to MUST) |
| **Moderation** | a global moderator | none exists; each community moderates its own index (it can decline to index), but cannot delete the pod resource or bar it from other communities |
| **Money/ops** | whoever funds hosting | a community is static-file-grade infrastructure (registry + inbox + index on any pod); facilitation compute is the only real cost and is per-community |

**Exit costs as the metric of decentralisation.** The design's test for every
future feature: *what does a person, a community, or an implementer lose by
leaving?* If the answer ever becomes "their data", "their identity", "their
history", or "the network", the feature is wrong. Today's answers: a person
leaving a community loses nothing but that community's audience; a community
leaving the federation keeps all its artifacts; an implementer forking the
spec keeps wire-compatibility for every version both sides advertise.

## 7. Protocol profile (what a conformant implementation must do)

A short normative list (the Stage-1 conformance fixture set, 05 §6):

1. Read/write `fut:` resources per the SHACL profile; Turtle + JSON-LD.
2. Solid-OIDC + DPoP auth; WAC/ACP respected end-to-end.
3. LDN `as:Announce` for propagation; WebSocketChannel2023 subscriptions.
4. `fedapp:` self-description published in the Client Identifier Document.
5. Verify community membership via `fedreg:` (+ `fedtrust:` where present);
   never trust self-assertion as membership.
6. Evaluate ODRL use-policies before any aggregation/synthesis/export;
   enforce k-anonymity thresholds.
7. Advertise + honour `fedreg:acceptsSpec` versions.
8. Render `fut:SharedFuture` ONLY with its dissent annex and bridging
   evidence; verify its Data Integrity proof.
