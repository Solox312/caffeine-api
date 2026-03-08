import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config as envConfig } from "../constants/config";
import { getSupabase } from "../utils/supabase";

const CONFIG_ROW_ID = "00000000-0000-0000-0000-000000000001";

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
    return merged;
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

                if (!error && data?.config) {
                    const overrides =
                        typeof data.config === "object" && data.config !== null
                            ? (data.config as Record<string, unknown>)
                            : null;
                    const merged = mergeConfig(baseConfig, overrides);
                    return reply.status(200).send(merged);
                }
            } catch (err) {
                fastify.log.warn(err, "Supabase config fetch failed, using env config");
            }
        }

        reply.status(200).send(baseConfig);
    });
}
