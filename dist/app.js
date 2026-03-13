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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.tmdbKey = exports.workers_url = void 0;
const fastify_1 = __importDefault(require("fastify"));
const daddylive_1 = __importDefault(require("./routes/daddylive"));
const config_1 = __importDefault(require("./routes/config"));
const scraper_1 = __importDefault(require("./routes/scraper"));
const status_1 = __importDefault(require("./routes/status"));
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = require("fs");
const path_1 = require("path");
const cors_1 = __importDefault(require("@fastify/cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const ioredis_1 = __importDefault(require("ioredis"));
dotenv_1.default.config();
exports.workers_url = process.env.WORKERS_URL && process.env.WORKERS_URL;
exports.tmdbKey = process.env.TMDB_KEY && process.env.TMDB_KEY;
exports.redis = process.env.REDIS_HOST &&
    new ioredis_1.default({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
    });
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        const PORT = Number(process.env.PORT) || 3000;
        console.log(chalk_1.default.green(`Starting server on port ${PORT}... 🚀`));
        if (!process.env.WORKERS_URL)
            console.warn(chalk_1.default.yellowBright("Workers (proxy) url not found use `proxied=false` argument in link fetching"));
        if (!process.env.TMDB_KEY)
            console.warn(chalk_1.default.yellowBright("TMDB key not found"));
        if (!process.env.REDIS_HOST)
            console.warn(chalk_1.default.yellowBright("Redis not found. Cache disabled."));
        const fastify = (0, fastify_1.default)({
            maxParamLength: 1000,
            logger: true,
        });
        yield fastify.register(cors_1.default, {
            origin: "*",
            methods: "GET",
        });
        yield fastify.register(daddylive_1.default, { prefix: "/daddylive" });
        yield fastify.register(config_1.default);
        yield fastify.register(scraper_1.default);
        const pkg = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(__dirname, "..", "package.json"), "utf-8"));
        yield fastify.register(status_1.default, {
            redis: exports.redis || undefined,
            version: pkg.version,
        });
        try {
            fastify.get("/", (_, rp) => __awaiter(this, void 0, void 0, function* () {
                rp.status(200).send("Welcome to Caffeine API! 🎉");
            }));
            fastify.get("*", (request, reply) => {
                reply.status(404).send({
                    message: "",
                    error: "page not found",
                });
            });
            fastify.listen({ port: PORT, host: "0.0.0.0" }, (e, address) => {
                if (e)
                    throw e;
                console.log(`server listening on ${address}`);
            });
        }
        catch (err) {
            fastify.log.error(err);
            process.exit(1);
        }
    });
}
exports.default = startServer;
