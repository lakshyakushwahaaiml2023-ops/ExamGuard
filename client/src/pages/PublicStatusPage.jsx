/**
 * PublicStatusPage — /status Route
 * ═══════════════════════════════════════════════════════════════════════════
 * Public, mobile-friendly status page for examination candidates (No login required).
 *
 * Shows:
 *   1. Overall exam status in plain language:
 *      - "Running normally"
 *      - "Minor disruption, no action needed"
 *      - "Disruption being resolved"
 *      - "Exam rescheduled"
 *   2. Reassuring Zero-Loss Guarantee callout.
 *   3. Per-centre operational health cards with non-technical guidance.
 *   4. Real-time chronological timeline of plain language updates auto-generated
 *      from incidents, automated failovers, and official DSS rulings.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import socket from '../socket';

const API = '';

const OVERALL_STATUS_CONFIG = {
  'Running normally': {
    bg: 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    indicator: 'bg-emerald-400',
    icon: '✅',
    headline: 'All Examination Systems Running Normally',
    description: 'All 5 exam centres are fully operational. Answers are continuously being saved to secure servers with zero latency.'
  },
  'Minor disruption, no action needed': {
    bg: 'bg-amber-950/40 border-amber-500/40 text-amber-200',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    indicator: 'bg-amber-400',
    icon: 'ℹ️',
    headline: 'Minor Disruption — No Action Needed',
    description: 'Minor network fluctuations detected at select centres. Candidate exams continue normally and all progress is safely recorded.'
  },
  'Disruption being resolved': {
    bg: 'bg-rose-950/40 border-rose-500/40 text-rose-200',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse',
    indicator: 'bg-rose-500 animate-ping',
    icon: '🛡️',
    headline: 'Disruption Being Resolved — Answers Protected',
    description: 'Automated backup systems are actively restoring affected workstations. All previously saved answers and remaining time are 100% preserved.'
  },
  'Exam rescheduled': {
    bg: 'bg-rose-950/60 border-rose-600/60 text-rose-100',
    badge: 'bg-rose-600/30 text-rose-200 border-rose-500/50',
    indicator: 'bg-rose-600',
    icon: '📢',
    headline: 'Examination Session Rescheduled',
    description: 'The Examination Authority has ordered a reschedule due to multi-centre disruption. All candidate work has been securely archived.'
  }
};

const TONE_BADGES = {
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  amber:   'bg-amber-500/20 text-amber-300 border-amber-500/30',
  rose:    'bg-rose-500/20 text-rose-300 border-rose-500/30',
  blue:    'bg-blue-500/20 text-blue-300 border-blue-500/30'
};

export default function PublicStatusPage() {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/api/public-status`);
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.warn('Status fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Auto-poll every 4 seconds for instant updates
    const interval = setInterval(fetchStatus, 4000);

    // Listen for real-time socket events
    const onTelemetry = () => fetchStatus();
    const onIncident = () => fetchStatus();
    const onFailover = () => fetchStatus();
    const onDecision = () => fetchStatus();

    socket.on('telemetry:broadcast', onTelemetry);
    socket.on('incident:created', onIncident);
    socket.on('incident:resolved', onIncident);
    socket.on('failover:progress', onFailover);
    socket.on('decision:created', onDecision);
    socket.on('decision:updated', onDecision);

    return () => {
      clearInterval(interval);
      socket.off('telemetry:broadcast', onTelemetry);
      socket.off('incident:created', onIncident);
      socket.off('incident:resolved', onIncident);
      socket.off('failover:progress', onFailover);
      socket.off('decision:created', onDecision);
      socket.off('decision:updated', onDecision);
    };
  }, []);

  const overallStatus = statusData?.overallStatus || 'Running normally';
  const cfg = OVERALL_STATUS_CONFIG[overallStatus] || OVERALL_STATUS_CONFIG['Running normally'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* ── Public Top Bar (Clean & Mobile-Friendly) ────────────────────────── */}
      <header className="px-4 sm:px-6 py-4 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🛡️</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black text-white tracking-tight">ExamGuard</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  Public Status
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                National Computer-Based Examination • Live Candidate Information Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] font-medium text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Updates</span>
            </div>
            <Link
              to="/exam?candidate=cand-1"
              className="text-xs px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition hidden sm:inline-flex items-center gap-1"
            >
              <span>🖥️</span>
              <span>Candidate Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ──────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* ── Hero Overall Status Banner ────────────────────────────────────── */}
        <section className={`p-5 sm:p-7 rounded-2xl border transition-all duration-300 shadow-xl relative overflow-hidden ${cfg.bg}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-2xl flex-shrink-0">
                {cfg.icon}
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold opacity-80 block">Current Status</span>
                <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                  {overallStatus}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono opacity-80 self-end sm:self-auto">
              <span>Updated:</span>
              <strong className="text-white">
                {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </strong>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm sm:text-base font-medium text-white/90 leading-relaxed">
              {statusData?.overallHeadline || cfg.headline}
            </p>
            <p className="text-xs sm:text-sm text-white/70 mt-1 leading-relaxed">
              {statusData?.overallDescription || cfg.description}
            </p>
          </div>
        </section>

        {/* ── Zero-Loss Guarantee Reassurance Box ────────────────────────────── */}
        <section className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 flex items-start gap-3.5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-lg flex-shrink-0 mt-0.5">
            🔒
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-blue-200">
              Zero-Loss Exam Guarantee Active
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Every answer you select is immediately saved server-side with a cryptographic timestamp.
              Even if your computer restarts, loses power, or switches rooms, <strong>all your answers and remaining exam time are 100% safe</strong>.
            </p>
          </div>
        </section>

        {/* ── Per-Centre Status Grid ────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>🏢</span>
              <span>Examination Centres Status</span>
            </h3>
            <span className="text-xs text-slate-500">5 Exam Centres Monitored</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {statusData?.centres?.map(c => {
              const toneClass = TONE_BADGES[c.statusTone] || TONE_BADGES.emerald;
              const isHealthy = c.statusTone === 'emerald';

              return (
                <div
                  key={c.id}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-white leading-snug">
                        {c.name}
                      </h4>
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${
                        isHealthy ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : c.statusTone === 'amber' ? 'bg-amber-400' : 'bg-rose-500 animate-ping'
                      }`} />
                    </div>

                    <div className="mt-2">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${toneClass}`}>
                        {c.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      {c.candidateMessage}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Candidates: <strong className="text-slate-300 font-sans">{c.candidateCount}</strong></span>
                    <span>{c.lastHeartbeat}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Timeline of Plain Language Updates ────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>⏱️</span>
              <span>Live Updates &amp; Notices</span>
            </h3>
            <span className="text-xs text-slate-500">Auto-generated in plain language</span>
          </div>

          {loading && (
            <div className="p-8 text-center text-slate-500 text-xs">
              Loading recent updates...
            </div>
          )}

          {!loading && (!statusData?.timeline || statusData.timeline.length === 0) && (
            <div className="p-6 text-center rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 text-xs">
              All systems have operated with zero incidents. No alerts or disruptions recorded.
            </div>
          )}

          <div className="space-y-3">
            {statusData?.timeline?.map((item, idx) => {
              const toneClass = TONE_BADGES[item.tone] || TONE_BADGES.blue;
              return (
                <div
                  key={item.id || idx}
                  className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition flex items-start gap-3.5"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                    {item.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${toneClass}`}>
                          {item.category}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                          {item.title}
                        </h4>
                      </div>

                      <span className="text-[11px] font-mono text-slate-400 sm:self-auto">
                        {item.timeFormatted}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      {item.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Candidate FAQ & Assistance Accordion ───────────────────────────── */}
        <section className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>❓</span>
            <span>Candidate FAQs &amp; Help</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
              <strong className="text-white block mb-1">What happens if my screen freezes or disconnects?</strong>
              <p className="text-slate-400 leading-relaxed">
                Do not panic. Your answers are stored on the server immediately. Your local proctor will re-open your session and you will resume at the exact same question with all previous answers intact.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
              <strong className="text-white block mb-1">Will my remaining exam time be lost?</strong>
              <p className="text-slate-400 leading-relaxed">
                No. The exam timer automatically preserves your remaining minutes during any connection pause, guaranteeing your full entitled testing duration.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
              <strong className="text-white block mb-1">How can I confirm my answers are recorded?</strong>
              <p className="text-slate-400 leading-relaxed">
                Whenever you select an option, a green "Saved" status appears on your candidate screen, backed by cryptographic ledger checkpointing.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
              <strong className="text-white block mb-1">Need on-site assistance?</strong>
              <p className="text-slate-400 leading-relaxed">
                Raise your hand at any time. Your room invigilator and on-duty IT administrators have real-time visibility through the ExamGuard Sentinel Console.
              </p>
            </div>
          </div>
        </section>

        {/* ── Quick Footer Links ────────────────────────────────────────────── */}
        <footer className="pt-4 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <p>© 2026 Examination Resilience Commission • Powered by ExamGuard Platform</p>
          <div className="flex items-center gap-4">
            <Link to="/exam?candidate=cand-1" className="hover:text-blue-400 transition">Candidate Exam</Link>
            <Link to="/ledger" className="hover:text-purple-400 transition">TrustLedger Proof</Link>
            <Link to="/admin" className="hover:text-slate-400 transition">Admin Console</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
