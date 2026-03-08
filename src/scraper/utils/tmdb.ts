/**
 * TMDB utilities for scraper - uses TMDB_KEY from caffeine-api env
 */
import axios from "axios";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const tmdbKey = process.env.TMDB_KEY;

export interface MovieMedia {
    type: "movie";
    title: string;
    releaseYear: number;
    tmdbId: string;
    imdbId?: string;
}

export interface ShowMedia {
    type: "show";
    title: string;
    releaseYear: number;
    tmdbId: string;
    episode: { number: number; tmdbId: string };
    season: { number: number; tmdbId: string; title: string; episodeCount?: number };
}

export async function generateMovieMedia(tmdbId: string): Promise<MovieMedia> {
    if (!tmdbKey) throw new Error("TMDB_KEY is not configured");

    const response = await axios.get(`${TMDB_BASE_URL}/movie/${tmdbId}`, {
        params: { api_key: tmdbKey },
    });
    const movie = response.data;
    const releaseYear = new Date(movie.release_date || 0).getFullYear();

    return {
        type: "movie",
        title: movie.title,
        releaseYear,
        tmdbId,
        ...(movie.imdb_id && { imdbId: movie.imdb_id }),
    };
}

export async function generateShowMedia(
    tmdbId: string,
    seasonNumber: number,
    episodeNumber: number
): Promise<ShowMedia> {
    if (!tmdbKey) throw new Error("TMDB_KEY is not configured");

    const [showRes, seasonRes] = await Promise.all([
        axios.get(`${TMDB_BASE_URL}/tv/${tmdbId}`, {
            params: { api_key: tmdbKey },
        }),
        axios.get(`${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNumber}`, {
            params: { api_key: tmdbKey },
        }),
    ]);

    const show = showRes.data;
    const season = seasonRes.data;
    const releaseYear = new Date(show.first_air_date || 0).getFullYear();
    const episode = season.episodes?.find(
        (ep: { episode_number: number }) => ep.episode_number === episodeNumber
    );

    if (!episode) {
        throw new Error(
            `Episode ${episodeNumber} not found in season ${seasonNumber}`
        );
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
}
