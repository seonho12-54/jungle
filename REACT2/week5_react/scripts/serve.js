import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const PORT = Number.parseInt(process.env.PORT ?? "8000", 10);
const ROOT = resolve(process.cwd());

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let targetPath = resolve(ROOT, `.${safePath}`);

  if (!targetPath.startsWith(ROOT)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  if (existsSync(targetPath) && statSync(targetPath).isDirectory()) {
    const nestedIndex = join(targetPath, "index.html");

    if (existsSync(nestedIndex)) {
      targetPath = nestedIndex;
    }
  }

  if (!existsSync(targetPath) || statSync(targetPath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
    return;
  }

  const extension = extname(targetPath).toLowerCase();
  const contentType = MIME_TYPES[extension] ?? "application/octet-stream";

  response.writeHead(200, { "Content-Type": contentType });
  createReadStream(targetPath).pipe(response);
}).listen(PORT, () => {
  console.log(`Static server running at http://localhost:${PORT}`);
  console.log(`Main app: http://localhost:${PORT}/public/index.html`);
  console.log(`Education lab: http://localhost:${PORT}/education/index.html`);
});
