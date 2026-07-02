// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The shared deliberation-aggregation hook. Aggregation reads FOREIGN
// participant pods, so it uses the credential-free publicFetch (never the
// session-bound fetch) — the cross-origin credential-leak boundary.

import type { LoginController } from "@jeswr/solid-elements/react";
import { useCallback, useState } from "react";
import { type AggregateResult, aggregateDeliberation } from "../lib/aggregate.js";
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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const registry = buildRegistry(config);
      const verifier = buildVerifier(config);
      setResult(await aggregateDeliberation({ registry, verifier, fetch: controller.publicFetch }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [config, controller]);

  return { result, loading, error, refresh };
}
