/**
 * AdminDashboard – the /admin route (LeetCode Themed Console)
 * ═══════════════════════════════════════════════════════════════════════════
 * LeetCode contest operations console with dark and light mode toggle.
 */
import React from 'react';
import useExamStore from '../hooks/useExamStore';
import AdminHeader from '../components/AdminHeader.jsx';
import CentreTile from '../components/CentreTile.jsx';
import IncidentFeed from '../components/IncidentFeed.jsx';
import LiveActivityTicker from '../components/LiveActivityTicker.jsx';
import DemoControls from '../components/DemoControls.jsx';

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

  const centreList = CENTRE_ORDER.map(id => centres[id]).filter(Boolean);
  const loading = centreList.length === 0;

  return (
    <div className="min-h-screen transition-colors duration-150 dark:bg-[#1a1a1a] bg-[#f7f7f8] dark:text-[#eff1f6] text-[#262626]">
      <div className="max-w-[1600px] mx-auto px-4 py-4 flex flex-col gap-4 min-h-screen">

        {/* ── LeetCode Styled Header ────────────────────────────────────────── */}
        <AdminHeader
          connected={connected}
          totalActiveCandidates={totalActiveCandidates}
          offlineCentres={offlineCentres}
          degradedCentres={degradedCentres}
          activeIncidents={activeIncidents}
        />

        {/* ── FAILOVER IN PROGRESS BANNER ───────────────────────────────────── */}
        {failoverState?.status === 'in_progress' && (
          <div className="rounded-lg p-3.5 flex items-center justify-between border shadow-sm animate-pulse transition-colors
            dark:bg-rose-950/40 dark:border-rose-600/60 dark:text-rose-200 bg-rose-50 border-rose-300 text-rose-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-[#ff375f]/20 border border-[#ff375f]/40 flex items-center justify-center text-lg">
                🚨
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Autonomous Failover In Progress
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#ff375f]/20 text-[#ff375f] border border-[#ff375f]/40 font-mono">
                    CRITICAL OUTAGE
                  </span>
                </div>
                <p className="text-xs mt-0.5 font-mono">
                  Centre <strong className="underline">{failoverState.failedCentreId}</strong> severed. Re-attaching {failoverState.candidatesAffected} active candidate sessions to healthiest node...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#ff375f]">
              <span className="w-2 h-2 rounded-full bg-[#ff375f] animate-ping" />
              <span>Migrating Sessions...</span>
            </div>
          </div>
        )}

        {/* ── FAILOVER RECOVERY SUMMARY CARD ─────────────────────────────────── */}
        {failoverState?.status === 'completed' && (
          <div className="rounded-lg p-3.5 border transition-colors shadow-xs
            dark:bg-[#282828] dark:border-[#3e3e3e] bg-white border-gray-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b dark:border-[#383838] border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#00b8a3]/20 border border-[#00b8a3]/40 flex items-center justify-center text-sm font-bold text-[#00b8a3]">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 dark:text-white text-gray-900">
                    Failover Recovery Summary
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#00b8a3]/15 text-[#00b8a3] border border-[#00b8a3]/30 font-mono">
                      ZERO DATA LOSS
                    </span>
                  </h4>
                  <p className="text-[11px] dark:text-gray-400 text-gray-500 font-mono">
                    Migrated: <strong className="text-[#ff375f]">{failoverState.failed_centre_id}</strong> ➔ <strong className="text-[#00b8a3]">{failoverState.backup_centre_id}</strong> · All checkpoints verified
                  </p>
                </div>
              </div>
              <button
                onClick={dismissFailoverSummary}
                className="text-xs dark:text-gray-400 dark:hover:text-white dark:bg-[#333] dark:border-[#444] text-gray-500 hover:text-gray-900 bg-gray-100 border-gray-200 px-2.5 py-1 rounded-md border transition"
              >
                ✕ Dismiss
              </button>
            </div>

            {/* 4 KPI Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-md border dark:bg-[#202020] dark:border-[#383838] bg-gray-50 border-gray-200">
                <span className="text-[10px] dark:text-gray-500 text-gray-400 uppercase tracking-wider block">Candidates Affected</span>
                <span className="text-sm font-bold dark:text-white text-gray-900">{failoverState.candidates_affected}</span>
              </div>
              <div className="p-2.5 rounded-md border dark:bg-[#202020] dark:border-[#383838] bg-gray-50 border-gray-200">
                <span className="text-[10px] dark:text-gray-500 text-gray-400 uppercase tracking-wider block">Recovered</span>
                <span className="text-sm font-bold text-[#00b8a3]">{failoverState.candidates_recovered} (100%)</span>
              </div>
              <div className="p-2.5 rounded-md border dark:bg-[#202020] dark:border-[#383838] bg-gray-50 border-gray-200">
                <span className="text-[10px] dark:text-gray-500 text-gray-400 uppercase tracking-wider block">Recovery Time</span>
                <span className="text-sm font-bold text-[#ffa116]">{failoverState.recovery_time_sec}s</span>
              </div>
              <div className="p-2.5 rounded-md border dark:bg-[#202020] dark:border-[#383838] bg-gray-50 border-gray-200">
                <span className="text-[10px] dark:text-gray-500 text-gray-400 uppercase tracking-wider block">Answers Lost</span>
                <span className="text-sm font-bold text-[#00b8a3]">0</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Main body: Grid left + Incident Feed right ─────────────────────── */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">

          {/* Left column – Sentinel grid + Demo Controls + Ticker */}
          <section className="flex flex-col gap-3.5 flex-1 min-w-0">

            {/* Section label */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full bg-[#ffa116]" />
                <h2 className="text-xs font-bold uppercase tracking-wider dark:text-gray-300 text-gray-700">
                  Sentinel — 5-Centre Health Grid
                </h2>
              </div>
              <div className="flex items-center gap-2.5 text-[11px] font-mono dark:text-gray-400 text-gray-500">
                <span>Cadence: 2s</span>
                <span className="px-2 py-0.5 rounded border dark:bg-[#222] dark:border-[#383838] bg-gray-100 border-gray-200">
                  ⛓ {ledgerCount} blocks
                </span>
              </div>
            </div>

            {/* 5-tile grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {CENTRE_ORDER.map(id => (
                  <div key={id} className="rounded-lg border p-4 animate-pulse dark:bg-[#282828] dark:border-[#3e3e3e] bg-white border-gray-200">
                    <div className="h-3 rounded w-2/3 mb-3 dark:bg-[#383838] bg-gray-200" />
                    <div className="h-4 rounded w-full mb-2 dark:bg-[#383838] bg-gray-200" />
                    <div className="h-3 rounded w-1/2 dark:bg-[#383838] bg-gray-200" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
          <section className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col min-h-0">
            <IncidentFeed incidents={incidents} onAcknowledge={acknowledgeIncident} />
          </section>
        </div>
      </div>
    </div>
  );
}
