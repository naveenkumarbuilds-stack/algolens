import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const db = new PrismaClient();
await db.$connect();
const app = await createApp({ db, config });
const server = app.listen(config.PORT, () =>
  console.log(`AlgoLens API listening on http://localhost:${config.PORT}`),
);
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(async () => {
    await db.$disconnect();
    clearTimeout(timeout);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
