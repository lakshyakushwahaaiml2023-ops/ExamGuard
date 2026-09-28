/**
 * screenshot2.js – Clean two-state screenshot:
 *   1. Healthy (all green) — after running "recover all"
 *   2. Faulted — after injecting power+latency faults
 */
const puppeteer = require('puppeteer');
const { io } = require('socket.io-client');
const path = require('path');

const ADMIN_URL = 'http://localhost:3000/admin';
const API_BASE  = 'http://localhost:4000';
const OUT_DIR   = 'C:\\Users\\PREDATOR\\.gemini\\antigravity\\brain\\4b3d9307-b5f6-477e-9d72-ff32f892e875';

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function injectTelemetry(socket, centreId, fault) {
  // fault: null | 'power' | 'latency'
  const healthy = {
    centreId, cpu: Math.floor(20 + Math.random() * 15),
    memory: Math.floor(45 + Math.random() * 10),
    latency: Math.floor(15 + Math.random() * 20),
    powerStatus: 'NORMAL', heartbeat: 2000,
    timestamp: new Date().toISOString()
  };
  const power = {
    centreId, cpu: 0, memory: 0, latency: 9999,
    powerStatus: 'FAIL', heartbeat: 2000,
    timestamp: new Date().toISOString()
  };
  const latency = {
    centreId, cpu: 91, memory: 82, latency: 860,
    powerStatus: 'NORMAL', heartbeat: 2000,
    timestamp: new Date().toISOString()
  };
  const payload = fault === 'power' ? power : fault === 'latency' ? latency : healthy;
  socket.emit('telemetry:report', payload);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1600, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto(ADMIN_URL, { waitUntil: 'networkidle0', timeout: 15000 });

  // Connect screenshot socket
  const socket = io(API_BASE, { transports: ['websocket'] });
  await new Promise(r => socket.once('connect', r));
  console.log('[SS] Socket connected');

  const centres = ['centre-1','centre-2','centre-3','centre-4','centre-5'];

  // ── State 1: Force all HEALTHY ──────────────────────────────────────────────
  console.log('[SS] Injecting HEALTHY telemetry for all centres...');
  for (let i = 0; i < 4; i++) {          // send 4 ticks to ensure page updates
    for (const c of centres) injectTelemetry(socket, c, null);
    await wait(700);
  }
  await wait(1000);
  const healthyPath = path.join(OUT_DIR, 'screenshot_healthy.png');
  await page.screenshot({ path: healthyPath });
  console.log('[SS] ✓ Healthy screenshot:', healthyPath);

  // ── State 2: Inject POWER fault on centre-3, LATENCY on centre-2 ───────────
  console.log('[SS] Injecting FAULT telemetry...');
  for (let i = 0; i < 4; i++) {
    injectTelemetry(socket, 'centre-1', null);
    injectTelemetry(socket, 'centre-2', 'latency');
    injectTelemetry(socket, 'centre-3', 'power');
    injectTelemetry(socket, 'centre-4', null);
    injectTelemetry(socket, 'centre-5', null);
    await wait(700);
  }
  await wait(1000);
  const faultedPath = path.join(OUT_DIR, 'screenshot_faulted.png');
  await page.screenshot({ path: faultedPath });
  console.log('[SS] ✓ Faulted screenshot:', faultedPath);

  socket.disconnect();
  await browser.close();
  console.log('[SS] Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
