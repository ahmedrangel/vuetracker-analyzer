import { createServer } from "http";
import { createServerAdapter } from "@whatwg-node/server";
import { AutoRouter } from "itty-router";
import { analyze } from "vuetracker-analyzer";
import consola from "consola";

const router = AutoRouter();

router.get("/analyze?", async (req) => {
  const { url } = req.query;
  return await analyze(url, {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 VueTracker/1.0 (Debian GNU/Linux 12; arm64; +vuetracker.nuxt.dev)"
  }).catch((e) => {
    return Response.json({ success: false, error: { message: e.message, cause: e.cause } }, { status: 500 });
  });
});

router.all("*", () =>
  Response.json({ success: false, error: "Route not found" }, { status: 404 })
);

const ittyServer = createServerAdapter(router.fetch);
const httpServer = createServer(ittyServer);
httpServer.listen(2082);
consola.info("Server running at http://localhost:2082/");