/**
 * CentreTile – Module 1 (Sentinel)
 * One card per exam centre. Background and border colour driven by health status:
 *   active   → green ring
 *   degraded → amber ring
 *   offline  → red ring + pulse animation
 *
 * Shows: centre name, city, CPU bar, latency, power status badge, active candidate count.
 */
import React from 'react';

// ── helpers ──────────────────────────────────────────────────────────────────
function CpuBar({ value }) {
  // Coloured progress bar for CPU load
  const pct   = Math.min(value ?? 0, 100);
  const color = pct > 85 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-0.5">
      <div className={`${color} h-1.5 rounded-full transition-all duration-700`}
           style={{ width: `${pct}%` }} />
    </div>
  );
}

function LatencyBadge({ value, offline }) {
  if (offline) return <span className="text-rose-400 font-bold">TIMEOUT</span>;
  if (value == null) return <span className="text-slate-500">–</span>;
  const color = value > 500 ? 'text-rose-400 font-bold'
              : value > 200 ? 'text-amber-400 font-bold'
              : 'text-emerald-400';
  return <span className={color}>{value} ms</span>;
}

// ── component ─────────────────────────────────────────────────────────────────
export default function CentreTile({ centre }) {
  const tel      = centre.telemetry || {};
  const status   = centre.status || 'active';
  const isOff    = status === 'offline';
  const isDeg    = status === 'degraded';

  // Card-level colour scheme
  const card = isOff
    ? 'border-rose-600/70 bg-gradient-to-br from-rose-950/40 to-slate-900 shadow-rose-950/40 shadow-lg'
    : isDeg
    ? 'border-amber-500/50 bg-gradient-to-br from-amber-950/30 to-slate-900 shadow-amber-950/30 shadow-md'
    : 'border-emerald-700/40 bg-gradient-to-br from-emerald-950/20 to-slate-900 hover:border-emerald-600/60';

  // Status badge
  const badge = isOff
    ? 'bg-rose-500/20 text-rose-300 border-rose-600/50 animate-pulse'
    : isDeg
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
    : 'bg-emerald-500/15 text-emerald-300 border-emerald-600/40';

  const badgeText = isOff ? 'OFFLINE' : isDeg ? 'DEGRADED' : 'HEALTHY';

  // Left accent strip colour
  const strip = isOff ? 'bg-rose-500' : isDeg ? 'bg-amber-400' : 'bg-emerald-500';

  // Active candidates: 0 if power failed
  const activeCands = isOff ? 0 : (centre.activeCandidates ?? 40);

  return (
    <div className={`relative rounded-2xl border overflow-hidden transition-all duration-500 ${card}`}>
      {/* Coloured left accent strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${strip} ${isOff ? 'animate-pulse' : ''}`} />

      <div className="pl-4 pr-4 pt-4 pb-4">
        {/* Top row: ID + badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              {centre.id}
            </span>
            <h3 className="text-sm font-bold text-white leading-snug truncate mt-0.5">
              {centre.name}
            </h3>
            <p className="text-xs text-slate-400">{centre.city}</p>
          </div>
          <span className={`flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${badge}`}>
            {badgeText}
          </span>
        </div>

        {/* Stats grid */}
        <div className="space-y-2.5 text-xs">
          {/* CPU */}
          <div>
            <div className="flex justify-between text-slate-400 mb-0.5">
              <span>CPU</span>
              <span className={tel.cpu > 85 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                {isOff ? '—' : `${tel.cpu ?? '–'}%`}
              </span>
            </div>
            {!isOff && <CpuBar value={tel.cpu} />}
            {isOff && <div className="w-full bg-slate-800 rounded-full h-1.5 mt-0.5" />}
          </div>

          {/* Latency */}
          <div className="flex justify-between items-center text-slate-400">
            <span>Latency</span>
            <LatencyBadge value={tel.latency} offline={isOff} />
          </div>

          {/* Power */}
          <div className="flex justify-between items-center text-slate-400">
            <span>Power</span>
            {isOff
              ? <span className="text-rose-400 font-bold flex items-center gap-1">⚡ FAIL</span>
              : <span className="text-emerald-400">✓ NORMAL</span>
            }
          </div>

          {/* Divider */}
          <div className="border-t border-slate-800/80 pt-2 flex justify-between items-center">
            <span className="text-slate-500">Active candidates</span>
            <span className={`font-bold tabular-nums ${isOff ? 'text-rose-400' : 'text-white'}`}>
              {activeCands}
              <span className="text-slate-500 font-normal"> / 40</span>
            </span>
          </div>

          {/* Heartbeat tick */}
          {tel.heartbeat && (
            <div className="text-[10px] text-slate-600 font-mono text-right">
              hb #{tel.heartbeat}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
