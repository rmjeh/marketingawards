const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
loadDotEnv(path.join(ROOT, ".env"));

const PUBLIC_DIR = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 3001);
const API_ROUTES = {
  "/api/awards": require("./api/awards"),
  "/api/nominations": require("./api/nominations"),
  "/api/results": require("./api/results"),
  "/api/vote": require("./api/vote")
};
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function serveStatic(req, res, reqUrl) {
  let pathname = reqUrl.pathname;
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/admin") pathname = "/admin.html";
  if (pathname === "/results") pathname = "/results.html";

  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const route = API_ROUTES[reqUrl.pathname];
  if (route) {
    await route(req, res);
    return;
  }
  serveStatic(req, res, reqUrl);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Marketing awards Vercel app running at http://localhost:${PORT}`);
});
