# Cloudflare Worker – Proxy for Caffeine API

Use this Worker so the API can fetch vidsrc/vixsrc through Cloudflare’s IP instead of your server’s IP (avoids 403 from streaming sites).

## 1. Create a Cloudflare account

- Go to [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) and sign up (free tier is enough).

## 2. Create a Worker

1. In the Cloudflare dashboard, go to **Workers & Pages**.
2. Click **Create** → **Create Worker**.
3. Name it (e.g. `caffeine-proxy`) and click **Deploy**.
4. After it’s created, click **Edit code** (or **Quick edit**).

## 3. Replace the default script with this

Delete the default code and paste:

```js
// Proxy: GET ?url=ENCODED_TARGET → fetch that URL and return response
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
          "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": request.headers.get("Accept") || "*/*",
          "Accept-Language": request.headers.get("Accept-Language") || "en-US,en;q=0.9",
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
```

4. Click **Save and deploy**.

## 4. Get your Worker URL

- In the Worker page, open **Triggers** (or the Worker URL in the right panel).
- The URL looks like: `https://caffeine-proxy.YOUR-SUBDOMAIN.workers.dev`
- Copy that URL (no path, no query).

## 5. Set it on the API server

On your EC2 (or wherever the API runs), add to **.env**:

```bash
WORKERS_URL=https://caffeine-proxy.YOUR-SUBDOMAIN.workers.dev
```

Replace with your actual Worker URL. Then restart the API:

```bash
./scripts/restart-aws.sh
```

After that, vidsrc/vixsrc requests from the API go through the Worker, so the streaming sites see Cloudflare’s IP instead of AWS and should stop returning 403.

## Optional: use your own domain

In **Workers & Pages** → your Worker → **Triggers** → **Custom Domains**, you can add a domain (e.g. `proxy.yourdomain.com`) and use that as `WORKERS_URL` instead of `*.workers.dev`.
