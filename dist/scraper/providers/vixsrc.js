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
exports.vixsrcProvider = void 0;
const BASE_URL = "https://vixsrc.to";
const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json,*/*",
    "Accept-Language": "en-US,en;q=0.5",
    Connection: "keep-alive",
};
function makeRequest(url, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = Object.assign(Object.assign({}, DEFAULT_HEADERS), options.headers);
        try {
            const response = yield fetch(url, Object.assign({ method: options.method || "GET", headers }, options));
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response;
        }
        catch (error) {
            console.error(`[Vixsrc] Request failed for ${url}: ${error instanceof Error ? error.message : "Unknown error"}`);
            throw error;
        }
    });
}
function extractStreamFromPage(contentType, contentId, seasonNum, episodeNum) {
    return __awaiter(this, void 0, void 0, function* () {
        let vixsrcUrl;
        let subtitleApiUrl;
        if (contentType === "movie") {
            vixsrcUrl = `${BASE_URL}/movie/${contentId}`;
            subtitleApiUrl = `https://sub.wyzie.ru/search?id=${contentId}`;
        }
        else {
            vixsrcUrl = `${BASE_URL}/tv/${contentId}/${seasonNum}/${episodeNum}`;
            subtitleApiUrl = `https://sub.wyzie.ru/search?id=${contentId}&season=${seasonNum}&episode=${episodeNum}`;
        }
        console.log(`[Vixsrc] Fetching: ${vixsrcUrl}`);
        try {
            const response = yield makeRequest(vixsrcUrl, {
                headers: {
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
            });
            const html = yield response.text();
            console.log(`[Vixsrc] HTML length: ${html.length} characters`);
            let masterPlaylistUrl = null;
            // Method 1: Look for window.masterPlaylist (primary method)
            if (html.includes("window.masterPlaylist")) {
                console.log("[Vixsrc] Found window.masterPlaylist");
                const urlMatch = html.match(/url:\s*['"]([^'"]+)['"]/);
                const tokenMatch = html.match(/['"]?token['"]?\s*:\s*['"]([^'"]+)['"]/);
                const expiresMatch = html.match(/['"]?expires['"]?\s*:\s*['"]([^'"]+)['"]/);
                if (urlMatch && tokenMatch && expiresMatch) {
                    const baseUrl = urlMatch[1];
                    const token = tokenMatch[1];
                    const expires = expiresMatch[1];
                    console.log("[Vixsrc] Extracted tokens:");
                    console.log(`  - Base URL: ${baseUrl}`);
                    console.log(`  - Token: ${token.substring(0, 20)}...`);
                    console.log(`  - Expires: ${expires}`);
                    if (baseUrl.includes("?b=1")) {
                        masterPlaylistUrl = `${baseUrl}&token=${token}&expires=${expires}&h=1&lang=en`;
                    }
                    else {
                        masterPlaylistUrl = `${baseUrl}?token=${token}&expires=${expires}&h=1&lang=en`;
                    }
                    console.log(`[Vixsrc] Constructed master playlist URL: ${masterPlaylistUrl}`);
                }
            }
            // Method 2: Look for direct .m3u8 URLs
            if (!masterPlaylistUrl) {
                const m3u8Match = html.match(/(https?:\/\/[^'"\s]+\.m3u8[^'"\s]*)/);
                if (m3u8Match) {
                    masterPlaylistUrl = m3u8Match[1];
                    console.log("[Vixsrc] Found direct .m3u8 URL:", masterPlaylistUrl);
                }
            }
            // Method 3: Look for stream URLs in script tags
            if (!masterPlaylistUrl) {
                const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
                if (scriptMatches) {
                    for (const script of scriptMatches) {
                        const streamMatch = script.match(/['"]?(https?:\/\/[^'"\s]+(?:\.m3u8|playlist)[^'"\s]*)/);
                        if (streamMatch) {
                            masterPlaylistUrl = streamMatch[1];
                            console.log("[Vixsrc] Found stream in script:", masterPlaylistUrl);
                            break;
                        }
                    }
                }
            }
            if (!masterPlaylistUrl) {
                console.log("[Vixsrc] No master playlist URL found");
                return null;
            }
            return { masterPlaylistUrl, subtitleApiUrl };
        }
        catch (error) {
            console.error(`[Vixsrc] Error extracting stream: ${error instanceof Error ? error.message : "Unknown error"}`);
            return null;
        }
    });
}
function getSubtitles(subtitleApiUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield makeRequest(subtitleApiUrl);
            const subtitleData = yield response.json();
            const subtitles = [];
            const encodingPriority = [
                "ASCII",
                "UTF-8",
                "CP1252",
                "CP1250",
                "CP850",
            ];
            let englishSubtitle;
            for (const encoding of encodingPriority) {
                englishSubtitle = subtitleData.find((track) => track.display.includes("English") &&
                    track.encoding === encoding);
                if (englishSubtitle)
                    break;
            }
            if (englishSubtitle) {
                subtitles.push({
                    file: englishSubtitle.url,
                    label: englishSubtitle.display,
                    kind: "captions",
                    default: true,
                });
                console.log(`[Vixsrc] Found English subtitles: ${englishSubtitle.url}`);
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
            console.log(`[Vixsrc] Total subtitles found: ${subtitles.length}`);
            return subtitles;
        }
        catch (error) {
            console.log(`[Vixsrc] Subtitle fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`);
            return [];
        }
    });
}
function getVixsrcStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[Vixsrc] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);
        try {
            const streamData = yield extractStreamFromPage(mediaType, tmdbId, seasonNum, episodeNum);
            if (!streamData) {
                console.log("[Vixsrc] No stream data found");
                return [];
            }
            const { masterPlaylistUrl, subtitleApiUrl } = streamData;
            const subtitles = yield getSubtitles(subtitleApiUrl);
            const links = [
                {
                    server: "vixsrc",
                    url: masterPlaylistUrl,
                    isM3U8: true,
                    quality: "auto",
                    subtitles,
                },
            ];
            console.log("[Vixsrc] Successfully processed 1 stream with Auto quality");
            return links;
        }
        catch (error) {
            console.error(`[Vixsrc] Error in getVixsrcStreams: ${error instanceof Error ? error.message : "Unknown error"}`);
            return [];
        }
    });
}
exports.vixsrcProvider = {
    name: "Vixsrc",
    id: "vixsrc",
    streamMovie(tmdbId) {
        return __awaiter(this, void 0, void 0, function* () {
            return getVixsrcStreams(tmdbId, "movie");
        });
    },
    streamTV(tmdbId, season, episode) {
        return __awaiter(this, void 0, void 0, function* () {
            return getVixsrcStreams(tmdbId, "tv", season, episode);
        });
    },
};
