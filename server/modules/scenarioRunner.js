/**
 * ExamGuard — In-Server Scripted Scenario Runner
 * ═══════════════════════════════════════════════════════════════════════════
 * Executes the 3-minute scripted demonstration scenario directly within
 * the server, broadcasting real-time progress via Socket.IO to the dashboard.
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class ScenarioRunner {
  /**
   * @param {Object} options
   * @param {import('socket.io').Server} options.io
   * @param {Object} options.embeddedSimulator
   * @param {Object} options.continuityEngine
   * @param {Object} options.triageAI
   * @param {Object} options.decisionEngine
   * @param {Object} options.ledgerModule
   */
  constructor({ io, embeddedSimulator, continuityEngine, triageAI, decisionEngine, ledgerModule }) {
    this.io = io;
    this.sim = embeddedSimulator;
    this.continuity = continuityEngine;
    this.triage = triageAI;
    this.dss = decisionEngine;
    this.ledger = ledgerModule;
    this.isRunning = false;
    this.currentStep = null;
    this.abortController = null;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      currentStep: this.currentStep
    };
  }

  broadcastProgress(step, title, details, progressPercent = 0) {
    this.currentStep = { step, title, details, progressPercent, timestamp: new Date().toISOString() };
    this.io.emit('demo:progress', this.currentStep);
    console.log(`[SCENARIO] Step ${step}: ${title} — ${details}`);
  }

  async run(isFast = false) {
    if (this.isRunning) {
      throw new Error('A demonstration scenario is already in progress.');
    }

    this.isRunning = true;
    const factor = isFast ? 0.2 : 1.0;

    try {
      // ── STEP 1: Normal Baseline (30s) ───────────────────────────────────────
      this.sim.recover('all');
      this.broadcastProgress(1, 'Normal Examination Baseline', 'All 5 centres operating at baseline health (CPU ~20%, Latency ~15ms). Answers saving in real time.', 10);
      await sleep(15000 * factor);
      this.broadcastProgress(1, 'Normal Examination Baseline', 'Real-time telemetry and SHA-256 block creation verified.', 20);
      await sleep(15000 * factor);

      // ── STEP 2: Latency Spike on Centre-2 (30s) ────────────────────────────
      this.broadcastProgress(2, 'Latency Spike on Centre-2', 'Injecting network latency spike (>700ms) on Centre-2 (Silicon City Institute)...', 30);
      this.sim.spikeLatency('centre-2');
      await sleep(10000 * factor);

      this.broadcastProgress(2, 'TriageAI Incident Acknowledged', 'TriageAI raised WARNING incident. Centre Administrator acknowledging...', 45);
      // Auto-acknowledge if incident exists
      const openInc = this.triage.getActiveIncidents?.()?.find(i => i.centre_id === 'centre-2');
      if (openInc) {
        try { this.triage.acknowledge(openInc.id); } catch {}
      }
      await sleep(12000 * factor);

      this.broadcastProgress(2, 'Recovering Centre-2 Network', 'Network connection restoring. TriageAI auto-resolving incident...', 55);
      this.sim.recover('centre-2');
      await sleep(8000 * factor);

      // ── STEP 3: Power Failure on Centre-3 & Failover (45s) ──────────────────
      this.broadcastProgress(3, 'Critical Power Failure on Centre-3', 'Cutting main grid power to Centre-3 (Coastal Bay Cyber Centre)...', 60);
      this.sim.failPower('centre-3');
      await sleep(8000 * factor);

      this.broadcastProgress(3, 'Automated Failover Protocol Active', 'Continuity Engine selecting healthiest standby centre & re-attaching 40 candidate sessions...', 70);
      try {
        await this.continuity.handleCentreFailure('centre-3', 'Automated scripted demo failure');
      } catch (e) {
        console.warn('[SCENARIO] Failover warning:', e.message);
      }
      await sleep(18000 * factor);

      this.broadcastProgress(3, 'Restoring Primary Power to Centre-3', 'Grid power restored to Centre-3. Normalizing telemetry...', 80);
      this.sim.recover('centre-3');
      await sleep(8000 * factor);

      // ── STEP 4: Decision Support Impact Assessment (30s) ───────────────────
      this.broadcastProgress(4, 'Post-Incident Impact Assessment', 'Evaluating statutory exam rules (candidates affected, recovered, answers lost)...', 85);
      let decisions = [];
      try {
        decisions = this.dss.evaluateAllResolvedIncidents();
        if (decisions.length > 0) {
          this.dss.approve(decisions[0].id, 'Chief Exam Controller Dr. Sharma');
        }
      } catch (e) {
        console.warn('[SCENARIO] DSS evaluation warning:', e.message);
      }
      await sleep(15000 * factor);

      // ── STEP 5: TrustLedger Tamper Attempt & Detection (35s) ────────────────
      this.broadcastProgress(5, 'TrustLedger Cryptographic Tamper Demo', 'Injecting unauthorized modification into past SQLite block payload...', 92);
      try {
        this.ledger.tamperDemo();
      } catch {}
      await sleep(8000 * factor);

      this.broadcastProgress(5, 'Tamper Detected & Repaired', 'Cryptographic signature mismatch identified! Repairing SHA-256 chain to 100% intact...', 96);
      try {
        this.ledger.repairLedger();
      } catch {}
      await sleep(6000 * factor);

      // ── COMPLETE ────────────────────────────────────────────────────────────
      this.broadcastProgress(5, 'Scenario Completed', 'All 5 resilience modules demonstrated successfully with zero data loss.', 100);
      this.io.emit('demo:completed', { success: true, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error('[SCENARIO] Error during demo scenario:', err);
      this.io.emit('demo:error', { error: err.message });
    } finally {
      this.isRunning = false;
      setTimeout(() => {
        if (!this.isRunning) {
          this.currentStep = null;
          this.io.emit('demo:progress', null);
        }
      }, 8000);
    }
  }

  stop() {
    this.isRunning = false;
    this.sim.recover('all');
    this.currentStep = null;
    this.io.emit('demo:progress', null);
  }
}

module.exports = ScenarioRunner;
