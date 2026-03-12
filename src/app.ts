import Fastify from "fastify";
import daddylive from "./routes/daddylive";
import configRoute from "./routes/config";
import scraperRoutes from "./routes/scraper";
import statusRoute from "./routes/status";
import chalk from "chalk";
import { readFileSync } from "fs";
import { join } from "path";
import FastifyCors from "@fastify/cors";
import dotenv from "dotenv";
import Redis from "ioredis";
dotenv.config();

export const workers_url = process.env.WORKERS_URL && process.env.WORKERS_URL;
export const tmdbKey = process.env.TMDB_KEY && process.env.TMDB_KEY;

export const redis =
    process.env.REDIS_HOST &&
    new Redis({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
    });

async function startServer() {
    const PORT = Number(process.env.PORT) || 3000;
    console.log(chalk.green(`Starting server on port ${PORT}... 🚀`));
    if (!process.env.WORKERS_URL)
        console.warn(
            chalk.yellowBright(
                "Workers (proxy) url not found use `proxied=false` argument in link fetching",
            ),
        );

    if (!process.env.TMDB_KEY)
        console.warn(chalk.yellowBright("TMDB key not found"));

    if (!process.env.REDIS_HOST)
        console.warn(chalk.yellowBright("Redis not found. Cache disabled."));

    const fastify = Fastify({
        maxParamLength: 1000,
        logger: true,
    });
    await fastify.register(FastifyCors, {
        origin: "*",
        methods: "GET",
    });

    await fastify.register(daddylive, { prefix: "/daddylive" });
    await fastify.register(configRoute);
    await fastify.register(scraperRoutes);
    const pkg = JSON.parse(
        readFileSync(join(__dirname, "..", "package.json"), "utf-8")
    ) as { version: string };
    await fastify.register(statusRoute, {
        redis: redis || undefined,
        version: pkg.version,
    });
    try {
        fastify.get("/", async (_, rp) => {
            rp.status(200).send("Welcome to Caffeine API! 🎉");
        });
        fastify.get("*", (request, reply) => {
            reply.status(404).send({
                message: "",
                error: "page not found",
            });
        });

        fastify.listen({ port: PORT, host: "0.0.0.0" }, (e, address) => {
            if (e) throw e;
            console.log(`server listening on ${address}`);
        });
    } catch (err: any) {
        fastify.log.error(err);
        process.exit(1);
    }
}
export default startServer;
