/**
 * VidSrc streaming provider - from flixquest-scraper
 * https://github.com/BeamlakAschalew/flixquest-scraper/blob/main/src/providers/vidsrc.ts
 */
import type { Provider, ProviderLink, Subtitle } from "../types";

const SOURCE_URL = "https://vidsrc.xyz/embed";
let BASEDOM = "https://cloudnestra.com";

const DEFAULT_HEADERS: Record<string, string> = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "sec-ch-ua":
        '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
};

async function makeRequest(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const headers = {
        ...DEFAULT_HEADERS,
        ...(options.headers as Record<string, string>),
    };

    try {
        const response = await fetch(url, {
            method: options.method || "GET",
            headers,
            ...options,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
    } catch (error) {
        console.error(
            `[VidSrc] Request failed for ${url}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
    }
}

interface ServerInfo {
    name: string;
    dataHash: string | null;
}

async function serversLoad(
    html: string
): Promise<{ servers: ServerInfo[]; title: string }> {
    const servers: ServerInfo[] = [];
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
        } catch {
            const originMatch = (
                baseFrameSrc.startsWith("//")
                    ? "https:" + baseFrameSrc
                    : baseFrameSrc
            ).match(/^(https?:\/\/[^/]+)/);
            if (originMatch && originMatch[1]) {
                BASEDOM = originMatch[1];
            }
        }
    }

    const serverRegex =
        /<div[^>]+class=["'][^"']*server[^"']*["'][^>]*data-hash=["']([^"']*)["'][^>]*>([^<]+)<\/div>/g;
    let match;
    while ((match = serverRegex.exec(html)) !== null) {
        servers.push({
            name: match[2].trim(),
            dataHash: match[1] || null,
        });
    }

    return { servers, title };
}

interface StreamQuality {
    quality: string;
    url: string;
}

async function parseMasterM3U8(
    m3u8Content: string,
    masterM3U8Url: string
): Promise<StreamQuality[]> {
    const lines = m3u8Content.split("\n").map((line) => line.trim());
    const streams: StreamQuality[] = [];

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#EXT-X-STREAM-INF:")) {
            const infoLine = lines[i];
            let quality = "unknown";

            const resolutionMatch = infoLine.match(/RESOLUTION=(\d+x\d+)/);
            if (resolutionMatch) {
                quality = resolutionMatch[1];
            } else {
                const bandwidthMatch = infoLine.match(/BANDWIDTH=(\d+)/);
                if (bandwidthMatch) {
                    quality = `${Math.round(parseInt(bandwidthMatch[1]) / 1000)}kbps`;
                }
            }

            if (
                i + 1 < lines.length &&
                lines[i + 1] &&
                !lines[i + 1].startsWith("#")
            ) {
                const streamUrlPart = lines[i + 1];
                try {
                    const fullStreamUrl = new URL(
                        streamUrlPart,
                        masterM3U8Url
                    ).href;
                    streams.push({ quality, url: fullStreamUrl });
                } catch {
                    streams.push({ quality, url: streamUrlPart });
                }
                i++;
            }
        }
    }

    streams.sort((a, b) => {
        const getHeight = (q: string) => {
            const m = q.match(/(\d+)x(\d+)/);
            return m ? parseInt(m[2], 10) : 0;
        };
        return getHeight(b.quality) - getHeight(a.quality);
    });

    return streams;
}

async function PRORCPhandler(prorcp: string): Promise<StreamQuality[] | null> {
    try {
        const prorcpUrl = `${BASEDOM}/prorcp/${prorcp}`;

        const prorcpFetch = await makeRequest(prorcpUrl, {
            headers: {
                "sec-fetch-dest": "script",
                "sec-fetch-mode": "no-cors",
                "sec-fetch-site": "same-origin",
                Referer: `${BASEDOM}/`,
                "Referrer-Policy": "origin",
            },
        });

        const prorcpResponse = await prorcpFetch.text();
        const regex = /file:\s*'([^']*)'/gm;
        const match = regex.exec(prorcpResponse);

        if (match && match[1]) {
            const masterM3U8Url = match[1];
            const m3u8FileFetch = await makeRequest(masterM3U8Url, {
                headers: { Referer: prorcpUrl, Accept: "*/*" },
            });
            const m3u8Content = await m3u8FileFetch.text();
            return parseMasterM3U8(m3u8Content, masterM3U8Url);
        }

        return null;
    } catch (error) {
        console.error(
            `[VidSrc] Error in PRORCPhandler: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        return null;
    }
}

async function SRCRCPhandler(
    srcrcpPath: string,
    refererForSrcrcp: string
): Promise<StreamQuality[] | null> {
    try {
        const srcrcpUrl = BASEDOM + srcrcpPath;

        const response = await makeRequest(srcrcpUrl, {
            headers: {
                "sec-fetch-dest": "iframe",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                Referer: refererForSrcrcp,
                "Referrer-Policy": "origin",
            },
        });

        const responseText = await response.text();

        const fileRegex = /file:\s*'([^']*)'/gm;
        const fileMatch = fileRegex.exec(responseText);
        if (fileMatch && fileMatch[1]) {
            const masterM3U8Url = fileMatch[1];
            const m3u8FileFetch = await makeRequest(masterM3U8Url, {
                headers: { Referer: srcrcpUrl, Accept: "*/*" },
            });
            const m3u8Content = await m3u8FileFetch.text();
            return parseMasterM3U8(m3u8Content, masterM3U8Url);
        }

        if (responseText.trim().startsWith("#EXTM3U")) {
            return parseMasterM3U8(responseText, srcrcpUrl);
        }

        const scriptMatches = responseText.matchAll(
            /<script[^>]*>([\s\S]*?)<\/script>/g
        );
        for (const scriptMatch of scriptMatches) {
            const scriptContent = scriptMatch[1] ?? "";
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
                    const absoluteM3u8Url = m3u8Url.startsWith("http")
                        ? m3u8Url
                        : new URL(m3u8Url, srcrcpUrl).href;
                    const m3u8FileFetch = await makeRequest(absoluteM3u8Url, {
                        headers: { Referer: srcrcpUrl, Accept: "*/*" },
                    });
                    const m3u8Content = await m3u8FileFetch.text();
                    return parseMasterM3U8(m3u8Content, absoluteM3u8Url);
                }
            }
        }

        return null;
    } catch (error) {
        console.error(
            `[VidSrc] Error in SRCRCPhandler: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        return null;
    }
}

async function rcpGrabber(html: string): Promise<{
    metadata: { image: string };
    data: string;
} | null> {
    const regex = /src:\s*'([^']*)'/;
    const match = html.match(regex);
    if (!match || !match[1]) return null;
    return { metadata: { image: "" }, data: match[1] };
}

function getUrl(id: string, type: "movie" | "tv"): string {
    if (type === "movie") {
        return `${SOURCE_URL}/movie/${id}`;
    } else {
        const arr = id.split(":");
        return `${SOURCE_URL}/tv/${arr[0]}/${arr[1]}-${arr[2]}`;
    }
}

async function getStreamContent(
    id: string,
    type: "movie" | "tv"
): Promise<ProviderLink[]> {
    const url = getUrl(id, type);

    try {
        const embedRes = await makeRequest(url, {
            headers: { Referer: SOURCE_URL },
        });
        const embedResp = await embedRes.text();
        const { servers } = await serversLoad(embedResp);

        const serverPromises = servers.map(async (server) => {
            if (!server.dataHash) return null;

            try {
                const rcpUrl = `${BASEDOM}/rcp/${server.dataHash}`;
                const rcpRes = await makeRequest(rcpUrl, {
                    headers: {
                        "sec-fetch-dest": "iframe",
                        Referer: url,
                    },
                });

                const rcpHtml = await rcpRes.text();
                const rcpData = await rcpGrabber(rcpHtml);

                if (!rcpData || !rcpData.data) return null;

                let streamDetails: StreamQuality[] | null = null;

                if (rcpData.data.startsWith("/prorcp/")) {
                    streamDetails = await PRORCPhandler(
                        rcpData.data.replace("/prorcp/", "")
                    );
                } else if (rcpData.data.startsWith("/srcrcp/")) {
                    if (
                        server.name === "Superembed" ||
                        server.name === "2Embed"
                    ) {
                        return null;
                    }
                    streamDetails = await SRCRCPhandler(rcpData.data, rcpUrl);
                } else {
                    return null;
                }

                if (streamDetails && streamDetails.length > 0) {
                    return streamDetails.map((stream) => ({
                        server: server.name,
                        url: stream.url,
                        isM3U8: true,
                        quality: stream.quality,
                        subtitles: [] as Subtitle[],
                    }));
                }

                return null;
            } catch {
                return null;
            }
        });

        const results = await Promise.all(serverPromises);

        const allLinks: ProviderLink[] = [];
        for (const result of results) {
            if (result && Array.isArray(result)) {
                allLinks.push(...result);
            }
        }

        return allLinks;
    } catch (error) {
        console.error(
            `[VidSrc] Error in getStreamContent: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        return [];
    }
}

export const vidsrcProvider: Provider = {
    name: "VidSrc",
    id: "vidsrc",

    async streamMovie(tmdbId: string): Promise<ProviderLink[]> {
        return getStreamContent(tmdbId, "movie");
    },

    async streamTV(
        tmdbId: string,
        season: number,
        episode: number
    ): Promise<ProviderLink[]> {
        const id = `${tmdbId}:${season}:${episode}`;
        return getStreamContent(id, "tv");
    },
};
