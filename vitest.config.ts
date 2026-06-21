import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: [
      // Mirror tsconfig's `paths` map so tests can import via the same
      // `@/...` and `@/app/...` aliases the app source uses.
      { find: /^@\/(?!app\/)(.*)$/, replacement: path.resolve(__dirname, "src/$1") },
      { find: /^@\/app\/(.*)$/, replacement: path.resolve(__dirname, "app/$1") },
    ],
  },
})
