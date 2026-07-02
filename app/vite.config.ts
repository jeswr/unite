import { execSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// AUTHORED-BY Claude Fable 5 (PSS agent)

/** Short git SHA for the FeedbackButton version tag; git-failure-safe. */
function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(gitSha()),
  },
  resolve: {
    // A nested second React instance triggers invalid-hook-call; dedupe the
    // shared singletons the app + the app-shell/solid-elements chrome all use.
    dedupe: ["react", "react-dom"],
  },
});
