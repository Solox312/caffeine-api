import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

const CODE_LENGTH = 8;
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function randomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
        s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
}

interface PendingCode {
    createdAt: number;
    expiresAt: number;
    accessToken?: string;
    refreshToken?: string;
}

const store = new Map<string, PendingCode>();

function cleanup(): void {
    const now = Date.now();
    for (const [code, data] of store.entries()) {
        if (data.expiresAt < now) store.delete(code);
    }
}

export default async function tvPairRoute(fastify: FastifyInstance) {
    // POST /tv/pair - TV app creates a pairing code
    fastify.post("/tv/pair", async (request: FastifyRequest, reply: FastifyReply) => {
        cleanup();
        let code: string;
        do {
            code = randomCode();
        } while (store.has(code));
        const now = Date.now();
        store.set(code, {
            createdAt: now,
            expiresAt: now + CODE_TTL_MS,
        });
        return reply.status(200).send({
            code,
            expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
            expiresInSeconds: Math.floor(CODE_TTL_MS / 1000),
        });
    });

    // POST /tv/pair/confirm - Pairing page (web/phone) submits code + Supabase tokens after user signs in
    fastify.post(
        "/tv/pair/confirm",
        async (request: FastifyRequest<{ Body: { code?: string; access_token?: string; refresh_token?: string } }>, reply: FastifyReply) => {
            const { code, access_token, refresh_token } = request.body || {};
            if (!code || typeof code !== "string" || !access_token || !refresh_token) {
                return reply.status(400).send({ error: "Missing code, access_token, or refresh_token" });
            }
            const c = code.trim().toUpperCase();
            const data = store.get(c);
            if (!data) {
                return reply.status(404).send({ error: "Invalid or expired code" });
            }
            if (data.expiresAt < Date.now()) {
                store.delete(c);
                return reply.status(410).send({ error: "Code expired" });
            }
            data.accessToken = access_token;
            data.refreshToken = refresh_token;
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
            const data = store.get(c);
            if (!data) {
                return reply.status(200).send({ linked: false, error: "Invalid or expired code" });
            }
            if (data.expiresAt < Date.now()) {
                store.delete(c);
                return reply.status(200).send({ linked: false, error: "Code expired" });
            }
            if (data.accessToken && data.refreshToken) {
                const out = {
                    linked: true,
                    access_token: data.accessToken,
                    refresh_token: data.refreshToken,
                };
                store.delete(c);
                return reply.status(200).send(out);
            }
            return reply.status(200).send({ linked: false });
        }
    );
}
