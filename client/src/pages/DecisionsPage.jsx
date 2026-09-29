/**
 * DecisionsPage — /decisions Route (LeetCode Themed Decision Support System)
 * ═══════════════════════════════════════════════════════════════════════════
 * LeetCode styled automated post-incident impact assessment and statutory
 * recommendation engine with dark/light mode toggle.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import socket from '../socket';
import LeetCodeNavbar from '../components/LeetCodeNavbar.jsx';

const API = '';

const RECOMMENDATION_STYLES = {
  'No re-conduct needed': {
    badge: 'dark:bg-[#00b8a3]/15 bg-teal-50 dark:text-[#00b8a3] text-teal-700 dark:border-[#00b8a3]/30 border-teal-200',
    cardBorder: 'hover:border-[#00b8a3]/60',
    icon: '✅',
    accent: 'text-[#00b8a3]'
  },
  'Partial re-conduct for affected candidates only': {
    badge: 'dark:bg-[#ffa116]/15 bg-amber-50 dark:text-[#ffa116] text-amber-700 dark:border-[#ffa116]/30 border-amber-200',
    cardBorder: 'hover:border-[#ffa116]/60',
    icon: '⚠️',
    accent: 'text-[#ffa116]'
  },
  'Full reschedule': {
    badge: 'dark:bg-[#ff375f]/15 bg-rose-50 dark:text-[#ff375f] text-rose-700 dark:border-[#ff375f]/30 border-rose-200',
    cardBorder: 'hover:border-[#ff375f]/60',
    icon: '🚨',
    accent: 'text-[#ff375f]'
  }
};

const STATUS_STYLES = {
  'PENDING':    'dark:bg-blue-500/15 bg-blue-50 dark:text-blue-400 text-blue-700 dark:border-blue-500/30 border-blue-200 animate-pulse',
  'APPROVED':   'dark:bg-[#00b8a3]/15 bg-teal-50 dark:text-[#00b8a3] text-teal-700 dark:border-[#00b8a3]/30 border-teal-200',
  'OVERRIDDEN': 'dark:bg-purple-500/15 bg-purple-50 dark:text-purple-400 text-purple-700 dark:border-purple-500/30 border-purple-200'
};

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [filterRec, setFilterRec] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState(null);

  // Override Modal state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [activeDecision, setActiveDecision] = useState(null);
  const [overrideRuling, setOverrideRuling] = useState('Partial re-conduct for affected candidates only');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideOfficer, setOverrideOfficer] = useState('Chief Exam Controller');
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Evidence Modal state
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  // Load all decisions
  const loadDecisions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/decisions`);
      const data = await res.json();
      setDecisions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load decisions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDecisions();

    const onDecisionCreated = (newDec) => {
      setDecisions(prev => {
        const filtered = prev.filter(d => d.id !== newDec.id);
        return [newDec, ...filtered];
      });
    };

    const onDecisionUpdated = (updDec) => {
      setDecisions(prev => prev.map(d => d.id === updDec.id ? updDec : d));
    };

    socket.on('decision:created', onDecisionCreated);
    socket.on('decision:updated', onDecisionUpdated);

    return () => {
      socket.off('decision:created', onDecisionCreated);
      socket.off('decision:updated', onDecisionUpdated);
    };
  }, [loadDecisions]);

  // Trigger evaluation of all resolved incidents
  const handleEvaluate = async () => {
    try {
      setEvaluating(true);
      const res = await fetch(`${API}/api/decisions/evaluate`, { method: 'POST' });
      const data = await res.json();
      if (data.decisions) {
        setDecisions(data.decisions);
        setActionSuccess(`Evaluated ${data.count} resolved incidents successfully.`);
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err) {
      console.error('Evaluation failed:', err);
    } finally {
      setEvaluating(false);
    }
  };

  // Approve decision
  const handleApprove = async (decision) => {
    try {
      const res = await fetch(`${API}/api/decisions/${decision.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decidedBy: 'Chief Exam Controller' })
      });
      const data = await res.json();
      if (data.success) {
        setDecisions(prev => prev.map(d => d.id === decision.id ? data.decision : d));
        setActionSuccess(`Decision #${decision.id} Approved & cryptographically logged to TrustLedger.`);
        setTimeout(() => setActionSuccess(null), 5000);
      }
    } catch (err) {
      alert('Approval failed: ' + err.message);
    }
  };

  // Open Override Modal
  const openOverride = (decision) => {
    setActiveDecision(decision);
    setOverrideRuling(
      decision.recommendation === 'No re-conduct needed'
        ? 'Partial re-conduct for affected candidates only'
        : 'No re-conduct needed'
    );
    setOverrideReason('');
    setOverrideModalOpen(true);
  };

  // Submit Override
  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      alert('Please provide a mandatory statutory reason for the override.');
      return;
    }

    try {
      setSubmittingOverride(true);
      const res = await fetch(`${API}/api/decisions/${activeDecision.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDecision: overrideRuling,
          reason: overrideReason.trim(),
          decidedBy: overrideOfficer.trim() || 'Chief Exam Controller'
        })
      });
      const data = await res.json();
      if (data.success) {
        setDecisions(prev => prev.map(d => d.id === activeDecision.id ? data.decision : d));
        setOverrideModalOpen(false);
        setActionSuccess(`Decision #${activeDecision.id} Overridden & signed to TrustLedger.`);
        setTimeout(() => setActionSuccess(null), 5000);
      } else {
        alert('Override error: ' + data.error);
      }
    } catch (err) {
      alert('Override failed: ' + err.message);
    } finally {
      setSubmittingOverride(false);
    }
  };

  // View Evidence Block details
  const viewEvidenceBlock = async (ledgerId) => {
    try {
      setLoadingEvidence(true);
      setSelectedEvidence(null);
      setEvidenceModalOpen(true);
      const res = await fetch(`${API}/api/ledger/event/${ledgerId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedEvidence(data.event || data);
      }
    } catch (err) {
      console.error('Failed to load evidence block:', err);
    } finally {
      setLoadingEvidence(false);
    }
  };

  // Filtered decisions list
  const filtered = decisions.filter(d => {
    const matchesRec = filterRec === 'ALL' || d.recommendation === filterRec;
    const matchesStatus = filterStatus === 'ALL' || d.status === filterStatus;
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      (d.centre_id || '').toLowerCase().includes(query) ||
      (d.incident_id || '').toLowerCase().includes(query) ||
      (d.recommendation || '').toLowerCase().includes(query);
    return matchesRec && matchesStatus && matchesSearch;
  });

  const totalDecisions = decisions.length;
  const noReconductCount = decisions.filter(d => d.recommendation === 'No re-conduct needed').length;
  const partialCount = decisions.filter(d => d.recommendation === 'Partial re-conduct for affected candidates only').length;
  const fullRescheduleCount = decisions.filter(d => d.recommendation === 'Full reschedule').length;
  const pendingCount = decisions.filter(d => d.status === 'PENDING').length;

  return (
    <div className="min-h-screen flex flex-col select-none transition-colors duration-150 dark:bg-[#1a1a1a] bg-[#f7f7f8] dark:text-[#eff1f6] text-[#262626]">
      {/* ── LeetCode Top Navigation ──────────────────────────────────────────── */}
      <LeetCodeNavbar
        extraRight={
          <div className="flex items-center gap-2">
            <button
              onClick={handleEvaluate}
              disabled={evaluating}
              className="px-3 py-1 rounded-md text-xs font-semibold text-white bg-[#00b8a3] hover:bg-[#00a390] transition shadow-2xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              title="Scan database for resolved incidents without decisions and evaluate rule-based impact"
            >
              <span>{evaluating ? '⏳' : '🔄'}</span>
              <span>{evaluating ? 'Evaluating...' : 'Re-Evaluate Incidents'}</span>
            </button>
          </div>
        }
      />

      {/* ── Main Content Container ──────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto w-full px-4 py-4 flex flex-col gap-4 flex-1">
        {/* Toast Notification Banner */}
        {actionSuccess && (
          <div className="p-3 rounded-lg border flex items-center justify-between text-xs font-medium dark:bg-[#00b8a3]/15 dark:border-[#00b8a3]/40 dark:text-[#00b8a3] bg-teal-50 border-teal-200 text-teal-800">
            <div className="flex items-center gap-2">
              <span>✨</span>
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="dark:text-[#00b8a3] hover:text-white font-bold">✕</button>
          </div>
        )}

        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1 border-b dark:border-[#282828] border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">Statutory Decision Support System (DSS)</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full dark:bg-[#ffa116]/15 dark:text-[#ffa116] bg-amber-50 text-amber-700 border dark:border-[#ffa116]/30 border-amber-200 font-mono">
                RULE ENGINE ACTIVE
              </span>
            </div>
            <p className="text-xs dark:text-gray-400 text-gray-500 mt-0.5">
              Automated post-incident mathematical impact evaluations &amp; legally defensible adjudication workflows.
            </p>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 flex flex-col shadow-2xs">
            <span className="text-[11px] dark:text-gray-400 text-gray-500 uppercase font-semibold">Total Assessments</span>
            <span className="text-2xl font-bold font-mono mt-1">{totalDecisions}</span>
            <span className="text-[10px] dark:text-gray-500 text-gray-400 mt-0.5">Post-incident evaluations</span>
          </div>
          <div className="p-3.5 rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 flex flex-col shadow-2xs">
            <span className="text-[11px] text-[#00b8a3] uppercase font-semibold">No Re-Conduct</span>
            <span className="text-2xl font-bold font-mono text-[#00b8a3] mt-1">{noReconductCount}</span>
            <span className="text-[10px] dark:text-gray-500 text-gray-400 mt-0.5">0 unrecovered, &lt;10m</span>
          </div>
          <div className="p-3.5 rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 flex flex-col shadow-2xs">
            <span className="text-[11px] text-[#ffa116] uppercase font-semibold">Partial Re-Conduct</span>
            <span className="text-2xl font-bold font-mono text-[#ffa116] mt-1">{partialCount}</span>
            <span className="text-[10px] dark:text-gray-500 text-gray-400 mt-0.5">Some unrecovered</span>
          </div>
          <div className="p-3.5 rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 flex flex-col shadow-2xs">
            <span className="text-[11px] text-[#ff375f] uppercase font-semibold">Full Reschedule</span>
            <span className="text-2xl font-bold font-mono text-[#ff375f] mt-1">{fullRescheduleCount}</span>
            <span className="text-[10px] dark:text-gray-500 text-gray-400 mt-0.5">&gt;30% affected or exam-wide</span>
          </div>
          <div className="p-3.5 rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 flex flex-col shadow-2xs">
            <span className="text-[11px] text-blue-400 uppercase font-semibold">Pending Review</span>
            <span className="text-2xl font-bold font-mono text-blue-400 mt-1">{pendingCount}</span>
            <span className="text-[10px] dark:text-gray-500 text-gray-400 mt-0.5">Awaiting controller action</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 shadow-2xs">
          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
            <span className="text-xs dark:text-gray-400 text-gray-500 font-medium mr-1">Filter:</span>
            {['ALL', 'No re-conduct needed', 'Partial re-conduct for affected candidates only', 'Full reschedule'].map(rec => (
              <button
                key={rec}
                onClick={() => setFilterRec(rec)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  filterRec === rec
                    ? 'dark:bg-[#333333] bg-gray-200 dark:text-white text-gray-900 font-semibold'
                    : 'dark:text-gray-400 text-gray-600 hover:dark:bg-[#202020] hover:bg-gray-100'
                }`}
              >
                {rec === 'ALL' ? 'All Rules' : rec.split(' ')[0] + ' ' + (rec.split(' ')[1] || '')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="dark:bg-[#1a1a1a] bg-gray-50 border dark:border-[#3e3e3e] border-gray-300 text-xs dark:text-gray-200 text-gray-800 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[#ffa116]"
            >
              <option value="ALL">Status: All</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="OVERRIDDEN">Overridden</option>
            </select>

            <input
              type="text"
              placeholder="Search centre, incident ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="dark:bg-[#1a1a1a] bg-gray-50 border dark:border-[#3e3e3e] border-gray-300 text-xs dark:text-gray-200 text-gray-800 placeholder-gray-400 rounded-md px-3 py-1.5 focus:outline-none focus:border-[#ffa116] w-full md:w-56"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center dark:text-gray-400 text-gray-500 text-sm">
            <span className="inline-block animate-spin mr-2">⚙️</span>
            Loading decision support assessments...
          </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <div className="p-12 text-center rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 dark:text-gray-300 text-gray-600">
            <p className="text-base font-semibold mb-1">No Decision Records Found</p>
            <p className="text-xs dark:text-gray-400 text-gray-500 max-w-md mx-auto mb-4">
              When exam incidents are resolved, TriageAI and the Decision Support Engine automatically compute impact assessments here.
            </p>
            <button
              onClick={handleEvaluate}
              className="px-4 py-2 bg-[#00b8a3] hover:bg-[#00a390] text-white rounded-md text-xs font-semibold transition"
            >
              Scan &amp; Evaluate Past Incidents
            </button>
          </div>
        )}

        {/* ── Decision Cards List ────────────────────────────────────────────── */}
        <div className="space-y-4">
          {filtered.map(decision => {
            const recStyle = RECOMMENDATION_STYLES[decision.recommendation] || RECOMMENDATION_STYLES['No re-conduct needed'];
            const statusStyle = STATUS_STYLES[decision.status] || STATUS_STYLES['PENDING'];
            const metrics = decision.metrics || {};
            const evidenceIds = decision.evidence_ledger_ids || [];

            return (
              <div
                key={decision.id}
                className={`p-5 rounded-lg dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-200 transition-all duration-150 shadow-2xs ${recStyle.cardBorder}`}
              >
                {/* Header Row: Recommendation Badge, Status Badge & Incident Meta */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b dark:border-[#333333] border-gray-100">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-lg">{recStyle.icon}</span>
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${recStyle.badge}`}>
                      {decision.recommendation}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border uppercase tracking-wider ${statusStyle}`}>
                      {decision.status}
                    </span>
                    {metrics.isExamWide ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold dark:bg-[#ff375f]/15 bg-rose-50 dark:text-[#ff375f] text-rose-700 border dark:border-[#ff375f]/30 border-rose-200 uppercase">
                        Exam-Wide Scope
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold dark:bg-blue-500/10 bg-blue-50 dark:text-blue-400 text-blue-700 border dark:border-blue-500/20 border-blue-200 uppercase">
                        Centre-Level Scope
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs dark:text-gray-400 text-gray-500 font-mono">
                    <span>Centre: <strong className="dark:text-gray-200 text-gray-800 uppercase">{decision.centre_id}</strong></span>
                    <span>•</span>
                    <span className="text-[11px] dark:text-gray-500 text-gray-400">{decision.incident_id}</span>
                  </div>
                </div>

                {/* Overridden Alert Box if status === OVERRIDDEN */}
                {decision.status === 'OVERRIDDEN' && (
                  <div className="mt-3 p-3 rounded-md dark:bg-purple-500/10 bg-purple-50 border dark:border-purple-500/30 border-purple-200 text-xs">
                    <div className="flex items-center justify-between font-bold dark:text-purple-300 text-purple-800 mb-1">
                      <span>⚖️ Adjudication Override Applied</span>
                      <span className="text-[10px] dark:text-purple-400 text-purple-600 font-mono">By: {decision.decided_by}</span>
                    </div>
                    <p className="dark:text-gray-300 text-gray-700 text-xs">
                      <strong className="dark:text-purple-300 text-purple-700">Statutory Justification:</strong> {decision.override_reason}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] dark:text-gray-400 text-gray-500">
                      <span>Original Rule: <span className="line-through">{decision.recommendation}</span></span>
                      <span>➔</span>
                      <span className="text-[#00b8a3] font-bold">Final Ruling: {decision.final_decision}</span>
                    </div>
                  </div>
                )}

                {/* Approved Notice if status === APPROVED */}
                {decision.status === 'APPROVED' && (
                  <div className="mt-3 px-3 py-2 rounded-md dark:bg-[#00b8a3]/10 bg-teal-50 border dark:border-[#00b8a3]/20 border-teal-200 text-xs flex items-center justify-between text-[#00b8a3]">
                    <span className="font-semibold">✓ Rule-Based Recommendation Approved and Enforced</span>
                    <span className="text-[11px] opacity-80 font-mono">Signed by: {decision.decided_by || 'Controller'}</span>
                  </div>
                )}

                {/* ── Impact Assessment Metrics Grid ───────────────────────────── */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  <div className="p-2.5 rounded-md dark:bg-[#202020] bg-gray-50 border dark:border-[#333333] border-gray-200 flex flex-col">
                    <span className="text-[10px] dark:text-gray-400 text-gray-500 uppercase font-semibold">Affected Candidates</span>
                    <span className="text-base font-bold dark:text-white text-gray-900 mt-0.5 font-mono">
                      {metrics.candidatesAffected ?? '—'}
                      <span className="text-xs dark:text-gray-500 text-gray-400 ml-1 font-normal">({metrics.affectedPercentage ?? 0}%)</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-md dark:bg-[#202020] bg-gray-50 border dark:border-[#333333] border-gray-200 flex flex-col">
                    <span className="text-[10px] dark:text-gray-400 text-gray-500 uppercase font-semibold">Failover Recovered</span>
                    <span className="text-base font-bold text-[#00b8a3] mt-0.5 font-mono">
                      {metrics.candidatesRecovered ?? '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-md dark:bg-[#202020] bg-gray-50 border dark:border-[#333333] border-gray-200 flex flex-col">
                    <span className="text-[10px] dark:text-gray-400 text-gray-500 uppercase font-semibold">Unrecovered</span>
                    <span className={`text-base font-bold mt-0.5 font-mono ${metrics.candidatesUnrecovered > 0 ? 'text-[#ff375f]' : 'dark:text-gray-300 text-gray-700'}`}>
                      {metrics.candidatesUnrecovered ?? 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-md dark:bg-[#202020] bg-gray-50 border dark:border-[#333333] border-gray-200 flex flex-col">
                    <span className="text-[10px] dark:text-gray-400 text-gray-500 uppercase font-semibold">Disruption Duration</span>
                    <span className="text-base font-bold text-blue-400 mt-0.5 font-mono">
                      {metrics.disruptionMinutes ?? 0} <span className="text-xs dark:text-gray-400 text-gray-500 font-normal">mins</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-md dark:bg-[#202020] bg-gray-50 border dark:border-[#333333] border-gray-200 flex flex-col">
                    <span className="text-[10px] dark:text-gray-400 text-gray-500 uppercase font-semibold">Answers Lost</span>
                    <span className="text-base font-bold text-[#00b8a3] mt-0.5 font-mono">
                      {metrics.answersLost ?? 0}
                      <span className="text-[10px] text-[#00b8a3]/80 ml-1 font-normal">(Zero-Loss)</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-md dark:bg-[#202020] bg-gray-50 border dark:border-[#333333] border-gray-200 flex flex-col">
                    <span className="text-[10px] dark:text-gray-400 text-gray-500 uppercase font-semibold">Outage Scope</span>
                    <span className="text-xs font-bold dark:text-gray-200 text-gray-800 mt-1 uppercase font-mono">
                      {metrics.isExamWide ? 'Exam-Wide' : 'Centre-Level'}
                    </span>
                  </div>
                </div>

                {/* ── Mathematical Reasoning Box ─────────────────────────────── */}
                <div className="mt-3.5 p-3 rounded-md dark:bg-[#202020] bg-gray-50 border dark:border-[#333333] border-gray-200">
                  <div className="text-[11px] uppercase tracking-wider dark:text-gray-400 text-gray-500 font-bold mb-1.5 flex items-center gap-1.5">
                    <span>📐</span>
                    <span>Rule Engine Evaluation &amp; Statutory Reasoning:</span>
                  </div>
                  <ul className="space-y-1">
                    {decision.reasoning?.map((reason, idx) => (
                      <li key={idx} className="text-xs dark:text-gray-300 text-gray-700 flex items-start gap-2">
                        <span className="text-[#ffa116] font-bold">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ── Cryptographic Evidence & Adjudication Controls ─────────── */}
                <div className="mt-4 pt-3 border-t dark:border-[#333333] border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* TrustLedger Evidence Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium dark:text-gray-400 text-gray-500 flex items-center gap-1">
                      <span>⛓️</span>
                      <span>TrustLedger Proof:</span>
                    </span>
                    {evidenceIds.length > 0 ? (
                      evidenceIds.map(eid => (
                        <button
                          key={eid}
                          onClick={() => viewEvidenceBlock(eid)}
                          className="px-2.5 py-1 rounded text-[11px] font-mono dark:bg-[#1a1a1a] bg-gray-100 hover:border-[#ffa116] border dark:border-[#3e3e3e] border-gray-300 dark:text-gray-200 text-gray-800 transition flex items-center gap-1"
                          title={`Click to inspect SHA-256 evidence block #${eid}`}
                        >
                          <span>Block #{eid}</span>
                          <span className="text-[9px] text-[#ffa116]">🔍</span>
                        </button>
                      ))
                    ) : (
                      <Link
                        to="/ledger"
                        className="text-xs text-[#ffa116] hover:underline font-mono"
                      >
                        View Full Ledger Audit Trail ➔
                      </Link>
                    )}
                  </div>

                  {/* Adjudication Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {decision.status === 'PENDING' ? (
                      <>
                        <button
                          onClick={() => handleApprove(decision)}
                          className="px-4 py-1.5 rounded-md bg-[#00b8a3] hover:bg-[#00a390] text-white text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 active:scale-95"
                        >
                          <span>✓</span>
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => openOverride(decision)}
                          className="px-3.5 py-1.5 rounded-md border text-xs font-semibold transition active:scale-95 flex items-center gap-1.5
                            dark:border-[#ffa116]/40 dark:bg-[#ffa116]/10 dark:text-[#ffa116] dark:hover:bg-[#ffa116]/20
                            border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        >
                          <span>✎</span>
                          <span>Override...</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openOverride(decision)}
                        className="px-3 py-1 rounded-md text-xs font-medium border transition
                          dark:bg-[#333333] dark:border-[#404040] dark:text-gray-300 dark:hover:bg-[#3e3e3e]
                          bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
                      >
                        Re-Adjudicate / Override
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Override Adjudication Modal ─────────────────────────────────────── */}
      {overrideModalOpen && activeDecision && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-300 rounded-lg max-w-lg w-full p-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b dark:border-[#3e3e3e] border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚖️</span>
                <h3 className="text-sm font-bold dark:text-white text-gray-900">Override Recommendation</h3>
              </div>
              <button
                onClick={() => setOverrideModalOpen(false)}
                className="dark:text-gray-400 text-gray-500 hover:dark:text-white hover:text-black text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOverrideSubmit} className="mt-4 space-y-4">
              <div className="p-3 rounded-md dark:bg-[#202020] bg-gray-50 border dark:border-[#333333] border-gray-200 text-xs">
                <span className="dark:text-gray-400 text-gray-500">Incident:</span> <strong className="dark:text-gray-200 text-gray-800 font-mono">{activeDecision.incident_id}</strong>
                <br />
                <span className="dark:text-gray-400 text-gray-500">Original Rule Recommendation:</span>{' '}
                <strong className="text-[#ffa116]">{activeDecision.recommendation}</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1">
                  New Adjudicated Ruling:
                </label>
                <select
                  value={overrideRuling}
                  onChange={e => setOverrideRuling(e.target.value)}
                  className="w-full dark:bg-[#1a1a1a] bg-gray-50 border dark:border-[#3e3e3e] border-gray-300 dark:text-gray-200 text-gray-800 text-xs rounded-md p-2.5 focus:outline-none focus:border-[#ffa116]"
                >
                  <option value="No re-conduct needed">No re-conduct needed</option>
                  <option value="Partial re-conduct for affected candidates only">Partial re-conduct for affected candidates only</option>
                  <option value="Full reschedule">Full reschedule</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1">
                  Adjudicating Authority:
                </label>
                <input
                  type="text"
                  value={overrideOfficer}
                  onChange={e => setOverrideOfficer(e.target.value)}
                  placeholder="e.g. Chief Exam Controller Dr. Sharma"
                  className="w-full dark:bg-[#1a1a1a] bg-gray-50 border dark:border-[#3e3e3e] border-gray-300 dark:text-gray-200 text-gray-800 text-xs rounded-md p-2.5 focus:outline-none focus:border-[#ffa116]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold dark:text-gray-300 text-gray-700 mb-1">
                  Mandatory Statutory Justification <span className="text-[#ff375f]">*</span>:
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="State the regulatory, logistical, or grievance committee rationale justifying this deviation from the automated rule engine..."
                  className="w-full dark:bg-[#1a1a1a] bg-gray-50 border dark:border-[#3e3e3e] border-gray-300 dark:text-gray-200 text-gray-800 text-xs rounded-md p-2.5 focus:outline-none focus:border-[#ffa116] resize-none"
                />
                <span className="text-[10px] dark:text-gray-500 text-gray-400 mt-1 block">
                  This justification and officer identity will be cryptographically hashed and logged to TrustLedger.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-[#3e3e3e] border-gray-200">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-md dark:bg-[#333333] bg-gray-200 dark:text-gray-300 text-gray-700 hover:dark:bg-[#3e3e3e] hover:bg-gray-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride || !overrideReason.trim()}
                  className="px-4 py-1.5 rounded-md bg-[#ffa116] hover:bg-[#e59114] disabled:opacity-50 text-white text-xs font-semibold transition shadow-2xs"
                >
                  {submittingOverride ? 'Signing to Ledger...' : 'Commit Override to TrustLedger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Cryptographic Evidence Modal ───────────────────────────────────── */}
      {evidenceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="dark:bg-[#282828] bg-white border dark:border-[#3e3e3e] border-gray-300 rounded-lg max-w-lg w-full p-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b dark:border-[#3e3e3e] border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">⛓️</span>
                <h3 className="text-sm font-bold dark:text-white text-gray-900">TrustLedger Cryptographic Evidence</h3>
              </div>
              <button
                onClick={() => setEvidenceModalOpen(false)}
                className="dark:text-gray-400 text-gray-500 hover:dark:text-white hover:text-black text-sm"
              >
                ✕
              </button>
            </div>

            {loadingEvidence ? (
              <div className="py-8 text-center dark:text-gray-400 text-gray-500 text-xs">
                Fetching cryptographic block from TrustLedger...
              </div>
            ) : selectedEvidence ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="dark:text-gray-400 text-gray-500">Block ID:</span>
                  <strong className="text-[#ffa116] font-mono">#{selectedEvidence.id}</strong>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="dark:text-gray-400 text-gray-500">Event Type:</span>
                  <span className="px-2 py-0.5 rounded dark:bg-blue-500/20 bg-blue-50 text-blue-500 font-mono text-[11px]">
                    {selectedEvidence.type || selectedEvidence.event_type}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="dark:text-gray-400 text-gray-500">Timestamp:</span>
                  <span className="font-mono dark:text-gray-300 text-gray-700 text-[11px]">{selectedEvidence.timestamp}</span>
                </div>

                <div>
                  <span className="text-xs dark:text-gray-400 text-gray-500 block mb-1">SHA-256 Block Hash:</span>
                  <div className="p-2 rounded-md dark:bg-[#1a1a1a] bg-gray-100 font-mono text-[11px] dark:text-[#eff1f6] text-gray-900 break-all border dark:border-[#3e3e3e] border-gray-200">
                    {selectedEvidence.hash || '—'}
                  </div>
                </div>

                <div>
                  <span className="text-xs dark:text-gray-400 text-gray-500 block mb-1">Payload Content:</span>
                  <pre className="p-3 rounded-md dark:bg-[#1a1a1a] bg-gray-100 font-mono text-[11px] dark:text-gray-300 text-gray-800 border dark:border-[#3e3e3e] border-gray-200 overflow-x-auto max-h-40">
                    {typeof selectedEvidence.payload === 'string'
                      ? (() => {
                          try {
                            return JSON.stringify(JSON.parse(selectedEvidence.payload), null, 2);
                          } catch {
                            return selectedEvidence.payload;
                          }
                        })()
                      : JSON.stringify(selectedEvidence.payload, null, 2)}
                  </pre>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <Link
                    to="/ledger"
                    className="text-xs text-[#ffa116] hover:underline font-semibold"
                  >
                    Open in TrustLedger Explorer ➔
                  </Link>
                  <button
                    onClick={() => setEvidenceModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-md dark:bg-[#333333] bg-gray-200 dark:text-gray-200 text-gray-800 hover:dark:bg-[#3e3e3e] hover:bg-gray-300 text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
