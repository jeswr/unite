// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The honest not-built-yet card (the registry PreviewView rule, carried onto
// the v2 surface): a routed surface whose machinery hasn't landed says so
// plainly — phase-labelled, never faked, never silently missing.

export function Preview({
  title,
  phase,
  children,
}: {
  title: string;
  /** The design/v2 07 §3 phase this surface lands in (e.g. "V4"). */
  phase: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="view">
      <div className="card">
        <h2>{title}</h2>
        <p className="muted">
          This part of unite is being built — it arrives with phase {phase} of the v2 build plan.
          Nothing here is faked: what you can already use is real, and what you can't yet is
          labelled, like this.
        </p>
        {children}
      </div>
    </section>
  );
}
