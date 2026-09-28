/**
 * ExamGuard — Module 2: TriageAI
 * ═══════════════════════════════════════════════════════════════════════════
 * Server module for real-time incident detection, classification, escalation,
 * and automated lifecycle management.
 *
 * Rules:
 *   1. 3 missed heartbeats = CRITICAL "centre offline"
 *   2. latency > 500ms for 3 consecutive readings = WARNING "network degradation"
 *   3. power status false / FAIL = CRITICAL "power failure"
 *   4. rolling z-score on CPU and latency (window 30, |z| > 3) = WARNING "PREDICTIVE WARNING"
 *
 * Escalation levels:
 *   WARNING  -> "notify centre admin"   (Target: Centre Administrator)
 *   CRITICAL -> "notify exam controller" (Target: Exam Controller)
 *
 * Incident fields:
 *   id, centre, type, severity, timestamp, affected candidate count,
 *   status (open/acknowledged/resolved), escalation level, escalation target.
 *
 * Auto-resolves when telemetry readings recover.
 * All state transitions recorded in TrustLedger (SHA-256 hash-chained log).
 */

const { db, appendLedgerEvent } = require('../db');

const ESCALATION = {
  WARNING: {
    level: 'notify centre admin',
    target: 'Centre Administrator'
  },
  CRITICAL: {
    level: 'notify exam controller',
    target: 'Exam Controller'
  }
};

const CANDIDATES_PER_CENTRE = 40;

// ── Rolling window buffer for z-score anomaly detection ───────────────────────
class RollingBuffer {
  constructor(windowSize = 30) {
    this.size = windowSize;
    this.data = [];
  }

  push(value) {
    if (typeof value !== 'number' || isNaN(value)) return;
    this.data.push(value);
    if (this.data.length > this.size) this.data.shift();
  }

  get count() {
    return this.data.length;
  }

  mean() {
    if (this.data.length === 0) return 0;
    return this.data.reduce((sum, v) => sum + v, 0) / this.data.length;
  }

  std() {
    if (this.data.length < 2) return 0;
    const m = this.mean();
    const variance = this.data.reduce((sum, v) => sum + (v - m) ** 2, 0) / this.data.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculates z-score: z = (x - mean) / std.
   * Requires at least 5 readings to avoid noisy false positives.
   */
  zScore(value) {
    if (this.data.length < 5) return 0;
    const s = this.std();
    if (s === 0) return 0;
    return (value - this.mean()) / s;
  }
}

// ── TriageAI Module ───────────────────────────────────────────────────────────
class TriageAI {
  /**
   * @param {import('socket.io').Server} io
   */
  constructor(io) {
    this.io = io;

    // Per-centre monitoring state
    this.lastSeen = new Map();         // centreId -> timestamp (ms)
    this.missedHeartbeats = new Map(); // centreId -> count
    this.latencyHistory = new Map();   // centreId -> Array of last 3 latency values
    this.cpuBuffers = new Map();       // centreId -> RollingBuffer(30)
    this.latBuffers = new Map();       // centreId -> RollingBuffer(30)

    // Active incidents mapping: `${centreId}:${typeKey}` -> incidentId
    this.active = new Map();

    // Watchdog timer checks for missed heartbeats every 2 seconds
    this._watchdogTimer = setInterval(() => this._checkHeartbeats(), 2000);

    console.log('[TRIAGE] TriageAI server module active (z-score window=30, threshold |z|>3)');
  }

