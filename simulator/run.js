/**
 * ExamGuard - Simulation Engine
 * Simulates 5 exam centres sending real-time telemetry every 2 seconds,
 * candidates submitting answers, and interactive CLI fault injection:
 *   - fail power <centre-id>
 *   - spike latency <centre-id>
 *   - recover <centre-id>
 */

const io = require('socket.io-client');
const readline = require('readline');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const socket = io(SERVER_URL, { reconnection: true });

// Centre simulation definitions
const centres = {
  'centre-1': { id: 'centre-1', name: 'North Apex Exam Hub', fault: null, heartbeats: 0 },
  'centre-2': { id: 'centre-2', name: 'Silicon City Institute', fault: null, heartbeats: 0 },
  'centre-3': { id: 'centre-3', name: 'Coastal Bay Cyber Centre', fault: null, heartbeats: 0 },
  'centre-4': { id: 'centre-4', name: 'Metro City Assessment Centre', fault: null, heartbeats: 0 },
  'centre-5': { id: 'centre-5', name: 'Royal Deccan Tech Campus', fault: null, heartbeats: 0 }
};

// Candidate pools (40 per centre, cand-1 to cand-200)
const candidatesByCentre = {};
let totalCandidates = 0;
for (let c = 1; c <= 5; c++) {
  const cid = `centre-${c}`;
  candidatesByCentre[cid] = [];
  for (let n = 1; n <= 40; n++) {
    totalCandidates++;
    candidatesByCentre[cid].push({
      candidateId: `cand-${totalCandidates}`,
      sessionId: `sess-cand-${totalCandidates}`,
      centreId: cid,
      currentQuestion: 1
    });
  }
}

// Socket connection handlers
socket.on('connect', () => {
  console.log(`\n============================================================`);
  console.log(`[SIMULATOR] Connected to ExamGuard Server at ${SERVER_URL}`);
  console.log(`[SIMULATOR] Monitoring 5 centres with 200 candidates.`);
  console.log(`[SIMULATOR] Available CLI commands:`);
  console.log(`   fail power centre-3    -> Cut main power to centre-3`);
  console.log(`   spike latency centre-2 -> Inject network degradation on centre-2`);
  console.log(`   recover centre-3       -> Restore centre-3 to normal`);
  console.log(`   recover all            -> Restore all centres`);
  console.log(`   status                 -> Display current fault states`);
  console.log(`============================================================\n`);
  promptCli();
});

socket.on('disconnect', () => {
  console.log('[SIMULATOR] Disconnected from server. Reconnecting...');
});

// 1. Telemetry loop - emits every 2 seconds
setInterval(() => {
  if (!socket.connected) return;

  const now = new Date().toISOString();
  const summaryLines = [];

  for (const centreId of Object.keys(centres)) {
    const c = centres[centreId];
    c.heartbeats++;

    let cpu, memory, latency, powerStatus, statusLabel;

    if (c.fault === 'power') {
      cpu = 0;
      memory = 0;
      latency = 9999;
      powerStatus = 'FAIL';
      statusLabel = 'OFFLINE [Power Failure]';
    } else if (c.fault === 'latency') {
      cpu = Math.floor(82 + Math.random() * 15);
      memory = Math.floor(75 + Math.random() * 15);
      latency = Math.floor(650 + Math.random() * 300);
      powerStatus = 'NORMAL';
      statusLabel = 'DEGRADED [Latency Spike]';
    } else {
      cpu = Math.floor(18 + Math.random() * 22);
      memory = Math.floor(40 + Math.random() * 15);
      latency = Math.floor(14 + Math.random() * 20);
      powerStatus = 'NORMAL';
      statusLabel = 'HEALTHY [OK]';
    }

    const telemetry = {
      centreId: c.id,
      cpu,
      memory,
      latency,
      powerStatus,
      heartbeat: c.heartbeats,
      timestamp: now
    };

    socket.emit('telemetry:report', telemetry);

    const latStr = latency > 5000 ? '   ---' : `${String(latency).padStart(4, ' ')}ms`;
    summaryLines.push(
      `  ${c.id.padEnd(8)} | CPU: ${String(cpu).padStart(2)}% | RAM: ${String(memory).padStart(2)}% | Lat: ${latStr} | Pwr: ${powerStatus.padEnd(6)} | ${statusLabel}`
    );
  }

  // Print telemetry stream to terminal
  console.log(`\n--- [TELEMETRY @ ${new Date().toLocaleTimeString()}] ---`);
  summaryLines.forEach(line => console.log(line));
  promptCli();
}, 2000);

