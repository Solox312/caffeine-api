/**
 * Live content provider for Streameast-style sites.
 * Lists events from the homepage and extracts m3u8/mpd stream links from event pages.
 * Set STREAMEAST_BASE_URL to a single URL or comma-separated mirrors (first that works is used).
 */
import { load } from "cheerio";

const DEFAULT_MIRRORS = [
    "https://v2.streameast.ga",
    "https://v2.streameast.ec",
    "https://v2.streameast.to",
    "https://streameast.games",
];

function getBaseUrls(): string[] {
    const env = process.env.STREAMEAST_BASE_URL?.trim();
    if (env) {
        return env.split(",").map((u) => u.trim()).filter(Boolean);
    }
    return DEFAULT_MIRRORS;
}

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DEFAULT_ORIGIN = "https://v2.streameast.ga";

export interface LiveEvent {
    id: string;
    title: string;
    url: string;
    sport?: string;
    logoUrl?: string;
}

function normalizeUrl(u: string): string {
    return u.replace(/\\\//g, "/").replace(/\\/g, "").trim();
}

function isValidHttpUrl(s: string): boolean {
    try {
        const parsed = new URL(s);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

/** Extract live stream URLs from HTML/JS (m3u8, mpd, stream paths) */
function extractStreamLinks(text: string, baseUrl: string): string[] {
    const out = new Set<string>();
    let origin: string;
    try {
        origin = new URL(baseUrl).origin;
    } catch {
        origin = DEFAULT_ORIGIN;
    }

    const add = (raw: string) => {
        const u = normalizeUrl(raw);
        if (u.startsWith("http") && isValidHttpUrl(u)) out.add(u);
    };

    const m3u8Re = /https?:\/\/[^\s"'<>)\]\}]+\.m3u8(?:\?[^\s"'<>)\]\}]*)?/gi;
    const mpdRe = /https?:\/\/[^\s"'<>)\]\}]+\.mpd(?:\?[^\s"'<>)\]\}]*)?/gi;
    for (const m of text.matchAll(m3u8Re)) add(m[0]);
    for (const m of text.matchAll(mpdRe)) add(m[0]);

    const escapedRe = /(?:https?:\\?\/\\?\/[^"'\s\\]+\.(?:m3u8|mpd)(?:[^"'\s\\]*)?)/gi;
    for (const m of text.matchAll(escapedRe)) add(m[0]);

    const quotedRe = /["'`](https?:\/\/[^"'`]*(?:m3u8|mpd)[^"'`]*)["'`]/gi;
    for (const m of text.matchAll(quotedRe)) {
        if (m[1]) add(m[1]);
    }

    const relRe = /["'`](\/(?!\/)[^"'`]*\.(?:m3u8|mpd)(?:\?[^"'`]*)?)["'`]/gi;
    for (const m of text.matchAll(relRe)) {
        if (m[1]) add(origin + m[1]);
    }

    const livePathRe = /https?:\/\/[^\s"'<>)\]]+(?:\/live\/|\/stream\/|\/hls\/|\/dash\/|\/m3u8\/)[^\s"'<>)\]]+/gi;
    for (const m of text.matchAll(livePathRe)) add(m[0]);

    const jsFileRe = /(?:file|src|url|source|hlsUrl|streamUrl|playlist)\s*[:=]\s*["'`]?(https?:\/\/[^"'\s)\]\},]+\.(?:m3u8|mpd)[^"'\s)\]\},]*)["'`]?/gi;
    for (const m of text.matchAll(jsFileRe)) {
        if (m[1]) add(m[1]);
    }
    const jsUnescapedRe = /(?:file|src|url|source)\s*[:=]\s*["'](https?:\\?\/\\?\/[^"']+\.(?:m3u8|mpd)[^"']*)["']/gi;
    for (const m of text.matchAll(jsUnescapedRe)) {
        if (m[1]) add(m[1]);
    }

    const jsonLikeRe = /(?:sources|sourcesList|playlist)\s*[\[:]\s*[^\]]*?(https?:\/\/[^\s"'\]]+\.(?:m3u8|mpd)[^\s"'\]]*)/gi;
    for (const m of text.matchAll(jsonLikeRe)) {
        if (m[1]) add(m[1]);
    }

    return Array.from(out);
}

/** Extract iframe and embed-like URLs from HTML (iframe src, data-src, embed links) */
function extractIframeSrcs(html: string, pageOrigin: string): string[] {
    const out = new Set<string>();
    const $ = load(html);
    const addUrl = (raw: string | undefined) => {
        if (!raw || raw.startsWith("javascript:") || raw.startsWith("data:") || raw.length < 10) return;
        try {
            const full = new URL(raw, pageOrigin).href;
            if (full.startsWith("http") && !full.startsWith("https://www.google.com")) out.add(full);
        } catch {
            // ignore
        }
    };
    $("iframe[src]").each((_, el) => addUrl($(el).attr("src")));
    $("iframe[data-src]").each((_, el) => addUrl($(el).attr("data-src")));
    $("iframe[data-lazy-src]").each((_, el) => addUrl($(el).attr("data-lazy-src")));
    $("[data-embed]").each((_, el) => addUrl($(el).attr("data-embed")));
    $("[data-src]").each((_, el) => addUrl($(el).attr("data-src")));
    $("[data-url]").each((_, el) => addUrl($(el).attr("data-url")));
    $('a[href*="embed"], a[href*="player"], a[href*="stream"]').each((_, el) => {
        const href = $(el).attr("href");
        if (href && /embed|player|stream|watch/.test(href)) addUrl(href);
    });
    const scriptHtml = $("script").text();
    const iframeInScript = /(?:src|url|iframe)\s*[:=]\s*["'](https?:\/\/[^"']+(?:embed|player|stream|watch)[^"']*)["']/gi;
    for (const m of scriptHtml.matchAll(iframeInScript)) {
        if (m[1]) addUrl(m[1]);
    }
    return Array.from(out);
}

async function fetchWithTimeout(
    url: string,
    opts: { referrer?: string; timeoutMs?: number } = {}
): Promise<string> {
    const { referrer, timeoutMs = 12000 } = opts;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": USER_AGENT,
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                ...(referrer ? { Referer: referrer } : {}),
            },
            signal: controller.signal,
        });
        clearTimeout(t);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.text();
    } catch (e) {
        clearTimeout(t);
        throw e;
    }
}

/**
 * Fetch homepage and parse event links. Tries each mirror until one returns events.
 */
export async function getEvents(): Promise<{ baseUrl: string; events: LiveEvent[] }> {
    const mirrors = getBaseUrls();
    let lastError: Error | null = null;

    for (const baseUrl of mirrors) {
        const url = baseUrl.replace(/\/$/, "");
        try {
            console.log(`[Streameast] getEvents: trying ${url}`);
            const html = await fetchWithTimeout(url);
            const $ = load(html);
            const events: LiveEvent[] = [];
            const seen = new Set<string>();

            // Path segments that are league/category index pages, not individual events (no stream links on those pages)
            const nonEventSegments = new Set([
                "leagues", "league", "sports", "category", "categories", "live", "premium", "multi",
                "updates", "search", "login", "register", "account", "contact", "about", "terms",
            ]);
            // Accept path like /sport/slug where sport looks like a sport and slug is an event (e.g. team-vs-team)
            $("a[href]").each((_, el) => {
                const href = $(el).attr("href");
                if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:"))
                    return;
                let fullUrl: string;
                try {
                    fullUrl = new URL(href, url).href;
                } catch {
                    return;
                }
                if (!fullUrl.startsWith(url)) return;
                const path = new URL(fullUrl).pathname.replace(/^\/+|\/+$/g, "");
                const parts = path.split("/").filter(Boolean);
                if (parts.length < 2) return;
                const [sport, ...rest] = parts;
                const sportLower = sport.toLowerCase();
                if (!/^[a-z]{2,15}$/.test(sportLower)) return;
                if (nonEventSegments.has(sportLower)) return;
                const slug = rest.join("/");
                if (!slug || slug.length < 2) return;
                const id = `${sport}-${slug}`;
                if (seen.has(id)) return;
                seen.add(id);
                const title = $(el).text().trim() || `${sport} - ${slug.replace(/-/g, " ")}`;
                let logoUrl: string | undefined;
                const img = $(el).find("img").first().attr("src") ?? $(el).parent().find("img").first().attr("src");
                if (img && !img.startsWith("data:")) {
                    try {
                        logoUrl = new URL(img, url).href;
                    } catch {
                        // ignore
                    }
                }
                events.push({
                    id,
                    title: title.slice(0, 120),
                    url: fullUrl,
                    sport,
                    logoUrl,
                });
            });

            console.log(`[Streameast] getEvents: ${url} returned ${events.length} events`);
            if (events.length > 0) {
                return { baseUrl: url, events };
            }
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.warn(`[Streameast] getEvents: ${url} failed`, lastError.message);
        }
    }

    throw lastError || new Error("All mirrors failed");
}

/**
 * Fetch an event page and return extracted stream links. Also follows iframe embeds (one level).
 */
export async function getStreamLinks(eventUrl: string): Promise<{ url: string; links: string[] }> {
    let resolved: string;
    const mirrors = getBaseUrls();
    const origin = mirrors[0]?.replace(/\/$/, "") || DEFAULT_ORIGIN;
    try {
        resolved = new URL(eventUrl).href;
    } catch {
        resolved = new URL(eventUrl, origin).href;
    }

    console.log(`[Streameast] getStreamLinks: fetching ${resolved}`);
    const html = await fetchWithTimeout(resolved, { referrer: origin + "/", timeoutMs: 15000 });
    const allLinks = new Set<string>();

    const mainLinks = extractStreamLinks(html, resolved);
    mainLinks.forEach((u) => allLinks.add(u));
    console.log(`[Streameast] getStreamLinks: main page yielded ${mainLinks.length} link(s)`);

    const iframeSrcs = extractIframeSrcs(html, resolved);
    const toFetch = iframeSrcs.slice(0, 8);
    if (toFetch.length > 0) {
        console.log(`[Streameast] getStreamLinks: found ${iframeSrcs.length} embed/iframe(s), fetching up to ${toFetch.length}`);
        for (const iframeUrl of toFetch) {
            try {
                const iframeHtml = await fetchWithTimeout(iframeUrl, {
                    referrer: resolved,
                    timeoutMs: 12000,
                });
                const embedLinks = extractStreamLinks(iframeHtml, iframeUrl);
                embedLinks.forEach((u) => allLinks.add(u));
                if (embedLinks.length > 0) {
                    console.log(`[Streameast] getStreamLinks: iframe yielded ${embedLinks.length} link(s)`);
                } else {
                    const nestedIframes = extractIframeSrcs(iframeHtml, iframeUrl);
                    for (const nestedUrl of nestedIframes.slice(0, 3)) {
                        try {
                            const nestedHtml = await fetchWithTimeout(nestedUrl, {
                                referrer: iframeUrl,
                                timeoutMs: 10000,
                            });
                            const nestedLinks = extractStreamLinks(nestedHtml, nestedUrl);
                            nestedLinks.forEach((u) => allLinks.add(u));
                            if (nestedLinks.length > 0) {
                                console.log(`[Streameast] getStreamLinks: nested iframe yielded ${nestedLinks.length} link(s)`);
                            }
                        } catch {
                            // ignore
                        }
                    }
                }
            } catch (e) {
                console.warn(`[Streameast] getStreamLinks: iframe fetch failed`, iframeUrl.slice(0, 70), e);
            }
        }
    }

    const links = Array.from(allLinks);
    console.log(`[Streameast] getStreamLinks: total ${links.length} unique link(s)`);
    return { url: resolved, links };
}

export function getBaseUrl(): string {
    const mirrors = getBaseUrls();
    return (mirrors[0] || DEFAULT_ORIGIN).replace(/\/$/, "");
}
