/**
 * LiveActivityTicker – thin scrolling row at the bottom of the grid.
 * Shows the last 8 candidate answer submissions with truncated ledger hashes,
 * giving the "live exam in progress" feel.
 */
import React from 'react';

export default function LiveActivityTicker({ activity }) {
  if (activity.length === 0) return null;

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex-shrink-0">
        Live
      </span>
      <div className="flex gap-2">
        {activity.slice(0, 8).map((a, i) => (
          <div key={i} className="flex-shrink-0 flex items-center gap-1.5
                                  bg-slate-800/70 border border-slate-700/50
                                  rounded-lg px-2.5 py-1 text-[11px] font-mono">
            <span className="text-blue-400">{a.candidateId}</span>
            <span className="text-slate-500">Q{(a.currentQuestion ?? 1) - 1}</span>
            <span className="text-slate-600">⛓ {a.ledgerHash?.slice(0, 8)}…</span>
          </div>
        ))}
      </div>
    </div>
  );
}
