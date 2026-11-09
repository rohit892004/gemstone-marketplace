import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    include: [
      "lib/**/*.test.ts",
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
      "components/**/*.test.tsx",
      "proxy.test.ts",
    ],
    environment: "node",
  },
});
