// Waits for postgres to accept connections, then exits 0.
// Usage: node scripts/dev-wait-for-postgres.js
const url = process.env.DATABASE_URL || '';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tryConnect() {
  // Plain TCP socket connect to host:port parsed from DATABASE_URL
  const net = require('net');
  const m = url.match(/@([^:/]+):(\d+)/);
  if (!m) { console.error('[db-wait] Cannot parse host:port from DATABASE_URL'); process.exit(1); }
  const [, host, port] = m;
  return new Promise(resolve => {
    const s = net.connect({ host, port: Number(port) });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => { s.destroy(); resolve(false); });
    setTimeout(() => { s.destroy(); resolve(false); }, 2000);
  });
}

(async () => {
  console.log('[db-wait] Waiting for postgres at', (url.match(/@([^:/]+:\d+)/) || [])[1]);
  for (let i = 0; i < 60; i++) {
    if (await tryConnect()) { console.log('[db-wait] postgres is accepting connections'); return; }
    await delay(2000);
  }
  console.error('[db-wait] postgres did not become ready in 120s');
  process.exit(1);
})();
