import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Each test file that needs a database creates its own scratch SQLite file (see tests/helpers/db.ts).
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
