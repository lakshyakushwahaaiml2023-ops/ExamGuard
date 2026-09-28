/**
 * AdminHeader – top bar for the admin dashboard.
 * Shows the ExamGuard logo, live connection status, and four KPI pills:
 *   total candidates active, healthy / degraded / offline centre counts.
 * The connection dot pulses green when Socket.IO is live.
 */
import React from 'react';
import { Link } from 'react-router-dom';

function KpiPill({ label, value, color }) {
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-xl border ${color}`}>
      <span className="text-lg font-black tabular-nums leading-none">{value}</span>
      <span className="text-[10px] uppercase tracking-wider mt-0.5 opacity-80">{label}</span>
    </div>
  );
}

export default function AdminHeader({
  connected,
  totalActiveCandidates,
  offlineCentres,
  degradedCentres,
  activeIncidents,
}) {
  const healthyCentres = 5 - offlineCentres - degradedCentres;

  return (
    <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between
                       gap-4 pb-5 border-b border-slate-800/80">
      {/* Branding & Nav */}
      <div className="flex items-center gap-3">
        {/* Shield icon (inline SVG) */}
        <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30
                        flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-blue-400" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 6v6c0 5.25 3.5 10.2 8 11.5C16.5 22.2 20 17.25 20 12V6L12 2zm-1 13.4l-3.4-3.4 1.4-1.4 2 2 4.6-4.6 1.4 1.4L11 15.4z"/>
          </svg>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-white tracking-tight">ExamGuard</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md
                             bg-blue-500/15 text-blue-300 border border-blue-500/30 uppercase tracking-wide">
              Admin
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md
                             bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wide">
              MVP SIM
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Resilience &amp; Trust Platform — Sentinel Operations Console
          </p>
        </div>

        {/* Navigation tabs */}
        <div className="hidden md:flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 ml-4 text-xs font-semibold">
          <span className="px-3 py-1.5 rounded-lg bg-blue-600/80 text-white shadow-sm">
            Sentinel Grid
          </span>
          <Link to="/ledger" className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition flex items-center gap-1">
            <span>⛓️</span>
            <span>TrustLedger</span>
          </Link>
          <Link to="/decisions" className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition flex items-center gap-1">
            <span>⚖️</span>
            <span>Decision Support</span>
          </Link>
          <Link to="/status" className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition flex items-center gap-1">
            <span>🌐</span>
            <span>Public Status</span>
          </Link>
          <Link to="/exam?candidate=cand-1" className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition flex items-center gap-1">
            <span>🖥️</span>
            <span>Candidate View</span>
          </Link>
        </div>
      </div>

      {/* Right side: connection indicator + KPIs */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Socket.IO connection pill */}
        <div className={`flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-xl border
          ${connected
            ? 'bg-emerald-500/10 border-emerald-600/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-600/30 text-rose-400'
          }`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          {connected ? 'Live Sentinel' : 'Disconnected'}
        </div>

        {/* KPI pills */}
        <KpiPill
          label="Candidates"
          value={totalActiveCandidates}
          color="bg-blue-500/10 border-blue-500/30 text-blue-200"
        />
        <KpiPill
          label="Healthy"
          value={healthyCentres}
          color="bg-emerald-500/10 border-emerald-600/30 text-emerald-200"
        />
        {degradedCentres > 0 && (
          <KpiPill
            label="Degraded"
            value={degradedCentres}
            color="bg-amber-500/10 border-amber-500/30 text-amber-200"
          />
        )}
        {offlineCentres > 0 && (
          <KpiPill
            label="Offline"
            value={offlineCentres}
            color="bg-rose-500/10 border-rose-600/30 text-rose-200 animate-pulse"
          />
        )}
        {activeIncidents > 0 && (
          <KpiPill
            label="Incidents"
            value={activeIncidents}
            color="bg-rose-600/20 border-rose-500/40 text-rose-300 animate-pulse"
          />
        )}
      </div>
    </header>
  );
}
