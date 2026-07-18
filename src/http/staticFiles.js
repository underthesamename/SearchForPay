import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendJson } from './responses.js';
import { securityHeaders } from './securityHeaders.js';

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8']
]);

function getPublicRoot(publicDir) {
  return publicDir instanceof URL ? fileURLToPath(publicDir) : resolve(publicDir);
}

export async function serveStaticFile({ url, response, publicDir }) {
  const root = getPublicRoot(publicDir);
  const requestPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = resolve(root, `.${requestPath}`);
  const pathFromRoot = relative(root, filePath);

  if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
    sendJson(response, 403, {
      error: {
        code: 'FORBIDDEN',
        message: 'Arquivo fora da pasta publica.'
      }
    });
    return true;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, securityHeaders({
      'content-type': contentTypes.get(extname(filePath)) || 'application/octet-stream',
      'cache-control': 'no-store'
    }));
    response.end(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      return false;
    }

    throw error;
  }
}
