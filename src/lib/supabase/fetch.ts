import { request as httpsRequest } from "node:https"
import { request as httpRequest } from "node:http"
import { URL } from "node:url"

type FetchInit = {
  method?: string
  headers?: HeadersInit
  body?: BodyInit | null
  signal?: AbortSignal | null
  redirect?: RequestRedirect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

type BuiltBody = {
  payload: Buffer | string | null
  contentLength?: string
  contentType?: string
}

const toHeaderRecord = (h: FetchInit["headers"]): Record<string, string> => {
  const out: Record<string, string> = {}
  if (!h) return out
  if (h instanceof Headers) {
    h.forEach((v, k) => {
      out[k.toLowerCase()] = v
    })
    return out
  }
  if (Array.isArray(h)) {
    for (const [k, v] of h) out[k.toLowerCase()] = String(v)
    return out
  }
  for (const [k, v] of Object.entries(h as Record<string, string>)) {
    if (v != null) out[k.toLowerCase()] = String(v)
  }
  return out
}

const buildRequestBody = (body: FetchInit["body"]): BuiltBody => {
  if (body == null) return { payload: null }
  if (typeof body === "string") {
    return { payload: body, contentLength: Buffer.byteLength(body).toString() }
  }
  if (Buffer.isBuffer(body)) {
    return { payload: body, contentLength: body.length.toString() }
  }
  if (body instanceof Uint8Array) {
    const buf = Buffer.from(body)
    return { payload: buf, contentLength: buf.length.toString() }
  }
  if (body instanceof ArrayBuffer) {
    const buf = Buffer.from(body)
    return { payload: buf, contentLength: buf.length.toString() }
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    const boundary = "----AivaSpaBoundary" + Math.random().toString(16).slice(2)
    const parts: Buffer[] = []
    for (const [name, value] of body.entries()) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n`,
        ),
      )
      parts.push(Buffer.from(String(value)))
      parts.push(Buffer.from("\r\n"))
    }
    parts.push(Buffer.from(`--${boundary}--\r\n`))
    const buf = Buffer.concat(parts)
    return {
      payload: buf,
      contentLength: buf.length.toString(),
      contentType: `multipart/form-data; boundary=${boundary}`,
    }
  }
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    const s = body.toString()
    return { payload: s, contentLength: Buffer.byteLength(s).toString() }
  }
  // Fallback: stringify
  const s = String(body)
  return { payload: s, contentLength: Buffer.byteLength(s).toString() }
}

// Node 24 + Next 16 Turbopack can drop the global undici fetch to certain
// HTTPS hosts with a generic `TypeError: fetch failed` and no cause. This
// shim bypasses that by using `node:https` directly with a fresh socket per
// call (no keep-alive pool). It implements just enough of the Fetch API for
// supabase-js (auth, REST, storage) to work: method/headers/body/signal +
// Response with status/headers/json/text/arrayBuffer.
export const robustFetch: typeof fetch = (input, init) => {
  return new Promise<Response>((resolve, reject) => {
    let urlString: string
    try {
      urlString = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url
    } catch {
      reject(new TypeError("Invalid URL passed to fetch"))
      return
    }

    let parsed: URL
    try {
      parsed = new URL(urlString)
    } catch {
      reject(new TypeError(`Invalid URL: ${urlString}`))
      return
    }

    const i: FetchInit = (init as FetchInit) || {}
    const method = (i.method || "GET").toUpperCase()
    const headersIn = toHeaderRecord(i.headers)
    const { payload, contentLength, contentType } = buildRequestBody(i.body as FetchInit["body"])

    const lowerHeaders: Record<string, string> = { ...headersIn }
    if (payload != null && !lowerHeaders["content-length"] && contentLength) {
      lowerHeaders["content-length"] = contentLength
    }
    if (contentType && !lowerHeaders["content-type"]) {
      lowerHeaders["content-type"] = contentType
    }

    const lib = parsed.protocol === "http:" ? httpRequest : httpsRequest
    const req = lib(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "http:" ? 80 : 443),
        path: (parsed.pathname || "/") + (parsed.search || ""),
        headers: lowerHeaders,
        agent: false, // disable keep-alive pool; fresh socket per request
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (c: Buffer) => chunks.push(c))
        res.on("end", () => {
          const status = res.statusCode || 0
          // Per the Fetch spec, 204/205/304 responses must not include a body.
          const isBodyless = status === 204 || status === 205 || status === 304
          const buf = isBodyless ? Buffer.alloc(0) : Buffer.concat(chunks)
          const responseHeaders = new Headers()
          for (const [k, v] of Object.entries(res.headers)) {
            if (v == null) continue
            if (Array.isArray(v)) v.forEach((vv) => responseHeaders.append(k, String(vv)))
            else responseHeaders.set(k, String(v))
          }
          resolve(
            new Response(isBodyless ? null : buf, {
              status,
              statusText: res.statusMessage || "",
              headers: responseHeaders,
            }),
          )
        })
        res.on("error", reject)
      },
    )

    req.on("error", (err) => {
      // Surface a more useful message than Node's bare "fetch failed".
      const e = new Error(
        `Supabase fetch failed: ${err.message} (${(err as NodeJS.ErrnoException).code ?? "unknown"}) — ${method} ${parsed.host}${parsed.pathname}`,
      )
      ;(e as Error & { cause?: unknown }).cause = err
      reject(e)
    })

    if (i.signal) {
      if (i.signal.aborted) {
        req.destroy(new Error("aborted"))
        return
      }
      const onAbort = () => {
        req.destroy(new Error("aborted"))
      }
      i.signal.addEventListener("abort", onAbort, { once: true })
    }

    if (payload != null) {
      if (typeof payload === "string") req.write(payload)
      else req.write(payload)
    }
    req.end()
  })
}
