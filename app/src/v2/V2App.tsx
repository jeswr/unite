// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The v2 surface shell (design/v2 02 §1): the conversation-first presentation
// over the SAME engine, demo pods and auth seam as the v1 surface — selected
// at runtime by the surface dimension (scope/surface.ts), never a fork. V0:
// an HONEST under-construction shell — the routes parse, the chrome stands,
// and every not-yet-built surface says so plainly (the registry PreviewView
// rule: never a silently-missing view, never a fake).
//
// The v2 surface binds to scope C (design/v2 07 §2) and — for phases V0–V2 —
// runs on the seeded demo deliberation only (the same honest-sandbox posture
// as v1's demo; pod-mode wiring on the v2 surface is post-V5 work, 07 §7).

import { FeedbackButton, ThemeToggle } from "@jeswr/app-shell";
import { SCOPES } from "../scope/scopes.js";
import { surfaceHref } from "../scope/surface.js";
import { useController } from "../ui/auth.js";
import { useAggregate } from "../ui/hooks.js";
import { collectionKinds, demoConfig } from "../ui/state.js";
import { DEMO_CIRCLE } from "./demo-circle.js";
import { useV2Route, type V2Route, v2Hash } from "./route.js";
import { Circle } from "./views/Circle.js";
import { Commons } from "./views/Commons.js";
import { How } from "./views/How.js";
import { Notebook } from "./views/Notebook.js";
import { Story } from "./views/Story.js";
import "./v2.css";

// The v2 surface's scope binding (07 §2): society, forced by the surface.
const SCOPE = SCOPES.society;
const KINDS = collectionKinds(SCOPE);
// The seeded demo deliberation — v2's only backing for V0–V2 (07 §7).
const CONFIG = demoConfig("society");

/** The v2 nav: warm names, no instrument idiom (the instruments live behind How). */
const NAV: { route: V2Route; label: string }[] = [
  { route: { view: "commons" }, label: "The commons" },
  { route: { view: "circle", id: DEMO_CIRCLE.slug }, label: "Your circle" },
  { route: { view: "notebook" }, label: "Your notebook" },
  { route: { view: "how" }, label: "How unite listens" },
];

export function V2App(): React.JSX.Element {
  const controller = useController();
  const [route, navigate] = useV2Route();
  const aggregate = useAggregate(CONFIG, controller, KINDS);

  const loc = typeof window === "undefined" ? null : window.location;

  return (
    <div className="app v2-app">
      <header className="app-header">
        <div className="brand">
          <div>
            <div className="brand-name">unite</div>
            <div className="brand-sub">a place to talk about what life here should be like</div>
          </div>
          <span className="badge demo">demo — nothing you type leaves this browser</span>
        </div>
        <div className="chrome">
          <FeedbackButton
            repo="jeswr/unite"
            appName="unite"
            appVersion={__APP_VERSION__}
            webId={null}
          />
          <ThemeToggle />
        </div>
      </header>

      <nav className="v2-nav" aria-label="unite">
        {NAV.map((n) => (
          <a
            key={n.label}
            className={route.view === n.route.view ? "v2-nav-link active" : "v2-nav-link"}
            aria-current={route.view === n.route.view ? "page" : undefined}
            href={v2Hash(n.route)}
          >
            {n.label}
          </a>
        ))}
      </nav>

      <main className="content v2-content">
        {route.view === "commons" && (
          <Commons aggregate={aggregate} config={CONFIG} onNavigate={navigate} />
        )}
        {route.view === "circle" && (
          <Circle circleSlug={route.id ?? DEMO_CIRCLE.slug} aggregate={aggregate} config={CONFIG} />
        )}
        {route.view === "notebook" && <Notebook aggregate={aggregate} config={CONFIG} />}
        {route.view === "how" && <How />}
        {route.view === "story" && <Story id={route.id} />}
      </main>

      <p className="footer-note">
        unite · everything you say lives in your own pod ·{" "}
        <a href={surfaceHref("v1", loc?.search, "#/overview")}>see the v1 instrument surface</a> ·
        under active development
      </p>
    </div>
  );
}
