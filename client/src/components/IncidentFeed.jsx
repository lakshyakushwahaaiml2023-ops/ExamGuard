/**
 * IncidentFeed – Module 2 (TriageAI - LeetCode Theme)
 * Real-time operational incident feed with LeetCode styling and dark/light mode.
 */
import React from 'react';

const SEV_STYLE = {
  CRITICAL: 'bg-[#ff375f]/15 text-[#ff375f] border-[#ff375f]/40',
  WARNING:  'bg-[#ffa116]/15 text-[#ffa116] border-[#ffa116]/40',
  HIGH:     'bg-[#ffa116]/15 text-[#ffa116] border-[#ffa116]/40',
  INFO:     'bg-blue-500/15 text-blue-400 border-blue-500/30'
};

const STATUS_STYLE = {
  open:         'bg-rose-500/20 text-[#ff375f] border-rose-500/40 animate-pulse',
  acknowledged: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40',
  resolved:     'bg-[#00b8a3]/15 text-[#00b8a3] border-[#00b8a3]/30'
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

  return (
    <aside className="flex flex-col rounded-lg border overflow-hidden h-full transition-colors shadow-xs
      dark:bg-[#282828] dark:border-[#3e3e3e] bg-white border-gray-200">
      
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0 transition-colors
        dark:bg-[#222222] dark:border-[#383838] bg-gray-50 border-gray-200">
        <div>
          <h2 className="text-[13px] font-bold tracking-tight flex items-center gap-2 dark:text-white text-gray-900">
            <span className={`w-2 h-2 rounded-full ${openCount > 0 ? 'bg-[#ff375f] animate-ping' : 'bg-[#00b8a3]'}`} />
            TriageAI Incident Stream
          </h2>
          <p className="text-[11px] dark:text-gray-400 text-gray-500 mt-0.5">Automated Z-score anomaly detector</p>
        </div>

        {openCount > 0 ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[#ff375f]/15 text-[#ff375f] border-[#ff375f]/30">
            {openCount} OPEN
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[#00b8a3]/15 text-[#00b8a3] border-[#00b8a3]/30">
            NOMINAL
          </span>
        )}
      </div>

      {/* Incident Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {incidents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs dark:text-gray-400 text-gray-500">
            <div className="w-10 h-10 rounded-full dark:bg-[#202020] bg-gray-100 border dark:border-[#333] border-gray-200 flex items-center justify-center text-base text-[#00b8a3] mb-2 shadow-2xs">
              ✓
            </div>
            <p className="font-semibold dark:text-gray-200 text-gray-700">All Centres Nominal</p>
            <p className="text-[11px] mt-1">Z-score watchdog actively monitoring heartbeats.</p>
          </div>
        ) : (
          incidents.map(inc => {
            const status = (inc.status || 'open').toLowerCase();
            const isOpen = status === 'open';
            const icon = getTypeIcon(inc.type);
            const sevClass = SEV_STYLE[inc.severity] || SEV_STYLE.INFO;
            const statusClass = STATUS_STYLE[status] || STATUS_STYLE.open;

            return (
              <div
                key={inc.id}
                className="p-3 rounded-lg border transition-all space-y-2
                  dark:bg-[#202020] dark:border-[#383838] bg-gray-50 border-gray-200 shadow-2xs"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{icon}</span>
                    <div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase font-mono ${sevClass}`}>
                        {inc.severity}
                      </span>
                      <h4 className="text-xs font-bold dark:text-white text-gray-900 mt-1 uppercase tracking-wide">
                        {inc.type}
                      </h4>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusClass}`}>
                    {status}
                  </span>
                </div>

                {/* Details */}
                <p className="text-[11px] dark:text-gray-300 text-gray-600 font-mono">
                  Centre: <strong className="text-[#ffa116]">{inc.centre_id}</strong>
                </p>

                {inc.details && (
                  <p className="text-[11px] dark:text-gray-400 text-gray-500 leading-relaxed">
                    {inc.details}
                  </p>
                )}

                {/* Metadata & Actions footer */}
                <div className="pt-2 border-t dark:border-[#333] border-gray-200 flex items-center justify-between text-[11px] font-mono">
                  <span className="dark:text-gray-500 text-gray-400">
                    {formatTime(inc.detected_at)}
                  </span>

                  {isOpen && (
                    <button
                      onClick={() => onAcknowledge && onAcknowledge(inc.id)}
                      className="px-2.5 py-1 rounded text-xs font-semibold text-white bg-[#00b8a3] hover:bg-[#00a390] transition shadow-2xs active:scale-95"
                    >
                      Acknowledge
                    </button>
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
