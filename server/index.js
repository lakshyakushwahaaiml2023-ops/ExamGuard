/**
 * ExamGuard - Main Server Entry Point
 * Express + Socket.IO single-service entry point.
 *
 * Features for Render & Single-Process Deployment:
 *   1. Express serves built client assets (client/dist) with SPA fallback
 *   2. In-process embedded simulator automatically started on boot
 *   3. Database auto-seeding if empty
 *   4. REST API endpoints for Demo Controls (/api/demo/*)
 *   5. /health monitoring endpoint
 *   6. Dynamic PORT binding (process.env.PORT || 4000)
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { db } = require('./db');
const { seedDatabase } = require('./seed');
const TriageAI = require('./modules/triage');
const ContinuityEngine = require('./modules/continuity');
const DecisionSupportEngine = require('./modules/decisionSupport');
const EmbeddedSimulator = require('./modules/embeddedSimulator');
const ScenarioRunner = require('./modules/scenarioRunner');
const ledgerModule = require('./modules/ledger');
const {
  appendLedgerEvent,
  verifyLedger,
  tamperDemo,
  repairLedger,
  getLedgerEvents,
  getLedgerEventById,
  setLedgerSocket
} = ledgerModule;
const { getPublicStatus } = require('./modules/publicStatus');

const PORT = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Setup Socket.IO with open CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ── 1. Auto-Seed SQLite Database if Empty ────────────────────────────────────
try {
  const countRow = db.prepare('SELECT count(*) as count FROM centres').get();
  if (!countRow || countRow.count === 0) {
    console.log('[SERVER] Database is empty. Running automatic seed on boot...');
    seedDatabase();
  } else {
    console.log(`[SERVER] Database verified: ${countRow.count} centres registered.`);
  }
} catch (err) {
  console.warn('[SERVER] Auto-seed check error:', err.message);
}

// In-memory cache of latest telemetry per centre
const latestTelemetry = new Map();

// Connect TrustLedger to Socket.IO for real-time block streaming
setLedgerSocket(io);

// Initialize Module 3: Continuity & Failover Engine
const continuityEngine = new ContinuityEngine(io, latestTelemetry);

// Initialize Module 5: Decision Support Engine
const decisionEngine = new DecisionSupportEngine(io);

// Initialize Module 2: TriageAI Server Module & wire into continuity + decision engine
const triageAI = new TriageAI(io);
triageAI.setContinuityEngine(continuityEngine);
triageAI.setDecisionEngine(decisionEngine);

// ── 2. Unified Telemetry & Answer Processing ─────────────────────────────────
function handleTelemetry(data) {
  const { centreId, cpu, memory, latency, powerStatus, heartbeat, timestamp } = data;
  latestTelemetry.set(centreId, data);

  // Determine centre operational health
  let centreStatus = 'active';
  const isPowerFail = powerStatus === false || powerStatus === 'FAIL' || powerStatus === 'false';
  if (isPowerFail) {
    centreStatus = 'offline';
  } else if (latency > 300 || cpu > 85) {
    centreStatus = 'degraded';
  }

  try {
    db.prepare('UPDATE centres SET status = ? WHERE id = ?').run(centreStatus, centreId);
  } catch {}

  // Delegate incident analysis to TriageAI module (Module 2)
  triageAI.processTelemetry(centreId, data);

  // Broadcast updated telemetry to frontend dashboards
  io.emit('telemetry:update', { centreId, ...data, status: centreStatus });
}

function handleCandidateAnswer(data) {
  continuityEngine.saveAnswerCheckpoint(data);
}

// ── 3. Embedded In-Process Simulator ──────────────────────────────────────────
const embeddedSimulator = new EmbeddedSimulator({
  io,
  onTelemetry: handleTelemetry,
  onCandidateAnswer: handleCandidateAnswer
});
embeddedSimulator.start();

// Initialize Scenario Runner for automated demos
const scenarioRunner = new ScenarioRunner({
  io,
  embeddedSimulator,
  continuityEngine,
  triageAI,
  decisionEngine,
  ledgerModule
});

// Load mock questions
let examQuestions = [];
try {
  examQuestions = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf8'));
} catch (e) {
  examQuestions = [
    { id: 1, text: "Which data structure uses LIFO order?", options: { A: "Queue", B: "Stack", C: "Tree", D: "Graph" } }
  ];
}

// ── 4. Core System Endpoints ──────────────────────────────────────────────────

// Render Health Check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'examguard',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 5. Demo Controls Endpoints (Module 7) ─────────────────────────────────────

// 1. Fail power on a centre (default: centre-3)
app.post('/api/demo/fail-power', (req, res) => {
  try {
    const centreId = req.body?.centreId || 'centre-3';
    const result = embeddedSimulator.failPower(centreId);
    io.emit('sim:command', `fail power ${centreId}`);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 2. Spike latency on a centre (default: centre-2)
app.post('/api/demo/spike-latency', (req, res) => {
  try {
    const centreId = req.body?.centreId || 'centre-2';
    const result = embeddedSimulator.spikeLatency(centreId);
    io.emit('sim:command', `spike latency ${centreId}`);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Recover centre(s) (default: all)
app.post('/api/demo/recover', (req, res) => {
  try {
    const centreId = req.body?.centreId || 'all';
    const result = embeddedSimulator.recover(centreId);
    io.emit('sim:command', `recover ${centreId}`);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 4. Reset entire system (database + simulator) to clean genesis state
app.post('/api/demo/reset', (req, res) => {
  try {
    embeddedSimulator.reset();
    seedDatabase();
    io.emit('sim:command', 'recover all');
    io.emit('demo:reset');
    res.json({ success: true, message: 'Database & simulation state cleanly reset.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Trigger scripted 3-minute scenario
app.post('/api/demo/run-scenario', (req, res) => {
  try {
    const isFast = req.body?.fast === true || req.query?.fast === 'true';
    scenarioRunner.run(isFast).catch(e => console.error('[SCENARIO] Runner error:', e));
    res.json({ success: true, message: 'Automated demonstration scenario initiated.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 6. Get status of scenario and simulator
app.get('/api/demo/status', (req, res) => {
  res.json({
    scenario: scenarioRunner.getStatus(),
    centres: embeddedSimulator.getStatus()
  });
});

// Legacy simulation command forwarder
app.post('/api/sim/command', (req, res) => {
  const { command } = req.body || {};
  if (!command) return res.status(400).json({ error: 'command required' });
  const parts = command.trim().toLowerCase().split(/\s+/);
  if (parts[0] === 'fail' && parts[1] === 'power') {
    embeddedSimulator.failPower(parts[2] || 'centre-3');
  } else if (parts[0] === 'spike' && parts[1] === 'latency') {
    embeddedSimulator.spikeLatency(parts[2] || 'centre-2');
  } else if (parts[0] === 'recover') {
    embeddedSimulator.recover(parts[1] || 'all');
  }
  io.emit('sim:command', command);
  res.json({ success: true, command });
});

// ── 6. Domain Business Endpoints ──────────────────────────────────────────────

// Centres
app.get('/api/centres', (req, res) => {
  const centres = db.prepare('SELECT * FROM centres').all();
  const result = centres.map(c => ({
    ...c,
    telemetry: latestTelemetry.get(c.id) || null
  }));
  res.json(result);
});

// Candidates
app.get('/api/candidates', (req, res) => {
  const centreId = req.query.centreId;
  let query = `
    SELECT c.id, c.name, c.roll_number, c.centre_id,
           s.id as session_id, s.node_id, s.status as session_status,
           s.current_question, s.time_remaining, s.last_heartbeat
    FROM candidates c
    JOIN sessions s ON c.id = s.candidate_id
  `;
  const params = [];
  if (centreId) {
    query += ' WHERE c.centre_id = ?';
    params.push(centreId);
  }
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

app.post('/api/candidates/login', (req, res) => {
  try {
    const { candidateId, centreId, nodeId } = req.body;
    const event = appendLedgerEvent(centreId || 'SYSTEM', 'candidate login', {
      candidateId,
      centreId,
      nodeId: nodeId || 'workstation-1',
      loginTime: new Date().toISOString()
    });
    res.json({ success: true, event });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Exam Questions & Candidate Session
app.get('/api/exam/questions', (req, res) => {
  res.json(examQuestions);
});

app.get('/api/candidates/:id/session', (req, res) => {
  const candidateId = req.params.id;
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ? OR roll_number = ?').get(candidateId, candidateId);

  if (!candidate) {
    return res.status(404).json({ error: `Candidate '${candidateId}' not found` });
  }

  let session = db.prepare('SELECT * FROM sessions WHERE candidate_id = ?').get(candidate.id);
  if (!session) {
    const sessId = `sess-${candidate.id}`;
    db.prepare(`
      INSERT INTO sessions (id, candidate_id, centre_id, node_id, status, current_question, time_remaining)
      VALUES (?, ?, ?, 'node-1', 'active', 1, 7200)
    `).run(sessId, candidate.id, candidate.centre_id);
    session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessId);
  }

  const centre = db.prepare('SELECT * FROM centres WHERE id = ?').get(session.centre_id);
  const answers = db.prepare('SELECT * FROM answers WHERE session_id = ? ORDER BY question_id ASC').all(session.id);
  const answersMap = Object.fromEntries(answers.map(a => [a.question_id, a.selected_option]));

  res.json({
    candidate,
    session,
    centre,
    answers,
    answersMap,
    totalAnswersSaved: answers.length
  });
});

app.post('/api/exam/answer', (req, res) => {
  try {
    const { candidateId, sessionId, centreId, questionId, selectedOption, timestamp } = req.body;
    const result = continuityEngine.saveAnswerCheckpoint({
      candidateId,
      sessionId,
      centreId,
      questionId: parseInt(questionId, 10),
      selectedOption,
      timestamp
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Failover
app.get('/api/failover/latest', (req, res) => {
  const latest = continuityEngine.getLatestFailover();
  res.json(latest || { status: 'idle', message: 'No failover events recorded.' });
});

app.post('/api/failover/trigger', async (req, res) => {
  try {
    const { centreId } = req.body;
    const targetCentre = centreId || 'centre-3';
    const result = await continuityEngine.handleCentreFailure(targetCentre, 'manual failover demonstration');
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Incidents
app.get('/api/incidents', (req, res) => {
  const rows = db.prepare('SELECT * FROM incidents ORDER BY detected_at DESC').all();
  const result = rows.map(r => ({
    id: r.id,
    centre: r.centre_id,
    centre_id: r.centre_id,
    type: r.type,
    severity: r.severity,
    timestamp: r.detected_at,
    detected_at: r.detected_at,
    affected_candidate_count: r.affected_candidates || 0,
    affected_candidates: r.affected_candidates || 0,
    status: r.status,
    escalation_level: r.escalation_level,
    escalation_target: r.escalation_target,
    acknowledged_at: r.acknowledged_at,
    resolved_at: r.resolved_at,
    details: r.details
  }));
  res.json(result);
});

app.post('/api/incidents/:id/acknowledge', (req, res) => {
  try {
    const updated = triageAI.acknowledge(req.params.id);
    res.json({ success: true, incident: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Decisions
app.get('/api/decisions', (req, res) => {
  const decisions = decisionEngine.getAllDecisions();
  res.json(decisions);
});

app.get('/api/decisions/:id', (req, res) => {
  const decision = decisionEngine.getAllDecisions().find(d => d.id === req.params.id);
  if (!decision) return res.status(404).json({ error: `Decision '${req.params.id}' not found` });
  res.json(decision);
});

app.post('/api/decisions/evaluate', (req, res) => {
  try {
    const { incidentId } = req.body || {};
    if (incidentId) {
      const result = decisionEngine.evaluateIncident(incidentId);
      res.json({ success: true, count: 1, decisions: [result] });
    } else {
      const results = decisionEngine.evaluateAllResolvedIncidents();
      res.json({ success: true, count: results.length, decisions: results });
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/decisions/:id/approve', (req, res) => {
  try {
    const { decidedBy } = req.body || {};
    const updated = decisionEngine.approve(req.params.id, decidedBy || 'National Exam Controller');
    res.json({ success: true, decision: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/decisions/:id/override', (req, res) => {
  try {
    const ruling = req.body?.newDecision || req.body?.finalDecision;
    const { reason, decidedBy } = req.body || {};
    if (!ruling) return res.status(400).json({ success: false, error: 'newDecision field is required' });
    if (!reason) return res.status(400).json({ success: false, error: 'reason field is required to override' });
    const updated = decisionEngine.override(
      req.params.id,
      ruling,
      reason,
      decidedBy || 'National Exam Controller'
    );
    res.json({ success: true, decision: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// TrustLedger
app.get('/api/ledger', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;
  const events = getLedgerEvents(limit, offset);
  res.json(events);
});

app.get('/api/ledger/event/:id', (req, res) => {
  const event = getLedgerEventById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Ledger event not found' });
  res.json(event);
});

app.get('/api/ledger/verify', (req, res) => {
  const result = verifyLedger();
  res.json(result);
});

app.post('/api/ledger/tamper-demo', (req, res) => {
  try {
    const eventId = req.body && req.body.eventId ? parseInt(req.body.eventId, 10) : null;
    const result = tamperDemo(eventId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/ledger/repair', (req, res) => {
  try {
    const result = repairLedger();
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Public Status
app.get('/api/public-status', (req, res) => {
  try {
    const statusData = getPublicStatus(latestTelemetry);
    res.json(statusData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 7. Socket.IO Event Handlers ───────────────────────────────────────────────

io.on('connection', (socket) => {
  // Allow external simulator clients to report if connected
  socket.on('telemetry:report', handleTelemetry);
  socket.on('candidate:answer', handleCandidateAnswer);

  socket.on('incident:acknowledge', ({ incidentId }) => {
    try {
      triageAI.acknowledge(incidentId);
    } catch (err) {
      console.error('[TRIAGE] Socket acknowledge failed:', err.message);
    }
  });
});

// ── 8. Static File Serving & Client SPA Routing (Render Deployment) ────────────

const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log('[SERVER] Serving static frontend from client/dist');
  app.use(express.static(clientDistPath));

  // Express 5 compatible SPA fallback for all GET client routes
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io') && req.path !== '/health') {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
} else {
  console.log('[SERVER] client/dist not found yet. Run "npm run build" to generate client bundle.');
  app.get('/', (req, res) => {
    res.send('<h1>ExamGuard API Online</h1><p>Client build not generated yet. Run <code>npm run build</code>.</p>');
  });
}

// ── 9. Start Server ───────────────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n============================================================`);
  console.log(`[SERVER] ExamGuard Server live on port ${PORT}`);
  console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);
  console.log(`[SERVER] Web Console: http://localhost:${PORT}/admin`);
  console.log(`============================================================\n`);
});

module.exports = { app, server, io, triageAI, continuityEngine, embeddedSimulator, scenarioRunner };