// 2. Candidate Answer submission loop - random answers every 2.5s
const OPTIONS = ['A', 'B', 'C', 'D'];
setInterval(() => {
  if (!socket.connected) return;

  // Pick a random centre
  const centreKeys = Object.keys(centres);
  const randomCentreId = centreKeys[Math.floor(Math.random() * centreKeys.length)];
  const centre = centres[randomCentreId];

  // Candidates cannot submit if power is failed
  if (centre.fault === 'power') return;

  const candList = candidatesByCentre[randomCentreId];
  if (!candList || candList.length === 0) return;

  // Pick 1-2 random candidates to submit
  const count = Math.floor(Math.random() * 2) + 1;
  for (let i = 0; i < count; i++) {
    const candidate = candList[Math.floor(Math.random() * candList.length)];
    const chosenOption = OPTIONS[Math.floor(Math.random() * OPTIONS.length)];

    socket.emit('candidate:answer', {
      candidateId: candidate.candidateId,
      sessionId: candidate.sessionId,
      centreId: candidate.centreId,
      questionId: candidate.currentQuestion,
      selectedOption: chosenOption,
      timestamp: new Date().toISOString()
    });

    candidate.currentQuestion++;
  }
}, 2500);

// 3. Interactive CLI Interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'ExamGuard> '
});

function promptCli() {
  rl.prompt(true);
}

function executeCommand(line) {
  const input = line.trim().toLowerCase();
  if (!input) return;

  const parts = input.split(/\s+/);
  const action = parts[0];

  if (action === 'fail') {
    const type = parts[1];
    const target = parts[2];

    if (!target || !centres[target]) {
      console.log(`\n[ERROR] Unknown centre '${target}'. Valid centres: ${Object.keys(centres).join(', ')}`);
    } else if (type === 'power') {
      centres[target].fault = 'power';
      console.log(`\n>>> [FAULT INJECTED] Power failure triggered on ${target}! Workstations offline.`);
    } else {
      console.log(`\n[ERROR] Unknown fault '${type}'. Use 'fail power <centreId>'.`);
    }
  } else if (action === 'spike') {
    const type = parts[1];
    const target = parts[2];

    if (!target || !centres[target]) {
      console.log(`\n[ERROR] Unknown centre '${target}'. Valid centres: ${Object.keys(centres).join(', ')}`);
    } else if (type === 'latency') {
      centres[target].fault = 'latency';
      console.log(`\n>>> [FAULT INJECTED] Latency spike triggered on ${target}! Network degraded (>700ms).`);
    } else {
      console.log(`\n[ERROR] Unknown spike '${type}'. Use 'spike latency <centreId>'.`);
    }
  } else if (action === 'recover') {
    const target = parts[1];
    if (target === 'all') {
      Object.keys(centres).forEach(k => { centres[k].fault = null; });
      console.log(`\n>>> [RECOVERY] All centres restored to normal operation.`);
    } else if (centres[target]) {
      centres[target].fault = null;
      console.log(`\n>>> [RECOVERY] ${target} restored to normal operation.`);
    } else {
      console.log(`\n[ERROR] Unknown target '${target}'. Use 'recover <centreId>' or 'recover all'.`);
    }
  } else if (action === 'status') {
    console.log('\n--- Centre Status Overview ---');
    for (const [id, c] of Object.entries(centres)) {
      console.log(`  ${id}: ${c.fault ? `FAULT (${c.fault.toUpperCase()})` : 'NORMAL'}`);
    }
  } else if (action === 'help') {
    console.log('\nSupported Commands:');
    console.log('  fail power <centre-id>     - Simulate power outage (e.g. fail power centre-3)');
    console.log('  spike latency <centre-id>  - Simulate network lag (e.g. spike latency centre-2)');
    console.log('  recover <centre-id>        - Restore centre to normal (e.g. recover centre-3)');
    console.log('  recover all                - Restore all centres to normal');
    console.log('  status                     - Show current fault status of centres');
  } else {
    console.log(`\n[ERROR] Command not recognized: '${input}'. Type 'help' for options.`);
  }
}

// Listen for remote simulation commands from server/demo runner
socket.on('sim:command', (cmd) => {
  executeCommand(cmd);
});

rl.on('line', (line) => {
  executeCommand(line);
  promptCli();
});

rl.on('close', () => {
  console.log('\n[SIMULATOR] Exiting...');
  process.exit(0);
});
