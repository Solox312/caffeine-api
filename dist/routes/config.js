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
const config_1 = require("../constants/config");
const supabase_1 = require("../utils/supabase");
const CONFIG_ROW_ID = "00000000-0000-0000-0000-000000000001";
/**
 * Config keys returned by GET /config (used by Caffeine app and admin panel).
 * Includes: consumet_url, caffeine_api_url, flix_api_url, and other app settings.
 */
function mergeConfig(base, overrides) {
    if (!overrides || typeof overrides !== "object")
        return base;
    const merged = Object.assign({}, base);
    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined)
            continue;
        if (typeof value === "boolean") {
            merged[key] = value;
        }
        else if (value !== null && value !== "") {
            merged[key] = value;
        }
    }
    return merged;
}
function getOverridesFromRow(data) {
    if (data == null || typeof data !== "object")
        return null;
    const raw = data;
    const c = raw.config;
    if (c == null || typeof c !== "object")
        return null;
    return c;
}
function configRoute(fastify) {
    return __awaiter(this, void 0, void 0, function* () {
        fastify.get("/config", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            const baseConfig = Object.assign({}, config_1.config);
            const supabase = (0, supabase_1.getSupabase)();
            if (supabase) {
                try {
                    const { data, error } = yield supabase
                        .from("app_config")
                        .select("config")
                        .eq("id", CONFIG_ROW_ID)
                        .maybeSingle();
                    if (error) {
                        fastify.log.warn({ err: error }, "Supabase config fetch error, using env config");
                    }
                    else {
                        const overrides = getOverridesFromRow(data);
                        const merged = mergeConfig(baseConfig, overrides);
                        return reply.status(200).send(merged);
                    }
                }
                catch (err) {
                    fastify.log.warn(err, "Supabase config fetch failed, using env config");
                }
            }
            else {
                fastify.log.debug("Supabase not configured, using env config only");
            }
            reply.status(200).send(baseConfig);
        }));
    });
}
exports.default = configRoute;
