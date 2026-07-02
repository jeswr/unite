import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// AUTHORED-BY Claude Fable 5 (PSS agent)
export default defineConfig({
  plugins: [react()],
  resolve: {
    // A nested second React instance triggers invalid-hook-call; dedupe the
    // shared singletons the app + the app-shell/solid-elements chrome all use.
    dedupe: ["react", "react-dom"],
  },
});
