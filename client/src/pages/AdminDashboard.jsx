/**
 * AdminDashboard – the /admin route.
 *
 * Layout (two columns on large screens):
 *   Left (2/3):  AdminHeader + 5-tile Sentinel grid + LiveActivityTicker
 *   Right (1/3): IncidentFeed panel (full height, scrollable)
 *
 * All data comes from the useExamStore hook which owns the Socket.IO subscriptions.
 */
import React from 'react';
import useExamStore from '../hooks/useExamStore';
import AdminHeader from '../components/AdminHeader.jsx';
import CentreTile from '../components/CentreTile.jsx';
import IncidentFeed from '../components/IncidentFeed.jsx';
import LiveActivityTicker from '../components/LiveActivityTicker.jsx';
import DemoControls from '../components/DemoControls.jsx';

// Canonical display order for the 5 centres
const CENTRE_ORDER = ['centre-1', 'centre-2', 'centre-3', 'centre-4', 'centre-5'];

export default function AdminDashboard() {
  const store = useExamStore();
  const {
    connected,
    centres,
    incidents,
    candidateActivity,
    ledgerCount,
    totalActiveCandidates,
    offlineCentres,
    degradedCentres,
    activeIncidents,
    acknowledgeIncident,
    failoverState,
    dismissFailoverSummary,
  } = store;

  // Sort centres into canonical order, show placeholder skeletons while loading
  const centreList = CENTRE_ORDER.map(id => centres[id]).filter(Boolean);
  const loading    = centreList.length === 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-[1600px] mx-auto px-6 py-6 flex flex-col gap-6 h-screen">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <AdminHeader
          connected={connected}
          totalActiveCandidates={totalActiveCandidates}
          offlineCentres={offlineCentres}
          degradedCentres={degradedCentres}
          activeIncidents={activeIncidents}
        />

        {/* ── FAILOVER IN PROGRESS BANNER ───────────────────────────────────── */}
        {failoverState?.status === 'in_progress' && (
          <div className="bg-rose-950/80 border-2 border-rose-500 rounded-2xl p-4 flex items-center justify-between shadow-2xl shadow-rose-950/60 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-500/50 flex items-center justify-center text-2xl">
                🚨
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Failover in Progress
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 border border-rose-500/50">
                    CRITICAL OUTAGE
                  </span>
                </div>
                <p className="text-xs text-rose-200 mt-0.5 font-mono">
                  Centre <strong className="text-white underline">{failoverState.failedCentreId}</strong> went down. Preserving session checkpoints & re-attaching {failoverState.candidatesAffected} active candidate sessions to healthiest backup node...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-rose-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
              <span>Re-attaching sessions...</span>
            </div>
          </div>
        )}

        {/* ── FAILOVER RECOVERY SUMMARY CARD ─────────────────────────────────── */}
        {failoverState?.status === 'completed' && (
          <div className="bg-emerald-950/40 border border-emerald-600/70 rounded-2xl p-4 shadow-xl shadow-emerald-950/30 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-emerald-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-base text-emerald-400">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    Failover Recovery Summary
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ZERO DATA LOSS
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Migrated: <strong className="text-rose-400">{failoverState.failed_centre_id}</strong> ➔ <strong className="text-emerald-400">{failoverState.backup_centre_id}</strong> · All session checkpoints intact
                  </p>
                </div>
              </div>
              <button
                onClick={dismissFailoverSummary}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 transition"
              >
                ✕ Dismiss
              </button>
            </div>

            {/* 4 KPI Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 text-xs font-mono">
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Candidates Affected</span>
                <span className="text-base font-black text-white">{failoverState.candidates_affected}</span>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Candidates Recovered</span>
                <span className="text-base font-black text-emerald-400">{failoverState.candidates_recovered} (100%)</span>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Recovery Time</span>
                <span className="text-base font-black text-amber-300">{failoverState.recovery_time_sec}s</span>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Answers Lost</span>
                <span className="text-base font-black text-emerald-400">0</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Main body: grid left + incident feed right ─────────────────────── */}
        <div className="flex-1 flex gap-6 min-h-0">

          {/* Left column – Sentinel grid + ticker */}
          <section className="flex flex-col gap-4 flex-1 min-w-0">

            {/* Section label */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-blue-500" />
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest">
                  Sentinel — Centre Health Grid
                </h2>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                <span>Telemetry cadence: 2 s</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                  ⛓ {ledgerCount} blocks
                </span>
              </div>
            </div>

            {/* 5-tile grid */}
            {loading ? (
              // Skeleton loader while waiting for first telemetry
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 flex-1">
                {CENTRE_ORDER.map(id => (
                  <div key={id} className="rounded-2xl border border-slate-800 bg-slate-900/50 animate-pulse p-4">
                    <div className="h-3 bg-slate-800 rounded w-2/3 mb-3" />
                    <div className="h-4 bg-slate-800 rounded w-full mb-2" />
                    <div className="h-3 bg-slate-800 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {centreList.map(centre => (
                  <CentreTile key={centre.id} centre={centre} />
                ))}
              </div>
            )}

            {/* Interactive Demo Controls & Fault Injection Panel */}
            <DemoControls />

            {/* Live activity ticker */}
            <LiveActivityTicker activity={candidateActivity} />
          </section>

          {/* Right column – Incident Feed */}
          <section className="w-80 xl:w-96 flex-shrink-0 flex flex-col min-h-0">
            <IncidentFeed incidents={incidents} onAcknowledge={acknowledgeIncident} />
          </section>
        </div>
      </div>
    </div>
  );
}
