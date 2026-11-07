import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import apiApp from "./app.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../dist");
const indexHtmlPath = path.join(distPath, "index.html");

const serverApp = express();
serverApp.disable("x-powered-by");

serverApp.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "querovagas" });
});

// Rotas da API e proxy Supabase
serverApp.use("/api", apiApp);

// Servir bundle estático do Vite em produção
if (fs.existsSync(distPath)) {
  serverApp.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge: "365d",
      immutable: true,
    }),
  );
  serverApp.use(express.static(distPath, { maxAge: "1h" }));

  serverApp.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(indexHtmlPath);
  });
} else {
  serverApp.use(apiApp);
}

const port = Number(process.env.PORT) || 3006;

serverApp.listen(port, "0.0.0.0", () => {
  console.log(`QueroVagas server listening on http://0.0.0.0:${port}`);
});
