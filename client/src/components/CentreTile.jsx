/**
 * CentreTile – Module 1 (Sentinel - LeetCode Theme)
 * Styled like LeetCode contest problem cards with dark & light mode support.
 */
import React from 'react';

function CpuBar({ value }) {
  const pct = Math.min(value ?? 0, 100);
  const color = pct > 85 ? 'bg-[#ff375f]' : pct > 60 ? 'bg-[#ffa116]' : 'bg-[#00b8a3]';
  return (
    <div className="w-full dark:bg-[#383838] bg-gray-200 rounded-full h-1.5 mt-0.5">
      <div className={`${color} h-1.5 rounded-full transition-all duration-700`}
           style={{ width: `${pct}%` }} />
    </div>
  );
}

function LatencyBadge({ value, offline }) {
  if (offline) return <span className="text-[#ff375f] font-bold">TIMEOUT</span>;
  if (value == null) return <span className="text-gray-400">–</span>;
  const color = value > 500 ? 'text-[#ff375f] font-bold'
              : value > 200 ? 'text-[#ffa116] font-bold'
              : 'text-[#00b8a3] font-semibold';
  return <span className={color}>{value} ms</span>;
}

export default function CentreTile({ centre }) {
  const tel      = centre.telemetry || {};
  const status   = centre.status || 'active';
  const isOff    = status === 'offline';
  const isDeg    = status === 'degraded';

  // LeetCode Card Styling (dark #282828 / light #ffffff)
  const cardBorder = isOff
    ? 'border-[#ff375f]/70 dark:bg-rose-950/20 bg-rose-50/40 shadow-xs'
    : isDeg
    ? 'border-[#ffa116]/60 dark:bg-amber-950/15 bg-amber-50/30 shadow-xs'
    : 'dark:border-[#383838] border-gray-200 dark:bg-[#282828] bg-white hover:border-gray-300 dark:hover:border-[#484848] shadow-xs';

  // LeetCode Difficulty Badge style (Easy green / Medium orange / Hard red)
  const badgeStyle = isOff
    ? 'bg-[#ff375f]/15 text-[#ff375f] border-[#ff375f]/30 animate-pulse'
    : isDeg
    ? 'bg-[#ffa116]/15 text-[#ffa116] border-[#ffa116]/30'
    : 'bg-[#00b8a3]/15 text-[#00b8a3] border-[#00b8a3]/30';

  const badgeText = isOff ? 'OFFLINE' : isDeg ? 'DEGRADED' : 'HEALTHY';
  const strip = isOff ? 'bg-[#ff375f]' : isDeg ? 'bg-[#ffa116]' : 'bg-[#00b8a3]';
  const activeCands = isOff ? 0 : (centre.activeCandidates ?? 40);

  return (
    <div className={`relative rounded-lg border overflow-hidden transition-all duration-300 ${cardBorder}`}>
      {/* Coloured accent left strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${strip} ${isOff ? 'animate-pulse' : ''}`} />

      <div className="pl-4 pr-3.5 pt-3.5 pb-3.5">
        {/* Top row: ID + badge */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="min-w-0">
            <span className="text-[10px] font-mono dark:text-gray-400 text-gray-500 uppercase tracking-wider block">
              {centre.id}
            </span>
            <h3 className="text-[13px] font-bold dark:text-white text-gray-900 leading-snug truncate mt-0.5">
              {centre.name}
            </h3>
            <p className="text-[11px] dark:text-gray-400 text-gray-500">{centre.city}</p>
          </div>
          <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeStyle}`}>
            {badgeText}
          </span>
        </div>

        {/* Stats grid */}
        <div className="space-y-2 text-xs">
          {/* CPU */}
          <div>
            <div className="flex justify-between dark:text-gray-400 text-gray-500 mb-0.5 text-[11px]">
              <span>CPU Load</span>
              <span className={`font-mono font-medium ${tel.cpu > 85 ? 'text-[#ff375f]' : 'dark:text-gray-200 text-gray-700'}`}>
                {isOff ? '—' : `${tel.cpu ?? '–'}%`}
              </span>
            </div>
            {!isOff && <CpuBar value={tel.cpu} />}
            {isOff && <div className="w-full dark:bg-[#383838] bg-gray-200 rounded-full h-1.5 mt-0.5" />}
          </div>

          {/* Latency */}
          <div className="flex justify-between items-center dark:text-gray-400 text-gray-500 text-[11px]">
            <span>Latency</span>
            <span className="font-mono">
              <LatencyBadge value={tel.latency} offline={isOff} />
            </span>
          </div>

          {/* Power */}
          <div className="flex justify-between items-center dark:text-gray-400 text-gray-500 text-[11px]">
            <span>Power Grid</span>
            {isOff
              ? <span className="text-[#ff375f] font-bold flex items-center gap-1 font-mono">⚡ FAIL</span>
              : <span className="text-[#00b8a3] font-semibold flex items-center gap-1">✓ NORMAL</span>
            }
          </div>

          {/* Divider & Active candidates */}
          <div className="border-t dark:border-[#383838] border-gray-200 pt-2 flex justify-between items-center text-[11px]">
            <span className="dark:text-gray-400 text-gray-500">Active Nodes</span>
            <span className={`font-bold font-mono tabular-nums ${isOff ? 'text-[#ff375f]' : 'dark:text-white text-gray-900'}`}>
              {activeCands}
              <span className="dark:text-gray-500 text-gray-400 font-normal"> / 40</span>
            </span>
          </div>

          {/* Heartbeat tick */}
          {tel.heartbeat && (
            <div className="text-[10px] dark:text-gray-500 text-gray-400 font-mono text-right">
              hb #{tel.heartbeat}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
