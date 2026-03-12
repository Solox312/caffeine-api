/**
 * Live content provider for Streameast-style sites.
 * Lists events from the homepage and extracts m3u8/mpd stream links from event pages.
 * Uses Playwright headless browser as fallback when plain fetch yields 0 links (JS-rendered content).
 * Set STREAMEAST_BASE_URL to a single URL or comma-separated mirrors (first that works is used).
 */
import { load } from "cheerio";

// Official mirrors (streameast.games removed — not official). Use STREAMEAST_BASE_URL to override.
const DEFAULT_MIRRORS = [
    "https://streameast.ga",
    "https://streameast.cf",
    "https://streameast.ch",
    "https://streameast.ec",
    "https://streameast.fi",
    "https://streameast.ms",
    "https://streameast.ph",
    "https://streameast.ps",
    "https://streameast.sg",
    "https://streameast.sk",
    "https://thestreameast.co",
    "https://thestreameast.fun",
    "https://thestreameast.ru",
    "https://thestreameast.su",
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

const DEFAULT_ORIGIN = "https://streameast.ga";

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

/**
 * Headless browser fallback: capture m3u8/mpd from network responses and rendered DOM.
 * Uses playwright-core + @sparticuz/chromium for Vercel/serverless (no native Chromium needed).
 */
async function getStreamLinksWithBrowser(eventUrl: string, pageOrigin: string): Promise<string[]> {
    let playwrightChromium: typeof import("playwright-core").chromium;
    let sparticuzChromium: { executablePath: () => Promise<string>; args: string[] };
    try {
        const pw = await import("playwright-core");
        playwrightChromium = pw.chromium;
        const sp = await import("@sparticuz/chromium");
        sparticuzChromium = sp.default ?? sp;
    } catch (e) {
        console.warn("[Streameast] playwright-core/@sparticuz/chromium not available:", e);
        return [];
    }

    const collected = new Set<string>();
    const add = (raw: string) => {
        const u = normalizeUrl(raw);
        if (u.startsWith("http") && isValidHttpUrl(u)) collected.add(u);
    };

    let browser: Awaited<ReturnType<typeof playwrightChromium.launch>> | null = null;
    try {
        const executablePath = await sparticuzChromium.executablePath();
        browser = await playwrightChromium.launch({
            executablePath,
            headless: true,
            args: sparticuzChromium.args,
        });
        const context = await browser.newContext({
            userAgent: USER_AGENT,
            viewport: { width: 1280, height: 720 },
            ignoreHTTPSErrors: true,
        });
        const page = await context.newPage();

        // Capture m3u8/mpd URLs from network responses
        page.on("response", (res) => {
            const url = res.url();
            if (/\.(m3u8|mpd)(\?|$)/i.test(url)) add(url);
        });

        console.log("[Streameast] getStreamLinksWithBrowser: navigating to", eventUrl.slice(0, 80));
        await page.goto(eventUrl, {
            waitUntil: "networkidle",
            timeout: 20000,
        });

        // Wait a bit more for lazy-loaded players
        await new Promise((r) => setTimeout(r, 3000));

        const html = await page.content();
        const domLinks = extractStreamLinks(html, pageOrigin);
        domLinks.forEach(add);

        const iframeSrcs = extractIframeSrcs(html, pageOrigin);
        for (const iframeUrl of iframeSrcs.slice(0, 4)) {
            try {
                const iframePage = await context.newPage();
                iframePage.on("response", (res) => {
                    const url = res.url();
                    if (/\.(m3u8|mpd)(\?|$)/i.test(url)) add(url);
                });
                await iframePage.goto(iframeUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
                await new Promise((r) => setTimeout(r, 2000));
                const iframeHtml = await iframePage.content();
                extractStreamLinks(iframeHtml, iframeUrl).forEach(add);
                await iframePage.close();
            } catch {
                // ignore iframe fetch failures
            }
        }

        console.log("[Streameast] getStreamLinksWithBrowser: collected", collected.size, "link(s)");
        return Array.from(collected);
    } catch (err) {
        console.warn("[Streameast] getStreamLinksWithBrowser failed:", err instanceof Error ? err.message : err);
        return Array.from(collected);
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

/** When WORKERS_URL is set, fetch via proxy to avoid 403/429/503 from mirrors blocking server IPs. */
/** When WORKERS_URL is set, clientIp is passed to the worker so it spoofs X-Forwarded-For / X-Real-IP / True-Client-IP on the upstream request. */
function resolveFetchUrl(url: string, clientIp?: string | null): string {
    const workersUrl = process.env.WORKERS_URL?.trim();
    if (!workersUrl) return url;
    const sep = workersUrl.includes("?") ? "&" : "?";
    let out = `${workersUrl}${sep}url=${encodeURIComponent(url)}`;
    if (clientIp && /^[\d.a-f:]+$/i.test(clientIp)) {
        out += `&client_ip=${encodeURIComponent(clientIp)}`;
        console.log("[Streameast] Using client IP for upstream request (spoofed in headers)");
    }
    return out;
}

async function fetchWithTimeout(
    url: string,
    opts: { referrer?: string; timeoutMs?: number; clientIp?: string | null } = {}
): Promise<string> {
    const { referrer, timeoutMs = 12000, clientIp } = opts;
    const fetchUrl = resolveFetchUrl(url, clientIp);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(fetchUrl, {
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

const NON_EVENT_SEGMENTS = new Set([
    "leagues", "league", "sports", "category", "categories", "live", "premium", "multi",
    "updates", "search", "login", "register", "account", "contact", "about", "terms",
]);

/** Parse event links from Streameast homepage HTML. */
function parseEventsFromHtml(html: string, baseUrl: string): LiveEvent[] {
    const $ = load(html);
    const events: LiveEvent[] = [];
    const seen = new Set<string>();
    const url = baseUrl.replace(/\/$/, "");
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
        if (NON_EVENT_SEGMENTS.has(sportLower)) return;
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
    return events;
}

/** Try to load events list using headless browser (real Chrome UA, sometimes bypasses blocks). */
async function getEventsWithBrowser(mirrorUrl: string): Promise<{ baseUrl: string; events: LiveEvent[] } | null> {
    let playwrightChromium: typeof import("playwright-core").chromium;
    let sparticuzChromium: { executablePath: () => Promise<string>; args: string[] };
    try {
        const pw = await import("playwright-core");
        playwrightChromium = pw.chromium;
        const sp = await import("@sparticuz/chromium");
        sparticuzChromium = sp.default ?? sp;
    } catch {
        return null;
    }
    const url = mirrorUrl.replace(/\/$/, "");
    let browser: Awaited<ReturnType<typeof playwrightChromium.launch>> | null = null;
    try {
        const executablePath = await sparticuzChromium.executablePath();
        browser = await playwrightChromium.launch({
            executablePath,
            headless: true,
            args: sparticuzChromium.args,
        });
        const context = await browser.newContext({
            userAgent: USER_AGENT,
            viewport: { width: 1280, height: 720 },
            ignoreHTTPSErrors: true,
        });
        const page = await context.newPage();
        console.log("[Streameast] getEventsWithBrowser: loading", url);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
        await new Promise((r) => setTimeout(r, 3000));
        const html = await page.content();
        const events = parseEventsFromHtml(html, url);
        console.log("[Streameast] getEventsWithBrowser: got", events.length, "events");
        if (events.length > 0) return { baseUrl: url, events };
        return null;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[Streameast] getEventsWithBrowser failed:", msg);
        if (/ENOENT|Failed to launch|chromium/i.test(msg)) {
            console.warn("[Streameast] Hint: set WORKERS_URL in .env to proxy requests, or run: npx playwright install chromium");
        }
        return null;
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

/** Cooldown (ms) for mirrors that returned 429/1015 so we don't hammer them. */
const MIRROR_RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const mirrorRateLimitUntil = new Map<string, number>();

function isRateLimited(msg: string): boolean {
    return /429|1015|530|rate limit/i.test(msg);
}

function skipMirrorIfRateLimited(url: string): boolean {
    const until = mirrorRateLimitUntil.get(url);
    if (until && Date.now() < until) return true;
    return false;
}

function setMirrorRateLimited(url: string): void {
    mirrorRateLimitUntil.set(url, Date.now() + MIRROR_RATE_LIMIT_COOLDOWN_MS);
}

/** Delay between mirror attempts to avoid bursting requests. */
const DELAY_BETWEEN_MIRRORS_MS = 2500;

/** Only try this many mirrors per request before browser fallback. */
const MAX_MIRRORS_TO_TRY = 2;

/** Recently successful mirrors (ranked first on next run). Max size. */
const PREFERRED_MIRRORS_MAX = 3;
const preferredMirrors: string[] = [];

function addPreferredMirror(url: string): void {
    const normalized = url.replace(/\/$/, "");
    const next = [normalized, ...preferredMirrors.filter((u) => u !== normalized)].slice(0, PREFERRED_MIRRORS_MAX);
    preferredMirrors.length = 0;
    preferredMirrors.push(...next);
}

/** Build list of mirrors to try: preferred (ranked) first, then rest, up to MAX_MIRRORS_TO_TRY. Skips cooldown. */
function getMirrorsToTry(): string[] {
    const all = getBaseUrls().map((u) => u.replace(/\/$/, ""));
    const available = all.filter((u) => !skipMirrorIfRateLimited(u));
    const preferred = preferredMirrors.filter((u) => available.includes(u));
    const rest = available.filter((u) => !preferred.includes(u));
    const ordered = [...preferred, ...rest];
    return ordered.slice(0, MAX_MIRRORS_TO_TRY);
}

export interface GetEventsOptions {
    clientIp?: string | null;
}

/**
 * Fetch homepage and parse event links. Tries up to 2 mirrors (ranked by recent success), then browser fallback.
 * Skips mirrors in cooldown. Successful mirrors are ranked first for later use.
 */
export async function getEvents(opts: GetEventsOptions = {}): Promise<{ baseUrl: string; events: LiveEvent[] }> {
    const { clientIp } = opts;
    const toTry = getMirrorsToTry();
    let lastError: Error | null = null;

    for (const baseUrl of toTry) {
        const url = baseUrl.replace(/\/$/, "");
        try {
            console.log(`[Streameast] getEvents: trying ${url}`);
            const html = await fetchWithTimeout(url, { clientIp });
            const events = parseEventsFromHtml(html, url);
            console.log(`[Streameast] getEvents: ${url} returned ${events.length} events`);
            if (events.length > 0) {
                addPreferredMirror(url);
                return { baseUrl: url, events };
            }
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.warn(`[Streameast] getEvents: ${url} failed`, lastError.message);
            if (isRateLimited(lastError.message)) setMirrorRateLimited(url);
            await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MIRRORS_MS));
        }
    }

    // Fallback: try first preferred or first from full list with headless browser
    const first = toTry[0] ?? getBaseUrls()[0]?.replace(/\/$/, "");
    console.log("[Streameast] getEvents: all fetch failed, trying browser fallback");
    if (first) {
        const result = await getEventsWithBrowser(first);
        if (result && result.events.length > 0) {
            addPreferredMirror(result.baseUrl);
            return result;
        }
    }

    throw lastError || new Error("All mirrors failed");
}

export interface GetStreamLinksOptions {
    clientIp?: string | null;
}

/**
 * Fetch an event page and return extracted stream links. Also follows iframe embeds (one level).
 * Pass clientIp so the worker can set X-Forwarded-For when using WORKERS_URL.
 */
export async function getStreamLinks(
    eventUrl: string,
    opts: GetStreamLinksOptions = {}
): Promise<{ url: string; links: string[] }> {
    const { clientIp } = opts;
    let resolved: string;
    const mirrors = getBaseUrls();
    const origin = mirrors[0]?.replace(/\/$/, "") || DEFAULT_ORIGIN;
    try {
        resolved = new URL(eventUrl).href;
    } catch {
        resolved = new URL(eventUrl, origin).href;
    }

    console.log(`[Streameast] getStreamLinks: fetching ${resolved}`);
    const html = await fetchWithTimeout(resolved, { referrer: origin + "/", timeoutMs: 15000, clientIp });
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
                    clientIp,
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
                                clientIp,
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

    let links = Array.from(allLinks);
    if (links.length === 0) {
        console.log("[Streameast] getStreamLinks: 0 links from fetch, trying headless browser fallback");
        const browserLinks = await getStreamLinksWithBrowser(resolved, origin);
        browserLinks.forEach((u) => allLinks.add(u));
        links = Array.from(allLinks);
        console.log(`[Streameast] getStreamLinks: browser fallback yielded ${links.length} total link(s)`);
    }
    return { url: resolved, links };
}

export function getBaseUrl(): string {
    const mirrors = getBaseUrls();
    return (mirrors[0] || DEFAULT_ORIGIN).replace(/\/$/, "");
}

/** Returns the mirror URL the client should fetch from the user's device (user's IP). Used for client-side fetch flow. */
export function getMirrorUrlForClient(): string {
    const toTry = getMirrorsToTry();
    return toTry[0] ?? getBaseUrl();
}

/** Parse event links from Streameast homepage HTML. Exported for POST /streameast/events/parse (client sends HTML). */
export function parseEventsFromHtmlPublic(html: string, baseUrl: string): LiveEvent[] {
    return parseEventsFromHtml(html, baseUrl.replace(/\/$/, ""));
}

/** Extract stream links from a single page HTML. Client fetches event page from device, sends HTML. */
export function parseStreamLinksFromHtml(html: string, pageUrl: string): { url: string; links: string[] } {
    const links = extractStreamLinks(html, pageUrl);
    return { url: pageUrl, links };
}
