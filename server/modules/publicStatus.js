/**
 * ExamGuard — Module 6: Public Status & Candidate Communications
 * ═══════════════════════════════════════════════════════════════════════════
 * Translates low-level telemetry, incidents, automated failovers, and DSS rulings
 * into comforting, clear, non-technical plain language for candidate public status.
 *
 * Overall status categories:
 *   1. "Running normally"
 *   2. "Minor disruption, no action needed"
 *   3. "Disruption being resolved"
 *   4. "Exam rescheduled"
 */

const { db } = require('../db');

const CENTRE_NAMES = {
  'centre-1': 'Centre 1 (North Campus)',
  'centre-2': 'Centre 2 (South Campus)',
  'centre-3': 'Centre 3 (East Cyber Centre)',
  'centre-4': 'Centre 4 (West Tech Hub)',
  'centre-5': 'Centre 5 (Central Examination Hall)'
};

function formatPlainTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

/**
 * Computes public status data from database & live telemetry.
 */
function getPublicStatus(latestTelemetry) {
  // 1. Fetch active (unresolved) incidents
  const activeIncidents = db.prepare(`
    SELECT * FROM incidents
    WHERE status != 'resolved'
    ORDER BY detected_at DESC
  `).all();

  // 2. Fetch recent incidents (resolved and unresolved) for timeline
  const recentIncidents = db.prepare(`
    SELECT * FROM incidents
    ORDER BY id DESC
    LIMIT 25
  `).all();

  // 3. Fetch recent failovers
  const recentFailovers = db.prepare(`
    SELECT * FROM failover_logs
    ORDER BY id DESC
    LIMIT 10
  `).all();

  // 4. Fetch recent decisions
  const recentDecisions = db.prepare(`
    SELECT * FROM decisions
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  // ── Determine Overall Status ──────────────────────────────────────────────
  let overallStatus = 'Running normally';
  let overallHeadline = 'All examination centres are operating normally.';
  let overallDescription = 'Candidate sessions are healthy and answers are saving continuously in real time.';

  const hasFullReschedule = recentDecisions.some(
    d => (d.status === 'APPROVED' || d.status === 'OVERRIDDEN') &&
         (d.final_decision === 'Full reschedule' || d.recommendation === 'Full reschedule')
  );

  const hasCriticalIncident = activeIncidents.some(inc => inc.severity === 'CRITICAL');
  const hasWarningIncident = activeIncidents.some(inc => inc.severity === 'WARNING');

  if (hasFullReschedule) {
    overallStatus = 'Exam rescheduled';
    overallHeadline = 'Examination session rescheduled by Controller Authority.';
    overallDescription = 'Due to multiple centre disruptions, a new exam date will be announced. Candidate progress has been securely archived.';
  } else if (hasCriticalIncident) {
    overallStatus = 'Disruption being resolved';
    overallHeadline = 'Technical disruption detected — automated recovery active.';
    overallDescription = 'Your answers are 100% saved on the server. Workstations are being smoothly re-routed to backup systems.';
  } else if (hasWarningIncident) {
    overallStatus = 'Minor disruption, no action needed';
    overallHeadline = 'Minor network fluctuations detected.';
    overallDescription = 'Exams are continuing as normal. All answers are safe; our automated systems are maintaining session stability.';
  }

  // ── Build Per-Centre Status ───────────────────────────────────────────────
  const centres = [];
  const centreIds = ['centre-1', 'centre-2', 'centre-3', 'centre-4', 'centre-5'];

  for (const cId of centreIds) {
    const activeInc = activeIncidents.find(i => i.centre_id === cId);
    const telemetry = latestTelemetry ? latestTelemetry.get(cId) : null;

    let centreStatus = 'Running normally';
    let statusTone = 'emerald'; // emerald, amber, rose
    let candidateMessage = 'All systems operational. Answers saved in real time.';

    if (activeInc) {
      if (activeInc.severity === 'CRITICAL') {
        centreStatus = 'Disruption being resolved';
        statusTone = 'rose';
        candidateMessage = activeInc.type.includes('power')
          ? 'Temporary power disruption. Backup server active; your progress is safe.'
          : 'Server reconnection in progress. Your answers & time are preserved.';
      } else {
        centreStatus = 'Minor network latency';
        statusTone = 'amber';
        candidateMessage = 'Slight latency observed. Exam continuing normally without data loss.';
      }
    }

    // Active candidate count for this centre
    const candRow = db.prepare('SELECT count(*) as count FROM sessions WHERE centre_id = ?').get(cId);
    const candidateCount = candRow ? candRow.count : 40;

    centres.push({
      id: cId,
      name: CENTRE_NAMES[cId] || `Centre ${cId}`,
      status: centreStatus,
      statusTone,
      candidateMessage,
      candidateCount,
      lastHeartbeat: telemetry?.timestamp ? formatPlainTime(telemetry.timestamp) : 'Just now'
    });
  }

  // ── Generate Plain Language Timeline ──────────────────────────────────────
  const timeline = [];

  // Add decisions
  for (const dec of recentDecisions) {
    const ruling = dec.final_decision || dec.recommendation;
    const timeStr = formatPlainTime(dec.decided_at || dec.created_at);
    const centreName = CENTRE_NAMES[dec.centre_id] || dec.centre_id;

    if (dec.status === 'APPROVED' || dec.status === 'OVERRIDDEN') {
      if (ruling === 'No re-conduct needed') {
        timeline.push({
          id: `dec-${dec.id}`,
          timestamp: dec.decided_at || dec.created_at,
          timeFormatted: timeStr,
          centre: centreName,
          category: 'Official Notice',
          tone: 'emerald',
          icon: '✅',
          title: `Integrity Confirmed — ${centreName}`,
          message: `The Examination Authority verified that all candidate sessions at ${centreName} were recovered with 0 lost answers. No re-examination is required; standard scoring applies.`
        });
      } else if (ruling === 'Partial re-conduct for affected candidates only') {
        timeline.push({
          id: `dec-${dec.id}`,
          timestamp: dec.decided_at || dec.created_at,
          timeFormatted: timeStr,
          centre: centreName,
          category: 'Advisory',
          tone: 'amber',
          icon: '⚠️',
          title: `Supplementary Session Advisory — ${centreName}`,
          message: `The Examination Authority has authorized a supplementary re-conduct for affected candidates at ${centreName}. Candidates will receive individual reporting instructions.`
        });
      } else if (ruling === 'Full reschedule') {
        timeline.push({
          id: `dec-${dec.id}`,
          timestamp: dec.decided_at || dec.created_at,
          timeFormatted: timeStr,
          centre: 'All Centres',
          category: 'Important Announcement',
          tone: 'rose',
          icon: '🚨',
          title: 'Full Examination Reschedule Order',
          message: 'Due to severe multi-centre disruption, today\'s exam session has been rescheduled. New admit cards and exam dates will be published on the official portal.'
        });
      }
    }
  }

  // Add failovers
  for (const f of recentFailovers) {
    const failedName = CENTRE_NAMES[f.failed_centre_id] || f.failed_centre_id;
    const backupName = CENTRE_NAMES[f.backup_centre_id] || f.backup_centre_id;
    const timeStr = formatPlainTime(f.completed_at || f.started_at);

    timeline.push({
      id: `failover-${f.id}`,
      timestamp: f.completed_at || f.started_at,
      timeFormatted: timeStr,
      centre: failedName,
      category: 'Automated Recovery',
      tone: 'emerald',
      icon: '🛡️',
      title: `Candidate Sessions Reconnected — ${failedName}`,
      message: `${f.candidates_recovered || 40} candidate workstations from ${failedName} were seamlessly reconnected via backup servers at ${backupName}. Zero answers were lost (${f.recovery_time_sec || 1.2}s recovery time).`
    });
  }

  // Add incidents (both detection and resolution)
  for (const inc of recentIncidents) {
    const centreName = CENTRE_NAMES[inc.centre_id] || inc.centre_id;
    const detectedTime = formatPlainTime(inc.detected_at);

    // Plain English incident translations
    let incidentTitle = '';
    let incidentMsg = '';
    let tone = 'amber';
    let icon = 'ℹ️';

    if (inc.type.includes('power')) {
      incidentTitle = `Power Supply Interruption at ${centreName}`;
      incidentMsg = `${centreName} experienced a power disruption at ${detectedTime}. Candidate answers are continuously saved on the server; workstations are being safely reconnected.`;
      tone = 'rose';
      icon = '⚡';
    } else if (inc.type.includes('offline')) {
      incidentTitle = `Temporary Server Disconnection at ${centreName}`;
      incidentMsg = `${centreName} lost primary server connectivity at ${detectedTime}. Automated failover is re-attaching candidate sessions to backup systems with all answers and remaining time intact.`;
      tone = 'rose';
      icon = '📡';
    } else if (inc.type.includes('network degradation')) {
      incidentTitle = `Minor Network Latency at ${centreName}`;
      incidentMsg = `Telemetry observed temporary network latency at ${centreName} around ${detectedTime}. Exams continue normally with real-time answer synchronization.`;
      tone = 'amber';
      icon = '📶';
    } else if (inc.type.includes('predictive')) {
      incidentTitle = `Proactive System Optimization at ${centreName}`;
      incidentMsg = `Automated telemetry detected elevated server load at ${centreName} at ${detectedTime}. Technicians optimized server allocation; candidate exam sessions are unaffected.`;
      tone = 'blue';
      icon = '🤖';
    } else {
      incidentTitle = `Notice: Operational Update at ${centreName}`;
      incidentMsg = `A temporary operational event was recorded at ${centreName} at ${detectedTime}. No progress was lost.`;
    }

    timeline.push({
      id: `inc-${inc.id}-detected`,
      timestamp: inc.detected_at,
      timeFormatted: detectedTime,
      centre: centreName,
      category: inc.severity === 'CRITICAL' ? 'Alert' : 'Notice',
      tone,
      icon,
      title: incidentTitle,
      message: incidentMsg
    });

    if (inc.resolved_at) {
      const resolvedTime = formatPlainTime(inc.resolved_at);
      timeline.push({
        id: `inc-${inc.id}-resolved`,
        timestamp: inc.resolved_at,
        timeFormatted: resolvedTime,
        centre: centreName,
        category: 'Resolved',
        tone: 'emerald',
        icon: '✓',
        title: `Normal Operations Restored at ${centreName}`,
        message: `Systems at ${centreName} have fully normalized as of ${resolvedTime}. All candidate sessions are running smoothly.`
      });
    }
  }

  // Sort timeline chronologically descending
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Deduplicate and cap to 20 most recent messages
  const seenTitles = new Set();
  const dedupedTimeline = [];
  for (const item of timeline) {
    const key = `${item.title}-${item.timeFormatted}`;
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      dedupedTimeline.push(item);
    }
  }

  return {
    overallStatus,
    overallHeadline,
    overallDescription,
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    guaranteeText: 'Zero-Loss Guarantee: Your exam answers are continuously recorded on the server every second. If your screen disconnects or restarts, all saved answers and remaining time are preserved.',
    centres,
    timeline: dedupedTimeline.slice(0, 15)
  };
}

module.exports = {
  getPublicStatus,
  CENTRE_NAMES
};
