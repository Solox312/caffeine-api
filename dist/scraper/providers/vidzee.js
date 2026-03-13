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
exports.vidzeeProvider = void 0;
const VIDZEE_API_BASE = "https://player.vidzee.wtf/api/server";
const VIDZEE_REFERER = "https://core.vidzee.wtf/";
const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: VIDZEE_REFERER,
};
function resolveFetchUrl(url) {
    var _a;
    const workersUrl = (_a = process.env.WORKERS_URL) === null || _a === void 0 ? void 0 : _a.trim();
    if (!workersUrl)
        return url;
    const sep = workersUrl.includes("?") ? "&" : "?";
    return `${workersUrl}${sep}url=${encodeURIComponent(url)}`;
}
function makeRequest(url, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = Object.assign(Object.assign({}, DEFAULT_HEADERS), options.headers);
        const fetchUrl = resolveFetchUrl(url);
        const response = yield fetch(fetchUrl, Object.assign({ method: options.method || "GET", headers, signal: AbortSignal.timeout(7000) }, options));
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
    });
}
function getStreamsFromServer(tmdbId, mediaType, server, seasonNum, episodeNum) {
    return __awaiter(this, void 0, void 0, function* () {
        let targetApiUrl = `${VIDZEE_API_BASE}?id=${tmdbId}&sr=${server}`;
        if (mediaType === "tv" && seasonNum != null && episodeNum != null) {
            targetApiUrl += `&ss=${seasonNum}&ep=${episodeNum}`;
        }
        const response = yield makeRequest(targetApiUrl);
        const responseData = yield response.json();
        if (!responseData || typeof responseData !== "object") {
            return [];
        }
        let apiSources = [];
        if (responseData.url && Array.isArray(responseData.url)) {
            apiSources = responseData.url;
        }
        else if (responseData.link && typeof responseData.link === "string") {
            apiSources = [
                {
                    link: responseData.link,
                    name: responseData.name,
                    type: responseData.type,
                    language: responseData.language || responseData.lang,
                },
            ];
        }
        if (!apiSources.length)
            return [];
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
    });
}
function getVidZeeStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    return __awaiter(this, void 0, void 0, function* () {
        const servers = [3, 4, 5];
        try {
            const results = yield Promise.all(servers.map((server) => getStreamsFromServer(tmdbId, mediaType, server, seasonNum, episodeNum)));
            return results.flat();
        }
        catch (err) {
            console.error(`[VidZee] Error: ${err instanceof Error ? err.message : "Unknown error"}`);
            return [];
        }
    });
}
exports.vidzeeProvider = {
    name: "VidZee",
    id: "vidzee",
    streamMovie(tmdbId) {
        return __awaiter(this, void 0, void 0, function* () {
            return getVidZeeStreams(String(tmdbId), "movie");
        });
    },
    streamTV(tmdbId, season, episode) {
        return __awaiter(this, void 0, void 0, function* () {
            return getVidZeeStreams(String(tmdbId), "tv", season, episode);
        });
    },
};
