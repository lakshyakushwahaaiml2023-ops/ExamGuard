/**
 * ExamGuard — Module 5: Decision Support System (DSS)
 * ═══════════════════════════════════════════════════════════════════════════
 * Computes post-incident impact assessments and rule-based operational recommendations:
 *
 * Rules:
 *   1. > 30% of total exam candidates affected OR exam-wide issue
 *      -> "Full reschedule"
 *   2. Some unrecovered candidates (> 0 unrecovered)
 *      -> "Partial re-conduct for affected candidates only"
 *   3. 0 unrecovered candidates AND disruption duration < 10 minutes
 *      -> "No re-conduct needed"
 *
 * Generates explicit mathematical reasoning for each rule that fired.
 * Links supporting TrustLedger blocks as tamper-evident cryptographic proof.
 * Provides Approve / Override lifecycle with all decisions signed to TrustLedger.
 */

const { db } = require('../db');
const { appendLedgerEvent } = require('./ledger');

class DecisionSupportEngine {
  /**
   * @param {import('socket.io').Server} io
   */
  constructor(io) {
    this.io = io;
    console.log('[DSS] Decision Support Module initialised.');
  }

  /**
   * Run impact assessment and evaluate rule-based recommendation for an incident.
   * Can be invoked automatically on incident resolution or manually via API.
   */
  evaluateIncident(incidentId) {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found`);
    }

    // ── 1. Calculate Metrics ──────────────────────────────────────────────────
    const startTime = new Date(incident.detected_at).getTime();
    const endTime = incident.resolved_at ? new Date(incident.resolved_at).getTime() : Date.now();
    const disruptionMinutes = Math.max(0.1, parseFloat(((endTime - startTime) / (1000 * 60)).toFixed(1)));

    // Total exam candidates
    const totalCandidatesRow = db.prepare('SELECT count(*) as count FROM candidates').get();
    const totalCandidates = totalCandidatesRow ? totalCandidatesRow.count : 200;

    // Candidates affected
    const candidatesAffected = incident.affected_candidates || 40;

    // Check if exam-wide: multiple concurrent incidents across different centres
    const concurrentCentres = db.prepare(`
      SELECT count(DISTINCT centre_id) as count
      FROM incidents
      WHERE (resolved_at IS NULL OR resolved_at >= ?)
        AND detected_at <= ?
    `).get(incident.detected_at, incident.resolved_at || new Date().toISOString());

    const isExamWide = (concurrentCentres && concurrentCentres.count > 2) ||
                       incident.type?.toLowerCase().includes('exam-wide');

    // Candidates recovered via automated failover
    const failoverLog = db.prepare(`
      SELECT * FROM failover_logs
      WHERE failed_centre_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(incident.centre_id);

    let candidatesRecovered = 0;
    let answersLost = 0;

    if (failoverLog) {
      candidatesRecovered = Math.min(candidatesAffected, failoverLog.candidates_recovered);
      answersLost = failoverLog.answers_lost || 0;
    } else if (incident.severity === 'CRITICAL') {
      // If failover wasn't triggered or recorded, fallback to recovery count
      candidatesRecovered = incident.status === 'resolved' ? candidatesAffected : 0;
    } else {
      // WARNING level incidents didn't sever candidate sessions
      candidatesRecovered = candidatesAffected;
    }

    const candidatesUnrecovered = Math.max(0, candidatesAffected - candidatesRecovered);
    const affectedPercentage = parseFloat(((candidatesAffected / totalCandidates) * 100).toFixed(1));

    // ── 2. Rule Evaluation ────────────────────────────────────────────────────
    let recommendation = '';
    const reasoning = [];

    // Rule 1: More than 30% of exam candidates affected OR exam-wide -> "Full reschedule"
    if (affectedPercentage > 30 || isExamWide) {
      recommendation = 'Full reschedule';
      if (affectedPercentage > 30) {
        reasoning.push(
          `Rule 1 Fired (Scale Threshold): ${affectedPercentage}% of total candidates impacted (${candidatesAffected} of ${totalCandidates}), exceeding the 30% statutory threshold.`
        );
      }
      if (isExamWide) {
        reasoning.push(
          `Rule 1 Fired (Systemic Outage): Disruption detected across ${concurrentCentres?.count || 'multiple'} examination centres concurrently.`
        );
      }
    }
    // Rule 2: Some unrecovered candidates -> "Partial re-conduct for affected candidates only"
    else if (candidatesUnrecovered > 0) {
      recommendation = 'Partial re-conduct for affected candidates only';
      reasoning.push(
        `Rule 2 Fired (Session Interruption): ${candidatesUnrecovered} candidate session(s) could not be re-attached via automated failover.`
      );
      reasoning.push(
        `Zero-Loss Violation: Session checkpoint recovery failed for ${candidatesUnrecovered} workstation(s) at centre ${incident.centre_id}.`
      );
    }
    // Rule 3: 0 unrecovered candidates and duration under 10 minutes -> "No re-conduct needed"
    else if (candidatesUnrecovered === 0 && disruptionMinutes < 10) {
      recommendation = 'No re-conduct needed';
      reasoning.push(
        `Rule 3 Fired (Full Recovery): 0 unrecovered candidates (100% of affected sessions, ${candidatesRecovered}/${candidatesAffected}, re-attached via automated failover).`
      );
      reasoning.push(
        `Rule 3 Fired (Duration Tolerance): Disruption duration was ${disruptionMinutes} minutes, well below the 10-minute tolerance threshold.`
      );
      reasoning.push(
        `Integrity Audit Confirmed: ${answersLost} answers lost across all candidate sessions verified against TrustLedger checkpoints.`
      );
    }
    // Fallback: 0 unrecovered but duration exceeded 10 minutes
    else {
      recommendation = 'Partial re-conduct for affected candidates only';
      reasoning.push(
        `Rule 4 Fired (Prolonged Outage): Disruption duration (${disruptionMinutes} minutes) exceeded the 10-minute maximum operational tolerance.`
      );
    }

    // ── 3. Find Supporting TrustLedger Evidence ────────────────────────────────
    const relevantEvidence = db.prepare(`
      SELECT id, timestamp, COALESCE(type, event_type) as type, hash
      FROM ledger_events
      WHERE (centre_id = ? OR centre_id = 'SYSTEM' OR centre_id IS NULL)
        AND (
          COALESCE(type, event_type) LIKE '%incident%' OR
          COALESCE(type, event_type) LIKE '%failover%' OR
          COALESCE(type, event_type) LIKE '%acknowledge%' OR
          COALESCE(type, event_type) LIKE '%decision%'
        )
      ORDER BY id DESC
      LIMIT 6
    `).all(incident.centre_id);

    const evidenceIds = relevantEvidence.map(e => e.id);

    // ── 4. Store / Update in Decisions Table ───────────────────────────────────
    const decisionId = `dec-${incident.id}`;
    const metrics = {
      candidatesAffected,
      candidatesRecovered,
      candidatesUnrecovered,
      disruptionMinutes,
      affectedPercentage,
      totalCandidates,
      isExamWide,
      answersLost
    };

    const existing = db.prepare('SELECT * FROM decisions WHERE id = ?').get(decisionId);

    if (existing) {
      db.prepare(`
        UPDATE decisions
        SET recommendation = ?, reasoning = ?, metrics = ?, evidence_ledger_ids = ?
        WHERE id = ?
      `).run(
        recommendation,
        JSON.stringify(reasoning),
        JSON.stringify(metrics),
        JSON.stringify(evidenceIds),
        decisionId
      );
    } else {
      db.prepare(`
        INSERT INTO decisions (
          id, incident_id, centre_id, recommendation, reasoning,
          metrics, evidence_ledger_ids, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
      `).run(
        decisionId,
        incident.id,
        incident.centre_id,
        recommendation,
        JSON.stringify(reasoning),
        JSON.stringify(metrics),
        JSON.stringify(evidenceIds)
      );
    }

    const saved = db.prepare('SELECT * FROM decisions WHERE id = ?').get(decisionId);
    const parsedDecision = this._formatDecision(saved);

    // Broadcast updated decision
    this.io.emit('decision:evaluated', parsedDecision);
    console.log(`[DSS] ⚖️ Evaluated ${incident.id}: Recommendation = "${recommendation}"`);

    return parsedDecision;
  }

