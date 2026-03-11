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
function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0)
        parts.push(`${d}d`);
    if (h > 0)
        parts.push(`${h}h`);
    if (m > 0)
        parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
}
function statusRoute(fastify, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const { version } = opts;
        fastify.get("/status", (_request, reply) => __awaiter(this, void 0, void 0, function* () {
            const uptimeSeconds = process.uptime();
            return reply.status(200).send({
                status: "ok",
                version,
                uptime: {
                    seconds: Math.floor(uptimeSeconds),
                    human: formatUptime(uptimeSeconds),
                },
                timestamp: new Date().toISOString(),
            });
        }));
    });
}
exports.default = statusRoute;
