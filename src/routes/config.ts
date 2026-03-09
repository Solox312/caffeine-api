import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config as envConfig } from "../constants/config";
import { getSupabase } from "../utils/supabase";

const CONFIG_ROW_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Config keys returned by GET /config (used by Caffeine app and admin panel).
 * Includes: consumet_url, caffeine_api_url, flix_api_url, and other app settings.
 */

function mergeConfig(
    base: Record<string, unknown>,
    overrides: Record<string, unknown> | null
): Record<string, unknown> {
    if (!overrides || typeof overrides !== "object") return base;
    const merged = { ...base };
    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) continue;
        if (typeof value === "boolean") {
            merged[key] = value;
        } else if (value !== null && value !== "") {
            merged[key] = value;
        }
    }
    // Ensure displayVipBanner is always present so the app can hide the banner when set to false
    if (Object.prototype.hasOwnProperty.call(overrides, "displayVipBanner")) {
        merged.displayVipBanner = overrides.displayVipBanner;
    }
    return merged;
}

function getOverridesFromRow(data: unknown): Record<string, unknown> | null {
    if (data == null || typeof data !== "object") return null;
    const raw = data as { config?: unknown };
    const c = raw.config;
    if (c == null || typeof c !== "object") return null;
    return c as Record<string, unknown>;
}

export default async function configRoute(fastify: FastifyInstance) {
    fastify.get("/config", async (request: FastifyRequest, reply: FastifyReply) => {
        const baseConfig = { ...envConfig } as Record<string, unknown>;
        const supabase = getSupabase();

        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from("app_config")
                    .select("config")
                    .eq("id", CONFIG_ROW_ID)
                    .maybeSingle();

                if (error) {
                    fastify.log.warn({ err: error }, "Supabase config fetch error, using env config");
                } else {
                    const overrides = getOverridesFromRow(data);
                    const merged = mergeConfig(baseConfig, overrides);
                    return reply.status(200).send(merged);
                }
            } catch (err) {
                fastify.log.warn(err, "Supabase config fetch failed, using env config");
            }
        } else {
            fastify.log.debug("Supabase not configured, using env config only");
        }

        reply.status(200).send(baseConfig);
    });
}
