// Sirve el export web estático (dist-web/) + proxy de /api/* al server de la
// demo. El export se generó con EXPO_PUBLIC_API_URL="" → los fetch son
// relativos (same-origin): el browser nunca pega directo al API y CORS no
// aplica. Pensado para la demo en la misma Wi-Fi.
//
// Uso:  node scripts/serve-web.mjs            → http://<esta-mac>:8088
//       PORT=8090 API=http://10.0.0.5:3000 node scripts/serve-web.mjs

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "dist-web");
const API = process.env.API ?? "http://localhost:3000";
const PORT = Number(process.env.PORT ?? 8088);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");

  // ── Proxy /api/* → server de la demo (misma máquina) ──────────────────────
  if (url.pathname.startsWith("/api/")) {
    try {
      const upstream = await fetch(`${API}${url.pathname}${url.search}`, {
        method: req.method,
        headers: { "content-type": req.headers["content-type"] ?? "application/json" },
        body: ["GET", "HEAD"].includes(req.method ?? "")
          ? undefined
          : await new Promise((ok) => {
              const chunks = [];
              req.on("data", (c) => chunks.push(c));
              req.on("end", () => ok(Buffer.concat(chunks)));
            }),
      });
      res.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "application/json" });
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (e) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { code: "proxy", message: `API inalcanzable en ${API}: ${e?.cause?.code ?? e?.message}` } }));
    }
    return;
  }

  // ── Estáticos + fallback SPA ───────────────────────────────────────────────
  let path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
  if (path === "/" || path === "\\") path = "/index.html";
  try {
    const body = await readFile(join(ROOT, path));
    const tipo = MIME[extname(path)] ?? "application/octet-stream";
    // HTML sin caché: el bundle hasheado cambia por export, index.html no.
    res.writeHead(200, {
      "content-type": tipo,
      ...(tipo.includes("html") ? { "cache-control": "no-cache" } : {}),
    });
    res.end(body);
  } catch {
    try {
      const body = await readFile(join(ROOT, "index.html")); // fallback SPA
      res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-cache" });
      res.end(body);
    } catch {
      res.writeHead(404).end("dist-web no existe — corré: EXPO_PUBLIC_API_URL='' npx expo export --platform web --output-dir dist-web");
    }
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`ContractAR web → http://0.0.0.0:${PORT}  (API: ${API})`);
});
