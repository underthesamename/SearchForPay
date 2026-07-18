import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { getEnv } from './config/env.js';
import { createApp } from './http/app.js';
import { createSafeLogger } from './http/safeLogger.js';

export function startServer(envSource = process.env) {
  const env = getEnv(envSource);
  const logger = createSafeLogger({ enabled: env.requestLoggingEnabled });
  const app = createApp({ env, startJobs: true, logger });
  const server = createServer(app);

  server.requestTimeout = env.serverRequestTimeoutMs;
  server.headersTimeout = env.serverHeadersTimeoutMs;
  server.keepAliveTimeout = env.serverKeepAliveTimeoutMs;

  server.listen(env.port, () => {
    logger.startup({ port: env.port });
    console.log(`SearchForPay running at http://localhost:${env.port}`);
  });

  server.on('close', () => {
    app.close?.();
  });

  return server;
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? resolve(process.argv[1]) : '';

if (entryFile === currentFile) {
  startServer();
}
