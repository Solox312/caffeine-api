"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const providers_1 = require("../scraper/providers");
const tmdb_1 = require("../scraper/utils/tmdb");
function scraperRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function* () {
        // List providers (id + name only)
        fastify.get("/providers", (_request, reply) => __awaiter(this, void 0, void 0, function* () {
            const providerList = (0, providers_1.getAllProviderIds)().map((id) => {
                var _a;
                const p = (0, providers_1.getProvider)(id);
                return { id, name: (_a = p === null || p === void 0 ? void 0 : p.name) !== null && _a !== void 0 ? _a : id };
            });
            return reply.status(200).send({ success: true, providers: providerList });
        }));
        // List providers with active status (probes each provider with a quick stream check)
        const PROBE_TMDB_ID = "550"; // Fight Club – widely available
        const PROBE_TIMEOUT_MS = 5000;
        fastify.get("/providers/status", (_request, reply) => __awaiter(this, void 0, void 0, function* () {
            const ids = (0, providers_1.getAllProviderIds)();
            const results = yield Promise.allSettled(ids.map((id) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const provider = (0, providers_1.getProvider)(id);
                const name = (_a = provider === null || provider === void 0 ? void 0 : provider.name) !== null && _a !== void 0 ? _a : id;
                if (!provider)
                    return { id, name, active: false };
                try {
                    const links = yield Promise.race([
                        provider.streamMovie(PROBE_TMDB_ID),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), PROBE_TIMEOUT_MS)),
                    ]);
                    return { id, name, active: Array.isArray(links) && links.length > 0 };
                }
                catch (_b) {
                    return { id, name, active: false };
                }
            })));
            const providers = results.map((r) => r.status === "fulfilled" ? r.value : { id: "unknown", name: "?", active: false });
            return reply.status(200).send({ success: true, providers });
        }));
        // Stream movie - GET /:provider/stream-movie?tmdbId=556574
        fastify.get("/:provider/stream-movie", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const { provider: providerId } = request.params;
            const { tmdbId } = request.query;
            const provider = (0, providers_1.getProvider)(providerId);
            if (!provider) {
                return reply.status(404).send({
                    success: false,
                    error: `Provider '${providerId}' not found`,
                    details: `Available: ${(0, providers_1.getAllProviderIds)().join(", ")}`,
                });
            }
            if (!tmdbId || typeof tmdbId !== "string") {
                return reply.status(400).send({
                    success: false,
                    error: "Missing or invalid tmdbId parameter",
                });
            }
            try {
                const media = yield (0, tmdb_1.generateMovieMedia)(tmdbId);
                const links = yield provider.streamMovie(tmdbId);
                if (!links || links.length === 0) {
                    return reply.status(404).send({
                        success: false,
                        error: "No streams found for this movie",
                    });
                }
                const response = {
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
            }
            catch (err) {
                fastify.log.error(err, "Error in stream-movie");
                return reply.status(500).send({
                    success: false,
                    error: "Failed to fetch movie stream",
                    details: err instanceof Error ? err.message : "Unknown error",
                });
            }
        }));
        // Stream TV - GET /:provider/stream-tv?tmdbId=2316&season=1&episode=1
        fastify.get("/:provider/stream-tv", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const { provider: providerId } = request.params;
            const { tmdbId, season, episode } = request.query;
            const provider = (0, providers_1.getProvider)(providerId);
            if (!provider) {
                return reply.status(404).send({
                    success: false,
                    error: `Provider '${providerId}' not found`,
                    details: `Available: ${(0, providers_1.getAllProviderIds)().join(", ")}`,
                });
            }
            if (!tmdbId || typeof tmdbId !== "string") {
                return reply.status(400).send({
                    success: false,
                    error: "Missing or invalid tmdbId parameter",
                });
            }
            const seasonNum = parseInt(season);
            const episodeNum = parseInt(episode);
            if (isNaN(seasonNum) || isNaN(episodeNum)) {
                return reply.status(400).send({
                    success: false,
                    error: "Missing or invalid season/episode parameters",
                });
            }
            try {
                const media = yield (0, tmdb_1.generateShowMedia)(tmdbId, seasonNum, episodeNum);
                const links = yield provider.streamTV(tmdbId, seasonNum, episodeNum);
                if (!links || links.length === 0) {
                    return reply.status(404).send({
                        success: false,
                        error: "No streams found for this episode",
                    });
                }
                const response = {
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
            }
            catch (err) {
                fastify.log.error(err, "Error in stream-tv");
                return reply.status(500).send({
                    success: false,
                    error: "Failed to fetch TV stream",
                    details: err instanceof Error ? err.message : "Unknown error",
                });
            }
        }));
    });
}
exports.default = scraperRoutes;
