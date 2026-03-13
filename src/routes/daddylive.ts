import { FastifyInstance } from "fastify";
import { get247, extractHlsFromUrl } from "../providers/daddylive";
import {
    daddyliveDomains,
    daddyliveReferrer,
    daddyliveStreamBaseUrl,
    daddyliveTrailingUrl,
    daddyliveUserAgent,
} from "../constants/api_constants";

const routes = async (fastify: FastifyInstance) => {
    fastify.get("/", async (_, rp) => {
        rp.status(200).send({
            intro: "Welcome to the daddylive provider",
            routes: "/live",
        });
    });

    fastify.get("/live", async (_, rp) => {
        const channels = await get247();
        if (channels && channels.length > 0) {
            return rp.status(200).send({
                base_url: daddyliveStreamBaseUrl,
                trailing_url: daddyliveTrailingUrl,
                referrer: daddyliveReferrer,
                user_agent: daddyliveUserAgent,
                channels,
            });
        }
        return rp.status(503).send({
            message: "Channels temporarily unavailable. The source may be down or changed.",
        });
    });

    /** Extract HLS (m3u8) URL from a Daddylive embed or watch page. Query: url (required). */
    fastify.get<{ Querystring: { url?: string } }>("/extract-hls", async (req, rp) => {
        const rawUrl = req.query?.url;
        if (!rawUrl || typeof rawUrl !== "string") {
            return rp.status(400).send({ error: "Missing url query parameter" });
        }
        let hls: string | null = null;
        hls = await extractHlsFromUrl(rawUrl);
        if (!hls) {
            // Try alternate domains if URL is from daddylive
            try {
                const u = new URL(rawUrl);
                if (u.hostname.includes("daddylive") || u.hostname.includes("dlhd")) {
                    for (const base of daddyliveDomains) {
                        const path = u.pathname + u.search;
                        const alt = base + (path.startsWith("/") ? path : "/" + path);
                        hls = await extractHlsFromUrl(alt);
                        if (hls) break;
                    }
                }
            } catch {
                // ignore
            }
        }
        if (hls) {
            return rp.status(200).send({ hls });
        }
        return rp.status(404).send({ error: "No HLS stream found in page" });
    });

    /** Get HLS URL for a channel ID. For 24/7 channels, returns direct m3u8. Query: id (channel id), source=tv|tv2. */
    fastify.get<{ Querystring: { id?: string; source?: string } }>("/hls", async (req, rp) => {
        const id = req.query?.id;
        if (!id || typeof id !== "string") {
            return rp.status(400).send({ error: "Missing id query parameter" });
        }
        const source = (req.query?.source ?? "tv") === "tv2" ? "tv2" : "tv";
        // 24/7 channels use direct HLS: base + id + trailing
        if (/^\d+$/.test(id)) {
            const direct =
                daddyliveStreamBaseUrl + "/" + id + daddyliveTrailingUrl;
            return rp.status(200).send({
                hls: direct,
                referrer: daddyliveReferrer,
                user_agent: daddyliveUserAgent,
            });
        }
        // Event paths like admin/ppv-event/1: need to fetch embed page and extract
        const embedPath = "/embed?id=" + encodeURIComponent(id) + "&player=1&source=" + source;
        for (const base of daddyliveDomains) {
            const url = base + embedPath;
            const hls = await extractHlsFromUrl(url);
            if (hls) {
                return rp.status(200).send({ hls });
            }
        }
        return rp.status(404).send({ error: "No HLS stream found for channel" });
    });
};

export default routes;
