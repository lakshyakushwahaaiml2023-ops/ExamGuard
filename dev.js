/**
 * ExamGuard - Dev Runner
 * Seeds the database if needed, then starts three processes in order:
 *   1. Express + Socket.IO server (port 4000)
 *   2. Vite React dev server (port 3000)  [only if client/node_modules exists]
 *   3. Simulator with interactive CLI for fault injection
 *
 * Usage: npm run dev
 * The simulator CLI accepts stdin commands:
 *   fail power centre-3 | spike latency centre-2 | recover centre-3 | status
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { db } = require('./server/db');
const { seedDatabase } = require('./server/seed');

// ── 0. Auto-seed on first run ─────────────────────────────────────────────────
const centreCount = db.prepare('SELECT count(*) as c FROM centres').get().c;
if (centreCount === 0) {
  console.log('[DEV] Initial run detected – seeding database...');
  seedDatabase();
} else {
  console.log(`[DEV] Database already seeded (${centreCount} centres, 200 candidates).`);
}

// ── Helper: spawn a child and stream its output with a prefix label ───────────
function launch(label, cmd, args, opts = {}) {
  const proc = spawn(cmd, args, { ...opts });
  if (proc.stdout) proc.stdout.on('data', d => process.stdout.write(`[${label}] ` + d));
  if (proc.stderr) proc.stderr.on('data', d => process.stderr.write(`[${label} ERR] ` + d));
  return proc;
}

const procs = [];

function killAll() {
  procs.forEach(p => { try { p.kill(); } catch (_) {} });
}

process.on('SIGINT',  () => { console.log('\n[DEV] Shutting down…'); killAll(); process.exit(0); });
process.on('SIGTERM', () => { killAll(); process.exit(0); });

// ── 1. API Server ─────────────────────────────────────────────────────────────
console.log('[DEV] Starting ExamGuard API server on http://localhost:4000 …');
const server = launch('SERVER', 'node', [path.join(__dirname, 'server', 'index.js')], {
  stdio: ['ignore', 'pipe', 'pipe']
});
procs.push(server);

server.on('exit', code => {
  if (code && code !== 0) {
    console.error(`[DEV] Server crashed (exit ${code}). Stopping all services.`);
    killAll();
    process.exit(code);
  }
});

// ── 2. Vite React client (port 3000) – only if client deps are installed ──────
const clientModules = path.join(__dirname, 'client', 'node_modules');
if (fs.existsSync(clientModules)) {
  console.log('[DEV] Starting React/Vite client on http://localhost:3000 …');
  const client = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'client'),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'  // npm is a .cmd on Windows
  });
  if (client.stdout) client.stdout.on('data', d => process.stdout.write('[CLIENT] ' + d));
  if (client.stderr) client.stderr.on('data', d => process.stderr.write('[CLIENT] ' + d));
  procs.push(client);
} else {
  console.log('[DEV] client/node_modules not found – skipping Vite. Run: cd client && npm install');
}

// ── 3. Simulator (with interactive stdin for CLI commands) ────────────────────
setTimeout(() => {
  console.log('[DEV] Launching Simulator (interactive CLI: fail/spike/recover) …\n');
  const simulator = spawn('node', [path.join(__dirname, 'simulator', 'run.js')], {
    stdio: ['inherit', 'inherit', 'inherit']   // inherit stdin so CLI works
  });
  procs.push(simulator);

  simulator.on('exit', code => {
    console.log(`[DEV] Simulator exited (${code}). Stopping all services.`);
    killAll();
    process.exit(code || 0);
  });
}, 1200);   // give the server 1.2 s to bind port 4000
