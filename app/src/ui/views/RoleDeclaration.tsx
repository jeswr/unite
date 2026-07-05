// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The S3.5 role-declaration control (docs/design/next-phases.md §1.3(a)/§1.5
// (5)): a scope-B participant DECLARES implementer / operator / participant
// standing and this control VERIFIES it against the public federation web by
// invoking the LANDED lib/roles.ts — fail-closed to fut:ParticipantRole on
// anything unverifiable, with the lib's reason shown VERBATIM. A verified role
// is a COMPUTED fact (INV-3 posture): nothing here is persisted as an
// authority claim — it is recomputed live from the wire, and it feeds the
// verified-role bridging lens (lib/convergence S3.2) for THIS session's view.

import { useRef, useState } from "react";
import { DEFAULT_ADOPTION_BAR, GOVERNED_SYSTEMS } from "../../lib/adoption.js";
import {
  ROLE_IMPLEMENTER,
  ROLE_OPERATOR,
  ROLE_PARTICIPANT,
  type StakeholderRole,
} from "../../lib/fut-draft.js";
import { type VerifiedStakeholderRole, verifyStakeholderRole } from "../../lib/roles.js";
import { useController } from "../auth.js";
import { Badge, Panel, SectionHeader } from "../components.js";
import { readFetchFor } from "../hooks.js";
import { roleLabel } from "../sign-decision.js";
import { type DeliberationConfig, sessionIdentity } from "../state.js";

/** The declarable standings, with honest evidence copy. */
const DECLARABLE: readonly { role: StakeholderRole; label: string; evidence: string | null }[] = [
  {
    role: ROLE_PARTICIPANT,
    label: "participant — the base standing (no evidence needed)",
    evidence: null,
  },
  {
    role: ROLE_IMPLEMENTER,
    label: "implementer — I run an implementation advertising the governed spec",
    evidence:
      "fedreg:StorageDescription IRI(s) of YOUR storage (served from within it, advertising an " +
      "accepted version or sector; your WebID must live within that storage)",
  },
  {
    role: ROLE_OPERATOR,
    label: "operator — a live registry's memberships are asserted by my WebID",
    evidence:
      "fedreg:Registry IRI(s) whose valid, Active memberships name your WebID as assertedBy",
  },
];

export function RoleDeclarationPanel({
  config,
  webId,
  verified,
  onVerified,
  onCleared,
}: {
  config: DeliberationConfig;
  webId: string | null;
  /** The session's current verified standing (lifted — it feeds the Room's
   *  role lens), or null when nothing has been verified yet. */
  verified: VerifiedStakeholderRole | null;
  onVerified: (result: VerifiedStakeholderRole) => void;
  /** Invalidate the lifted verified standing — called the MOMENT the declared
   *  role or evidence changes, so a stale verified role (from a PREVIOUS
   *  declaration) never keeps feeding the Room's role lens against inputs the
   *  user has since edited. */
  onCleared?: () => void;
}): React.JSX.Element {
  const controller = useController();
  const [declared, setDeclared] = useState<StakeholderRole>(ROLE_PARTICIPANT);
  const [evidenceText, setEvidenceText] = useState("");
  const [busy, setBusy] = useState(false);
  // Monotonic request id: bumped on every input change AND every verify, so a
  // superseded in-flight verification (its inputs edited before it resolved)
  // is ignored and never lands a stale role.
  const reqId = useRef(0);

  const identity = sessionIdentity(config, webId);
  const selected = DECLARABLE.find((d) => d.role === declared) ?? DECLARABLE[0];

  /** Invalidate any prior/in-flight verification: the visible declaration no
   *  longer matches what was verified, so drop the lifted result. */
  function invalidate(): void {
    reqId.current += 1;
    onCleared?.();
  }

  async function verify(): Promise<void> {
    if (identity === null || busy) return;
    setBusy(true);
    reqId.current += 1;
    const id = reqId.current;
    try {
      const fetchFn = await readFetchFor(config, controller);
      // The LANDED verifier (lib/roles.ts): declared → verified against the
      // federation web, FAIL-CLOSED to ParticipantRole. It never throws — a
      // hostile/broken/absent evidence document degrades with a reason.
      const result = await verifyStakeholderRole(
        {
          webId: identity,
          declaredRole: declared,
          evidence: evidenceText
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        },
        {
          fetch: fetchFn,
          acceptedVersions: GOVERNED_SYSTEMS.flatMap((s) => s.versions.map((v) => v.iri)),
          acceptedSectors: GOVERNED_SYSTEMS.map((s) => s.id),
        },
      );
      // Ignore a superseded result: the declared role/evidence changed while
      // this verification was in flight, so it must not land a stale role.
      if (id === reqId.current) onVerified(result);
    } catch (e) {
      if (id !== reqId.current) return; // superseded — drop
      // fail-closed: a read-seam failure degrades to the base standing, with
      // the reason carried (mirrors the lib's participantFallback shape).
      onVerified({
        webId: identity,
        declaredRole: declared,
        verifiedRole: ROLE_PARTICIPANT,
        verified: false,
        reason: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <SectionHeader
        title="Your stakeholder standing"
        sub={
          <>
            Declared, then <strong>verified against the public federation web</strong> — an
            implementer's storage must itself advertise the governed spec (
            <span className="data">fedreg:acceptsSpec</span>, bar ≥{DEFAULT_ADOPTION_BAR}); an
            operator must be an <span className="data">assertedBy</span> party on a live registry.
            Fail-closed to participant; computed live, never stored as an authority claim.
          </>
        }
      />
      {identity === null ? (
        <p className="muted small">
          Sign in first — a standing is verified for your own WebID, never for someone else's.
        </p>
      ) : (
        <>
          <label className="field">
            <span>Declared standing</span>
            <select
              value={declared}
              onChange={(e) => {
                setDeclared(e.target.value as StakeholderRole);
                invalidate(); // the declaration changed → drop any stale verified role
              }}
            >
              {DECLARABLE.map((d) => (
                <option key={d.role} value={d.role}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          {selected?.evidence !== null && (
            <label className="field">
              <span>
                Evidence{" "}
                <span className="hint">— {selected?.evidence} (https-only, one per line)</span>
              </span>
              <textarea
                rows={2}
                value={evidenceText}
                onChange={(e) => {
                  setEvidenceText(e.target.value);
                  invalidate(); // the evidence changed → drop any stale verified role
                }}
                placeholder="https://storage.example/.well-known/fedreg.ttl"
              />
            </label>
          )}
          <div className="chip-row">
            <button type="button" className="btn" onClick={() => void verify()} disabled={busy}>
              {busy ? "Verifying…" : "Verify against the federation web"}
            </button>
          </div>
        </>
      )}
      {verified !== null && (
        <p className="muted small">
          {verified.verified ? (
            <Badge tone="res">verified: {roleLabel(verified.verifiedRole)}</Badge>
          ) : (
            <Badge tone="con">
              fail-closed to {roleLabel(verified.verifiedRole)} — the declared standing did not
              verify
            </Badge>
          )}{" "}
          {verified.evidenceSource !== undefined && (
            <>
              confirmed by{" "}
              <a href={verified.evidenceSource} rel="noopener noreferrer" target="_blank">
                its re-checkable source
              </a>
              .{" "}
            </>
          )}
          {verified.reason !== undefined && <>Reason: {verified.reason}.</>} Your verified standing
          feeds the role lens of the endorsement gate below — for this session's view; every
          verifier recomputes it independently from the wire.
        </p>
      )}
    </Panel>
  );
}
