import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.hdr': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};
const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      res.end();
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(
      root,
      '.' + decodeURIComponent(url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname)
    );
    if (!file.startsWith(root) || !types[path.extname(file)]) {
      res.writeHead(404);
      res.end();
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) throw Error();
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)],
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else
      createReadStream(file)
        .on('error', () => res.destroy())
        .pipe(res);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? '端口已占用，可通过 PORT 指定其他本地端口。' : e.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log('砼核 · http://127.0.0.1:' + server.address().port));
