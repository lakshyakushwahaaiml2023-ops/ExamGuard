/**
 * TrustLedgerPage — /ledger Route (LeetCode Themed Audit Explorer)
 * ═══════════════════════════════════════════════════════════════════════════
 * LeetCode styled cryptographic hash-chain inspection interface with
 * dark/light mode toggle.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import socket from '../socket';
import LeetCodeNavbar from '../components/LeetCodeNavbar.jsx';

const API = '';

const TYPE_BADGE_STYLE = {
  'candidate login':      'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'answer submission':    'bg-[#00b8a3]/15 text-[#00b8a3] border-[#00b8a3]/30',
  'incident created':     'bg-[#ff375f]/15 text-[#ff375f] border-[#ff375f]/30',
  'incident resolved':    'bg-[#00b8a3]/15 text-[#00b8a3] border-[#00b8a3]/30',
  'failover initiated':   'bg-[#ffa116]/15 text-[#ffa116] border-[#ffa116]/30',
  'failover backup selected': 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  'failover completed':   'bg-[#00b8a3]/15 text-[#00b8a3] border-[#00b8a3]/30',
  'admin acknowledge':    'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  'decision made':        'bg-[#ffa116]/15 text-[#ffa116] border-[#ffa116]/30'
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

  const loadLedger = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/ledger?limit=150`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to load ledger events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLedger();
    const onBlockAppended = (newEvent) => {
      setEvents(prev => [newEvent, ...prev.filter(e => e.id !== newEvent.id)]);
    };
    socket.on('ledger:block', onBlockAppended);
    return () => {
      socket.off('ledger:block', onBlockAppended);
    };
  }, [loadLedger]);

  const handleVerify = async () => {
    try {
      setVerifying(true);
      setVerificationResult(null);
      const res = await fetch(`${API}/api/ledger/verify`);
      const data = await res.json();
      setVerificationResult(data);
    } catch (err) {
      setVerificationResult({ valid: false, reason: 'Network verification failed: ' + err.message });
    } finally {
      setVerifying(false);
    }
  };

  const handleTamperDemo = async () => {
    try {
      setTampering(true);
      const res = await fetch(`${API}/api/ledger/tamper-demo`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTamperNotice(`Tamper Demo Executed: Past event #${data.tamperedEventId} modified secretly in DB.`);
        await loadLedger();
        await handleVerify();
      }
    } catch (err) {
      setTamperNotice('Tamper demo failed: ' + err.message);
    } finally {
      setTampering(false);
    }
  };

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

  const filteredEvents = events.filter(e => {
    const matchesType = filterType === 'ALL' || (e.type || '').toLowerCase() === filterType.toLowerCase();
    const query = searchQuery.toLowerCase();
    return matchesType && (!query ||
      String(e.id).includes(query) ||
      (e.type || '').toLowerCase().includes(query) ||
      (e.centre_id || '').toLowerCase().includes(query) ||
      (e.hash || '').toLowerCase().includes(query) ||
      (e.payload || '').toLowerCase().includes(query));
  });

  return (
    <div className="min-h-screen flex flex-col select-none transition-colors duration-150 dark:bg-[#1a1a1a] bg-[#f7f7f8] dark:text-[#eff1f6] text-[#262626]">
      {/* ── Top LeetCode Navbar ──────────────────────────────────────────────── */}
      <LeetCodeNavbar
        extraRight={
          <div className="flex items-center gap-2">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="px-3 py-1 rounded-md text-xs font-semibold text-white bg-[#00b8a3] hover:bg-[#00a390] transition shadow-2xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <span>🛡️</span>
              <span>{verifying ? 'Verifying...' : 'Verify Integrity'}</span>
            </button>
            <button
              onClick={handleTamperDemo}
              disabled={tampering}
              className="px-2.5 py-1 rounded-md text-xs font-medium border transition active:scale-95 disabled:opacity-50
                dark:bg-[#ff375f]/15 dark:border-[#ff375f]/40 dark:text-[#ff375f] dark:hover:bg-[#ff375f]/25
                bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
              title="Secretly tamper with SQLite record to demonstrate detection"
            >
              <span>🔨</span>
              <span>Tamper Demo</span>
            </button>
            <button
              onClick={handleRepair}
              disabled={tampering}
              className="px-2.5 py-1 rounded-md text-xs font-medium border transition active:scale-95 disabled:opacity-50
                dark:bg-[#333333] dark:border-[#404040] dark:text-gray-300 dark:hover:bg-[#3e3e3e]
                bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <span>🔧</span>
              <span>Repair</span>
            </button>
          </div>
        }
      />

      {/* ── Main Container ──────────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto w-full px-4 py-4 flex flex-col gap-4 flex-1">
        
        {/* Verification Result Banner (LeetCode Alert style) */}
        {verificationResult && (
          <div className={`p-3.5 rounded-lg border transition-colors shadow-xs animate-fadeIn ${
            verificationResult.valid
              ? 'dark:bg-[#00b8a3]/10 dark:border-[#00b8a3]/40 dark:text-[#00b8a3] bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'dark:bg-[#ff375f]/10 dark:border-[#ff375f]/40 dark:text-[#ff375f] bg-rose-50 border-rose-300 text-rose-900'
          }`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold">{verificationResult.valid ? '✓' : '⚠️'}</span>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    {verificationResult.valid ? 'Cryptographic Hash Chain Intact' : `Tampering Detected at Block #${verificationResult.brokenEventId}`}
                  </h3>
                  <p className="text-xs font-mono opacity-90 mt-0.5">
                    {verificationResult.valid
                      ? `All ${verificationResult.totalEvents} blocks verified against SHA-256(prev_hash + timestamp + type + payload). Zero tampering.`
                      : `${verificationResult.reason || 'Hash mismatch'}. Integrity broken at block #${verificationResult.brokenEventId}.`}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                verificationResult.valid
                  ? 'bg-[#00b8a3]/20 border-[#00b8a3]/40'
                  : 'bg-[#ff375f]/20 border-[#ff375f]/40'
              }`}>
                {verificationResult.valid ? 'VERIFIED INTACT' : 'COMPROMISED'}
              </span>
            </div>
          </div>
        )}

        {/* Tamper Notice */}
        {tamperNotice && (
          <div className="p-3 rounded-lg border text-xs flex items-center justify-between gap-3 dark:bg-amber-950/20 dark:border-amber-700/50 dark:text-amber-300 bg-amber-50 border-amber-200 text-amber-900">
            <span>{tamperNotice}</span>
            <button onClick={() => setTamperNotice(null)} className="font-bold px-2">✕</button>
          </div>
        )}

        {/* Toolbar & Filters (LeetCode Tag style) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg border transition-colors shadow-xs
          dark:bg-[#282828] dark:border-[#3e3e3e] bg-white border-gray-200">
          
          {/* Tag filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            {['ALL', 'candidate login', 'answer submission', 'incident created', 'incident resolved', 'decision made'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition whitespace-nowrap ${
                  filterType === type
                    ? 'bg-[#ffa116] text-white font-semibold shadow-2xs'
                    : 'dark:bg-[#202020] dark:border-[#383838] dark:text-gray-300 dark:hover:bg-[#2e2e2e] bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200 border'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder="Search id, type, hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md px-3 py-1.5 text-xs font-mono border transition focus:outline-none focus:border-[#ffa116]
                dark:bg-[#202020] dark:border-[#383838] dark:text-gray-200 dark:placeholder-gray-500
                bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400"
            />
          </div>
        </div>

        {/* ── Hash Chain Submissions Table (LeetCode exact table design) ──────── */}
        <div className="rounded-lg border overflow-hidden flex-1 shadow-xs transition-colors
          dark:bg-[#282828] dark:border-[#3e3e3e] bg-white border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b font-mono text-[11px] uppercase tracking-wider transition-colors
                  dark:border-[#383838] dark:bg-[#222222] dark:text-gray-400
                  bg-gray-50 border-gray-200 text-gray-500">
                  <th className="py-2.5 px-3.5 w-16">Block #</th>
                  <th className="py-2.5 px-3.5 w-32">Timestamp</th>
                  <th className="py-2.5 px-3.5 w-36">Event Type</th>
                  <th className="py-2.5 px-3.5 w-24">Centre</th>
                  <th className="py-2.5 px-3.5">Payload Preview</th>
                  <th className="py-2.5 px-3.5 w-32">Prev Hash</th>
                  <th className="py-2.5 px-3.5 w-32">Block Hash</th>
                  <th className="py-2.5 px-3 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono dark:divide-[#333333] divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-gray-400">
                      Loading cryptographic blocks...
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-gray-400">
                      No blocks match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map(evt => {
                    const badgeClass = TYPE_BADGE_STYLE[evt.type] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
                    return (
                      <tr key={evt.id} className="transition-colors dark:hover:bg-[#222222] hover:bg-gray-50">
                        <td className="py-2.5 px-3.5 font-bold dark:text-white text-gray-900">#{evt.id}</td>
                        <td className="py-2.5 px-3.5 text-[11px] dark:text-gray-400 text-gray-500">{formatTimestamp(evt.timestamp)}</td>
                        <td className="py-2.5 px-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${badgeClass}`}>
                            {evt.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 dark:text-gray-300 text-gray-700">{evt.centre_id || 'SYSTEM'}</td>
                        <td className="py-2.5 px-3.5 font-mono text-[11px] dark:text-gray-300 text-gray-600 truncate max-w-xs">
                          {typeof evt.payload === 'string' ? evt.payload : JSON.stringify(evt.payload)}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-[11px] dark:text-gray-400 text-gray-500">
                          {evt.prev_hash ? `${evt.prev_hash.slice(0, 10)}...` : '0000000000...'}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-[11px] text-[#ffa116] font-semibold">
                          {evt.hash ? `${evt.hash.slice(0, 10)}...` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setSelectedEvent(evt)}
                            className="px-2 py-0.5 rounded text-[11px] font-medium border transition
                              dark:bg-[#333] dark:border-[#404040] dark:text-gray-200 dark:hover:bg-[#3e3e3e]
                              bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
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
      </div>

      {/* Block Inspection Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xl w-full rounded-lg border p-5 shadow-2xl transition-colors
            dark:bg-[#282828] dark:border-[#3e3e3e] bg-white border-gray-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b dark:border-[#383838] border-gray-200">
              <h3 className="font-bold text-sm dark:text-white text-gray-900">
                Block #{selectedEvent.id} Details
              </h3>
              <button onClick={() => setSelectedEvent(null)} className="dark:text-gray-400 text-gray-500 hover:text-white font-bold">
                ✕
              </button>
            </div>
            <div className="py-4 space-y-3 font-mono text-xs">
              <div>
                <span className="text-gray-500 block text-[10px]">EVENT TYPE:</span>
                <span className="font-bold text-[#ffa116]">{selectedEvent.type}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">SHA-256 HASH:</span>
                <span className="text-[#00b8a3] break-all">{selectedEvent.hash}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">PREVIOUS HASH:</span>
                <span className="dark:text-gray-400 text-gray-600 break-all">{selectedEvent.prev_hash}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">PAYLOAD:</span>
                <pre className="p-2.5 rounded border dark:bg-[#202020] dark:border-[#333] bg-gray-50 border-gray-200 text-[11px] overflow-x-auto">
                  {typeof selectedEvent.payload === 'string'
                    ? selectedEvent.payload
                    : JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
