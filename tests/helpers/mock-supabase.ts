import { vi } from "vitest"

/**
 * Helpers for mocking Supabase clients in integration tests.
 *
 * The mock is chainable and supports the patterns used in this codebase:
 *   supabase.from('table').select('*').eq('id', '1').single()
 *   supabase.from('table').insert({...}).select().single()
 *   supabase.from('table').update({...}).eq('id', '1')
 *   supabase.from('table').delete().eq('id', '1')
 *
 * The first "source op" (select|insert|update|delete|upsert|rpc) is the
 * one used for result lookup. Chain methods (eq, order, ...) preserve it.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type OpResult = {
  data: unknown
  error: { message: string } | null
  count?: number
}

type Call = { table: string; op: string; args: unknown[] }

type AuthUser = ({ id: string; email?: string } & { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }) | null

export type MockSupabase = {
  client: any
  setAuthUser: (user: AuthUser) => void
  setResult: (
    table: string,
    op: "select" | "insert" | "update" | "delete" | "upsert" | "rpc",
    result: OpResult,
  ) => void
  getCalls: () => Call[]
  callsFor: (table: string, op?: string) => Call[]
  reset: () => void
}

const keyOf = (table: string, op: string) => `${table}::${op}`

function defaultResult(op: string): OpResult {
  if (op === "rpc") return { data: null, error: null }
  if (op === "select" || op === "delete") return { data: [], error: null }
  return { data: null, error: null }
}

function buildThenable(data: unknown, error: OpResult["error"], count?: number) {
  return {
    data,
    error,
    ...(count !== undefined ? { count } : {}),
    then: (resolve: (v: unknown) => void) =>
      Promise.resolve({ data, error, count }).then(resolve as never),
  }
}

export type MockSupabaseFactory = {
  server: MockSupabase & { results: Map<string, OpResult> }
  browser: MockSupabase & { results: Map<string, OpResult> }
  admin: MockSupabase & { results: Map<string, OpResult> }
}

function buildClientWithSharedResults(
  sharedResults: Map<string, OpResult>,
): MockSupabase & { results: Map<string, OpResult> } {
  const calls: Call[] = []
  const authRef: { current: AuthUser } = { current: null }
  // All closure lookups use the shared map, so server/admin/browser all
  // read the same configured results.
  const results = sharedResults

  function buildQuery(table: string, sourceOp: string, inInsertSelect = false): any {
    const query: any = {}
    const get = () => results.get(keyOf(table, sourceOp)) ?? defaultResult(sourceOp)

    // Starting a new source op. select() after a data op is used to
    // expand the response (e.g. .update().eq().select() returns the
    // updated rows), so it preserves the source op rather than switching.
    query.select = (...args: unknown[]) => {
      calls.push({ table, op: "select", args })
      if (
        sourceOp === "insert" ||
        sourceOp === "update" ||
        sourceOp === "upsert" ||
        sourceOp === "delete"
      ) {
        return buildQuery(table, sourceOp, true)
      }
      return buildQuery(table, "select")
    }
    query.insert = (...args: unknown[]) => {
      calls.push({ table, op: "insert", args })
      return buildQuery(table, "insert")
    }
    query.update = (...args: unknown[]) => {
      calls.push({ table, op: "update", args })
      return buildQuery(table, "update")
    }
    query.delete = (...args: unknown[]) => {
      calls.push({ table, op: "delete", args })
      return buildQuery(table, "delete")
    }
    query.upsert = (...args: unknown[]) => {
      calls.push({ table, op: "upsert", args })
      return buildQuery(table, "upsert")
    }

    // Chain methods preserve the source op
    const chain = (method: string) => (...args: unknown[]) => {
      calls.push({ table, op: method, args })
      return buildQuery(table, sourceOp, inInsertSelect)
    }
    query.eq = chain("eq")
    query.neq = chain("neq")
    query.gt = chain("gt")
    query.gte = chain("gte")
    query.lt = chain("lt")
    query.lte = chain("lte")
    query.in = chain("in")
    query.is = chain("is")
    query.not = chain("not")
    query.or = chain("or")
    query.and = chain("and")
    query.match = chain("match")
    query.order = chain("order")
    query.limit = chain("limit")
    query.range = chain("range")

    query.single = () => {
      calls.push({ table, op: "single", args: [] })
      const r = get()
      const data = Array.isArray(r.data) ? r.data[0] ?? null : r.data
      return buildThenable(data, r.error)
    }
    query.maybeSingle = () => {
      calls.push({ table, op: "maybeSingle", args: [] })
      const r = get()
      const data = Array.isArray(r.data) ? r.data[0] ?? null : r.data
      return buildThenable(data, r.error)
    }

    query.then = (resolve: (v: unknown) => void) => {
      calls.push({ table, op: `${sourceOp}_resolve`, args: [] })
      const r = get()
      return Promise.resolve(buildThenable(r.data, r.error, r.count)).then(resolve)
    }

    return query
  }

  const from = (table: string) => ({
    select: (...args: unknown[]) => {
      calls.push({ table, op: "select", args })
      return buildQuery(table, "select")
    },
    insert: (...args: unknown[]) => {
      calls.push({ table, op: "insert", args })
      return buildQuery(table, "insert")
    },
    update: (...args: unknown[]) => {
      calls.push({ table, op: "update", args })
      return buildQuery(table, "update")
    },
    delete: (...args: unknown[]) => {
      calls.push({ table, op: "delete", args })
      return buildQuery(table, "delete")
    },
    upsert: (...args: unknown[]) => {
      calls.push({ table, op: "upsert", args })
      return buildQuery(table, "upsert")
    },
    rpc: (...args: unknown[]) => {
      calls.push({ table: args[0] as string, op: "rpc", args: args.slice(1) })
      return buildThenable(null, null)
    },
  })

  const auth = {
    getUser: async () => {
      calls.push({ table: "auth", op: "getUser", args: [] })
      return { data: { user: authRef.current }, error: null }
    },
    getSession: async () => {
      calls.push({ table: "auth", op: "getSession", args: [] })
      return {
        data: { session: authRef.current ? { user: authRef.current } : null },
        error: null,
      }
    },
    signInWithPassword: async () => ({
      data: { user: authRef.current, session: null },
      error: null,
    }),
    signUp: async () => ({
      data: { user: authRef.current, session: null },
      error: null,
    }),
    signOut: async () => ({ error: null }),
    signInWithOAuth: async () => ({
      data: { url: "https://example.com/oauth" },
      error: null,
    }),
    updateUser: async () => ({ data: { user: authRef.current }, error: null }),
    resend: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
    admin: {
      updateUserById: async () => ({ data: { user: authRef.current }, error: null }),
      deleteUser: async () => ({ data: { user: null }, error: null }),
      createUser: async () => ({ data: { user: authRef.current }, error: null }),
      listUsers: async () => ({ data: { users: [] }, error: null }),
    },
  }

  const client = { from, auth, rpc: (...args: unknown[]) => from(args[0] as string).rpc() }

  const self = {
    client,
    results,
    setAuthUser: (u: AuthUser) => {
      authRef.current = u
    },
    setResult: (table: string, op: string, result: OpResult) => {
      results.set(keyOf(table, op), result)
    },
    getCalls: () => calls,
    callsFor: (table: string, op?: string) =>
      calls.filter((c) => c.table === table && (op ? c.op === op : true)),
    reset: () => {
      // Note: do NOT clear the shared results map here — that would wipe
      // results configured by other mocks. Only clear the per-client
      // call log and auth ref.
      calls.length = 0
      authRef.current = null
    },
  } as unknown as MockSupabase & { results: Map<string, OpResult> }
  return self
}

export function makeSupabaseClient(): MockSupabase & { results: Map<string, OpResult> } {
  return buildClientWithSharedResults(new Map<string, OpResult>())
}

/**
 * Install the Supabase mock onto @/lib/supabase/server, client, and admin.
 * Returns the mock objects so individual tests can configure per-table results.
 *
 * All three mocked clients share their result map, so a single
 * `setResult("api_keys", "select", ...)` works regardless of which client
 * the production code happens to use (anon, server, or admin) for that
 * call. The call log is per-client so you can still tell which client
 * actually issued the request.
 */
