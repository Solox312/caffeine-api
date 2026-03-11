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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateShowMedia = exports.generateMovieMedia = void 0;
/**
 * TMDB utilities for scraper - uses TMDB_KEY from caffeine-api env
 */
const axios_1 = __importDefault(require("axios"));
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const tmdbKey = process.env.TMDB_KEY;
function generateMovieMedia(tmdbId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!tmdbKey)
            throw new Error("TMDB_KEY is not configured");
        const response = yield axios_1.default.get(`${TMDB_BASE_URL}/movie/${tmdbId}`, {
            params: { api_key: tmdbKey },
        });
        const movie = response.data;
        const releaseYear = new Date(movie.release_date || 0).getFullYear();
        return Object.assign({ type: "movie", title: movie.title, releaseYear,
            tmdbId }, (movie.imdb_id && { imdbId: movie.imdb_id }));
    });
}
exports.generateMovieMedia = generateMovieMedia;
function generateShowMedia(tmdbId, seasonNumber, episodeNumber) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (!tmdbKey)
            throw new Error("TMDB_KEY is not configured");
        const [showRes, seasonRes] = yield Promise.all([
            axios_1.default.get(`${TMDB_BASE_URL}/tv/${tmdbId}`, {
                params: { api_key: tmdbKey },
            }),
            axios_1.default.get(`${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNumber}`, {
                params: { api_key: tmdbKey },
            }),
        ]);
        const show = showRes.data;
        const season = seasonRes.data;
        const releaseYear = new Date(show.first_air_date || 0).getFullYear();
        const episode = (_a = season.episodes) === null || _a === void 0 ? void 0 : _a.find((ep) => ep.episode_number === episodeNumber);
        if (!episode) {
            throw new Error(`Episode ${episodeNumber} not found in season ${seasonNumber}`);
        }
        return {
            type: "show",
            title: show.name,
            releaseYear,
            tmdbId,
            episode: {
                number: episodeNumber,
                tmdbId: episode.id.toString(),
            },
            season: {
                number: seasonNumber,
                tmdbId: season.id.toString(),
                title: season.name,
                episodeCount: season.episode_count,
            },
        };
    });
}
exports.generateShowMedia = generateShowMedia;
