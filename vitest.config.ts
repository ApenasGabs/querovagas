import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    environmentMatchGlobs: [
      ["server/**", "node"],
    ],
    setupFiles: ["./vitest.setup.ts"],
    css: true,
    testTimeout: 15000,
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.spec.ts", "**/e2e/**"],
  },
});
