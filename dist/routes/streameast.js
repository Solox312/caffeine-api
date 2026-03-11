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
const streameast_1 = require("../providers/streameast");
function streameastRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function* () {
        fastify.get("/", (_request, reply) => __awaiter(this, void 0, void 0, function* () {
            return reply.status(200).send({
                intro: "Streameast-style live provider",
                base_url: (0, streameast_1.getBaseUrl)(),
                routes: {
                    events: "GET /streameast/events - list live events",
                    stream: "GET /streameast/stream?url=<event_page_url> - get stream links for an event",
                },
            });
        }));
        fastify.get("/events", (_request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { baseUrl, events } = yield (0, streameast_1.getEvents)();
                return reply.status(200).send({
                    success: true,
                    base_url: baseUrl,
                    events,
                });
            }
            catch (err) {
                fastify.log.warn(err, "streameast/events failed");
                return reply.status(502).send({
                    success: false,
                    error: err instanceof Error ? err.message : "Failed to fetch events",
                });
            }
        }));
        fastify.get("/stream", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const eventUrl = (_a = request.query) === null || _a === void 0 ? void 0 : _a.url;
            if (!eventUrl || typeof eventUrl !== "string" || !eventUrl.trim()) {
                return reply.status(400).send({
                    success: false,
                    error: "Missing or invalid query: url (event page URL)",
                });
            }
            try {
                const { url, links } = yield (0, streameast_1.getStreamLinks)(eventUrl.trim());
                return reply.status(200).send({
                    success: true,
                    url,
                    count: links.length,
                    links,
                });
            }
            catch (err) {
                fastify.log.warn(err, "streameast/stream failed");
                return reply.status(502).send({
                    success: false,
                    error: err instanceof Error ? err.message : "Failed to fetch stream links",
                });
            }
        }));
    });
}
exports.default = streameastRoutes;
