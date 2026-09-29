/**
 * PublicStatusPage — /status Route (LeetCode Themed Candidate Status Portal)
 * ═══════════════════════════════════════════════════════════════════════════
 * LeetCode styled public status page with dark/light mode toggle.
 * Provides transparent, reassuring exam operational status in plain language.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import socket from '../socket';
import LeetCodeNavbar from '../components/LeetCodeNavbar.jsx';

const API = '';

const OVERALL_STATUS_CONFIG = {
  'Running normally': {
    bg: 'dark:bg-[#00b8a3]/10 dark:border-[#00b8a3]/30 bg-teal-50/80 border-teal-200 text-[#00b8a3]',
    badge: 'dark:bg-[#00b8a3]/20 bg-teal-100 dark:text-[#00b8a3] text-teal-800 border dark:border-[#00b8a3]/40 border-teal-300',
    indicator: 'bg-[#00b8a3]',
    icon: '✅',
    headline: 'All Examination Systems Running Normally',
    description: 'All 5 exam centres are fully operational. Answers are continuously being saved to secure servers with zero latency.'
  },
  'Minor disruption, no action needed': {
    bg: 'dark:bg-[#ffa116]/10 dark:border-[#ffa116]/30 bg-amber-50/80 border-amber-200 text-[#ffa116]',
    badge: 'dark:bg-[#ffa116]/20 bg-amber-100 dark:text-[#ffa116] text-amber-800 border dark:border-[#ffa116]/40 border-amber-300',
    indicator: 'bg-[#ffa116]',
    icon: 'ℹ️',
    headline: 'Minor Disruption — No Action Needed',
    description: 'Minor network fluctuations detected at select centres. Candidate exams continue normally and all progress is safely recorded.'
  },
  'Disruption being resolved': {
    bg: 'dark:bg-[#ff375f]/10 dark:border-[#ff375f]/30 bg-rose-50/80 border-rose-200 text-[#ff375f]',
    badge: 'dark:bg-[#ff375f]/20 bg-rose-100 dark:text-[#ff375f] text-rose-800 border dark:border-[#ff375f]/40 border-rose-300 animate-pulse',
    indicator: 'bg-[#ff375f] animate-ping',
    icon: '🛡️',
    headline: 'Disruption Being Resolved — Answers Protected',
    description: 'Automated backup systems are actively restoring affected workstations. All previously saved answers and remaining time are 100% preserved.'
  },
  'Exam rescheduled': {
    bg: 'dark:bg-[#ff375f]/15 dark:border-[#ff375f]/40 bg-rose-100 border-rose-300 text-rose-800',
    badge: 'dark:bg-[#ff375f]/30 bg-rose-200 text-rose-900 border border-rose-400',
    indicator: 'bg-[#ff375f]',
    icon: '📢',
    headline: 'Examination Session Rescheduled',
    description: 'The Examination Authority has ordered a reschedule due to multi-centre disruption. All candidate work has been securely archived.'
  }
};

const TONE_BADGES = {
  emerald: 'dark:bg-[#00b8a3]/15 bg-teal-50 dark:text-[#00b8a3] text-teal-700 dark:border-[#00b8a3]/30 border-teal-200',
  amber:   'dark:bg-[#ffa116]/15 bg-amber-50 dark:text-[#ffa116] text-amber-700 dark:border-[#ffa116]/30 border-amber-200',
  rose:    'dark:bg-[#ff375f]/15 bg-rose-50 dark:text-[#ff375f] text-rose-700 dark:border-[#ff375f]/30 border-rose-200',
  blue:    'dark:bg-blue-500/15 bg-blue-50 dark:text-blue-400 text-blue-700 dark:border-blue-500/30 border-blue-200'
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
    socket.on('failover:trigger', onFailover);
    socket.on('failover:success', onFailover);
    socket.on('decision:created', onDecision);
    socket.on('decision:updated', onDecision);

    return () => {
      clearInterval(interval);
      socket.off('telemetry:broadcast', onTelemetry);
      socket.off('incident:created', onIncident);
      socket.off('incident:resolved', onIncident);
      socket.off('failover:trigger', onFailover);
      socket.off('failover:success', onFailover);
      socket.off('decision:created', onDecision);
      socket.off('decision:updated', onDecision);
    };
  }, []);

  const overallStatus = statusData?.overallStatus || 'Running normally';
  const cfg = OVERALL_STATUS_CONFIG[overallStatus] || OVERALL_STATUS_CONFIG['Running normally'];

  return (
    <div className="min-h-screen flex flex-col select-none transition-colors duration-150 dark:bg-[#1a1a1a] bg-[#f7f7f8] dark:text-[#eff1f6] text-[#262626]">
      {/* ── Top LeetCode Navbar ──────────────────────────────────────────────── */}
      <LeetCodeNavbar
        extraRight={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-[#00b8a3] animate-pulse" />
              <span className="dark:text-gray-300 text-gray-700">Live Status</span>
            </div>
            <Link
              to="/exam?candidate=cand-1"
              className="px-3 py-1 rounded-md text-xs font-semibold text-white bg-[#00b8a3] hover:bg-[#00a390] transition shadow-2xs flex items-center gap-1 active:scale-95"
            >
              <span>🖥️</span>
              <span>Candidate Portal</span>
            </Link>
          </div>
        }
      />

      {/* ── Main Content Container ──────────────────────────────────────────── */}
      <div className="max-w-[1200px] mx-auto w-full px-4 py-6 flex flex-col gap-6 flex-1">
        
        {/* ── Hero Overall Status Banner ────────────────────────────────────── */}
        <section className={`p-5 sm:p-6 rounded-lg border transition-all duration-150 shadow-2xs relative overflow-hidden ${cfg.bg}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b dark:border-white/10 border-black/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg dark:bg-white/10 bg-black/5 border dark:border-white/20 border-black/10 flex items-center justify-center text-2xl flex-shrink-0">
                {cfg.icon}
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold opacity-80 block">Current Status</span>
                <h2 className="text-xl sm:text-2xl font-bold leading-tight">
                  {overallStatus}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono opacity-80 self-end sm:self-auto">
              <span>Updated:</span>
              <strong className="font-bold">
                {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </strong>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm sm:text-base font-semibold leading-relaxed">
              {statusData?.overallHeadline || cfg.headline}
            </p>
            <p className="text-xs sm:text-sm mt-1 leading-relaxed opacity-90">
              {statusData?.overallDescription || cfg.description}
            </p>
          </div>
        </section>

        {/* ── Zero-Loss Guarantee Reassurance Box ────────────────────────────── */}
        <section className="p-4 sm:p-5 rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 flex items-start gap-3.5 shadow-2xs">
          <div className="w-8 h-8 rounded-md dark:bg-[#00b8a3]/15 bg-teal-50 border dark:border-[#00b8a3]/30 border-teal-200 flex items-center justify-center text-base flex-shrink-0 mt-0.5">
            🔒
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#00b8a3]">
              Zero-Loss Exam Guarantee Active
            </h3>
            <p className="text-xs dark:text-gray-300 text-gray-600 mt-1 leading-relaxed">
              Every answer choice you select is immediately saved server-side with a cryptographic SHA-256 timestamp.
              Even if your computer restarts, loses power, or switches rooms, <strong>all your answers and remaining exam time are 100% safe</strong>.
            </p>
          </div>
        </section>

        {/* ── Per-Centre Status Grid ────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b dark:border-[#282828] border-gray-200">
            <h3 className="text-xs font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 flex items-center gap-1.5">
              <span>🏢</span>
              <span>Examination Centres Status</span>
            </h3>
            <span className="text-xs dark:text-gray-500 text-gray-400 font-mono">5 Centres Monitored</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {statusData?.centres?.map(c => {
              const toneClass = TONE_BADGES[c.statusTone] || TONE_BADGES.emerald;
              const isHealthy = c.statusTone === 'emerald';

              return (
                <div
                  key={c.id}
                  className="p-4 rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 transition-all duration-150 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold leading-snug">
                        {c.name}
                      </h4>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                        isHealthy ? 'bg-[#00b8a3]' : c.statusTone === 'amber' ? 'bg-[#ffa116]' : 'bg-[#ff375f] animate-ping'
                      }`} />
                    </div>

                    <div className="mt-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${toneClass}`}>
                        {c.status}
                      </span>
                    </div>

                    <p className="text-xs dark:text-gray-400 text-gray-600 mt-2 leading-relaxed">
                      {c.candidateMessage}
                    </p>
                  </div>

                  <div className="pt-2 border-t dark:border-[#333333] border-gray-100 flex items-center justify-between text-[11px] dark:text-gray-400 text-gray-500 font-mono">
                    <span>Candidates: <strong className="dark:text-gray-200 text-gray-800 font-sans">{c.candidateCount}</strong></span>
                    <span>{c.lastHeartbeat}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Timeline of Plain Language Updates ────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b dark:border-[#282828] border-gray-200">
            <h3 className="text-xs font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 flex items-center gap-1.5">
              <span>⏱️</span>
              <span>Live Updates &amp; Notices</span>
            </h3>
            <span className="text-xs dark:text-gray-500 text-gray-400">Auto-generated in plain language</span>
          </div>

          {loading && (
            <div className="p-8 text-center dark:text-gray-400 text-gray-500 text-xs">
              Loading recent updates...
            </div>
          )}

          {!loading && (!statusData?.timeline || statusData.timeline.length === 0) && (
            <div className="p-6 text-center rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 dark:text-gray-400 text-gray-500 text-xs">
              All systems have operated with zero incidents. No alerts or disruptions recorded.
            </div>
          )}

          <div className="space-y-2.5">
            {statusData?.timeline?.map((item, idx) => {
              const toneClass = TONE_BADGES[item.tone] || TONE_BADGES.blue;
              return (
                <div
                  key={item.id || idx}
                  className="p-3.5 rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-7 h-7 rounded-md dark:bg-[#202020] bg-gray-100 border dark:border-[#3e3e3e] border-gray-200 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                    {item.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${toneClass}`}>
                          {item.category}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold truncate">
                          {item.title}
                        </h4>
                      </div>

                      <span className="text-[11px] font-mono dark:text-gray-400 text-gray-500 sm:self-auto">
                        {item.timeFormatted}
                      </span>
                    </div>

                    <p className="text-xs dark:text-gray-300 text-gray-700 leading-relaxed mt-0.5">
                      {item.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Candidate FAQ & Assistance Accordion ───────────────────────────── */}
        <section className="p-5 rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 space-y-3 shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 flex items-center gap-1.5">
            <span>❓</span>
            <span>Candidate FAQs &amp; Help</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-md dark:bg-[#202020] bg-gray-50 border dark:border-[#333333] border-gray-200">
              <strong className="block mb-1 dark:text-white text-gray-900 font-semibold">What happens if my screen freezes or disconnects?</strong>
              <p className="dark:text-gray-400 text-gray-600 leading-relaxed">
                Do not panic. Your answers are stored on the server immediately. Your local proctor will re-open your session and you will resume at the exact same question with all previous answers intact.
              </p>
            </div>

            <div className="p-3 rounded-md dark:bg-[#202020] bg-gray-50 border dark:border-[#333333] border-gray-200">
              <strong className="block mb-1 dark:text-white text-gray-900 font-semibold">Will my remaining exam time be lost?</strong>
              <p className="dark:text-gray-400 text-gray-600 leading-relaxed">
                No. The exam timer automatically preserves your remaining minutes during any connection pause, guaranteeing your full entitled testing duration.
              </p>
            </div>

            <div className="p-3 rounded-md dark:bg-[#202020] bg-gray-50 border dark:border-[#333333] border-gray-200">
              <strong className="block mb-1 dark:text-white text-gray-900 font-semibold">How can I confirm my answers are recorded?</strong>
              <p className="dark:text-gray-400 text-gray-600 leading-relaxed">
                Whenever you select an option, a green "Saved" status appears on your candidate screen, backed by cryptographic ledger checkpointing.
              </p>
            </div>

            <div className="p-3 rounded-md dark:bg-[#202020] bg-gray-50 border dark:border-[#333333] border-gray-200">
              <strong className="block mb-1 dark:text-white text-gray-900 font-semibold">Need on-site assistance?</strong>
              <p className="dark:text-gray-400 text-gray-600 leading-relaxed">
                Raise your hand at any time. Your room invigilator and on-duty IT administrators have real-time visibility through the ExamGuard Sentinel Console.
              </p>
            </div>
          </div>
        </section>

        {/* ── Quick Footer Links ────────────────────────────────────────────── */}
        <footer className="pt-4 border-t dark:border-[#282828] border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] dark:text-gray-500 text-gray-400">
          <p>© 2026 Examination Resilience Commission • Powered by ExamGuard Platform</p>
          <div className="flex items-center gap-4">
            <Link to="/exam?candidate=cand-1" className="hover:text-[#ffa116] transition">Candidate Exam</Link>
            <Link to="/ledger" className="hover:text-[#ffa116] transition">TrustLedger Proof</Link>
            <Link to="/admin" className="hover:text-[#ffa116] transition">Sentinel Console</Link>
            <Link to="/decisions" className="hover:text-[#ffa116] transition">Decision Support</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
