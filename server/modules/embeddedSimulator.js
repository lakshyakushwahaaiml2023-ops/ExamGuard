/**
 * ExamGuard — Embedded In-Process Simulation Engine
 * ═══════════════════════════════════════════════════════════════════════════
 * Runs inside the main server process, eliminating the need for a separate
 * simulator daemon. Perfect for single-service container deployments (e.g. Render).
 *
 * Simulates:
 *   - 5 exam centres emitting real-time telemetry every 2 seconds
 *   - Continuous candidate answer submissions with zero-loss checkpointing
 *   - Interactive fault injections: power failure, latency spikes, and automated recoveries
 *   - Automated end-to-end demo scenario execution
 */

const CENTRES_CONFIG = {
  'centre-1': { id: 'centre-1', name: 'North Apex Exam Hub', fault: null, heartbeats: 0 },
  'centre-2': { id: 'centre-2', name: 'Silicon City Institute', fault: null, heartbeats: 0 },
  'centre-3': { id: 'centre-3', name: 'Coastal Bay Cyber Centre', fault: null, heartbeats: 0 },
  'centre-4': { id: 'centre-4', name: 'Metro City Assessment Centre', fault: null, heartbeats: 0 },
  'centre-5': { id: 'centre-5', name: 'Royal Deccan Tech Campus', fault: null, heartbeats: 0 }
};

const OPTIONS = ['A', 'B', 'C', 'D'];

class EmbeddedSimulator {
  /**
   * @param {Object} options
   * @param {import('socket.io').Server} options.io
   * @param {Function} options.onTelemetry
   * @param {Function} options.onCandidateAnswer
   */
  constructor({ io, onTelemetry, onCandidateAnswer }) {
    this.io = io;
    this.onTelemetry = onTelemetry;
    this.onCandidateAnswer = onCandidateAnswer;
    this.centres = JSON.parse(JSON.stringify(CENTRES_CONFIG));
    this.telemetryInterval = null;
    this.answerInterval = null;
    this.isRunningScenario = false;

    // Build candidate pool (40 per centre = 200 candidates)
    this.candidatesByCentre = {};
    let total = 0;
    for (let c = 1; c <= 5; c++) {
      const cid = `centre-${c}`;
      this.candidatesByCentre[cid] = [];
      for (let n = 1; n <= 40; n++) {
        total++;
        this.candidatesByCentre[cid].push({
          candidateId: `cand-${total}`,
          sessionId: `sess-cand-${total}`,
          centreId: cid,
          currentQuestion: 1
        });
      }
    }
  }

  start() {
    if (this.telemetryInterval) return;

    console.log('[SIMULATOR] Embedded simulator engine starting...');

    // 1. Telemetry loop every 2 seconds
    this.telemetryInterval = setInterval(() => {
      this.tickTelemetry();
    }, 2000);

    // 2. Candidate answer submission loop every 2.5 seconds
    this.answerInterval = setInterval(() => {
      this.tickAnswers();
    }, 2500);

    console.log('[SIMULATOR] In-process simulation active (5 centres, 200 candidate workstations).');
  }

  stop() {
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    if (this.answerInterval) clearInterval(this.answerInterval);
    this.telemetryInterval = null;
    this.answerInterval = null;
  }

  tickTelemetry() {
    for (const centreId of Object.keys(this.centres)) {
      const c = this.centres[centreId];
      c.heartbeats++;

      let cpu, memory, latency, powerStatus;

      if (c.fault === 'power') {
        cpu = 0;
        memory = 0;
        latency = 9999;
        powerStatus = 'FAIL';
      } else if (c.fault === 'latency') {
        cpu = Math.floor(82 + Math.random() * 15);
        memory = Math.floor(75 + Math.random() * 15);
        latency = Math.floor(650 + Math.random() * 300);
        powerStatus = 'NORMAL';
      } else {
        cpu = Math.floor(18 + Math.random() * 22);
        memory = Math.floor(40 + Math.random() * 15);
        latency = Math.floor(14 + Math.random() * 20);
        powerStatus = 'NORMAL';
      }

      const telemetry = {
        centreId: c.id,
        cpu,
        memory,
        latency,
        powerStatus,
        heartbeat: c.heartbeats,
        timestamp: new Date().toISOString()
      };

      if (this.onTelemetry) {
        this.onTelemetry(telemetry);
      }
    }
  }

  tickAnswers() {
    const centreKeys = Object.keys(this.centres);
    const activeCentres = centreKeys.filter(cid => this.centres[cid].fault !== 'power');
    if (activeCentres.length === 0) return;

    const randomCentreId = activeCentres[Math.floor(Math.random() * activeCentres.length)];
    const pool = this.candidatesByCentre[randomCentreId];
    if (!pool || pool.length === 0) return;

    const candidate = pool[Math.floor(Math.random() * pool.length)];
    const chosenOption = OPTIONS[Math.floor(Math.random() * OPTIONS.length)];

    if (this.onCandidateAnswer) {
      this.onCandidateAnswer({
        candidateId: candidate.candidateId,
        sessionId: candidate.sessionId,
        centreId: candidate.centreId,
        questionId: candidate.currentQuestion,
        selectedOption: chosenOption,
        timestamp: new Date().toISOString()
      });
    }

    candidate.currentQuestion++;
    if (candidate.currentQuestion > 20) {
      candidate.currentQuestion = 1;
    }
  }

  failPower(centreId = 'centre-3') {
    if (this.centres[centreId]) {
      this.centres[centreId].fault = 'power';
      console.log(`[SIMULATOR] Power failure injected on ${centreId}`);
      this.tickTelemetry();
      return { success: true, centreId, fault: 'power', message: `Power failure injected on ${centreId}` };
    }
    throw new Error(`Unknown centre: ${centreId}`);
  }

  spikeLatency(centreId = 'centre-2') {
    if (this.centres[centreId]) {
      this.centres[centreId].fault = 'latency';
      console.log(`[SIMULATOR] Latency spike injected on ${centreId}`);
      this.tickTelemetry();
      return { success: true, centreId, fault: 'latency', message: `Latency spike injected on ${centreId}` };
    }
    throw new Error(`Unknown centre: ${centreId}`);
  }

  recover(centreId = 'all') {
    if (centreId === 'all') {
      Object.keys(this.centres).forEach(k => { this.centres[k].fault = null; });
      console.log('[SIMULATOR] All centres recovered to normal operation.');
      this.tickTelemetry();
      return { success: true, centreId: 'all', message: 'All centres recovered to normal operation.' };
    }
    if (this.centres[centreId]) {
      this.centres[centreId].fault = null;
      console.log(`[SIMULATOR] Centre ${centreId} recovered to normal operation.`);
      this.tickTelemetry();
      return { success: true, centreId, message: `Centre ${centreId} recovered to normal operation.` };
    }
    throw new Error(`Unknown centre: ${centreId}`);
  }

  reset() {
    Object.keys(this.centres).forEach(k => {
      this.centres[k].fault = null;
      this.centres[k].heartbeats = 0;
    });
    console.log('[SIMULATOR] Simulation state reset.');
  }

  getStatus() {
    return Object.values(this.centres).map(c => ({
      id: c.id,
      name: c.name,
      fault: c.fault,
      status: c.fault ? `FAULT (${c.fault.toUpperCase()})` : 'HEALTHY'
    }));
  }
}

module.exports = EmbeddedSimulator;
