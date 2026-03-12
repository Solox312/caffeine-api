/**
 * Live content provider routes for Streameast-style sites (e.g. v2.streameast.ga).
 * GET /streameast         - list events (scraped from homepage)
 * GET /streameast/stream  - get m3u8/mpd links for an event page (?url=...)
 * Results are cached (in-memory or Redis when configured) to reduce 429s and load.
 * Client IP (X-Forwarded-For / X-Real-IP) is passed to the provider when using WORKERS_URL so the worker can set X-Forwarded-For on upstream requests.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type Redis from "ioredis";
import { getEvents, getStreamLinks, getBaseUrl, getMirrorUrlForClient, parseEventsFromHtmlPublic, parseStreamLinksFromHtml } from "../providers/streameast";
import cache from "../utils/cache";
import memoryCache from "../utils/memory-cache";

/** Get client IP from request (behind nginx/proxy: X-Forwarded-For or X-Real-IP). */
function getClientIp(request: FastifyRequest): string | null {
    const forwarded = request.headers["x-forwarded-for"];
    const first = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : null;
    if (first) return first;
    const real = request.headers["x-real-ip"];
    if (typeof real === "string" && real.trim()) return real.trim();
    const ip = request.ip;
    if (typeof ip === "string" && ip.trim()) return ip;
    return null;
}

const EVENTS_CACHE_KEY = "streameast:events";
const EVENTS_TTL_SECONDS = 30 * 60; // 30 minutes – fewer requests, less 429
const STREAM_CACHE_PREFIX = "streameast:stream:";
const STREAM_TTL_SECONDS = 10 * 60; // 10 minutes

export interface StreameastRouteOptions {
    redis?: Redis | false | null;
}