  /**
   * Ingest and evaluate telemetry from a centre.
   * Called on every telemetry:report event.
   */
  processTelemetry(centreId, telemetry) {
    const { cpu, latency, powerStatus } = telemetry;

    // Update heartbeat tracking & immediately resolve offline incident if open
    this.lastSeen.set(centreId, Date.now());
    this.missedHeartbeats.set(centreId, 0);
    this._autoResolve(centreId, 'centre offline');

    // Initialise rolling buffers if first reading for this centre
    if (!this.cpuBuffers.has(centreId)) this.cpuBuffers.set(centreId, new RollingBuffer(30));
    if (!this.latBuffers.has(centreId)) this.latBuffers.set(centreId, new RollingBuffer(30));
    if (!this.latencyHistory.has(centreId)) this.latencyHistory.set(centreId, []);

    const cpuBuf = this.cpuBuffers.get(centreId);
    const latBuf = this.latBuffers.get(centreId);
    const latHist = this.latencyHistory.get(centreId);

    // ── Rule 1: Power Status False / FAIL -> CRITICAL "power failure" ─────────
    const isPowerFail = powerStatus === false || powerStatus === 'FAIL' || powerStatus === 'false';
    if (isPowerFail) {
      this._raiseIfNew(centreId, 'power failure', 'CRITICAL', {
        powerStatus,
        reason: 'Mains power failure detected'
      });
    } else {
      this._autoResolve(centreId, 'power failure');
    }

    // ── Rule 2: Latency > 500ms for 3 consecutive readings -> WARNING "network degradation"
    if (!isPowerFail && typeof latency === 'number' && latency >= 0) {
      latHist.push(latency);
      if (latHist.length > 3) latHist.shift();

      const consecutiveHighLatency = latHist.length === 3 && latHist.every(l => l > 500);
      if (consecutiveHighLatency) {
        this._raiseIfNew(centreId, 'network degradation', 'WARNING', {
          consecutiveReadings: [...latHist],
          reason: 'Latency exceeded 500ms for 3 consecutive readings'
        });
      } else if (latHist.length === 3 && latHist.every(l => l <= 300)) {
        // Auto-resolve when latency returns below 300ms
        this._autoResolve(centreId, 'network degradation');
      }
    }

    // ── Rule 3 & 4: Rolling Z-Score Anomaly Detector on CPU and Latency (Window 30, |z| > 3)
    // Raises a "PREDICTIVE WARNING" before hard failure
    if (!isPowerFail && typeof cpu === 'number') {
      cpuBuf.push(cpu);
      const zCpu = cpuBuf.zScore(cpu);
      if (Math.abs(zCpu) > 3) {
        this._raiseIfNew(centreId, 'PREDICTIVE WARNING', 'WARNING', {
          metric: 'CPU',
          value: cpu,
          zScore: parseFloat(zCpu.toFixed(2)),
          mean: parseFloat(cpuBuf.mean().toFixed(2)),
          std: parseFloat(cpuBuf.std().toFixed(2)),
          reason: `CPU anomalous spike: z-score ${zCpu.toFixed(2)} exceeds ±3 threshold`
        });
      } else if (Math.abs(zCpu) < 1.5) {
        this._autoResolve(centreId, 'PREDICTIVE WARNING');
      }
    }

    if (!isPowerFail && typeof latency === 'number' && latency > 0 && latency < 5000) {
      latBuf.push(latency);
      const zLat = latBuf.zScore(latency);
      if (Math.abs(zLat) > 3) {
        this._raiseIfNew(centreId, 'PREDICTIVE WARNING', 'WARNING', {
          metric: 'Latency',
          value: latency,
          zScore: parseFloat(zLat.toFixed(2)),
          mean: parseFloat(latBuf.mean().toFixed(2)),
          std: parseFloat(latBuf.std().toFixed(2)),
          reason: `Latency anomalous surge: z-score ${zLat.toFixed(2)} exceeds ±3 threshold`
        });
      } else if (Math.abs(zLat) < 1.5) {
        this._autoResolve(centreId, 'PREDICTIVE WARNING');
      }
    }
  }

  // ── Heartbeat Watchdog: 3 missed heartbeats = CRITICAL "centre offline" ────
  _checkHeartbeats() {
    const now = Date.now();
    for (const [centreId, lastTs] of this.lastSeen.entries()) {
      const elapsedMs = now - lastTs;
      // Simulator reports every 2s. 3 missed = 6s.
      if (elapsedMs >= 6000) {
        const missed = Math.floor(elapsedMs / 2000);
        this.missedHeartbeats.set(centreId, missed);

        if (missed >= 3) {
          this._raiseIfNew(centreId, 'centre offline', 'CRITICAL', {
            missedHeartbeats: missed,
            elapsedSeconds: Math.round(elapsedMs / 1000),
            reason: `No telemetry received for ${missed} consecutive cycles (3 missed heartbeats)`
          });
        }
      } else {
        // Reporting resumed -> auto-resolve
        this._autoResolve(centreId, 'centre offline');
      }
    }
  }

