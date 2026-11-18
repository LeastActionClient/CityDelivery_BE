require('dotenv').config();

const { env, assertEnv } = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const { startRetryWorker, retryPendingNotifications } = require('./services/emailService');

async function start() {
  assertEnv();
  await connectDB();

  const server = app.listen(env.port, () => {
    console.log(`[server] City Delivery Services API listening on :${env.port} (${env.nodeEnv})`);
  });

  // Retry any notifications that failed earlier (e.g. SMTP outage) — now and periodically.
  startRetryWorker();
  setTimeout(retryPendingNotifications, 15 * 1000).unref();

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

start().catch((err) => {
  console.error('[startup] failed:', err.message);
  process.exit(1);
});
