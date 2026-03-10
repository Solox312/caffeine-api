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

    const m3u8Re = /https?:\/\/[^\s"'<>)\]]+\.m3u8(?:\?[^\s"'<>)\]]*)?/gi;
    const mpdRe = /https?:\/\/[^\s"'<>)\]]+\.mpd(?:\?[^\s"'<>)\]]*)?/gi;
    for (const m of text.matchAll(m3u8Re)) out.add(m[0].replace(/\\\//g, "/"));
    for (const m of text.matchAll(mpdRe)) out.add(m[0].replace(/\\\//g, "/"));

    const escapedRe = /(?:https?:\\?\/\\?\/[^"'\s\\]+\.(?:m3u8|mpd)(?:[^"'\s\\]*)?)/gi;
    for (const m of text.matchAll(escapedRe)) {
        const u = m[0].replace(/\\\//g, "/").replace(/\\/g, "");
        if (u.startsWith("http")) out.add(u);
    }

    const quotedRe = /["'](https?:\/\/[^"']*(?:m3u8|mpd)[^"']*)["']/gi;
    for (const m of text.matchAll(quotedRe)) {
        if (m[1]) out.add(m[1].replace(/\\\//g, "/"));
    }

    const relRe = /["'](\/(?!\/)[^"']*\.(?:m3u8|mpd)(?:\?[^"']*)?)["']/gi;
    for (const m of text.matchAll(relRe)) {
        if (m[1]) out.add(origin + m[1]);
    }

    const livePathRe = /https?:\/\/[^\s"'<>)\]]+(?:\/live\/|\/stream\/|\/hls\/|\/dash\/)[^\s"'<>)\]]+/gi;
    for (const m of text.matchAll(livePathRe)) out.add(m[0].replace(/\\\//g, "/"));

    return Array.from(out).filter((u) => {
        try {
            const parsed = new URL(u);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
            return false;
        }
    });
}

/** Extract iframe src URLs from HTML */
function extractIframeSrcs(html: string, pageOrigin: string): string[] {
    const out = new Set<string>();
    const $ = load(html);
    $("iframe[src]").each((_, el) => {
        const src = $(el).attr("src");
        if (!src || src.startsWith("javascript:") || src.startsWith("data:")) return;
        try {
            const full = new URL(src, pageOrigin).href;
            if (full.startsWith("http")) out.add(full);
        } catch {
            // ignore
        }
    });
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
                events.push({
                    id,
                    title: title.slice(0, 120),
                    url: fullUrl,
                    sport,
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
    if (iframeSrcs.length > 0) {
        console.log(`[Streameast] getStreamLinks: found ${iframeSrcs.length} iframe(s), fetching up to 3`);
        const toFetch = iframeSrcs.slice(0, 3);
        for (const iframeUrl of toFetch) {
            try {
                const iframeHtml = await fetchWithTimeout(iframeUrl, {
                    referrer: resolved,
                    timeoutMs: 10000,
                });
                const embedLinks = extractStreamLinks(iframeHtml, iframeUrl);
                embedLinks.forEach((u) => allLinks.add(u));
                if (embedLinks.length > 0) {
                    console.log(`[Streameast] getStreamLinks: iframe ${iframeUrl.slice(0, 50)}... yielded ${embedLinks.length} link(s)`);
                }
            } catch (e) {
                console.warn(`[Streameast] getStreamLinks: iframe fetch failed`, iframeUrl.slice(0, 60), e);
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