export function installSupabaseMocks() {
  // All three mocked clients share a single result-config map so a
  // `setResult("api_keys", "select", ...)` call applies regardless of
  // which client (anon, server, or admin) the production code happens
  // to use. This makes tests robust to refactors that switch clients.
  const sharedResults = new Map<string, OpResult>()
  const server = buildClientWithSharedResults(sharedResults)
  const browser = buildClientWithSharedResults(sharedResults)
  const admin = buildClientWithSharedResults(sharedResults)

  vi.doMock("@/lib/supabase/server", () => ({
    createClient: () => Promise.resolve(server.client),
  }))
  vi.doMock("@/lib/supabase/client", () => ({
    createClient: () => browser.client,
  }))
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => admin.client,
  }))
  vi.doMock("server-only", () => ({}))
  vi.doMock("next/cache", () => ({
    revalidatePath: () => {},
    revalidateTag: () => {},
  }))
  vi.doMock("next/navigation", () => ({
    redirect: (url: string) => {
      const err = new Error(`NEXT_REDIRECT:${url}`)
      throw err
    },
    useRouter: () => ({ push: () => {}, refresh: () => {} }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
  }))
  vi.doMock("next/headers", () => ({
    headers: async () => new Map(),
    cookies: async () => ({
      getAll: () => [],
      set: () => {},
      get: () => undefined,
    }),
  }))

  return { server, browser, admin }
}
