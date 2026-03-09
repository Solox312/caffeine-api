import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type Redis from "ioredis";
import { getSupabase } from "../utils/supabase";

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
    const { redis, version } = opts;

    fastify.get("/status", async (_request: FastifyRequest, reply: FastifyReply) => {
        const uptimeSeconds = process.uptime();

        const services: Record<string, { status: string; message?: string }> = {};

        // Redis
        if (redis) {
            try {
                await redis.ping();
                services.redis = { status: "ok" };
            } catch (err) {
                services.redis = {
                    status: "error",
                    message: err instanceof Error ? err.message : "Ping failed",
                };
            }
        } else {
            services.redis = { status: "disabled", message: "Not configured" };
        }

        // Workers (proxy) URL
        services.workers = process.env.WORKERS_URL
            ? { status: "configured" }
            : { status: "missing", message: "WORKERS_URL not set" };

        // TMDB API key
        services.tmdb = process.env.TMDB_KEY
            ? { status: "configured" }
            : { status: "missing", message: "TMDB_KEY not set" };

        // Supabase
        const supabase = getSupabase();
        if (supabase) {
            services.supabase = { status: "configured" };
        } else {
            services.supabase = { status: "disabled", message: "Not configured" };
        }

        const hasError = Object.values(services).some((s) => s.status === "error");
        const overallStatus = hasError ? "degraded" : "ok";

        return reply.status(200).send({
            status: overallStatus,
            version,
            uptime: {
                seconds: Math.floor(uptimeSeconds),
                human: formatUptime(uptimeSeconds),
            },
            services,
            timestamp: new Date().toISOString(),
        });
    });
}
