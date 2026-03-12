// Cloudflare Worker: proxy for Caffeine API (avoids 403 from vidsrc/vixsrc).
// Deploy in Cloudflare Dashboard → Workers & Pages → Create Worker → paste this → Save and deploy.
// Then set WORKERS_URL=https://your-worker.xxx.workers.dev in your API .env

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response("Missing url query parameter", { status: 400 });
    }
    try {
      const res = await fetch(target, {
        method: request.method,
        headers: {
          "User-Agent":
            request.headers.get("User-Agent") ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: request.headers.get("Accept") || "*/*",
          "Accept-Language":
            request.headers.get("Accept-Language") || "en-US,en;q=0.9",
        },
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
