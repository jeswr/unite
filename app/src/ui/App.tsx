// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The Stage-1 seed client shell. App chrome from @jeswr/app-shell (ThemeToggle +
// FeedbackButton) + the <jeswr-login-panel> auth seam from @jeswr/solid-elements.
// Everything below is thin over src/lib.

import { FeedbackButton, ThemeToggle } from "@jeswr/app-shell";
import { LoginPanel } from "@jeswr/solid-elements/react";
import { useState } from "react";
import { useController } from "./auth.js";
import { useAggregate } from "./hooks.js";
import { DEFAULT_CONFIG, type DeliberationConfig } from "./state.js";
import { Bridging } from "./views/Bridging.js";
import { Compose } from "./views/Compose.js";
import { Join } from "./views/Join.js";
import { NeedsBoard } from "./views/NeedsBoard.js";

type View = "join" | "compose" | "needs" | "bridging";

const TABS: { id: View; label: string }[] = [
  { id: "join", label: "Join" },
  { id: "compose", label: "Compose" },
  { id: "needs", label: "Needs board" },
  { id: "bridging", label: "Bridging" },
];

export function App(): React.JSX.Element {
  const controller = useController();
  const [webId, setWebId] = useState<string | null>(controller.webId);
  const [config, setConfig] = useState<DeliberationConfig>(DEFAULT_CONFIG);
  const [view, setView] = useState<View>("join");
  const aggregate = useAggregate(config, controller);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <strong>unite</strong>
          <span className="muted small">Stage-1 app co-design · under active development</span>
        </div>
        <div className="chrome">
          <FeedbackButton
            repo="jeswr/unite"
            appName="unite"
            appVersion={__APP_VERSION__}
            webId={webId}
          />
          <ThemeToggle />
        </div>
      </header>

      <div className="login-bar">
        <LoginPanel
          controller={controller}
          autoRestore={true}
          onSessionChange={(e) => setWebId(e.detail.webId)}
        />
        <span className="muted small">{webId ? `Signed in as ${webId}` : "Not signed in"}</span>
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            className={view === t.id ? "tab active" : "tab"}
            onClick={() => setView(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {view === "join" && <Join config={config} onChange={setConfig} webId={webId} />}
        {view === "compose" && <Compose config={config} webId={webId} />}
        {view === "needs" && <NeedsBoard config={config} webId={webId} aggregate={aggregate} />}
        {view === "bridging" && <Bridging aggregate={aggregate} />}
      </main>
    </div>
  );
}
