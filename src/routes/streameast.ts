/**
 * Live content provider routes for Streameast-style sites (e.g. v2.streameast.ga).
 * GET /streameast         - list events (scraped from homepage)
 * GET /streameast/stream  - get m3u8/mpd links for an event page (?url=...)
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getEvents, getStreamLinks, getBaseUrl } from "../providers/streameast";

export default async function streameastRoutes(fastify: FastifyInstance) {
    fastify.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply.status(200).send({
            intro: "Streameast-style live provider",
            base_url: getBaseUrl(),
            routes: {
                events: "GET /streameast/events - list live events",
                stream: "GET /streameast/stream?url=<event_page_url> - get stream links for an event",
            },
        });
    });

    fastify.get("/events", async (_request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { baseUrl, events } = await getEvents();
            return reply.status(200).send({
                success: true,
                base_url: baseUrl,
                events,
            });
        } catch (err) {
            fastify.log.warn(err, "streameast/events failed");
            return reply.status(502).send({
                success: false,
                error: err instanceof Error ? err.message : "Failed to fetch events",
            });
        }
    });

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
            try {
                const { url, links } = await getStreamLinks(eventUrl.trim());
                return reply.status(200).send({
                    success: true,
                    url,
                    count: links.length,
                    links,
                });
            } catch (err) {
                fastify.log.warn(err, "streameast/stream failed");
                const message = err instanceof Error ? err.message : "Failed to fetch stream links";
                const is429 = typeof message === "string" && message.includes("429");
                return reply.status(is429 ? 429 : 502).send({
                    success: false,
                    error: message,
                    ...(is429 && { code: "RATE_LIMITED" }),
                });
            }
        }
    );
}
