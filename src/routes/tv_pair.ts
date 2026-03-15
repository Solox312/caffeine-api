import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type Redis from "ioredis";

const CODE_LENGTH = 8;
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CODE_TTL_SEC = Math.floor(CODE_TTL_MS / 1000);
const REDIS_PREFIX = "tv:pair:";

export interface TvPairRouteOptions {
    redis?: Redis | false;
}

interface PendingCode {
    createdAt: number;
    expiresAt: number;
    accessToken?: string;
    refreshToken?: string;
}

function randomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
        s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
}

// In-memory fallback when Redis is not available (single instance only)
const memoryStore = new Map<string, PendingCode>();

function memoryCleanup(): void {
    const now = Date.now();
    for (const [code, data] of memoryStore.entries()) {
        if (data.expiresAt < now) memoryStore.delete(code);
    }
}

export default async function tvPairRoute(
    fastify: FastifyInstance,
    opts: TvPairRouteOptions = {}
) {
    const redis = opts.redis && typeof opts.redis !== "boolean" ? opts.redis : undefined;

    // POST /tv/pair - TV app creates a pairing code
    fastify.post("/tv/pair", async (request: FastifyRequest, reply: FastifyReply) => {
        const now = Date.now();
        const data: PendingCode = {
            createdAt: now,
            expiresAt: now + CODE_TTL_MS,
        };
        const payload = JSON.stringify(data);
        if (redis) {
            let code: string;
            let set = false;
            for (let attempt = 0; attempt < 20 && !set; attempt++) {
                code = randomCode();
                const key = REDIS_PREFIX + code;
                const result = await redis.set(key, payload, "EX", CODE_TTL_SEC, "NX");
                if (result === "OK") {
                    set = true;
                    return reply.status(200).send({
                        code,
                        expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
                        expiresInSeconds: CODE_TTL_SEC,
                    });
                }
            }
            return reply.status(503).send({ error: "Could not generate unique code" });
        }
        memoryCleanup();
        let code: string;
        do {
            code = randomCode();
        } while (memoryStore.has(code));
        const now = Date.now();
        memoryStore.set(code, {
            createdAt: now,
            expiresAt: now + CODE_TTL_MS,
        });
        return reply.status(200).send({
            code,
            expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
            expiresInSeconds: CODE_TTL_SEC,
        });
    });

    async function getData(c: string): Promise<PendingCode | null> {
        if (redis) {
            const key = REDIS_PREFIX + c;
            const raw = await redis.get(key);
            if (!raw) return null;
            try {
                return JSON.parse(raw) as PendingCode;
            } catch {
                return null;
            }
        }
        return memoryStore.get(c) ?? null;
    }

    async function setData(c: string, data: PendingCode): Promise<void> {
        if (redis) {
            const key = REDIS_PREFIX + c;
            const ttl = await redis.ttl(key);
            await redis.set(key, JSON.stringify(data), "EX", ttl > 0 ? ttl : CODE_TTL_SEC);
        } else {
            memoryStore.set(c, data);
        }
    }

    async function deleteData(c: string): Promise<void> {
        if (redis) {
            await redis.del(REDIS_PREFIX + c);
        } else {
            memoryStore.delete(c);
        }
    }

    // POST /tv/pair/confirm - Pairing page (web/phone) submits code + Supabase tokens after user signs in
    fastify.post(
        "/tv/pair/confirm",
        async (request: FastifyRequest<{ Body: { code?: string; access_token?: string; refresh_token?: string } }>, reply: FastifyReply) => {
            const { code, access_token, refresh_token } = request.body || {};
            if (!code || typeof code !== "string" || !access_token || !refresh_token) {
                return reply.status(400).send({ error: "Missing code, access_token, or refresh_token" });
            }
            const c = code.trim().toUpperCase();
            const data = await getData(c);
            if (!data) {
                return reply.status(404).send({ error: "Invalid or expired code" });
            }
            if (data.expiresAt < Date.now()) {
                await deleteData(c);
                return reply.status(410).send({ error: "Code expired" });
            }
            data.accessToken = access_token;
            data.refreshToken = refresh_token;
            await setData(c, data);
            return reply.status(200).send({ success: true });
        }
    );

    // GET /tv/pair?code=XXX - TV app polls; returns tokens when linked
    fastify.get(
        "/tv/pair",
        async (request: FastifyRequest<{ Querystring: { code?: string } }>, reply: FastifyReply) => {
            const { code } = request.query || {};
            if (!code || typeof code !== "string") {
                return reply.status(400).send({ error: "Missing code" });
            }
            const c = code.trim().toUpperCase();
            const data = await getData(c);
            if (!data) {
                return reply.status(200).send({ linked: false, error: "Invalid or expired code" });
            }
            if (data.expiresAt < Date.now()) {
                await deleteData(c);
                return reply.status(200).send({ linked: false, error: "Code expired" });
            }
            if (data.accessToken && data.refreshToken) {
                const out = {
                    linked: true,
                    access_token: data.accessToken,
                    refresh_token: data.refreshToken,
                };
                await deleteData(c);
                return reply.status(200).send(out);
            }
            return reply.status(200).send({ linked: false });
        }
    );
}
