// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The shared deliberation-aggregation hook. Aggregation reads FOREIGN
// participant pods, so it uses the credential-free publicFetch (never the
// session-bound fetch) — the cross-origin credential-leak boundary.

import type { LoginController } from "@jeswr/solid-elements/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type AggregateResult, aggregateDeliberation } from "../lib/aggregate.js";
import { watchContainers } from "../lib/notifications.js";
import { isValidParticipant } from "../lib/registry.js";
import { buildRegistry, buildVerifier, type DeliberationConfig } from "./state.js";

export interface AggregateState {
  readonly result: AggregateResult | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
}

export function useAggregate(
  config: DeliberationConfig,
  controller: LoginController,
): AggregateState {
  const [result, setResult] = useState<AggregateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic request id: only the LATEST refresh may apply its outcome, so a
  // slow/out-of-order response can never clobber a newer one.
  const reqId = useRef(0);
  // The current config, tracked SYNCHRONOUSLY during render. Because this is set
  // in render (before any commit/effect), a stale aggregation that resolves
  // after a config change sees the new config here and is dropped — closing the
  // passive-effect race window.
  const configRef = useRef(config);
  configRef.current = config;

  const refresh = useCallback(async () => {
    reqId.current += 1;
    const id = reqId.current;
    const startedConfig = config;
    const isCurrent = () => id === reqId.current && configRef.current === startedConfig;
    setLoading(true);
    setError(null);
    try {
      const registry = buildRegistry(config);
      const verifier = buildVerifier(config);
      const next = await aggregateDeliberation({
        registry,
        verifier,
        fetch: controller.publicFetch,
      });
      if (!isCurrent()) return; // superseded (newer refresh or config change)
      setResult(next);
    } catch (e) {
      if (!isCurrent()) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [config, controller]);

  // A config change invalidates any in-flight request (bumping reqId) and clears
  // the loading flag — a superseded request's `finally` no longer owns the id, so
  // it will not clear loading itself, and the hook must not stick at loading=true.
  // biome-ignore lint/correctness/useExhaustiveDependencies: MUST re-run on config change to supersede in-flight requests.
  useEffect(() => {
    reqId.current += 1;
    setLoading(false);
  }, [config]);

  return { result, loading, error, refresh };
}

/**
 * The needs/ + resonances/ container URLs for every configured participant — the
 * containers whose changes should re-trigger aggregation. Malformed bases are
 * skipped (defensive; the write path independently guards its own base).
 */
export function deliberationContainers(config: DeliberationConfig): string[] {
  const out: string[] = [];
  for (const p of config.participants) {
    // Only watch VALIDATED participants (https WebID + https base ending "/") — the
    // same gate StaticRegistry enforces. Prevents live-update HEAD/POST/WebSocket
    // requests to http/localhost/private/invalid bases before the registry is built.
    if (!isValidParticipant(p)) continue;
    for (const dir of ["needs/", "resonances/"]) {
      out.push(new URL(dir, p.base).toString());
    }
  }
  return out;
}

/**
 * Subscribe to live changes across the deliberation's participant containers
 * (WebSocketChannel2023 with a poll fallback) and invoke `onChange` — the board's
 * `refresh` — when anything changes. Foreign pods are watched with the
 * credential-free `publicFetch` (the same boundary the read path uses). Best-effort:
 * a server with no notifications simply polls. Re-subscribes only when the config
 * or controller changes; `onChange` is read through a ref so a new callback identity
 * does not churn the subscriptions.
 */
export function useLiveUpdates(
  config: DeliberationConfig,
  controller: LoginController,
  onChange: () => void,
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const containers = deliberationContainers(config);
    if (containers.length === 0) return;
    const watcher = watchContainers({
      containers,
      fetch: controller.publicFetch,
      onChange: () => onChangeRef.current(),
    });
    return () => watcher.close();
  }, [config, controller]);
}
