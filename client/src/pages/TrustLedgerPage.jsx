/**
 * TrustLedgerPage — /ledger Route
 * ═══════════════════════════════════════════════════════════════════════════
 * Visual explorer for ExamGuard's SHA-256 hash-chained immutable audit log.
 *
 * Features:
 *   - Live event stream (candidate login, answer submission, incident opened/resolved,
 *     admin acknowledge, decision made).
 *   - Big "Verify Integrity" button that recalculates all SHA-256 hashes:
 *       • Green "Chain intact" badge if all blocks verify
 *       • Red "Tampering detected at event #N" alert if any byte was altered
 *   - "Tamper Demo" button to secretly alter a record in SQLite directly to demo
 *     cryptographic tampering detection.
 *   - "Repair Chain" button to restore cryptographic validity.
 *   - Hash previews with copy-to-clipboard and full payload inspection modal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import socket from '../socket';

const API = '';

const TYPE_BADGE_STYLE = {
  'genesis':              'bg-purple-500/20 text-purple-300 border-purple-500/40',
  'candidate login':      'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  'answer submission':    'bg-blue-500/20 text-blue-300 border-blue-500/40',
  'incident created':     'bg-rose-500/20 text-rose-300 border-rose-500/40',
  'incident resolved':    'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  'admin acknowledge':    'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  'decision made':        'bg-amber-500/20 text-amber-300 border-amber-500/40'
};

function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return ts;
  }
}

export default function TrustLedgerPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [tampering, setTampering] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [tamperNotice, setTamperNotice] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);

  // Fetch initial ledger events
  const loadLedger = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/ledger?limit=150`);
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error('Failed to load ledger events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLedger();

    // Listen for live new blocks appended to the chain
    const onNewBlock = (newEvent) => {
      setEvents(prev => [newEvent, ...prev.slice(0, 199)]);
      // Invalidate current verification badge since new blocks arrived
      setVerificationResult(prev => prev ? { ...prev, isStale: true } : null);
    };

    socket.on('ledger:new_event', onNewBlock);

    return () => {
      socket.off('ledger:new_event', onNewBlock);
    };
  }, [loadLedger]);

  // Verify chain integrity
  const handleVerify = async () => {
    try {
      setVerifying(true);
      setTamperNotice(null);
      const res = await fetch(`${API}/api/ledger/verify`);
      const data = await res.json();
      setVerificationResult(data);
    } catch (err) {
      setVerificationResult({ valid: false, message: 'Verification request failed: ' + err.message });
    } finally {
      setVerifying(false);
    }
  };

  // Tamper demo: secretly modifies an event in DB
  const handleTamperDemo = async () => {
    try {
      setTampering(true);
      const res = await fetch(`${API}/api/ledger/tamper-demo`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTamperNotice(`⚠️ Attack Simulated: Event #${data.tamperedEventId} payload was secretly modified in SQLite! Click "Verify Integrity" to detect it.`);
        await loadLedger();
        // Clear previous verification result so user must re-verify
        setVerificationResult(null);
      }
    } catch (err) {
      setTamperNotice('Tamper demo failed: ' + err.message);
    } finally {
      setTampering(false);
    }
  };

  // Repair chain helper
  const handleRepair = async () => {
    try {
      setTampering(true);
      const res = await fetch(`${API}/api/ledger/repair`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTamperNotice(`✓ Chain repaired: All ${data.repairedEvents} hashes re-calculated and cryptographically linked.`);
        await loadLedger();
        await handleVerify();
      }
    } catch (err) {
      setTamperNotice('Repair failed: ' + err.message);
    } finally {
      setTampering(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  // Filtered events
  const filteredEvents = events.filter(e => {
    const matchesType = filterType === 'ALL' || (e.type || '').toLowerCase() === filterType.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      String(e.id).includes(query) ||
      (e.type || '').toLowerCase().includes(query) ||
      (e.centre_id || '').toLowerCase().includes(query) ||
      (e.hash || '').toLowerCase().includes(query) ||
      (e.payload || '').toLowerCase().includes(query);
    return matchesType && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
              <span className="text-lg">⛓️</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">TrustLedger</h1>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  SHA-256 HASH CHAIN
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographic tamper-evident audit trail for computer-based examination integrity
              </p>
            </div>

            {/* Navigation Tabs */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 ml-4 text-xs font-semibold">
              <Link to="/admin" className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                ← Sentinel Grid
              </Link>
              <span className="px-3 py-1.5 rounded-lg bg-purple-600/80 text-white shadow-sm">
                TrustLedger Explorer
              </span>
              <Link to="/decisions" className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition">
                ⚖️ Decision Support
              </Link>
            </div>
          </div>

          {/* Action Buttons: Verify & Tamper Demo */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Big Verify Integrity Button */}
            <button
              onClick={handleVerify}
              disabled={verifying}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 border ${
                verifying
                  ? 'bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40 shadow-emerald-950/40'
              }`}
            >
              <span className="text-sm">🛡️</span>
              <span>{verifying ? 'Recalculating SHA-256...' : 'Verify Integrity'}</span>
            </button>

            {/* Tamper Demo Button */}
            <button
              onClick={handleTamperDemo}
              disabled={tampering}
              className="px-3.5 py-2 rounded-xl font-bold text-xs bg-rose-950/80 hover:bg-rose-900/90 text-rose-200 border border-rose-700/50 transition-all flex items-center gap-1.5 active:scale-95"
              title="Secretly modifies one past record's payload in SQLite to demonstrate tamper detection"
            >
              <span>🧪</span>
              <span>Tamper Demo</span>
            </button>

            {/* Repair Chain Button */}
            <button
              onClick={handleRepair}
              disabled={tampering}
              className="px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-all flex items-center gap-1"
              title="Recalculate hashes from genesis to restore valid chain"
            >
              <span>🔧</span>
              <span>Repair Chain</span>
            </button>

            {/* Live Block Count Pill */}
            <div className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
              Blocks: <span className="font-bold text-purple-400">{events.length}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col gap-5">
        {/* Verification Result Banner */}
        {verificationResult && (
          <div
            className={`p-4 rounded-2xl border transition-all duration-300 ${
              verificationResult.valid
                ? 'bg-emerald-950/50 border-emerald-600/70 text-emerald-200 shadow-lg shadow-emerald-950/30'
                : 'bg-rose-950/60 border-rose-600/80 text-rose-100 shadow-lg shadow-rose-950/40 animate-pulse'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 border ${
                    verificationResult.valid
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  }`}
                >
                  {verificationResult.valid ? '✓' : '⚠️'}
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">
                    {verificationResult.valid
                      ? 'Chain intact'
                      : `Tampering detected at event #${verificationResult.brokenEventId}`}
                  </h3>
                  <p className="text-xs opacity-90 mt-0.5 font-mono">
                    {verificationResult.valid
                      ? `All ${verificationResult.totalEvents} blocks verified against SHA-256(prev_hash + timestamp + type + payload). Zero tampering detected.`
                      : `${verificationResult.reason || 'Cryptographic mismatch'}. Chain integrity broken at block #${verificationResult.brokenEventId}.`}
                  </p>
                </div>
              </div>

              <span
                className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                  verificationResult.valid
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-500/30 border-rose-500/60 text-rose-200'
                }`}
              >
                {verificationResult.valid ? 'VERIFIED INTACT' : 'COMPROMISED'}
              </span>
            </div>
          </div>
        )}

        {/* Tamper Notice Banner */}
        {tamperNotice && (
          <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-600/50 text-amber-200 text-xs flex items-center justify-between gap-3">
            <span>{tamperNotice}</span>
            <button
              onClick={() => setTamperNotice(null)}
              className="text-amber-400 hover:text-white font-bold px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Table Toolbar & Search ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            {['ALL', 'candidate login', 'answer submission', 'incident created', 'incident resolved', 'admin acknowledge', 'decision made'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                  filterType === type
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              placeholder="Search id, type, hash, payload..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
        </div>

        {/* ── Ledger Table ──────────────────────────────────────────────────── */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden flex-1 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 w-16">Block #</th>
                  <th className="py-3 px-4 w-32">Timestamp</th>
                  <th className="py-3 px-4 w-36">Event Type</th>
                  <th className="py-3 px-4 w-28">Centre</th>
                  <th className="py-3 px-4">Payload Preview</th>
                  <th className="py-3 px-4 w-36">Prev Hash</th>
                  <th className="py-3 px-4 w-36">Block Hash</th>
                  <th className="py-3 px-3 w-16 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      Loading cryptographic hash chain...
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No ledger events matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev) => {
                    const isTampered = verificationResult && !verificationResult.valid && verificationResult.brokenEventId === ev.id;
                    const badgeClass = TYPE_BADGE_STYLE[ev.type] || 'bg-slate-800 text-slate-300 border-slate-700';

                    return (
                      <tr
                        key={ev.id}
                        className={`transition-colors ${
                          isTampered
                            ? 'bg-rose-950/40 hover:bg-rose-900/50 border-l-4 border-rose-500'
                            : 'hover:bg-slate-850/60'
                        }`}
                      >
                        {/* Block ID */}
                        <td className="py-2.5 px-4 font-bold text-slate-300">
                          #{ev.id}
                        </td>

                        {/* Timestamp */}
                        <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                          {formatTimestamp(ev.timestamp)}
                        </td>

                        {/* Type Badge */}
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
                            {ev.type}
                          </span>
                        </td>

                        {/* Centre */}
                        <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">
                          {ev.centre_id || 'SYSTEM'}
                        </td>

                        {/* Payload Preview */}
                        <td className="py-2.5 px-4 max-w-[280px] truncate text-slate-400 font-mono text-[11px]" title={ev.payload}>
                          {ev.payload}
                        </td>

                        {/* Prev Hash */}
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <button
                            onClick={() => copyToClipboard(ev.prev_hash, `prev-${ev.id}`)}
                            className="group flex items-center gap-1 text-[11px] text-slate-500 hover:text-purple-300 transition"
                            title={ev.prev_hash}
                          >
                            <span>{ev.prev_hash?.substring(0, 10)}…</span>
                            <span className="opacity-0 group-hover:opacity-100 text-[10px]">
                              {copiedHash === `prev-${ev.id}` ? '✓' : '📋'}
                            </span>
                          </button>
                        </td>

                        {/* Current Hash */}
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <button
                            onClick={() => copyToClipboard(ev.hash, `hash-${ev.id}`)}
                            className={`group flex items-center gap-1 text-[11px] font-bold transition ${
                              isTampered ? 'text-rose-400 animate-pulse' : 'text-purple-400 hover:text-purple-300'
                            }`}
                            title={ev.hash}
                          >
                            <span>{ev.hash?.substring(0, 10)}…</span>
                            <span className="opacity-0 group-hover:opacity-100 text-[10px]">
                              {copiedHash === `hash-${ev.id}` ? '✓' : '📋'}
                            </span>
                          </button>
                        </td>

                        {/* Inspect Payload Button */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setSelectedEvent(ev)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition"
                            title="Inspect complete payload"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── Payload Inspector Modal ─────────────────────────────────────────── */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-bold font-mono">Block #{selectedEvent.id}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                  {selectedEvent.type}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Previous Hash</span>
                <p className="bg-slate-950 p-2 rounded border border-slate-800 text-slate-400 break-all select-all">
                  {selectedEvent.prev_hash}
                </p>
              </div>

              <div>
                <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Block Hash (SHA-256)</span>
                <p className="bg-slate-950 p-2 rounded border border-slate-800 text-purple-300 break-all select-all">
                  {selectedEvent.hash}
                </p>
              </div>

              <div>
                <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Timestamp & Centre</span>
                <p className="text-slate-300">
                  {selectedEvent.timestamp} · Centre: {selectedEvent.centre_id || 'SYSTEM'}
                </p>
              </div>

              <div>
                <span className="text-slate-500 uppercase tracking-wider block text-[10px]">Payload JSON</span>
                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-200 overflow-x-auto max-h-60 text-[11px]">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(selectedEvent.payload), null, 2);
                    } catch {
                      return selectedEvent.payload;
                    }
                  })()}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
