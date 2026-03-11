"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.getBaseUrl = exports.getStreamLinks = exports.getEvents = void 0;
/**
 * Live content provider for Streameast-style sites.
 * Lists events from the homepage and extracts m3u8/mpd stream links from event pages.
 * Uses Playwright headless browser as fallback when plain fetch yields 0 links (JS-rendered content).
 * Set STREAMEAST_BASE_URL to a single URL or comma-separated mirrors (first that works is used).
 */
const cheerio_1 = require("cheerio");
// Official mirrors from https://gostreameast.is/ (updated Mar 2026)
const DEFAULT_MIRRORS = [
    "https://streameast.games",
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
function getBaseUrls() {
    var _a;
    const env = (_a = process.env.STREAMEAST_BASE_URL) === null || _a === void 0 ? void 0 : _a.trim();
    if (env) {
        return env.split(",").map((u) => u.trim()).filter(Boolean);
    }
    return DEFAULT_MIRRORS;
}
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DEFAULT_ORIGIN = "https://streameast.games";
function normalizeUrl(u) {
    return u.replace(/\\\//g, "/").replace(/\\/g, "").trim();
}
function isValidHttpUrl(s) {
    try {
        const parsed = new URL(s);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    }
    catch (_a) {
        return false;
    }
}
/** Extract live stream URLs from HTML/JS (m3u8, mpd, stream paths) */
function extractStreamLinks(text, baseUrl) {
    const out = new Set();
    let origin;
    try {
        origin = new URL(baseUrl).origin;
    }
    catch (_a) {
        origin = DEFAULT_ORIGIN;
    }
    const add = (raw) => {
        const u = normalizeUrl(raw);
        if (u.startsWith("http") && isValidHttpUrl(u))
            out.add(u);
    };
    const m3u8Re = /https?:\/\/[^\s"'<>)\]\}]+\.m3u8(?:\?[^\s"'<>)\]\}]*)?/gi;
    const mpdRe = /https?:\/\/[^\s"'<>)\]\}]+\.mpd(?:\?[^\s"'<>)\]\}]*)?/gi;
    for (const m of text.matchAll(m3u8Re))
        add(m[0]);
    for (const m of text.matchAll(mpdRe))
        add(m[0]);
    const escapedRe = /(?:https?:\\?\/\\?\/[^"'\s\\]+\.(?:m3u8|mpd)(?:[^"'\s\\]*)?)/gi;
    for (const m of text.matchAll(escapedRe))
        add(m[0]);
    const quotedRe = /["'`](https?:\/\/[^"'`]*(?:m3u8|mpd)[^"'`]*)["'`]/gi;
    for (const m of text.matchAll(quotedRe)) {
        if (m[1])
            add(m[1]);
    }
    const relRe = /["'`](\/(?!\/)[^"'`]*\.(?:m3u8|mpd)(?:\?[^"'`]*)?)["'`]/gi;
    for (const m of text.matchAll(relRe)) {
        if (m[1])
            add(origin + m[1]);
    }
    const livePathRe = /https?:\/\/[^\s"'<>)\]]+(?:\/live\/|\/stream\/|\/hls\/|\/dash\/|\/m3u8\/)[^\s"'<>)\]]+/gi;
    for (const m of text.matchAll(livePathRe))
        add(m[0]);
    const jsFileRe = /(?:file|src|url|source|hlsUrl|streamUrl|playlist)\s*[:=]\s*["'`]?(https?:\/\/[^"'\s)\]\},]+\.(?:m3u8|mpd)[^"'\s)\]\},]*)["'`]?/gi;
    for (const m of text.matchAll(jsFileRe)) {
        if (m[1])
            add(m[1]);
    }
    const jsUnescapedRe = /(?:file|src|url|source)\s*[:=]\s*["'](https?:\\?\/\\?\/[^"']+\.(?:m3u8|mpd)[^"']*)["']/gi;
    for (const m of text.matchAll(jsUnescapedRe)) {
        if (m[1])
            add(m[1]);
    }
    const jsonLikeRe = /(?:sources|sourcesList|playlist)\s*[\[:]\s*[^\]]*?(https?:\/\/[^\s"'\]]+\.(?:m3u8|mpd)[^\s"'\]]*)/gi;
    for (const m of text.matchAll(jsonLikeRe)) {
        if (m[1])
            add(m[1]);
    }
    return Array.from(out);
}
/** Extract iframe and embed-like URLs from HTML (iframe src, data-src, embed links) */
function extractIframeSrcs(html, pageOrigin) {
    const out = new Set();
    const $ = (0, cheerio_1.load)(html);
    const addUrl = (raw) => {
        if (!raw || raw.startsWith("javascript:") || raw.startsWith("data:") || raw.length < 10)
            return;
        try {
            const full = new URL(raw, pageOrigin).href;
            if (full.startsWith("http") && !full.startsWith("https://www.google.com"))
                out.add(full);
        }
        catch (_a) {
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
        if (href && /embed|player|stream|watch/.test(href))
            addUrl(href);
    });
    const scriptHtml = $("script").text();
    const iframeInScript = /(?:src|url|iframe)\s*[:=]\s*["'](https?:\/\/[^"']+(?:embed|player|stream|watch)[^"']*)["']/gi;
    for (const m of scriptHtml.matchAll(iframeInScript)) {
        if (m[1])
            addUrl(m[1]);
    }
    return Array.from(out);
}
/**
 * Headless browser fallback: capture m3u8/mpd from network responses and rendered DOM.
 * Uses playwright-core + @sparticuz/chromium for Vercel/serverless (no native Chromium needed).
 */
function getStreamLinksWithBrowser(eventUrl, pageOrigin) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let playwrightChromium;
        let sparticuzChromium;
        try {
            const pw = yield Promise.resolve().then(() => __importStar(require("playwright-core")));
            playwrightChromium = pw.chromium;
            const sp = yield Promise.resolve().then(() => __importStar(require("@sparticuz/chromium")));
            sparticuzChromium = (_a = sp.default) !== null && _a !== void 0 ? _a : sp;
        }
        catch (e) {
            console.warn("[Streameast] playwright-core/@sparticuz/chromium not available:", e);
            return [];
        }
        const collected = new Set();
        const add = (raw) => {
            const u = normalizeUrl(raw);
            if (u.startsWith("http") && isValidHttpUrl(u))
                collected.add(u);
        };
        let browser = null;
        try {
            const executablePath = yield sparticuzChromium.executablePath();
            browser = yield playwrightChromium.launch({
                executablePath,
                headless: true,
                args: sparticuzChromium.args,
            });
            const context = yield browser.newContext({
                userAgent: USER_AGENT,
                viewport: { width: 1280, height: 720 },
                ignoreHTTPSErrors: true,
            });
            const page = yield context.newPage();
            // Capture m3u8/mpd URLs from network responses
            page.on("response", (res) => {
                const url = res.url();
                if (/\.(m3u8|mpd)(\?|$)/i.test(url))
                    add(url);
            });
            console.log("[Streameast] getStreamLinksWithBrowser: navigating to", eventUrl.slice(0, 80));
            yield page.goto(eventUrl, {
                waitUntil: "networkidle",
                timeout: 20000,
            });
            // Wait a bit more for lazy-loaded players
            yield new Promise((r) => setTimeout(r, 3000));
            const html = yield page.content();
            const domLinks = extractStreamLinks(html, pageOrigin);
            domLinks.forEach(add);
            const iframeSrcs = extractIframeSrcs(html, pageOrigin);
            for (const iframeUrl of iframeSrcs.slice(0, 4)) {
                try {
                    const iframePage = yield context.newPage();
                    iframePage.on("response", (res) => {
                        const url = res.url();
                        if (/\.(m3u8|mpd)(\?|$)/i.test(url))
                            add(url);
                    });
                    yield iframePage.goto(iframeUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
                    yield new Promise((r) => setTimeout(r, 2000));
                    const iframeHtml = yield iframePage.content();
                    extractStreamLinks(iframeHtml, iframeUrl).forEach(add);
                    yield iframePage.close();
                }
                catch (_b) {
                    // ignore iframe fetch failures
                }
            }
            console.log("[Streameast] getStreamLinksWithBrowser: collected", collected.size, "link(s)");
            return Array.from(collected);
        }
        catch (err) {
            console.warn("[Streameast] getStreamLinksWithBrowser failed:", err instanceof Error ? err.message : err);
            return Array.from(collected);
        }
        finally {
            if (browser)
                yield browser.close().catch(() => { });
        }
    });
}
function fetchWithTimeout(url, opts = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const { referrer, timeoutMs = 12000 } = opts;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = yield fetch(url, {
                method: "GET",
                headers: Object.assign({ "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" }, (referrer ? { Referer: referrer } : {})),
                signal: controller.signal,
            });
            clearTimeout(t);
            if (!res.ok)
                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            return res.text();
        }
        catch (e) {
            clearTimeout(t);
            throw e;
        }
    });
}
/**
 * Fetch homepage and parse event links. Tries each mirror until one returns events.
 */
function getEvents() {
    return __awaiter(this, void 0, void 0, function* () {
        const mirrors = getBaseUrls();
        let lastError = null;
        for (const baseUrl of mirrors) {
            const url = baseUrl.replace(/\/$/, "");
            try {
                console.log(`[Streameast] getEvents: trying ${url}`);
                const html = yield fetchWithTimeout(url);
                const $ = (0, cheerio_1.load)(html);
                const events = [];
                const seen = new Set();
                // Path segments that are league/category index pages, not individual events (no stream links on those pages)
                const nonEventSegments = new Set([
                    "leagues", "league", "sports", "category", "categories", "live", "premium", "multi",
                    "updates", "search", "login", "register", "account", "contact", "about", "terms",
                ]);
                // Accept path like /sport/slug where sport looks like a sport and slug is an event (e.g. team-vs-team)
                $("a[href]").each((_, el) => {
                    var _a;
                    const href = $(el).attr("href");
                    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:"))
                        return;
                    let fullUrl;
                    try {
                        fullUrl = new URL(href, url).href;
                    }
                    catch (_b) {
                        return;
                    }
                    if (!fullUrl.startsWith(url))
                        return;
                    const path = new URL(fullUrl).pathname.replace(/^\/+|\/+$/g, "");
                    const parts = path.split("/").filter(Boolean);
                    if (parts.length < 2)
                        return;
                    const [sport, ...rest] = parts;
                    const sportLower = sport.toLowerCase();
                    if (!/^[a-z]{2,15}$/.test(sportLower))
                        return;
                    if (nonEventSegments.has(sportLower))
                        return;
                    const slug = rest.join("/");
                    if (!slug || slug.length < 2)
                        return;
                    const id = `${sport}-${slug}`;
                    if (seen.has(id))
                        return;
                    seen.add(id);
                    const title = $(el).text().trim() || `${sport} - ${slug.replace(/-/g, " ")}`;
                    let logoUrl;
                    const img = (_a = $(el).find("img").first().attr("src")) !== null && _a !== void 0 ? _a : $(el).parent().find("img").first().attr("src");
                    if (img && !img.startsWith("data:")) {
                        try {
                            logoUrl = new URL(img, url).href;
                        }
                        catch (_c) {
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
            }
            catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                console.warn(`[Streameast] getEvents: ${url} failed`, lastError.message);
            }
        }
        throw lastError || new Error("All mirrors failed");
    });
}
exports.getEvents = getEvents;
/**
 * Fetch an event page and return extracted stream links. Also follows iframe embeds (one level).
 */
function getStreamLinks(eventUrl) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let resolved;
        const mirrors = getBaseUrls();
        const origin = ((_a = mirrors[0]) === null || _a === void 0 ? void 0 : _a.replace(/\/$/, "")) || DEFAULT_ORIGIN;
        try {
            resolved = new URL(eventUrl).href;
        }
        catch (_b) {
            resolved = new URL(eventUrl, origin).href;
        }
        console.log(`[Streameast] getStreamLinks: fetching ${resolved}`);
        const html = yield fetchWithTimeout(resolved, { referrer: origin + "/", timeoutMs: 15000 });
        const allLinks = new Set();
        const mainLinks = extractStreamLinks(html, resolved);
        mainLinks.forEach((u) => allLinks.add(u));
        console.log(`[Streameast] getStreamLinks: main page yielded ${mainLinks.length} link(s)`);
        const iframeSrcs = extractIframeSrcs(html, resolved);
        const toFetch = iframeSrcs.slice(0, 8);
        if (toFetch.length > 0) {
            console.log(`[Streameast] getStreamLinks: found ${iframeSrcs.length} embed/iframe(s), fetching up to ${toFetch.length}`);
            for (const iframeUrl of toFetch) {
                try {
                    const iframeHtml = yield fetchWithTimeout(iframeUrl, {
                        referrer: resolved,
                        timeoutMs: 12000,
                    });
                    const embedLinks = extractStreamLinks(iframeHtml, iframeUrl);
                    embedLinks.forEach((u) => allLinks.add(u));
                    if (embedLinks.length > 0) {
                        console.log(`[Streameast] getStreamLinks: iframe yielded ${embedLinks.length} link(s)`);
                    }
                    else {
                        const nestedIframes = extractIframeSrcs(iframeHtml, iframeUrl);
                        for (const nestedUrl of nestedIframes.slice(0, 3)) {
                            try {
                                const nestedHtml = yield fetchWithTimeout(nestedUrl, {
                                    referrer: iframeUrl,
                                    timeoutMs: 10000,
                                });
                                const nestedLinks = extractStreamLinks(nestedHtml, nestedUrl);
                                nestedLinks.forEach((u) => allLinks.add(u));
                                if (nestedLinks.length > 0) {
                                    console.log(`[Streameast] getStreamLinks: nested iframe yielded ${nestedLinks.length} link(s)`);
                                }
                            }
                            catch (_c) {
                                // ignore
                            }
                        }
                    }
                }
                catch (e) {
                    console.warn(`[Streameast] getStreamLinks: iframe fetch failed`, iframeUrl.slice(0, 70), e);
                }
            }
        }
        let links = Array.from(allLinks);
        if (links.length === 0) {
            console.log("[Streameast] getStreamLinks: 0 links from fetch, trying headless browser fallback");
            const browserLinks = yield getStreamLinksWithBrowser(resolved, origin);
            browserLinks.forEach((u) => allLinks.add(u));
            links = Array.from(allLinks);
            console.log(`[Streameast] getStreamLinks: browser fallback yielded ${links.length} total link(s)`);
        }
        return { url: resolved, links };
    });
}
exports.getStreamLinks = getStreamLinks;
function getBaseUrl() {
    const mirrors = getBaseUrls();
    return (mirrors[0] || DEFAULT_ORIGIN).replace(/\/$/, "");
}
exports.getBaseUrl = getBaseUrl;