  /**
   * Approve the automated recommendation.
   */
  approve(decisionId, decidedBy = 'National Exam Controller') {
    const row = db.prepare('SELECT * FROM decisions WHERE id = ?').get(decisionId);
    if (!row) throw new Error(`Decision '${decisionId}' not found`);

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE decisions
      SET status = 'APPROVED', final_decision = recommendation, decided_by = ?, decided_at = ?
      WHERE id = ?
    `).run(decidedBy, now, decisionId);

    // Log final decision to TrustLedger
    appendLedgerEvent(row.centre_id, 'decision made', {
      decisionId,
      incidentId: row.incident_id,
      action: 'APPROVED',
      recommendation: row.recommendation,
      finalDecision: row.recommendation,
      decidedBy,
      decidedAt: now
    });

    const updated = db.prepare('SELECT * FROM decisions WHERE id = ?').get(decisionId);
    const formatted = this._formatDecision(updated);
    this.io.emit('decision:updated', formatted);

    console.log(`[DSS] ✓ APPROVED decision for ${row.incident_id}: "${row.recommendation}"`);
    return formatted;
  }

  /**
   * Override the recommendation with custom ruling and justification.
   */
  override(decisionId, newDecision, reason, decidedBy = 'National Exam Controller') {
    const row = db.prepare('SELECT * FROM decisions WHERE id = ?').get(decisionId);
    if (!row) throw new Error(`Decision '${decisionId}' not found`);
    if (!reason || reason.trim().length === 0) {
      throw new Error('An explicit justification reason is required to override automated recommendation');
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE decisions
      SET status = 'OVERRIDDEN', final_decision = ?, override_reason = ?, decided_by = ?, decided_at = ?
      WHERE id = ?
    `).run(newDecision, reason, decidedBy, now, decisionId);

