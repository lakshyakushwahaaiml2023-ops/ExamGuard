/**
 * DecisionsPage — /decisions Route
 * ═══════════════════════════════════════════════════════════════════════════
 * ExamGuard Decision Support System (DSS)
 *
 * Rules:
 *   1. > 30% of total candidates affected OR exam-wide issue -> "Full reschedule"
 *   2. Some unrecovered candidates (> 0 unrecovered)         -> "Partial re-conduct for affected candidates only"
 *   3. 0 unrecovered candidates AND disruption < 10 mins     -> "No re-conduct needed"
 *
 * Features:
 *   - Impact assessment breakdown: affected, recovered via failover, unrecovered, duration, scope.
 *   - Explicit reasoning list showing exact mathematical rules that fired.
 *   - Supporting TrustLedger evidence block links.
 *   - Approve / Override adjudication workflow with cryptographic ledger signing.
 *   - Real-time updates via Socket.IO.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import socket from '../socket';

const API = '';

const RECOMMENDATION_STYLES = {
  'No re-conduct needed': {
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    cardBorder: 'border-emerald-500/30 hover:border-emerald-500/60',
    icon: '✅',
    accent: 'text-emerald-400'
  },
  'Partial re-conduct for affected candidates only': {
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    cardBorder: 'border-amber-500/30 hover:border-amber-500/60',
    icon: '⚠️',
    accent: 'text-amber-400'
  },
  'Full reschedule': {
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    cardBorder: 'border-rose-500/30 hover:border-rose-500/60',
    icon: '🚨',
    accent: 'text-rose-400'
  }
};

const STATUS_STYLES = {
  'PENDING':    'bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse',
  'APPROVED':   'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  'OVERRIDDEN': 'bg-purple-500/20 text-purple-300 border-purple-500/40'
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
        setActionSuccess(`Decision ${decision.id} Approved & logged to TrustLedger.`);
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
        setActionSuccess(`Decision ${activeDecision.id} Overridden & signed to TrustLedger.`);
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
      setEvidenceModalOpen(true);
      const res = await fetch(`${API}/api/ledger/event/${ledgerId}`);
      if (res.ok) {
        const event = await res.json();
        setSelectedEvidence(event);
      } else {
        setSelectedEvidence({ id: ledgerId, error: 'Event not found in TrustLedger' });
      }
    } catch (err) {
      setSelectedEvidence({ id: ledgerId, error: err.message });
    } finally {
      setLoadingEvidence(false);
    }
  };

  // Stats calculation
  const totalDecisions = decisions.length;
  const noReconductCount = decisions.filter(d => (d.final_decision || d.recommendation) === 'No re-conduct needed').length;
  const partialCount = decisions.filter(d => (d.final_decision || d.recommendation) === 'Partial re-conduct for affected candidates only').length;
  const fullRescheduleCount = decisions.filter(d => (d.final_decision || d.recommendation) === 'Full reschedule').length;
  const pendingCount = decisions.filter(d => d.status === 'PENDING').length;

  // Filtered decisions list
  const filtered = decisions.filter(d => {
    if (filterRec !== 'ALL' && d.recommendation !== filterRec) return false;
    if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = d.id?.toLowerCase().includes(q);
      const matchCentre = d.centre_id?.toLowerCase().includes(q);
      const matchInc = d.incident_id?.toLowerCase().includes(q);
      if (!matchId && !matchCentre && !matchInc) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">⚖️</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">ExamGuard</h1>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase tracking-wide">
                DSS
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wide">
                Adjudication
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated Post-Incident Impact Assessment &amp; Statutory Recommendation Engine
            </p>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 ml-4 text-xs font-semibold">
            <Link to="/admin" className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition flex items-center gap-1">
              <span>🛡️</span>
              <span>Sentinel Grid</span>
            </Link>
            <Link to="/ledger" className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition flex items-center gap-1">
              <span>⛓️</span>
              <span>TrustLedger</span>
            </Link>
            <span className="px-3 py-1.5 rounded-lg bg-purple-600/80 text-white shadow-sm flex items-center gap-1">
              <span>⚖️</span>
              <span>Decision Support</span>
            </span>
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

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleEvaluate}
            disabled={evaluating}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition shadow-sm disabled:opacity-50"
            title="Scan database for resolved incidents without decisions and evaluate rule-based impact"
          >
            <span>{evaluating ? '⏳' : '🔄'}</span>
            <span>{evaluating ? 'Evaluating Incidents...' : 'Re-Evaluate Incidents'}</span>
          </button>
        </div>
      </header>

      {/* ── Toast Notification Banner ────────────────────────────────────────── */}
      {actionSuccess && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✨</span>
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ── Main Content Container ──────────────────────────────────────────── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Assessments</span>
            <span className="text-2xl font-black text-white mt-1">{totalDecisions}</span>
            <span className="text-[10px] text-slate-500 mt-0.5">Post-incident evaluations</span>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col">
            <span className="text-xs text-emerald-400 uppercase font-semibold">No Re-Conduct</span>
            <span className="text-2xl font-black text-emerald-300 mt-1">{noReconductCount}</span>
            <span className="text-[10px] text-emerald-500/80 mt-0.5">0 unrecovered, &lt;10m</span>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col">
            <span className="text-xs text-amber-400 uppercase font-semibold">Partial Re-Conduct</span>
            <span className="text-2xl font-black text-amber-300 mt-1">{partialCount}</span>
            <span className="text-[10px] text-amber-500/80 mt-0.5">Some unrecovered</span>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col">
            <span className="text-xs text-rose-400 uppercase font-semibold">Full Reschedule</span>
            <span className="text-2xl font-black text-rose-300 mt-1">{fullRescheduleCount}</span>
            <span className="text-[10px] text-rose-500/80 mt-0.5">&gt;30% affected or exam-wide</span>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-col">
            <span className="text-xs text-blue-400 uppercase font-semibold">Pending Review</span>
            <span className="text-2xl font-black text-blue-300 mt-1">{pendingCount}</span>
            <span className="text-[10px] text-blue-500/80 mt-0.5">Awaiting controller action</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <span className="text-xs text-slate-400 font-semibold mr-1">Filter:</span>
            {['ALL', 'No re-conduct needed', 'Partial re-conduct for affected candidates only', 'Full reschedule'].map(rec => (
              <button
                key={rec}
                onClick={() => setFilterRec(rec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterRec === rec
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
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
              className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500"
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
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500 w-full md:w-56"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center text-slate-500 text-sm">
            <span className="inline-block animate-spin mr-2">⚙️</span>
            Loading decision support assessments...
          </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400">
            <p className="text-base font-semibold mb-1">No Decision Records Found</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              When exam incidents are resolved, TriageAI and the Decision Support Engine automatically compute impact assessments here.
            </p>
            <button
              onClick={handleEvaluate}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition"
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
                className={`p-5 rounded-2xl bg-slate-900/80 border transition-all duration-200 ${recStyle.cardBorder}`}
              >
                {/* Header Row: Recommendation Badge, Status Badge & Incident Meta */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xl">{recStyle.icon}</span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${recStyle.badge}`}>
                      {decision.recommendation}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold border uppercase tracking-wider ${statusStyle}`}>
                      {decision.status}
                    </span>
                    {metrics.isExamWide ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
                        Exam-Wide Scope
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20 uppercase">
                        Centre-Level Scope
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span>Centre: <strong className="text-slate-200 uppercase">{decision.centre_id}</strong></span>
                    <span>•</span>
                    <span className="text-[11px] text-slate-500">{decision.incident_id}</span>
                  </div>
                </div>

                {/* Overridden Alert Box if status === OVERRIDDEN */}
                {decision.status === 'OVERRIDDEN' && (
                  <div className="mt-3 p-3 rounded-xl bg-purple-500/15 border border-purple-500/30 text-xs">
                    <div className="flex items-center justify-between font-bold text-purple-200 mb-1">
                      <span>⚖️ Adjudication Override Applied</span>
                      <span className="text-[10px] text-purple-400 font-mono">By: {decision.decided_by}</span>
                    </div>
                    <p className="text-slate-300 text-xs">
                      <strong className="text-purple-300">Statutory Justification:</strong> {decision.override_reason}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                      <span>Original Rule: <span className="line-through">{decision.recommendation}</span></span>
                      <span>➔</span>
                      <span className="text-emerald-300 font-bold">Final Ruling: {decision.final_decision}</span>
                    </div>
                  </div>
                )}

                {/* Approved Notice if status === APPROVED */}
                {decision.status === 'APPROVED' && (
                  <div className="mt-3 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between text-emerald-300">
                    <span className="font-semibold">✓ Rule-Based Recommendation Approved and Enforced</span>
                    <span className="text-[11px] text-emerald-400/80 font-mono">Signed by: {decision.decided_by || 'Controller'}</span>
                  </div>
                )}

                {/* ── Impact Assessment Metrics Grid ───────────────────────────── */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Affected Candidates</span>
                    <span className="text-base font-bold text-white mt-0.5">
                      {metrics.candidatesAffected ?? '—'}
                      <span className="text-xs text-slate-500 ml-1">({metrics.affectedPercentage ?? 0}%)</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Failover Recovered</span>
                    <span className="text-base font-bold text-emerald-400 mt-0.5">
                      {metrics.candidatesRecovered ?? '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Unrecovered</span>
                    <span className={`text-base font-bold mt-0.5 ${metrics.candidatesUnrecovered > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {metrics.candidatesUnrecovered ?? 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Disruption Duration</span>
                    <span className="text-base font-bold text-blue-300 mt-0.5">
                      {metrics.disruptionMinutes ?? 0} <span className="text-xs text-slate-400 font-normal">mins</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Answers Lost</span>
                    <span className="text-base font-bold text-emerald-400 mt-0.5">
                      {metrics.answersLost ?? 0}
                      <span className="text-[10px] text-emerald-500/80 ml-1 font-normal">(Zero-Loss)</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Outage Scope</span>
                    <span className="text-xs font-bold text-slate-200 mt-1 uppercase">
                      {metrics.isExamWide ? 'Exam-Wide' : 'Centre-Level'}
                    </span>
                  </div>
                </div>

                {/* ── Mathematical Reasoning Box ─────────────────────────────── */}
                <div className="mt-3.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1.5 flex items-center gap-1.5">
                    <span>📐</span>
                    <span>Rule Engine Evaluation &amp; Statutory Reasoning:</span>
                  </div>
                  <ul className="space-y-1">
                    {decision.reasoning?.map((reason, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-purple-400 font-bold">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ── Cryptographic Evidence & Adjudication Controls ─────────── */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* TrustLedger Evidence Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                      <span>⛓️</span>
                      <span>TrustLedger Proof:</span>
                    </span>
                    {evidenceIds.length > 0 ? (
                      evidenceIds.map(eid => (
                        <button
                          key={eid}
                          onClick={() => viewEvidenceBlock(eid)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 transition flex items-center gap-1"
                          title={`Click to inspect SHA-256 evidence block #${eid}`}
                        >
                          <span>Block #{eid}</span>
                          <span className="text-[9px] text-purple-400">🔍</span>
                        </button>
                      ))
                    ) : (
                      <Link
                        to="/ledger"
                        className="text-xs text-purple-400 hover:text-purple-300 underline font-mono"
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
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                        >
                          <span>✓</span>
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => openOverride(decision)}
                          className="px-3.5 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <span>✎</span>
                          <span>Override...</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openOverride(decision)}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
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
      </main>

      {/* ── Override Adjudication Modal ─────────────────────────────────────── */}
      {overrideModalOpen && activeDecision && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚖️</span>
                <h3 className="text-base font-bold text-white">Override Recommendation</h3>
              </div>
              <button
                onClick={() => setOverrideModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOverrideSubmit} className="mt-4 space-y-4">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                <span className="text-slate-400">Incident:</span> <strong className="text-slate-200 font-mono">{activeDecision.incident_id}</strong>
                <br />
                <span className="text-slate-400">Original Rule Recommendation:</span>{' '}
                <strong className="text-amber-300">{activeDecision.recommendation}</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Adjudicated Ruling:
                </label>
                <select
                  value={overrideRuling}
                  onChange={e => setOverrideRuling(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-purple-500"
                >
                  <option value="No re-conduct needed">No re-conduct needed</option>
                  <option value="Partial re-conduct for affected candidates only">Partial re-conduct for affected candidates only</option>
                  <option value="Full reschedule">Full reschedule</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Adjudicating Authority:
                </label>
                <input
                  type="text"
                  value={overrideOfficer}
                  onChange={e => setOverrideOfficer(e.target.value)}
                  placeholder="e.g. Chief Exam Controller Dr. Sharma"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mandatory Statutory Justification <span className="text-rose-400">*</span>:
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="State the regulatory, logistical, or grievance committee rationale justifying this deviation from the automated rule engine..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-purple-500 resize-none"
                />
                <span className="text-[10px] text-slate-500">
                  This justification and officer identity will be cryptographically hashed and logged to TrustLedger.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride || !overrideReason.trim()}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-md"
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">⛓️</span>
                <h3 className="text-base font-bold text-white">TrustLedger Cryptographic Evidence</h3>
              </div>
              <button
                onClick={() => setEvidenceModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {loadingEvidence ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Fetching cryptographic block from TrustLedger...
              </div>
            ) : selectedEvidence ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Block ID:</span>
                  <strong className="text-purple-300 font-mono">#{selectedEvidence.id}</strong>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Event Type:</span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[11px]">
                    {selectedEvidence.type || selectedEvidence.event_type}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="font-mono text-slate-300 text-[11px]">{selectedEvidence.timestamp}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block mb-1">SHA-256 Block Hash:</span>
                  <div className="p-2 rounded-lg bg-slate-950 font-mono text-[11px] text-purple-300 break-all border border-slate-800">
                    {selectedEvidence.hash || '—'}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block mb-1">Payload Content:</span>
                  <pre className="p-3 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 border border-slate-800 overflow-x-auto max-h-40">
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
                    className="text-xs text-purple-400 hover:text-purple-300 underline font-semibold"
                  >
                    Open in TrustLedger Explorer ➔
                  </Link>
                  <button
                    onClick={() => setEvidenceModalOpen(false)}
                    className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
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
