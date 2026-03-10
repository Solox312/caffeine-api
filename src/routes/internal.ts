/**
 * Internal admin-only routes. Protect with INTERNAL_API_KEY.
 * Used by caffeine-admin for tools like scraping competitor live source links.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";

function isAuthorized(request: FastifyRequest): boolean {
    if (!INTERNAL_KEY) return true; // No key configured: allow (e.g. local dev)
    const key = request.headers["x-internal-key"];
    return typeof key === "string" && key === INTERNAL_KEY;
}

/** Extract live stream URLs from HTML/JS text (m3u8, mpd, common CDN patterns) */
function extractStreamLinks(text: string, baseUrl: string): string[] {
    const out = new Set<string>();
    const base = new URL(baseUrl);
    const origin = base.origin;

    // Absolute URLs: .m3u8 and .mpd
    const m3u8Re = /https?:\/\/[^\s"'<>)\]]+\.m3u8(?:\?[^\s"'<>)\]]*)?/gi;
    const mpdRe = /https?:\/\/[^\s"'<>)\]]+\.mpd(?:\?[^\s"'<>)\]]*)?/gi;
    for (const m of text.matchAll(m3u8Re)) out.add(m[0].replace(/\\\//g, "/"));
    for (const m of text.matchAll(mpdRe)) out.add(m[0].replace(/\\\//g, "/"));

    // JSON-escaped URLs (e.g. \"https://...m3u8\")
    const escapedRe = /(?:https?:\\?\/\\?\/[^"'\s\\]+\.(?:m3u8|mpd)(?:[^"'\s\\]*)?)/gi;
    for (const m of text.matchAll(escapedRe)) {
        const u = m[0].replace(/\\\//g, "/").replace(/\\/g, "");
        if (u.startsWith("http")) out.add(u);
    }

    // Single-quoted or double-quoted URLs containing m3u8 or mpd
    const quotedRe = /["'](https?:\/\/[^"']*(?:m3u8|mpd)[^"']*)["']/gi;
    for (const m of text.matchAll(quotedRe)) {
        if (m[1]) out.add(m[1].replace(/\\\//g, "/"));
    }

    // Relative .m3u8 / .mpd (resolve against page origin)
    const relRe = /["'](\/(?!\/)[^"']*\.(?:m3u8|mpd)(?:\?[^"']*)?)["']/gi;
    for (const m of text.matchAll(relRe)) {
        if (m[1]) out.add(origin + m[1]);
    }

    // Common live stream path patterns (e.g. /live/..., /stream/..., /hls/...)
    const livePathRe = /https?:\/\/[^\s"'<>)\]]+(?:\/live\/|\/stream\/|\/hls\/|\/dash\/)[^\s"'<>)\]]+/gi;
    for (const m of text.matchAll(livePathRe)) out.add(m[0].replace(/\\\//g, "/"));

    return Array.from(out).filter((u) => {
        try {
            const parsed = new URL(u);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
            return false;
        }
    });
}

export default async function internalRoutes(fastify: FastifyInstance) {
    /**
     * POST /internal/scrape-live-sources
     * Body: { url: string }
     * Scrapes the given URL and returns extracted live stream links (m3u8, mpd, stream paths).
     */
    fastify.post<{ Body: { url?: string } }>(
        "/scrape-live-sources",
        async (request: FastifyRequest<{ Body: { url?: string } }>, reply: FastifyReply) => {
            if (!isAuthorized(request)) {
                return reply.status(401).send({ success: false, error: "Unauthorized" });
            }

            const url = request.body?.url;
            if (!url || typeof url !== "string" || !url.trim()) {
                return reply.status(400).send({
                    success: false,
                    error: "Missing or invalid body.url",
                });
            }

            let resolvedUrl: string;
            try {
                resolvedUrl = new URL(url.trim()).href;
            } catch {
                return reply.status(400).send({
                    success: false,
                    error: "Invalid URL",
                });
            }

            const timeoutMs = 15000;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const response = await fetch(resolvedUrl, {
                    method: "GET",
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                    signal: controller.signal,
                });

                clearTimeout(timeout);

                if (!response.ok) {
                    return reply.status(502).send({
                        success: false,
                        error: `Upstream returned ${response.status} ${response.statusText}`,
                    });
                }

                const contentType = response.headers.get("content-type") || "";
                if (!contentType.includes("text/html") && !contentType.includes("application/json") && !contentType.includes("text/")) {
                    return reply.status(400).send({
                        success: false,
                        error: "URL did not return HTML or text; cannot safely scrape",
                    });
                }

                const text = await response.text();
                const links = extractStreamLinks(text, resolvedUrl);

                return reply.status(200).send({
                    success: true,
                    url: resolvedUrl,
                    count: links.length,
                    links,
                });
            } catch (err) {
                clearTimeout(timeout);
                const message = err instanceof Error ? err.message : "Unknown error";
                if (message.includes("abort")) {
                    return reply.status(504).send({
                        success: false,
                        error: "Request timeout",
                    });
                }
                return reply.status(502).send({
                    success: false,
                    error: message,
                });
            }
        }
    );
}
