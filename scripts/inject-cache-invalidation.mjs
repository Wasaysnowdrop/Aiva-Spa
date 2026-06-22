import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const file = resolve(process.cwd(), "app/actions/knowledge.ts")
let src = readFileSync(file, "utf-8")

// Add invalidateKnowledgeCache() after every successful revalidatePath("/dashboard/knowledge-base")
// followed by `return { ok: true` (i.e. the success path of a KB action).
const before = src
const re = /revalidatePath\("\/dashboard\/knowledge-base"\)\s*\n(\s*)return \{ ok: true/g
const matches = src.match(re)
console.log("matches found:", matches?.length ?? 0)
src = src.replace(
  re,
  'revalidatePath("/dashboard/knowledge-base")\n$1invalidateKnowledgeCache()\n$1return { ok: true',
)

if (src === before) {
  console.log("No replacements made")
  process.exit(1)
}

writeFileSync(file, src, "utf-8")
console.log("OK — invalidateKnowledgeCache() injected into all KB success paths")
