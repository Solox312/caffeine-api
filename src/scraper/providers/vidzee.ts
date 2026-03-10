/**
 * VidZee streaming provider for Caffeine API
 * Based on: https://github.com/BeamlakAschalew/flixquest-scraper/blob/main/src/providers/vidzee.ts
 */
import type { Provider, ProviderLink } from "../types";

const VIDZEE_API_BASE = "https://player.vidzee.wtf/api/server";
const VIDZEE_REFERER = "https://core.vidzee.wtf/";

const DEFAULT_HEADERS: Record<string, string> = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: VIDZEE_REFERER,
};

interface VidZeeSourceItem {
    link: string;
    name?: string;
    type?: string;
    language?: string;
    lang?: string;
}

interface VidZeeApiResponse {
    url?: VidZeeSourceItem[];
    link?: string;
    name?: string;
    type?: string;
    language?: string;
    lang?: string;
}

async function makeRequest(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const headers = {
        ...DEFAULT_HEADERS,
        ...(options.headers as Record<string, string>),
    };
    const response = await fetch(url, {
        method: options.method || "GET",
        headers,
        signal: AbortSignal.timeout(7000),
        ...options,
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response;
}

async function getStreamsFromServer(
    tmdbId: string,
    mediaType: "movie" | "tv",
    server: number,
    seasonNum?: number,
    episodeNum?: number
): Promise<ProviderLink[]> {
    let targetApiUrl = `${VIDZEE_API_BASE}?id=${tmdbId}&sr=${server}`;
    if (mediaType === "tv" && seasonNum != null && episodeNum != null) {
        targetApiUrl += `&ss=${seasonNum}&ep=${episodeNum}`;
    }

    const response = await makeRequest(targetApiUrl);
    const responseData: VidZeeApiResponse = await response.json();

    if (!responseData || typeof responseData !== "object") {
        return [];
    }

    let apiSources: VidZeeSourceItem[] = [];
    if (responseData.url && Array.isArray(responseData.url)) {
        apiSources = responseData.url;
    } else if (responseData.link && typeof responseData.link === "string") {
        apiSources = [
            {
                link: responseData.link,
                name: responseData.name,
                type: responseData.type,
                language: responseData.language || responseData.lang,
            },
        ];
    }

    if (!apiSources.length) return [];

    return apiSources
        .filter((item) => item.link)
        .map((item) => {
            const label = item.name || item.type || "VidZee";
            const quality = String(label).match(/^\d+$/) ? `${label}p` : label;
            return {
                server: `VidZee S${server}`,
                url: item.link,
                isM3U8: item.link.includes(".m3u8"),
                quality,
                subtitles: [],
            };
        });
}

async function getVidZeeStreams(
    tmdbId: string,
    mediaType: "movie" | "tv",
    seasonNum?: number,
    episodeNum?: number
): Promise<ProviderLink[]> {
    const servers = [3, 4, 5];
    try {
        const results = await Promise.all(
            servers.map((server) =>
                getStreamsFromServer(
                    tmdbId,
                    mediaType,
                    server,
                    seasonNum,
                    episodeNum
                )
            )
        );
        return results.flat();
    } catch (err) {
        console.error(
            `[VidZee] Error: ${err instanceof Error ? err.message : "Unknown error"}`
        );
        return [];
    }
}

export const vidzeeProvider: Provider = {
    name: "VidZee",
    id: "vidzee",

    async streamMovie(tmdbId: string): Promise<ProviderLink[]> {
        return getVidZeeStreams(String(tmdbId), "movie");
    },

    async streamTV(
        tmdbId: string,
        season: number,
        episode: number
    ): Promise<ProviderLink[]> {
        return getVidZeeStreams(String(tmdbId), "tv", season, episode);
    },
};