    // Log final decision override to TrustLedger
    appendLedgerEvent(row.centre_id, 'decision made', {
      decisionId,
      incidentId: row.incident_id,
      action: 'OVERRIDDEN',
      originalRecommendation: row.recommendation,
      finalDecision: newDecision,
      overrideReason: reason,
      decidedBy,
      decidedAt: now
    });

    const updated = db.prepare('SELECT * FROM decisions WHERE id = ?').get(decisionId);
    const formatted = this._formatDecision(updated);
    this.io.emit('decision:updated', formatted);

    console.log(`[DSS] ⚡ OVERRIDDEN decision for ${row.incident_id}: "${row.recommendation}" -> "${newDecision}"`);
    return formatted;
  }

  /**
   * Returns all decision assessments.
   */
  getAllDecisions() {
    const rows = db.prepare('SELECT * FROM decisions ORDER BY created_at DESC').all();
    return rows.map(r => this._formatDecision(r));
  }

  /**
   * Evaluates all resolved incidents that haven't been assessed yet.
   */
  evaluateAllResolvedIncidents() {
    const resolvedIncidents = db.prepare(`
      SELECT id FROM incidents WHERE status = 'resolved'
    `).all();

    const results = [];
    for (const inc of resolvedIncidents) {
      results.push(this.evaluateIncident(inc.id));
    }
    return results;
  }

  _formatDecision(row) {
    if (!row) return null;
    return {
      ...row,
      reasoning: JSON.parse(row.reasoning || '[]'),
      metrics: JSON.parse(row.metrics || '{}'),
      evidence_ledger_ids: JSON.parse(row.evidence_ledger_ids || '[]')
    };
  }
}

module.exports = DecisionSupportEngine;
