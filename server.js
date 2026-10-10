import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'public');
const types = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain',
};
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://ethereum-rpc.publicnode.com; base-uri 'none'; frame-ancestors 'none'",
};
const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    // Also mirror the Pages subpath locally so icon and error-page links can be checked.
    const publicPath = pathname.startsWith('/degenerator/') ? pathname.slice('/degenerator'.length) : pathname;
    const file = resolve(root, publicPath === '/' ? 'index.html' : '.' + publicPath);
    if (!file.startsWith(root + sep)) {
      response.writeHead(403, headers).end('Forbidden');
      return;
    }
    const body = await readFile(file);
    const type = types[extname(file)] || 'application/octet-stream';
    const charset = type.startsWith('text/') || ['image/svg+xml', 'application/json', 'application/manifest+json'].includes(type) ? '; charset=utf-8' : '';
    response.writeHead(200, { ...headers, 'Content-Type': type + charset });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    const status = ['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code) ? 404 : error instanceof URIError ? 400 : 500;
    const page = status === 404 ? await readFile(resolve(root, '404.html')).catch(() => null) : null;
    response.writeHead(status, { ...headers, 'Content-Type': page ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : page || (status === 404 ? 'Not found' : 'Request failed'));
  }
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => {
  console.log('Degenerator listening on port ' + server.address().port);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
