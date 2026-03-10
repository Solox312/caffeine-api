import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type Redis from "ioredis";

export interface StatusRouteOptions {
    redis: Redis | false | undefined;
    version: string;
}

function formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
}

export default async function statusRoute(
    fastify: FastifyInstance,
    opts: StatusRouteOptions
) {
    const { version } = opts;

    fastify.get("/status", async (_request: FastifyRequest, reply: FastifyReply) => {
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
    });
}
