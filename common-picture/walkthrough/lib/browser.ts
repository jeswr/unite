/**
 * The recording browser. The demonstration is a static site with its fonts bundled, so the
 * browser may reach only the local server that serves it: any other request is refused in
 * the browser and listed in report.json (and fails --strict). This replaces the allowlisting
 * proxy of the Unite pipeline, which had a server and live connections to watch.
 * WebRTC is switched off as well, as there.
 */
import { createRequire } from 'node:module';
import type { Browser, BrowserContext } from 'playwright';

// Playwright comes from the machine (it is not a dependency of the site), so it is required
// the CommonJS way, which also finds globally installed packages through NODE_PATH.
const require = createRequire(import.meta.url);
export const { chromium } = require('playwright') as typeof import('playwright');

export const WEBRTC_ARGS = ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--webrtc-ip-handling-policy=disable_non_proxied_udp'];

const NO_WEBRTC = `(() => {
  const blocked = function () { throw new TypeError('WebRTC is disabled while recording the walkthrough'); };
  for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCIceTransport']) {
    try { Object.defineProperty(globalThis, name, { value: blocked, configurable: false, writable: false, enumerable: false }); } catch {}
  }
})();`;

export async function launchBrowser(o: { headless?: boolean; args?: string[] }): Promise<Browser> {
  return chromium.launch({ headless: o.headless !== false, args: [...(o.args ?? []), ...WEBRTC_ARGS] });
}

/** Refuses every request that isn't to the site being recorded, and notes where it was going. */
export async function guardContext(context: BrowserContext, origin: string, outside: Set<string>) {
  await context.addInitScript(NO_WEBRTC);
  await context.route(
    (u) => u.origin !== origin && u.protocol !== 'data:' && u.protocol !== 'blob:',
    (route) => {
      const u = new URL(route.request().url());
      outside.add(`${u.protocol}//${u.host}`);
      return route.abort('blockedbyclient');
    },
  );
}
