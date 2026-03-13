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
const daddylive_1 = require("../providers/daddylive");
const api_constants_1 = require("../constants/api_constants");
const routes = (fastify) => __awaiter(void 0, void 0, void 0, function* () {
    fastify.get("/", (_, rp) => __awaiter(void 0, void 0, void 0, function* () {
        rp.status(200).send({
            intro: "Welcome to the daddylive provider",
            routes: "/live",
        });
    }));
    fastify.get("/live", (_, rp) => __awaiter(void 0, void 0, void 0, function* () {
        const channels = yield (0, daddylive_1.get247)();
        if (channels && channels.length > 0) {
            return rp.status(200).send({
                base_url: api_constants_1.daddyliveStreamBaseUrl,
                trailing_url: api_constants_1.daddyliveTrailingUrl,
                referrer: api_constants_1.daddyliveReferrer,
                user_agent: api_constants_1.daddyliveUserAgent,
                channels,
            });
        }
        return rp.status(503).send({
            message: "Channels temporarily unavailable. The source may be down or changed.",
        });
    }));
    /** Extract HLS (m3u8) URL from a Daddylive embed or watch page. Query: url (required). */
    fastify.get("/extract-hls", (req, rp) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const rawUrl = (_a = req.query) === null || _a === void 0 ? void 0 : _a.url;
        if (!rawUrl || typeof rawUrl !== "string") {
            return rp.status(400).send({ error: "Missing url query parameter" });
        }
        let hls = null;
        hls = yield (0, daddylive_1.extractHlsFromUrl)(rawUrl);
        if (!hls) {
            // Try alternate domains if URL is from daddylive
            try {
                const u = new URL(rawUrl);
                if (u.hostname.includes("daddylive") || u.hostname.includes("dlhd")) {
                    for (const base of api_constants_1.daddyliveDomains) {
                        const path = u.pathname + u.search;
                        const alt = base + (path.startsWith("/") ? path : "/" + path);
                        hls = yield (0, daddylive_1.extractHlsFromUrl)(alt);
                        if (hls)
                            break;
                    }
                }
            }
            catch (_b) {
                // ignore
            }
        }
        if (hls) {
            return rp.status(200).send({ hls });
        }
        return rp.status(404).send({ error: "No HLS stream found in page" });
    }));
    /** Get HLS URL for a channel ID. For 24/7 channels, returns direct m3u8. Query: id (channel id), source=tv|tv2. */
    fastify.get("/hls", (req, rp) => __awaiter(void 0, void 0, void 0, function* () {
        var _c, _d, _e;
        const id = (_c = req.query) === null || _c === void 0 ? void 0 : _c.id;
        if (!id || typeof id !== "string") {
            return rp.status(400).send({ error: "Missing id query parameter" });
        }
        const source = ((_e = (_d = req.query) === null || _d === void 0 ? void 0 : _d.source) !== null && _e !== void 0 ? _e : "tv") === "tv2" ? "tv2" : "tv";
        // 24/7 channels use direct HLS: base + id + trailing
        if (/^\d+$/.test(id)) {
            const direct = api_constants_1.daddyliveStreamBaseUrl + "/" + id + api_constants_1.daddyliveTrailingUrl;
            return rp.status(200).send({
                hls: direct,
                referrer: api_constants_1.daddyliveReferrer,
                user_agent: api_constants_1.daddyliveUserAgent,
            });
        }
        // Event paths like admin/ppv-event/1: need to fetch embed page and extract
        const embedPath = "/embed?id=" + encodeURIComponent(id) + "&player=1&source=" + source;
        for (const base of api_constants_1.daddyliveDomains) {
            const url = base + embedPath;
            const hls = yield (0, daddylive_1.extractHlsFromUrl)(url);
            if (hls) {
                return rp.status(200).send({ hls });
            }
        }
        return rp.status(404).send({ error: "No HLS stream found for channel" });
    }));
});
exports.default = routes;
