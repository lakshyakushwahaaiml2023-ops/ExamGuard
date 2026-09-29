/**
 * LiveActivityTicker – thin scrolling row at the bottom of the grid.
 * LeetCode themed submission stream.
 */
import React from 'react';

export default function LiveActivityTicker({ activity }) {
  if (activity.length === 0) return null;

  return (
    <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none select-none">
      <span className="text-[10px] font-bold dark:text-gray-400 text-gray-500 uppercase tracking-widest flex-shrink-0 font-mono">
        SUBMISSIONS
      </span>
      <div className="flex gap-2">
        {activity.slice(0, 8).map((a, i) => (
          <div
            key={i}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-mono border transition-colors
              dark:bg-[#202020] dark:border-[#383838] bg-gray-100 border-gray-200"
          >
            <span className="font-semibold text-[#ffa116]">{a.candidateId}</span>
            <span className="dark:text-gray-400 text-gray-500">Q{(a.currentQuestion ?? 1) - 1}</span>
            <span className="text-[#00b8a3]">✓ {a.ledgerHash?.slice(0, 8)}…</span>
          </div>
        ))}
      </div>
    </div>
  );
}
