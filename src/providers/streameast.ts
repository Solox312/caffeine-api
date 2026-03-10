/**
 * Live content provider for Streameast-style sites (e.g. v2.streameast.ga).
 * Lists events from the homepage and extracts m3u8/mpd stream links from event pages.
 */
import { load } from "cheerio";

const DEFAULT_BASE = "https://v2.streameast.ga";
const BASE_URL = process.env.STREAMEAST_BASE_URL || DEFAULT_BASE;

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
        origin = BASE_URL;
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

/**
 * Fetch homepage and parse event links (e.g. /nba/..., /nfl/..., /mlb/...).
 */
export async function getEvents(): Promise<{ baseUrl: string; events: LiveEvent[] }> {
    const url = BASE_URL.replace(/\/$/, "");
    const timeoutMs = 15000;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": USER_AGENT,
                Accept: "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            },
            signal: controller.signal,
        });
        clearTimeout(t);
        if (!res.ok) throw new Error(`Upstream ${res.status} ${res.statusText}`);
        const html = await res.text();
        const $ = load(html);
        const events: LiveEvent[] = [];
        const seen = new Set<string>();

        // Common sport path segments
        const sportSlugs = ["nba", "nfl", "nhl", "mlb", "ufc", "mma", "boxing", "soccer", "f1", "ncaaf", "wnba", "ncaab", "wwe"];
        $("a[href]").each((_, el) => {
            const href = $(el).attr("href");
            if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
            let fullUrl: string;
            try {
                fullUrl = new URL(href, url).href;
            } catch {
                return;
            }
            if (!fullUrl.startsWith(url)) return;
            const path = new URL(fullUrl).pathname.replace(/^\/+|\/+$/g, "");
            const parts = path.split("/");
            if (parts.length < 2) return;
            const [sport, ...rest] = parts;
            if (!sportSlugs.includes(sport.toLowerCase())) return;
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

        return { baseUrl: url, events };
    } catch (err) {
        clearTimeout(t);
        throw err;
    }
}

/**
 * Fetch an event page and return extracted stream links (m3u8, mpd).
 */
export async function getStreamLinks(eventUrl: string): Promise<{ url: string; links: string[] }> {
    let resolved: string;
    try {
        resolved = new URL(eventUrl).href;
    } catch {
        resolved = new URL(eventUrl, BASE_URL).href;
    }
    const timeoutMs = 15000;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(resolved, {
            method: "GET",
            headers: {
                "User-Agent": USER_AGENT,
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                Referer: BASE_URL + "/",
            },
            signal: controller.signal,
        });
        clearTimeout(t);
        if (!res.ok) throw new Error(`Upstream ${res.status} ${res.statusText}`);
        const text = await res.text();
        const links = extractStreamLinks(text, resolved);
        return { url: resolved, links };
    } catch (err) {
        clearTimeout(t);
        throw err;
    }
}

export function getBaseUrl(): string {
    return BASE_URL.replace(/\/$/, "");
}
