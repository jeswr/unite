import { defineConfig } from "vitest/config";

// AUTHORED-BY Claude Fable 5 (PSS agent)
// The exhaustive suite is on the pure data layer (src/lib), which needs no DOM —
// a node environment keeps it fast and free of jsdom.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/**/*.test.ts"],
  },
});
