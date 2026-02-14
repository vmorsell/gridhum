import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = parseInt(process.env.PORT || "3000", 10);
const DIST = path.resolve("dist");
const UPSTREAM =
  "https://driftsdata.statnett.no/restapi/Frequency/BySecond?From=2012-01-01";

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const server = http.createServer(async (req, res) => {
  if (req.url === "/api/frequency") {
    try {
      const upstream = await fetch(UPSTREAM);
      const data = await upstream.text();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=5",
      });
      res.end(data);
    } catch {
      res.writeHead(502);
      res.end("upstream error");
    }
    return;
  }

  let filePath = path.join(DIST, req.url === "/" ? "index.html" : req.url);
  if (!fs.existsSync(filePath)) filePath = path.join(DIST, "index.html");

  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

server.listen(PORT, () => console.log(`listening on :${PORT}`));