export default async function streameastRoutes(
    fastify: FastifyInstance,
    opts: StreameastRouteOptions = {}
) {
    const redis = opts.redis && typeof opts.redis.get === "function" ? opts.redis : null;

    fastify.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply.status(200).send({
            intro: "Streameast-style live provider",
            base_url: getBaseUrl(),
            routes: {
                "events/mirror": "GET /streameast/events/mirror - mirror URL for client to fetch (user's IP)",
                "events/parse": "POST /streameast/events/parse - body: { html, base_url } - parse events from HTML",
                events: "GET /streameast/events - list live events (server fetch, fallback)",
                "stream/parse": "POST /streameast/stream/parse - body: { html, url } - parse stream links from HTML",
                stream: "GET /streameast/stream?url=<event_page_url> - get stream links (server fetch, fallback)",
            },
        });
    });

    /** Client fetches this URL from the user's device (user's IP), then POSTs HTML to /events/parse. */
    fastify.get("/events/mirror", async (_request: FastifyRequest, reply: FastifyReply) => {
        const url = getMirrorUrlForClient();
        return reply.status(200).send({ url });
    });

    /** Parse events from HTML that the client fetched from the mirror (user's IP). Body: { html: string, base_url: string }. */
    fastify.post<{ Body: { html?: string; base_url?: string } }>(
        "/events/parse",
        async (request: FastifyRequest<{ Body: { html?: string; base_url?: string } }>, reply: FastifyReply) => {
            const body = request.body ?? {};
            const html = typeof body.html === "string" ? body.html : "";
            const baseUrl = typeof body.base_url === "string" ? body.base_url.trim() : "";
            if (!html || html.length < 100) {
                return reply.status(400).send({ success: false, error: "Missing or invalid body.html" });
            }
            if (!baseUrl) {
                return reply.status(400).send({ success: false, error: "Missing or invalid body.base_url" });
            }
            try {
                const events = parseEventsFromHtmlPublic(html, baseUrl);
                return reply.status(200).send({ success: true, base_url: baseUrl.replace(/\/$/, ""), events });
            } catch (err) {
                fastify.log.warn(err, "streameast/events/parse failed");
                return reply.status(500).send({
                    success: false,
                    error: err instanceof Error ? err.message : "Parse failed",
                });
            }
        }
    );

    fastify.get("/events", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const clientIp = getClientIp(request);
            const fetchEvents = () => getEvents({ clientIp });
            const result = redis
                ? await cache.fetch(redis, EVENTS_CACHE_KEY, fetchEvents, EVENTS_TTL_SECONDS)
                : await memoryCache.fetch(EVENTS_CACHE_KEY, fetchEvents, EVENTS_TTL_SECONDS);

            return reply.status(200).send({
                success: true,
                base_url: result.baseUrl,
                events: result.events,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const is429 = /429|1015|rate limit/i.test(msg);
            const stale = redis
                ? await cache.get<{ baseUrl: string; events: unknown[] }>(redis, EVENTS_CACHE_KEY)
                : memoryCache.get<{ baseUrl: string; events: unknown[] }>(EVENTS_CACHE_KEY);
            if (stale && Array.isArray(stale.events) && stale.events.length > 0) {
                fastify.log.info({ err: msg }, "streameast/events: returning stale cache after error");
                return reply.status(200).header("X-Cache", "stale").send({
                    success: true,
                    base_url: stale.baseUrl,
                    events: stale.events,
                });
            }
            fastify.log.warn(err, "streameast/events failed");
            return reply.status(is429 ? 429 : 502).send({
                success: false,
                error: msg,
                ...(is429 && { code: "RATE_LIMITED" }),
            });
        }
    });

    /** Parse stream links from HTML that the client fetched (user's IP). Body: { html: string, url: string }. */
    fastify.post<{ Body: { html?: string; url?: string } }>(
        "/stream/parse",
        async (request: FastifyRequest<{ Body: { html?: string; url?: string } }>, reply: FastifyReply) => {
            const body = request.body ?? {};
            const html = typeof body.html === "string" ? body.html : "";
            const pageUrl = typeof body.url === "string" ? body.url.trim() : "";
            if (!html || html.length < 50) {
                return reply.status(400).send({ success: false, error: "Missing or invalid body.html" });
            }
            if (!pageUrl) {
                return reply.status(400).send({ success: false, error: "Missing or invalid body.url" });
            }
            try {
                const result = parseStreamLinksFromHtml(html, pageUrl);
                return reply.status(200).send({
                    success: true,
                    url: result.url,
                    count: result.links.length,
                    links: result.links,
                });
            } catch (err) {
                fastify.log.warn(err, "streameast/stream/parse failed");
                return reply.status(500).send({
                    success: false,
                    error: err instanceof Error ? err.message : "Parse failed",
                });
            }
        }
    );

    fastify.get<{ Querystring: { url?: string } }>(
        "/stream",
        async (request: FastifyRequest<{ Querystring: { url?: string } }>, reply: FastifyReply) => {
            const eventUrl = request.query?.url;
            if (!eventUrl || typeof eventUrl !== "string" || !eventUrl.trim()) {
                return reply.status(400).send({
                    success: false,
                    error: "Missing or invalid query: url (event page URL)",
                });
            }
            const normalizedUrl = eventUrl.trim();
            const streamCacheKey = `${STREAM_CACHE_PREFIX}${encodeURIComponent(normalizedUrl)}`;
            const clientIp = getClientIp(request);

            try {
                const fetchStream = () => getStreamLinks(normalizedUrl, { clientIp });
                const result = redis
                    ? await cache.fetch(redis, streamCacheKey, fetchStream, STREAM_TTL_SECONDS)
                    : await memoryCache.fetch(streamCacheKey, fetchStream, STREAM_TTL_SECONDS);

                return reply.status(200).send({
                    success: true,
                    url: result.url,
                    count: result.links.length,
                    links: result.links,
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to fetch stream links";
                const is429 = /429|1015|rate limit/i.test(message);
                const stale = redis
                    ? await cache.get<{ url: string; links: string[] }>(redis, streamCacheKey)
                    : memoryCache.get<{ url: string; links: string[] }>(streamCacheKey);
                if (stale && Array.isArray(stale.links)) {
                    fastify.log.info({ err: message }, "streameast/stream: returning stale cache after error");
                    return reply.status(200).header("X-Cache", "stale").send({
                        success: true,
                        url: stale.url,
                        count: stale.links.length,
                        links: stale.links,
                    });
                }
                fastify.log.warn(err, "streameast/stream failed");
                return reply.status(is429 ? 429 : 502).send({
                    success: false,
                    error: message,
                    ...(is429 && { code: "RATE_LIMITED" }),
                });
            }
        }
    );
}
