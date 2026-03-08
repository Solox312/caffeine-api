/**
 * Vixsrc streaming provider - from flixquest-scraper
 * https://github.com/BeamlakAschalew/flixquest-scraper
 */
import type { Provider, ProviderLink, Subtitle } from "../types";

const BASE_URL = "https://vixsrc.to";
const DEFAULT_HEADERS: Record<string, string> = {
    "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json,*/*",
    "Accept-Language": "en-US,en;q=0.5",
    Connection: "keep-alive",
};

async function makeRequest(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const headers = { ...DEFAULT_HEADERS, ...(options.headers as Record<string, string>) };
    const response = await fetch(url, { method: options.method || "GET", headers, ...options });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response;
}

async function extractStreamFromPage(
    contentType: "movie" | "tv",
    contentId: string,
    seasonNum?: number,
    episodeNum?: number
): Promise<{ masterPlaylistUrl: string; subtitleApiUrl: string } | null> {
    let vixsrcUrl: string;
    let subtitleApiUrl: string;

    if (contentType === "movie") {
        vixsrcUrl = `${BASE_URL}/movie/${contentId}`;
        subtitleApiUrl = `https://sub.wyzie.ru/search?id=${contentId}`;
    } else {
        vixsrcUrl = `${BASE_URL}/tv/${contentId}/${seasonNum}/${episodeNum}`;
        subtitleApiUrl = `https://sub.wyzie.ru/search?id=${contentId}&season=${seasonNum}&episode=${episodeNum}`;
    }

    try {
        const response = await makeRequest(vixsrcUrl, {
            headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        });
        const html = await response.text();
        let masterPlaylistUrl: string | null = null;

        if (html.includes("window.masterPlaylist")) {
            const urlMatch = html.match(/url:\s*['"]([^'"]+)['"]/);
            const tokenMatch = html.match(/['"]?token['"]?\s*:\s*['"]([^'"]+)['"]/);
            const expiresMatch = html.match(/['"]?expires['"]?\s*:\s*['"]([^'"]+)['"]/);

            if (urlMatch && tokenMatch && expiresMatch) {
                const baseUrl = urlMatch[1];
                const token = tokenMatch[1];
                const expires = expiresMatch[1];
                masterPlaylistUrl = baseUrl.includes("?b=1")
                    ? `${baseUrl}&token=${token}&expires=${expires}&h=1&lang=en`
                    : `${baseUrl}?token=${token}&expires=${expires}&h=1&lang=en`;
            }
        }

        if (!masterPlaylistUrl) {
            const m3u8Match = html.match(/(https?:\/\/[^'"\s]+\.m3u8[^'"\s]*)/);
            if (m3u8Match) masterPlaylistUrl = m3u8Match[1];
        }

        if (!masterPlaylistUrl) {
            const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
            if (scriptMatches) {
                for (const script of scriptMatches) {
                    const streamMatch = script.match(
                        /['"]?(https?:\/\/[^'"\s]+(?:\.m3u8|playlist)[^'"\s]*)/
                    );
                    if (streamMatch) {
                        masterPlaylistUrl = streamMatch[1];
                        break;
                    }
                }
            }
        }

        if (!masterPlaylistUrl) return null;
        return { masterPlaylistUrl, subtitleApiUrl };
    } catch {
        return null;
    }
}

interface WyzieSubtitle {
    display: string;
    encoding: string;
    url: string;
}

async function getSubtitles(subtitleApiUrl: string): Promise<Subtitle[]> {
    try {
        const response = await makeRequest(subtitleApiUrl);
        const subtitleData: WyzieSubtitle[] = await response.json();
        const subtitles: Subtitle[] = [];
        const encodingPriority = ["ASCII", "UTF-8", "CP1252", "CP1250", "CP850"];

        let englishSubtitle: WyzieSubtitle | undefined;
        for (const encoding of encodingPriority) {
            englishSubtitle = subtitleData.find(
                (track) => track.display.includes("English") && track.encoding === encoding
            );
            if (englishSubtitle) break;
        }

        if (englishSubtitle) {
            subtitles.push({
                file: englishSubtitle.url,
                label: englishSubtitle.display,
                kind: "captions",
                default: true,
            });
        }

        for (const track of subtitleData) {
            if (!track.display.includes("English")) {
                subtitles.push({
                    file: track.url,
                    label: track.display,
                    kind: "captions",
                });
            }
        }
        return subtitles;
    } catch {
        return [];
    }
}

async function getVixsrcStreams(
    tmdbId: string,
    mediaType: "movie" | "tv",
    seasonNum?: number,
    episodeNum?: number
): Promise<ProviderLink[]> {
    try {
        const streamData = await extractStreamFromPage(
            mediaType,
            tmdbId,
            seasonNum,
            episodeNum
        );
        if (!streamData) return [];

        const { masterPlaylistUrl, subtitleApiUrl } = streamData;
        const subtitles = await getSubtitles(subtitleApiUrl);

        return [
            {
                server: "vixsrc",
                url: masterPlaylistUrl,
                isM3U8: true,
                quality: "auto",
                subtitles,
            },
        ];
    } catch {
        return [];
    }
}

export const vixsrcProvider: Provider = {
    name: "Vixsrc",
    id: "vixsrc",
    async streamMovie(tmdbId: string) {
        return getVixsrcStreams(tmdbId, "movie");
    },
    async streamTV(tmdbId: string, season: number, episode: number) {
        return getVixsrcStreams(tmdbId, "tv", season, episode);
    },
};
