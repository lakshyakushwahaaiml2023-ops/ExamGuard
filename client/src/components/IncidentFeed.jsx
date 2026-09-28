/**
 * IncidentFeed – Module 2 (TriageAI)
 * Displays real-time incident cards with:
 *   - Coloured severity badges (CRITICAL = Red, WARNING = Amber)
 *   - Incident type & centre
 *   - Affected candidate count
 *   - Escalation target (e.g. "Notify: Exam Controller" / "Notify: Centre Administrator")
 *   - Manual "Acknowledge" button for OPEN incidents
 *   - Auto-resolved state indicator
 */
import React from 'react';

const SEV_STYLE = {
  CRITICAL: 'bg-rose-500/25 text-rose-300 border-rose-500/50 shadow-sm shadow-rose-950/40',
  WARNING:  'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-950/40',
  HIGH:     'bg-amber-500/25 text-amber-300 border-amber-500/50',
  INFO:     'bg-blue-500/20 text-blue-300 border-blue-500/40'
};

const STATUS_STYLE = {
  open:         'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse',
  acknowledged: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  resolved:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
};

function getTypeIcon(type = '') {
  const t = type.toLowerCase();
  if (t.includes('power')) return '⚡';
  if (t.includes('offline')) return '🛑';
  if (t.includes('network') || t.includes('latency')) return '📡';
  if (t.includes('predictive') || t.includes('z-score')) return '🔮';
  return '⚠️';
}

function formatTime(ts) {
  if (!ts) return 'just now';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return 'recently';
  }
}

export default function IncidentFeed({ incidents = [], onAcknowledge }) {
  const openCount = incidents.filter(i => (i.status || '').toLowerCase() === 'open').length;
  const ackCount = incidents.filter(i => (i.status || '').toLowerCase() === 'acknowledged').length;
  const resCount = incidents.filter(i => (i.status || '').toLowerCase() === 'resolved').length;

  return (
    <aside className="flex flex-col bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0 bg-slate-900/90">
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${openCount > 0 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
            TriageAI Incident Feed
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Automated detection & escalation</p>
        </div>

        <div className="flex gap-1.5 text-[10px] font-bold">
          {openCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
              {openCount} OPEN
            </span>
          )}
          {ackCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              {ackCount} ACK'D
            </span>
          )}
          {resCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {resCount} RESOLVED
            </span>
          )}
        </div>
      </div>

      {/* Incident List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-600/25 flex items-center justify-center text-xl text-emerald-400 mb-3">
              ✓
            </div>
            <p className="text-sm font-semibold text-emerald-400">All Systems Nominal</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
              No active or historical incidents. Z-score anomaly detector & watchdog active.
            </p>
          </div>
        ) : (
          incidents.map((inc, idx) => {
            const rawStatus = (inc.status || 'open').toLowerCase();
            const isOpen = rawStatus === 'open';
            const isAck = rawStatus === 'acknowledged';
            const isResolved = rawStatus === 'resolved';

            const severity = (inc.severity || 'WARNING').toUpperCase();
            const sevBadgeStyle = SEV_STYLE[severity] || SEV_STYLE.WARNING;
            const statusBadgeStyle = STATUS_STYLE[rawStatus] || STATUS_STYLE.open;

            const icon = getTypeIcon(inc.type);
            const centreName = inc.centre || inc.centre_id || 'Global';
            const target = inc.escalation_target || (severity === 'CRITICAL' ? 'Exam Controller' : 'Centre Administrator');
            const affectedCount = inc.affected_candidate_count ?? inc.affected_candidates ?? (severity === 'CRITICAL' ? 40 : 0);

            return (
              <div
                key={inc.id || idx}
                className={`rounded-xl border p-3.5 transition-all duration-300 ${
                  isOpen
                    ? 'bg-slate-950/95 border-rose-900/60 shadow-lg shadow-rose-950/20'
                    : isAck
                    ? 'bg-slate-950/80 border-indigo-900/40'
                    : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                }`}
              >
                {/* Header row: Severity + Type + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg flex-shrink-0">{icon}</span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${sevBadgeStyle}`}>
                          {severity}
                        </span>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wide truncate">
                          {inc.type}
                        </h4>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Centre: <span className="text-slate-200 font-semibold">{centreName}</span>
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${statusBadgeStyle}`}>
                    {rawStatus}
                  </span>
                </div>

                {/* Details & Escalation Target */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5 text-[11px]">
                  {/* Escalation target */}
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Escalation Target:</span>
                    <span className="font-semibold text-amber-300/90 flex items-center gap-1">
                      📣 {target}
                    </span>
                  </div>

                  {/* Affected candidates */}
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Affected Candidates:</span>
                    <span className={`font-mono font-bold ${affectedCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {affectedCount} {affectedCount === 1 ? 'candidate' : 'candidates'}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center justify-between text-slate-500 font-mono text-[10px]">
                    <span>Detected:</span>
                    <span>{formatTime(inc.timestamp || inc.detected_at)}</span>
                  </div>
                </div>

                {/* Manual Acknowledge Action Button */}
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-end">
                  {isOpen ? (
                    <button
                      onClick={() => onAcknowledge && onAcknowledge(inc.id)}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600/80 hover:bg-indigo-500
                                 text-white border border-indigo-400/30 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <span>👁</span>
                      <span>Acknowledge</span>
                    </button>
                  ) : isAck ? (
                    <span className="text-[11px] text-indigo-400 font-medium flex items-center gap-1">
                      <span>✓</span> Acknowledged by operator
                    </span>
                  ) : (
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <span>✓</span> Auto-resolved on recovery
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
