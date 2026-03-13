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
exports.vidsrcProvider = void 0;
const SOURCE_URL = "https://vidsrc.xyz/embed";
let BASEDOM = "https://cloudnestra.com";
const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "sec-ch-ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
};
/** When WORKERS_URL is set, fetch via proxy to avoid 403 from provider blocking server IPs. */
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
        try {
            const response = yield fetch(fetchUrl, Object.assign({ method: options.method || "GET", headers }, options));
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response;
        }
        catch (error) {
            console.error(`[VidSrc] Request failed for ${url}: ${error instanceof Error ? error.message : "Unknown error"}`);
            throw error;
        }
    });
}
function serversLoad(html) {
    return __awaiter(this, void 0, void 0, function* () {
        const servers = [];
        let title = "";
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
        if (titleMatch) {
            title = titleMatch[1].trim();
        }
        const iframeSrcMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/);
        if (iframeSrcMatch) {
            const baseFrameSrc = iframeSrcMatch[1];
            try {
                const fullUrl = baseFrameSrc.startsWith("//")
                    ? "https:" + baseFrameSrc
                    : baseFrameSrc;
                BASEDOM = new URL(fullUrl).origin;
                console.log(`[VidSrc] Updated BASEDOM to: ${BASEDOM}`);
            }
            catch (_a) {
                const originMatch = (baseFrameSrc.startsWith("//")
                    ? "https:" + baseFrameSrc
                    : baseFrameSrc).match(/^(https?:\/\/[^/]+)/);
                if (originMatch && originMatch[1]) {
                    BASEDOM = originMatch[1];
                    console.log(`[VidSrc] Updated BASEDOM via regex fallback to: ${BASEDOM}`);
                }
            }
        }
        const serverRegex = /<div[^>]+class=["'][^"']*server[^"']*["'][^>]*data-hash=["']([^"']*)["'][^>]*>([^<]+)<\/div>/g;
        let match;
        while ((match = serverRegex.exec(html)) !== null) {
            servers.push({
                name: match[2].trim(),
                dataHash: match[1] || null,
            });
        }
        return { servers, title };
    });
}
function parseMasterM3U8(m3u8Content, masterM3U8Url) {
    return __awaiter(this, void 0, void 0, function* () {
        const lines = m3u8Content.split("\n").map((line) => line.trim());
        const streams = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith("#EXT-X-STREAM-INF:")) {
                const infoLine = lines[i];
                let quality = "unknown";
                const resolutionMatch = infoLine.match(/RESOLUTION=(\d+x\d+)/);
                if (resolutionMatch) {
                    quality = resolutionMatch[1];
                }
                else {
                    const bandwidthMatch = infoLine.match(/BANDWIDTH=(\d+)/);
                    if (bandwidthMatch) {
                        quality = `${Math.round(parseInt(bandwidthMatch[1]) / 1000)}kbps`;
                    }
                }
                if (i + 1 < lines.length &&
                    lines[i + 1] &&
                    !lines[i + 1].startsWith("#")) {
                    const streamUrlPart = lines[i + 1];
                    try {
                        const fullStreamUrl = new URL(streamUrlPart, masterM3U8Url).href;
                        streams.push({ quality, url: fullStreamUrl });
                    }
                    catch (_a) {
                        streams.push({ quality, url: streamUrlPart });
                    }
                    i++;
                }
            }
        }
        streams.sort((a, b) => {
            const getHeight = (q) => {
                const m = q.match(/(\d+)x(\d+)/);
                return m ? parseInt(m[2], 10) : 0;
            };
            return getHeight(b.quality) - getHeight(a.quality);
        });
        return streams;
    });
}
function PRORCPhandler(prorcp) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const prorcpUrl = `${BASEDOM}/prorcp/${prorcp}`;
            console.log(`[VidSrc] Fetching PRORCP: ${prorcpUrl}`);
            const prorcpFetch = yield makeRequest(prorcpUrl, {
                headers: {
                    "sec-fetch-dest": "script",
                    "sec-fetch-mode": "no-cors",
                    "sec-fetch-site": "same-origin",
                    Referer: `${BASEDOM}/`,
                    "Referrer-Policy": "origin",
                },
            });
            const prorcpResponse = yield prorcpFetch.text();
            const regex = /file:\s*'([^']*)'/gm;
            const match = regex.exec(prorcpResponse);
            if (match && match[1]) {
                const masterM3U8Url = match[1];
                console.log(`[VidSrc] Found master M3U8: ${masterM3U8Url}`);
                const m3u8FileFetch = yield makeRequest(masterM3U8Url, {
                    headers: { Referer: prorcpUrl, Accept: "*/*" },
                });
                const m3u8Content = yield m3u8FileFetch.text();
                return parseMasterM3U8(m3u8Content, masterM3U8Url);
            }
            console.warn("[VidSrc] No master M3U8 URL found in prorcp response");
            return null;
        }
        catch (error) {
            console.error(`[VidSrc] Error in PRORCPhandler: ${error instanceof Error ? error.message : "Unknown error"}`);
            return null;
        }
    });
}
function SRCRCPhandler(srcrcpPath, refererForSrcrcp) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const srcrcpUrl = BASEDOM + srcrcpPath;
            console.log(`[VidSrc] Fetching SRCRCP: ${srcrcpUrl}`);
            const response = yield makeRequest(srcrcpUrl, {
                headers: {
                    "sec-fetch-dest": "iframe",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    Referer: refererForSrcrcp,
                    "Referrer-Policy": "origin",
                },
            });
            const responseText = yield response.text();
            const fileRegex = /file:\s*'([^']*)'/gm;
            const fileMatch = fileRegex.exec(responseText);
            if (fileMatch && fileMatch[1]) {
                const masterM3U8Url = fileMatch[1];
                console.log(`[VidSrc] Found M3U8 URL (file match): ${masterM3U8Url}`);
                const m3u8FileFetch = yield makeRequest(masterM3U8Url, {
                    headers: { Referer: srcrcpUrl, Accept: "*/*" },
                });
                const m3u8Content = yield m3u8FileFetch.text();
                return parseMasterM3U8(m3u8Content, masterM3U8Url);
            }
            if (responseText.trim().startsWith("#EXTM3U")) {
                console.log("[VidSrc] Response is M3U8 playlist directly");
                return parseMasterM3U8(responseText, srcrcpUrl);
            }
            const scriptMatches = responseText.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
            for (const scriptMatch of scriptMatches) {
                const scriptContent = (_a = scriptMatch[1]) !== null && _a !== void 0 ? _a : "";
                const patterns = [
                    /sources\s*[:=]\s*\[.*?file\s*:\s*['"]([^'"]+)['"]/s,
                    /file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
                    /src\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
                    /loadSource\(['"]([^'"]+\.m3u8[^'"]*)['"]\)/i,
                    /['"](https?:\/\/[^'"\s]+\.m3u8[^'"\s]*)['"]/i,
                ];
                for (const pattern of patterns) {
                    const m = scriptContent.match(pattern);
                    if (m && m[1]) {
                        const m3u8Url = m[1];
                        console.log(`[VidSrc] Found M3U8 URL in script: ${m3u8Url}`);
                        const absoluteM3u8Url = m3u8Url.startsWith("http")
                            ? m3u8Url
                            : new URL(m3u8Url, srcrcpUrl).href;
                        const m3u8FileFetch = yield makeRequest(absoluteM3u8Url, {
                            headers: { Referer: srcrcpUrl, Accept: "*/*" },
                        });
                        const m3u8Content = yield m3u8FileFetch.text();
                        return parseMasterM3U8(m3u8Content, absoluteM3u8Url);
                    }
                }
            }
            console.warn(`[VidSrc] No stream found for SRCRCP: ${srcrcpUrl}`);
            return null;
        }
        catch (error) {
            console.error(`[VidSrc] Error in SRCRCPhandler: ${error instanceof Error ? error.message : "Unknown error"}`);
            return null;
        }
    });
}
function rcpGrabber(html) {
    return __awaiter(this, void 0, void 0, function* () {
        const regex = /src:\s*'([^']*)'/;
        const match = html.match(regex);
        if (!match || !match[1])
            return null;
        return { metadata: { image: "" }, data: match[1] };
    });
}
function getUrl(id, type) {
    if (type === "movie") {
        return `${SOURCE_URL}/movie/${id}`;
    }
    else {
        const arr = id.split(":");
        return `${SOURCE_URL}/tv/${arr[0]}/${arr[1]}-${arr[2]}`;
    }
}
function getStreamContent(id, type) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = getUrl(id, type);
        console.log(`[VidSrc] Fetching embed page: ${url}`);
        try {
            const embedRes = yield makeRequest(url, {
                headers: { Referer: SOURCE_URL },
            });
            const embedResp = yield embedRes.text();
            const { servers } = yield serversLoad(embedResp);
            console.log(`[VidSrc] Found ${servers.length} servers`);
            const serverPromises = servers.map((server) => __awaiter(this, void 0, void 0, function* () {
                if (!server.dataHash)
                    return null;
                try {
                    const rcpUrl = `${BASEDOM}/rcp/${server.dataHash}`;
                    const rcpRes = yield makeRequest(rcpUrl, {
                        headers: {
                            "sec-fetch-dest": "iframe",
                            Referer: url,
                        },
                    });
                    const rcpHtml = yield rcpRes.text();
                    const rcpData = yield rcpGrabber(rcpHtml);
                    if (!rcpData || !rcpData.data) {
                        console.warn(`[VidSrc] Skipping server ${server.name} - no rcp data`);
                        return null;
                    }
                    let streamDetails = null;
                    if (rcpData.data.startsWith("/prorcp/")) {
                        streamDetails = yield PRORCPhandler(rcpData.data.replace("/prorcp/", ""));
                    }
                    else if (rcpData.data.startsWith("/srcrcp/")) {
                        if (server.name === "Superembed" ||
                            server.name === "2Embed") {
                            console.warn(`[VidSrc] Skipping known problematic server: ${server.name}`);
                            return null;
                        }
                        streamDetails = yield SRCRCPhandler(rcpData.data, rcpUrl);
                    }
                    else {
                        console.warn(`[VidSrc] Unhandled rcp data type for ${server.name}: ${rcpData.data.substring(0, 50)}`);
                        return null;
                    }
                    if (streamDetails && streamDetails.length > 0) {
                        return streamDetails.map((stream) => ({
                            server: server.name,
                            url: stream.url,
                            isM3U8: true,
                            quality: stream.quality,
                            subtitles: [],
                        }));
                    }
                    return null;
                }
                catch (e) {
                    console.error(`[VidSrc] Error processing server ${server.name}: ${e instanceof Error ? e.message : "Unknown error"}`);
                    return null;
                }
            }));
            const results = yield Promise.all(serverPromises);
            const allLinks = [];
            for (const result of results) {
                if (result && Array.isArray(result)) {
                    allLinks.push(...result);
                }
            }
            console.log(`[VidSrc] Found ${allLinks.length} total stream links`);
            return allLinks;
        }
        catch (error) {
            console.error(`[VidSrc] Error in getStreamContent: ${error instanceof Error ? error.message : "Unknown error"}`);
            return [];
        }
    });
}
exports.vidsrcProvider = {
    name: "VidSrc",
    id: "vidsrc",
    streamMovie(tmdbId) {
        return __awaiter(this, void 0, void 0, function* () {
            return getStreamContent(tmdbId, "movie");
        });
    },
    streamTV(tmdbId, season, episode) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = `${tmdbId}:${season}:${episode}`;
            return getStreamContent(id, "tv");
        });
    },
};