  // ── Raise Incident ─────────────────────────────────────────────────────────
  _raiseIfNew(centreId, type, severity, details) {
    const key = `${centreId}:${type.toLowerCase()}`;
    if (this.active.has(key)) return;

    // Verify centre exists in database to uphold foreign key integrity
    const centreExists = db.prepare('SELECT id FROM centres WHERE id = ?').get(centreId);
    if (!centreExists) {
      console.warn(`[TRIAGE] Skipped incident for unknown centre: ${centreId}`);
      return;
    }

    const esc = ESCALATION[severity] || ESCALATION.WARNING;
    const id = `inc-${type.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}-${centreId}`;
    const affectedCandidates = severity === 'CRITICAL' ? CANDIDATES_PER_CENTRE : 0;
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
    const timestamp = new Date().toISOString();

    // Persist to database
    db.prepare(`
      INSERT INTO incidents (
        id, centre_id, type, severity, status, details,
        affected_candidates, escalation_level, escalation_target, detected_at
      ) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
    `).run(
      id,
      centreId,
      type,
      severity,
      detailsStr,
      affectedCandidates,
      esc.level,
      esc.target,
      timestamp
    );

    this.active.set(key, id);

    // TrustLedger append
    appendLedgerEvent(centreId, 'incident created', {
      incidentId: id,
      type,
      severity,
      escalationLevel: esc.level,
      escalationTarget: esc.target,
      affectedCandidates
    });

    const incident = {
      id,
      centre: centreId,
      centre_id: centreId,
      type,
      severity,
      timestamp,
      detected_at: timestamp,
      affected_candidate_count: affectedCandidates,
      affected_candidates: affectedCandidates,
      status: 'open',
      escalation_level: esc.level,
      escalation_target: esc.target,
      details: detailsStr
    };

    // Broadcast to real-time incident feed
    this.io.emit('incident:new', incident);
    console.log(`[TRIAGE] ▲ OPENED [${severity}] "${type}" @ ${centreId} -> Escalation: ${esc.target}`);

    // Trigger automated session failover if centre suffered a CRITICAL outage
    if (severity === 'CRITICAL' && this.continuityEngine) {
      this.continuityEngine.handleCentreFailure(centreId, type).catch(err => {
        console.error(`[TRIAGE] Failover invocation error for ${centreId}:`, err.message);
      });
    }
  }

  setContinuityEngine(engine) {
    this.continuityEngine = engine;
  }

  // ── Auto-Resolve Incident ──────────────────────────────────────────────────
  _autoResolve(centreId, type) {
    const key = `${centreId}:${type.toLowerCase()}`;
    if (!this.active.has(key)) return;

    const id = this.active.get(key);
    const resolvedAt = new Date().toISOString();

    const row = db.prepare('SELECT status FROM incidents WHERE id = ?').get(id);
    if (!row || row.status === 'resolved') {
      this.active.delete(key);
      return;
    }

    db.prepare(`
      UPDATE incidents
      SET status = 'resolved', resolved_at = ?
      WHERE id = ?
    `).run(resolvedAt, id);

    this.active.delete(key);

    appendLedgerEvent(centreId, 'incident resolved', {
      incidentId: id,
      type,
      resolvedAt
    });

    this.io.emit('incident:resolved', {
      id,
      centre: centreId,
      centre_id: centreId,
      type,
      status: 'resolved',
      resolved_at: resolvedAt
    });

    console.log(`[TRIAGE] ✓ AUTO-RESOLVED "${type}" @ ${centreId}`);

    // Trigger Module 5: Decision Support impact assessment after incident resolution
    if (this.decisionEngine) {
      try {
        this.decisionEngine.evaluateIncident(id);
      } catch (err) {
        console.warn(`[TRIAGE] Decision evaluation for ${id} deferred:`, err.message);
      }
    }
  }

  setDecisionEngine(engine) {
    this.decisionEngine = engine;
  }

  // ── Manual Acknowledge ─────────────────────────────────────────────────────
  acknowledge(incidentId) {
    const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
    if (!row) {
      throw new Error(`Incident '${incidentId}' not found`);
    }
    if (row.status === 'resolved') {
      throw new Error(`Incident '${incidentId}' is already resolved`);
    }

    const acknowledgedAt = new Date().toISOString();
    db.prepare(`
      UPDATE incidents
      SET status = 'acknowledged', acknowledged_at = ?
      WHERE id = ?
    `).run(acknowledgedAt, incidentId);

    appendLedgerEvent(row.centre_id, 'admin acknowledge', {
      incidentId,
      acknowledgedAt
    });

    const updated = {
      ...row,
      centre: row.centre_id,
      timestamp: row.detected_at,
      affected_candidate_count: row.affected_candidates,
      status: 'acknowledged',
      acknowledged_at: acknowledgedAt
    };

    this.io.emit('incident:acknowledged', updated);
    console.log(`[TRIAGE] 👁 ACKNOWLEDGED "${row.type}" (${incidentId})`);
    return updated;
  }

  destroy() {
    clearInterval(this._watchdogTimer);
  }
}

module.exports = TriageAI;
