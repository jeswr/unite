// @vitest-environment jsdom
// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// S3.5 — the role-declaration control. The load-bearing assertions: the
// control INVOKES lib/roles.verifyStakeholderRole (it does not re-implement
// the verification) — a participant declaration verifies trivially; an
// implementer/operator claim with unusable evidence degrades FAIL-CLOSED to
// fut:ParticipantRole with the lib's reason rendered VERBATIM (including
// against a REAL, parseable demo storage description that fails the
// authoritativeness binding); and nothing is persisted — the result only
// flows out through onVerified (a computed fact, INV-3 posture).

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ADOPTION_SOURCES } from "../../demo/fixtures.js";
import { ROLE_IMPLEMENTER, ROLE_PARTICIPANT } from "../../lib/fut-draft.js";
import type { VerifiedStakeholderRole } from "../../lib/roles.js";
import { AuthProvider, DevLoginController } from "../auth.js";
import { demoConfig } from "../state.js";
import { RoleDeclarationPanel } from "./RoleDeclaration.js";

afterEach(cleanup);

/** A stateful harness: the Room's lifted-state wiring, minimally. */
function Harness({
  onVerified,
  onCleared,
}: {
  onVerified?: (v: VerifiedStakeholderRole) => void;
  onCleared?: () => void;
}) {
  const [verified, setVerified] = useState<VerifiedStakeholderRole | null>(null);
  return (
    <AuthProvider controller={new DevLoginController()}>
      <RoleDeclarationPanel
        config={demoConfig("infrastructure")}
        webId={null}
        verified={verified}
        onVerified={(v) => {
          setVerified(v);
          onVerified?.(v);
        }}
        onCleared={() => {
          setVerified(null);
          onCleared?.();
        }}
      />
    </AuthProvider>
  );
}

describe("the S3.5 role-declaration control", () => {
  it("a PARTICIPANT declaration verifies trivially (the base standing, no evidence field)", async () => {
    const onVerified = vi.fn();
    render(<Harness onVerified={onVerified} />);
    // The base standing needs no evidence — the evidence field is absent.
    expect(screen.queryByPlaceholderText(/fedreg/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Verify against the federation web/ }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    const result = onVerified.mock.calls[0]?.[0] as VerifiedStakeholderRole;
    expect(result.verified).toBe(true);
    expect(result.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(await screen.findByText(/verified: role: participants/)).toBeTruthy();
  });

  it("an IMPLEMENTER claim against a REAL demo storage doc FAILS the authoritativeness binding — fail-closed, reason verbatim", async () => {
    const onVerified = vi.fn();
    render(<Harness onVerified={onVerified} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: ROLE_IMPLEMENTER } });
    // A real, PARSEABLE fedreg:StorageDescription served by the demo sandbox —
    // but it is not served from within the storage it describes, and the demo
    // session's WebID does not live within it: the lib refuses the binding.
    fireEvent.change(screen.getByPlaceholderText(/fedreg\.ttl/), {
      target: { value: DEMO_ADOPTION_SOURCES[0] },
    });
    fireEvent.click(screen.getByRole("button", { name: /Verify against the federation web/ }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1), { timeout: 8000 });
    const result = onVerified.mock.calls[0]?.[0] as VerifiedStakeholderRole;
    expect(result.verified).toBe(false);
    expect(result.declaredRole).toBe(ROLE_IMPLEMENTER);
    expect(result.verifiedRole).toBe(ROLE_PARTICIPANT); // fail-closed
    expect(await screen.findByText(/fail-closed to role: participants/)).toBeTruthy();
    expect(screen.getByText(/Reason:/)).toBeTruthy();
  });

  it("an IMPLEMENTER claim with NO evidence degrades fail-closed with the honest reason", async () => {
    const onVerified = vi.fn();
    render(<Harness onVerified={onVerified} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: ROLE_IMPLEMENTER } });
    fireEvent.click(screen.getByRole("button", { name: /Verify against the federation web/ }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    const result = onVerified.mock.calls[0]?.[0] as VerifiedStakeholderRole;
    expect(result.verified).toBe(false);
    expect(result.verifiedRole).toBe(ROLE_PARTICIPANT);
    expect(await screen.findByText(/no evidence supplied/)).toBeTruthy();
  });

  it("changing the declared role AFTER verifying INVALIDATES the stale result (roborev Medium)", async () => {
    const onVerified = vi.fn();
    const onCleared = vi.fn();
    render(<Harness onVerified={onVerified} onCleared={onCleared} />);
    // Verify participant standing first — the verified badge shows.
    fireEvent.click(screen.getByRole("button", { name: /Verify against the federation web/ }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/verified: role: participants/)).toBeTruthy();
    // Now change the declared role: the stale verified result must be cleared
    // (it must not keep feeding the role lens against the edited declaration).
    fireEvent.change(screen.getByRole("combobox"), { target: { value: ROLE_IMPLEMENTER } });
    expect(onCleared).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(/verified: role: participants/)).toBeNull());
  });
});
