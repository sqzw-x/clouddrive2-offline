import { GM_xmlhttpRequest } from "vite-plugin-monkey/dist/client";

/**
 * A fetch-like shim implemented on top of GM_xmlhttpRequest to bypass page CSP.
 *
 * Notes:
 * - Requires @grant GM_xmlhttpRequest and appropriate @connect permissions in userscript metadata.
 * - Only supports the subset used by @connectrpc/connect-web (method, headers, body, arraybuffer response).
 */
export async function gmFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  // If GM_xmlhttpRequest is not available, fall back to native fetch
  const GMX: typeof GM_xmlhttpRequest | undefined =
    typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : undefined;

  if (!GMX) {
    return fetch(input as RequestInfo, init);
  }

  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const method =
    init.method ?? (typeof input === "object" && "method" in (input as Request) ? (input as Request).method : "GET");

  // Normalize headers
  const headersRecord: Record<string, string> = {};
  const pushHeader = (k: string, v: string) => {
    headersRecord[k] = v;
  };
  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => {
        pushHeader(k, v);
      });
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) pushHeader(k, v);
    } else {
      for (const [k, v] of Object.entries(init.headers as Record<string, string>)) pushHeader(k, v);
    }
  } else if (typeof input === "object" && input instanceof Request) {
    input.headers.forEach((v, k) => {
      pushHeader(k, v);
    });
  }

  // Prepare body
  let data: string | ArrayBuffer | undefined;
  const body =
    init.body ?? (typeof input === "object" && input instanceof Request ? (input as Request).body : undefined);
  if (body instanceof ReadableStream) {
    // Consume stream to ArrayBuffer
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    data = merged.buffer;
  } else if (body instanceof ArrayBuffer) {
    data = body;
  } else if (body instanceof Uint8Array) {
    // Ensure we provide a plain ArrayBuffer by copying into a fresh buffer
    const ab = new ArrayBuffer(body.byteLength);
    new Uint8Array(ab).set(body);
    data = ab;
  } else if (body instanceof Blob) {
    data = await body.arrayBuffer();
  } else if (typeof body === "string") {
    data = body;
  } else if (body == null) {
    data = undefined;
  } else {
    // Attempt to handle unknown body by stringifying
    data = String(body as unknown as object);
  }

  const response: Response = await new Promise((resolve, reject) => {
    try {
      // Normalize method to an allowed union for Tampermonkey
      const mUpper = (method || "GET").toUpperCase() as Exclude<Tampermonkey.Request<unknown>["method"], undefined>;
      GMX({
        url,
        method: mUpper,
        headers: headersRecord,
        // Force arraybuffer to preserve binary frames of grpc-web
        responseType: "arraybuffer",
        data,
        onload: (ev) => {
          const status = ev.status ?? 0;
          const statusText = ev.statusText ?? "";
          const headers = new Headers();
          // Parse raw headers string
          if (ev.responseHeaders) {
            const lines = ev.responseHeaders.split(/\r?\n/);
            for (const line of lines) {
              const idx = line.indexOf(":");
              if (idx > 0) {
                const k = line.slice(0, idx).trim();
                const v = line.slice(idx + 1).trim();
                if (k) headers.append(k, v);
              }
            }
          }
          const ab = (ev.response as ArrayBuffer) ?? new ArrayBuffer(0);
          const res = new Response(ab, { status, statusText, headers });
          resolve(res);
        },
        onerror: () => reject(new TypeError("Network request failed (GM)")),
        ontimeout: () => reject(new TypeError("Network request timeout (GM)")),
      });
    } catch (e) {
      reject(e);
    }
  });

  return response;
}

export default gmFetch;
