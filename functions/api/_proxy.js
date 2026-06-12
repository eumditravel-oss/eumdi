function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}

function apiBase(env) {
  return String(env.API_BASE_URL || env.BACKEND_API_URL || "").replace(/\/+$/, "");
}

export async function proxyApi({ request, env }, pathname) {
  const base = apiBase(env);
  if (!base) {
    return json(
      {
        ok: false,
        error: "API_BASE_URL is not configured in Cloudflare Pages",
      },
      { status: 500 },
    );
  }

  const incoming = new URL(request.url);
  const target = new URL(`${pathname}${incoming.search}`, base);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = request.body;
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("cache-control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
