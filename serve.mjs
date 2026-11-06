import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const types = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png",
};

createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const file = path === "/" ? "/index.html" : path;
  if (!/^\/[a-z0-9.-]+$/i.test(file) || !types[extname(file)]) {
    response.writeHead(404).end();
    return;
  }
  try {
    const data = await readFile(new URL("./dist" + file, import.meta.url));
    response.writeHead(200, {
      "Content-Type": types[extname(file)], "Cache-Control": "no-cache",
    }).end(data);
  } catch {
    response.writeHead(404).end();
  }
}).listen(4173, "127.0.0.1", () => console.log("http://localhost:4173"));
