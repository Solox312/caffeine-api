/**
 * FlixQuest-style scraper routes for Caffeine API
 * Compatible with Caffeine app's getStreamLinksFlixAPIMulti
 * Format: /:provider/stream-movie?tmdbId=X and /:provider/stream-tv?tmdbId=X&season=X&episode=X
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getProvider, getAllProviderIds } from "../scraper/providers";
import { generateMovieMedia, generateShowMedia } from "../scraper/utils/tmdb";
import type { ProviderResponse } from "../scraper/types";

export default async function scraperRoutes(fastify: FastifyInstance) {
    // List providers (id + name only)
    fastify.get("/providers", async (_request: FastifyRequest, reply: FastifyReply) => {
        const providerList = getAllProviderIds().map((id) => {
            const p = getProvider(id);
            return { id, name: p?.name ?? id };
        });
        return reply.status(200).send({ success: true, providers: providerList });
    });

    // List providers with active status (probes each provider with a quick stream check)
    const PROBE_TMDB_ID = "550"; // Fight Club – widely available
    const PROBE_TIMEOUT_MS = 5000;

    fastify.get("/providers/status", async (_request: FastifyRequest, reply: FastifyReply) => {
        const ids = getAllProviderIds();
        const results = await Promise.allSettled(
            ids.map(async (id) => {
                const provider = getProvider(id);
                const name = provider?.name ?? id;
                if (!provider) return { id, name, active: false };
                try {
                    const links = await Promise.race([
                        provider.streamMovie(PROBE_TMDB_ID),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error("Timeout")), PROBE_TIMEOUT_MS)
                        ),
                    ]);
                    return { id, name, active: Array.isArray(links) && links.length > 0 };
                } catch {
                    return { id, name, active: false };
                }
            })
        );

        const providers = results.map((r) =>
            r.status === "fulfilled" ? r.value : { id: "unknown", name: "?", active: false }
        );
        return reply.status(200).send({ success: true, providers });
    });

    // Stream movie - GET /:provider/stream-movie?tmdbId=556574
    fastify.get<{
        Params: { provider: string };
        Querystring: { tmdbId?: string };
    }>(
        "/:provider/stream-movie",
        async (request: FastifyRequest<{ Params: { provider: string }; Querystring: { tmdbId?: string } }>, reply: FastifyReply) => {
            const { provider: providerId } = request.params;
            const { tmdbId } = request.query;

            const provider = getProvider(providerId);
            if (!provider) {
                return reply.status(404).send({
                    success: false,
                    error: `Provider '${providerId}' not found`,
                    details: `Available: ${getAllProviderIds().join(", ")}`,
                });
            }

            if (!tmdbId || typeof tmdbId !== "string") {
                return reply.status(400).send({
                    success: false,
                    error: "Missing or invalid tmdbId parameter",
                });
            }

            try {
                const media = await generateMovieMedia(tmdbId);
                const links = await provider.streamMovie(tmdbId);

                if (!links || links.length === 0) {
                    return reply.status(404).send({
                        success: false,
                        error: "No streams found for this movie",
                    });
                }

                const response: ProviderResponse = {
                    success: true,
                    provider: providerId,
                    media: {
                        type: media.type,
                        title: media.title,
                        releaseYear: media.releaseYear,
                        tmdbId: media.tmdbId,
                    },
                    links,
                };
                return reply.status(200).send(response);
            } catch (err) {
                fastify.log.error(err, "Error in stream-movie");
                return reply.status(500).send({
                    success: false,
                    error: "Failed to fetch movie stream",
                    details: err instanceof Error ? err.message : "Unknown error",
                });
            }
        }
    );

    // Stream TV - GET /:provider/stream-tv?tmdbId=2316&season=1&episode=1
    fastify.get<{
        Params: { provider: string };
        Querystring: { tmdbId?: string; season?: string; episode?: string };
    }>(
        "/:provider/stream-tv",
        async (
            request: FastifyRequest<{
                Params: { provider: string };
                Querystring: { tmdbId?: string; season?: string; episode?: string };
            }>,
            reply: FastifyReply
        ) => {
            const { provider: providerId } = request.params;
            const { tmdbId, season, episode } = request.query;

            const provider = getProvider(providerId);
            if (!provider) {
                return reply.status(404).send({
                    success: false,
                    error: `Provider '${providerId}' not found`,
                    details: `Available: ${getAllProviderIds().join(", ")}`,
                });
            }

            if (!tmdbId || typeof tmdbId !== "string") {
                return reply.status(400).send({
                    success: false,
                    error: "Missing or invalid tmdbId parameter",
                });
            }

            const seasonNum = parseInt(season as string);
            const episodeNum = parseInt(episode as string);
            if (isNaN(seasonNum) || isNaN(episodeNum)) {
                return reply.status(400).send({
                    success: false,
                    error: "Missing or invalid season/episode parameters",
                });
            }

            try {
                const media = await generateShowMedia(tmdbId, seasonNum, episodeNum);
                const links = await provider.streamTV(tmdbId, seasonNum, episodeNum);

                if (!links || links.length === 0) {
                    return reply.status(404).send({
                        success: false,
                        error: "No streams found for this episode",
                    });
                }

                const response: ProviderResponse = {
                    success: true,
                    provider: providerId,
                    media: {
                        type: media.type,
                        title: `${media.title} - S${seasonNum}E${episodeNum}`,
                        releaseYear: media.releaseYear,
                        tmdbId: media.tmdbId,
                    },
                    links,
                };
                return reply.status(200).send(response);
            } catch (err) {
                fastify.log.error(err, "Error in stream-tv");
                return reply.status(500).send({
                    success: false,
                    error: "Failed to fetch TV stream",
                    details: err instanceof Error ? err.message : "Unknown error",
                });
            }
        }
    );
}
