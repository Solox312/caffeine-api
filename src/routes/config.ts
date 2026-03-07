import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "../constants/config";

export default async function configRoute(fastify: FastifyInstance) {
    fastify.get("/config", async (request: FastifyRequest, reply: FastifyReply) => {
        reply.status(200).send(config);
    });
}
