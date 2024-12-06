import { createServerAdapter } from "@whatwg-node/server";
import { createServer } from "http";
import { AutoRouter } from "itty-router";
import { analyze } from "vuetracker-analyzer";
const router = AutoRouter();

router.get("/vue-telescope/analyze?", async (req) => {
  const { url } = req.query;
  return await analyze(url, {
    userAgent: "VueTracker/1.0 (Ubuntu 23.10; x64); https://vuetracker.pages.dev"
  });
});

router.all("*", () =>
  Response.json({ success: false, error: "Route not found" }, { status: 404 })
);

const ittyServer = createServerAdapter(router.fetch);
const httpServer = createServer(ittyServer);
httpServer.listen(2082);
