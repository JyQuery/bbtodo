import Fastify from "fastify";

export function buildApp() {
  const app = Fastify({
    logger: true
  });

  app.get("/health", async () => {
    return {
      app: "bbtodo-api",
      status: "ok"
    };
  });

  return app;
}

