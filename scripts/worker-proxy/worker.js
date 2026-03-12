// Cloudflare Worker: proxy for Caffeine API (avoids 403 from vidsrc/vixsrc).
// Deploy in Cloudflare Dashboard → Workers & Pages → Create Worker → paste this → Save and deploy.
// Then set WORKERS_URL=https://your-worker.xxx.workers.dev in your API .env
//
// Optional: API can pass client_ip in the query (user's IP from X-Forwarded-For). We set
// X-Forwarded-For and X-Real-IP on the outgoing request so upstreams that respect them
// may rate-limit or geo-check by the user's IP instead of the worker's IP.

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response("Missing url query parameter", { status: 400 });
    }
    const clientIp = url.searchParams.get("client_ip") || request.headers.get("CF-Connecting-IP");
    const headers = {
      "User-Agent":
        request.headers.get("User-Agent") ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: request.headers.get("Accept") || "*/*",
      "Accept-Language": request.headers.get("Accept-Language") || "en-US,en;q=0.9",
    };
    if (clientIp) {
      headers["X-Forwarded-For"] = clientIp;
      headers["X-Real-IP"] = clientIp;
      headers["True-Client-IP"] = clientIp;
    }
    try {
      const res = await fetch(target, {
        method: request.method,
        headers,
      });
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    } catch (err) {
      return new Response(String(err), { status: 502 });
    }
  },
};
