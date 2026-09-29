/**
 * AdminHeader – top bar for the admin dashboard (LeetCode theme).
 * Styled with LeetCode contest operations console aesthetic and dark/light support.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';

function KpiPill({ label, value, colorClass, highlight = false }) {
  return (
    <div className={`flex flex-col items-center px-3.5 py-1.5 rounded-lg border transition-all ${colorClass} ${highlight ? 'ring-1 ring-rose-500 animate-pulse' : ''}`}>
      <span className="text-base font-bold font-mono tabular-nums leading-tight">{value}</span>
      <span className="text-[10px] uppercase font-semibold tracking-wider opacity-75">{label}</span>
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
  const { isDark, toggleTheme } = useTheme();
  const healthyCentres = 5 - offlineCentres - degradedCentres;

  return (
    <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b transition-colors
      dark:border-[#3e3e3e] border-gray-200">
      
      {/* ── Left: Branding & Navigation Tabs ──────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* LeetCode stylized mark */}
        <Link to="/admin" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[#ffa116] flex items-center justify-center shadow-xs">
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 4.818 3.551 5.86 5.86 0 0 0 3.322-.454 5.753 5.753 0 0 0 1.259-.838l4.475-4.489a1.38 1.38 0 0 0 0-1.952 1.38 1.38 0 0 0-1.953 0l-4.476 4.49a3.14 3.14 0 0 1-1.895.733 3.14 3.14 0 0 1-2.073-.787 3.2 3.2 0 0 1-1.077-1.782 3.24 3.24 0 0 1 .425-2.585l3.854-4.127 5.405-5.787A1.38 1.38 0 0 0 13.483 0z"/>
              <path d="M19.167 12.35H9.68a1.38 1.38 0 1 0 0 2.76h9.487a1.38 1.38 0 1 0 0-2.76z" fill="#282828"/>
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight dark:text-white text-gray-900 group-hover:text-[#ffa116] transition">
                ExamGuard
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#ffa116]/15 text-[#ffa116] border border-[#ffa116]/30 uppercase">
                Console
              </span>
            </div>
            <p className="text-[11px] dark:text-gray-400 text-gray-500 font-medium">
              National Assessment Sentinel &amp; Resilience Operations
            </p>
          </div>
        </Link>

        {/* LeetCode styled Navigation Tabs */}
        <nav className="flex items-center gap-1 p-1 rounded-lg border text-xs font-medium ml-2 transition-colors
          dark:bg-[#202020] dark:border-[#383838] bg-gray-100 border-gray-200">
          <span className="px-3 py-1.5 rounded-md font-semibold dark:bg-[#333333] dark:text-[#ffa116] bg-white text-[#ffa116] shadow-xs">
            ⚡ Sentinel Grid
          </span>
          <Link to="/ledger" className="px-3 py-1.5 rounded-md transition flex items-center gap-1 dark:text-gray-400 dark:hover:text-white dark:hover:bg-[#2a2a2a] text-gray-600 hover:text-gray-900 hover:bg-white/60">
            <span>⛓️</span>
            <span>TrustLedger</span>
          </Link>
          <Link to="/decisions" className="px-3 py-1.5 rounded-md transition flex items-center gap-1 dark:text-gray-400 dark:hover:text-white dark:hover:bg-[#2a2a2a] text-gray-600 hover:text-gray-900 hover:bg-white/60">
            <span>⚖️</span>
            <span>Decision Support</span>
          </Link>
          <Link to="/status" className="px-3 py-1.5 rounded-md transition flex items-center gap-1 dark:text-gray-400 dark:hover:text-white dark:hover:bg-[#2a2a2a] text-gray-600 hover:text-gray-900 hover:bg-white/60">
            <span>🌐</span>
            <span>Public Status</span>
          </Link>
          <Link to="/exam?candidate=cand-1" className="px-3 py-1.5 rounded-md transition flex items-center gap-1 dark:text-gray-400 dark:hover:text-white dark:hover:bg-[#2a2a2a] text-gray-600 hover:text-gray-900 hover:bg-white/60">
            <span>🖥️</span>
            <span>Candidate View</span>
          </Link>
        </nav>
      </div>

      {/* ── Right: Connection Status, KPI Pills & Theme Switcher ─────────────── */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Connection status pill */}
        <div className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-lg border transition-colors
          ${connected
            ? 'dark:bg-emerald-950/30 dark:border-emerald-700/50 dark:text-emerald-300 bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'dark:bg-rose-950/30 dark:border-rose-700/50 dark:text-rose-300 bg-rose-50 border-rose-200 text-rose-700'
          }`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#00b8a3] animate-pulse' : 'bg-[#ff375f]'}`} />
          <span>{connected ? 'Live Sentinel' : 'Offline'}</span>
        </div>

        {/* LeetCode styled KPI Pills */}
        <KpiPill
          label="Candidates"
          value={totalActiveCandidates}
          colorClass="dark:bg-[#202020] dark:border-[#383838] dark:text-white bg-gray-50 border-gray-200 text-gray-900"
        />
        <KpiPill
          label="Healthy"
          value={healthyCentres}
          colorClass="dark:bg-[#00b8a3]/10 dark:border-[#00b8a3]/30 dark:text-[#00b8a3] bg-emerald-50 border-emerald-200 text-emerald-700"
        />
        {degradedCentres > 0 && (
          <KpiPill
            label="Degraded"
            value={degradedCentres}
            colorClass="dark:bg-[#ffa116]/10 dark:border-[#ffa116]/30 dark:text-[#ffa116] bg-amber-50 border-amber-200 text-amber-700"
          />
        )}
        {offlineCentres > 0 && (
          <KpiPill
            label="Offline"
            value={offlineCentres}
            colorClass="dark:bg-rose-950/40 dark:border-rose-600/60 dark:text-rose-300 bg-rose-50 border-rose-300 text-rose-700"
            highlight={true}
          />
        )}
        {activeIncidents > 0 && (
          <KpiPill
            label="Incidents"
            value={activeIncidents}
            colorClass="dark:bg-rose-950/40 dark:border-rose-600/60 dark:text-rose-300 bg-rose-50 border-rose-300 text-rose-700"
            highlight={true}
          />
        )}

        {/* Dark / Light Mode Toggle Button (LeetCode exact styling) */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
          title={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
          className="p-2 rounded-lg transition border flex items-center justify-center shadow-2xs
            dark:bg-[#202020] dark:border-[#383838] dark:text-amber-400 dark:hover:bg-[#2a2a2a]
            bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
        >
          {isDark ? (
            <svg className="w-4 h-4 fill-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 fill-slate-700" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
