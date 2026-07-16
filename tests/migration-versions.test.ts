import { readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("Supabase migration versions", () => {
  it("uses a unique version for every migration file", () => {
    const files = readdirSync(join(process.cwd(), "supabase/migrations"))
      .filter((file) => file.endsWith(".sql"))
    const versions = files.map((file) => file.match(/^(\d+)_/)?.[1])

    expect(versions.every(Boolean)).toBe(true)
    expect(new Set(versions).size).toBe(versions.length)
  })
})