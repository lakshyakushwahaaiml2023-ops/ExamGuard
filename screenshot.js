/**
 * screenshot.js – Puppeteer script to capture the ExamGuard admin dashboard
 * in three states: healthy, faulted (power outage + latency spike), recovered.
 *
 * Usage: node screenshot.js
 * Requires: server + simulator + Vite client already running
 */

const puppeteer = require('puppeteer');
const path = require('path');

const ADMIN_URL  = 'http://localhost:3000/admin';
const API_BASE   = 'http://localhost:4000';
const OUT_DIR    = path.join(
  'C:\\Users\\PREDATOR\\.gemini\\antigravity\\brain\\4b3d9307-b5f6-477e-9d72-ff32f892e875'
);

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// Send a fault command via stdin to the simulator by updating via the REST API
// (We actually just wait for the already-running simulator faults to reflect in telemetry)

async function main() {
  console.log('[SCREENSHOT] Launching headless Chromium…');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1600, height: 900 }
  });

  const page = await browser.newPage();

  // ── 1. Screenshot: current state (faults already active from earlier) ────────
  console.log('[SCREENSHOT] Opening', ADMIN_URL);
  await page.goto(ADMIN_URL, { waitUntil: 'networkidle0', timeout: 15000 });

  // Wait for Socket.IO to deliver first telemetry batch (tiles should be coloured)
  await wait(5000);

  const faultedPath = path.join(OUT_DIR, 'screenshot_faulted.png');
  await page.screenshot({ path: faultedPath, fullPage: false });
  console.log('[SCREENSHOT] Saved faulted state →', faultedPath);

  // ── 2. Recover all centres then screenshot healthy state ──────────────────────
  // We call a direct DB update via Node inline (no API endpoint needed)
  // Instead, we send the recover command to the server via fetch — the server
  // will receive it on the next telemetry tick. We simulate it by fetching centres.
  console.log('[SCREENSHOT] Waiting for recovery (sending recover all via node)…');

  // Programmatically send "recover all" to the running simulator via a quick
  // socket.io-client connection that sets faults. But the simplest approach:
  // just wait — the user can run "recover all" themselves. For the screenshot
  // we emit a telemetry:report directly to the server to force healthy data.
  const { io } = require('socket.io-client');
  const socket = io(API_BASE);

  await new Promise(resolve => socket.once('connect', resolve));
  console.log('[SCREENSHOT] Socket.IO connected for forced telemetry injection');

  // Emit healthy telemetry for all 5 centres to override the fault state
  const centres = ['centre-1','centre-2','centre-3','centre-4','centre-5'];
  for (const cid of centres) {
    socket.emit('telemetry:report', {
      centreId: cid,
      cpu: Math.floor(20 + Math.random() * 15),
      memory: Math.floor(45 + Math.random() * 10),
      latency: Math.floor(15 + Math.random() * 20),
      powerStatus: 'NORMAL',
      heartbeat: 999,
      timestamp: new Date().toISOString()
    });
  }

  await wait(3000); // let the page receive the Socket.IO updates

  const healthyPath = path.join(OUT_DIR, 'screenshot_healthy.png');
  await page.screenshot({ path: healthyPath, fullPage: false });
  console.log('[SCREENSHOT] Saved healthy state →', healthyPath);

  // ── 3. Re-inject faults for the "faulted" screenshot one more time ─────────────
  socket.emit('telemetry:report', {
    centreId: 'centre-3', cpu: 0, memory: 0, latency: 9999,
    powerStatus: 'FAIL', heartbeat: 1001, timestamp: new Date().toISOString()
  });
  socket.emit('telemetry:report', {
    centreId: 'centre-2', cpu: 92, memory: 84, latency: 820,
    powerStatus: 'NORMAL', heartbeat: 1001, timestamp: new Date().toISOString()
  });

  await wait(3000);

  const faulted2Path = path.join(OUT_DIR, 'screenshot_faulted2.png');
  await page.screenshot({ path: faulted2Path, fullPage: false });
  console.log('[SCREENSHOT] Saved faulted (re-injected) →', faulted2Path);

  socket.disconnect();
  await browser.close();
  console.log('[SCREENSHOT] Done.');
}

main().catch(err => {
  console.error('[SCREENSHOT ERROR]', err.message);
  process.exit(1);
});
