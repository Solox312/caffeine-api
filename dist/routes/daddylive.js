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
});
exports.default = routes;
