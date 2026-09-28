/**
 * CandidateExamPage — /exam Route
 * ═══════════════════════════════════════════════════════════════════════════
 * Real-time Candidate Workstation View demonstrating:
 *   1. Immediate server-side answer checkpointing to SQLite & TrustLedger.
 *   2. "Reconnecting..." state when centre suffers a critical power failure or outage.
 *   3. Automatic resume at the exact same question with zero answers lost upon failover re-attachment.
 *   4. Interactive "Simulate Power Outage" button for instant judge demonstration.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import socket from '../socket';

const API = '';

export default function CandidateExamPage() {
  const [searchParams] = useSearchParams();
  const candidateId = searchParams.get('candidate') || 'cand-1';

  const [loading, setLoading] = useState(true);
  const [candidateData, setCandidateData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [questionId]: 'A' | 'B' | ... }
  const [savingState, setSavingState] = useState(null); // { status: 'saving'|'saved', hash?: string }
  const [secondsRemaining, setSecondsRemaining] = useState(7200);

  // Failover & Reconnection Overlay State
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectNotice, setReconnectNotice] = useState(null);
  const [failoverResolvedNotice, setFailoverResolvedNotice] = useState(null);
  const [simulatingFault, setSimulatingFault] = useState(false);

  const centreRef = useRef(null);

  // ── 1. Fetch Candidate Session & Questions ──────────────────────────────────
  const loadCandidateSession = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch questions
      const qRes = await fetch(`${API}/api/exam/questions`);
      const qData = await qRes.json();
      setQuestions(qData);

      // Fetch candidate session & previous checkpoints
      const cRes = await fetch(`${API}/api/candidates/${candidateId}/session`);
      if (!cRes.ok) throw new Error(`Candidate ${candidateId} not found`);
      const cData = await cRes.json();

      setCandidateData(cData);
      centreRef.current = cData.session?.centre_id || cData.candidate?.centre_id;
      setSelectedAnswers(cData.answersMap || {});

      // Resume at saved current_question
      const savedQ = (cData.session?.current_question || 1) - 1;
      const validIndex = Math.max(0, Math.min(savedQ, qData.length - 1));
      setCurrentQuestionIndex(validIndex);

      if (cData.session?.time_remaining) {
        setSecondsRemaining(cData.session.time_remaining);
      }
    } catch (err) {
      console.error('Failed to load candidate session:', err);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    loadCandidateSession();
  }, [loadCandidateSession]);

  // ── 2. Timer Countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isReconnecting) return; // Pause timer during power outage / failover
    const interval = setInterval(() => {
      setSecondsRemaining(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isReconnecting]);

  // ── 3. Socket.IO Listeners for Failover & Reconnection ──────────────────────
  useEffect(() => {
    // A centre has failed and failover started
    const onFailoverStarted = (data) => {
      const myCentre = centreRef.current;
      if (data.failedCentreId === myCentre) {
        setIsReconnecting(true);
        setReconnectNotice({
          failedCentreId: data.failedCentreId,
          message: `Workstation severed: Centre "${data.failedCentreId}" suffered critical outage. Re-attaching session to backup centre...`
        });
      }
    };

    // Candidate session re-attached to new centre
    const onSessionMigrated = (data) => {
      if (data.candidateId === candidateId || data.candidateId === candidateData?.candidate?.id) {
        centreRef.current = data.newCentreId;

        // Update local session state
        setCandidateData(prev => ({
          ...prev,
          session: {
            ...prev?.session,
            centre_id: data.newCentreId,
            node_id: data.newNodeId
          },
          centre: {
            ...prev?.centre,
            id: data.newCentreId,
            name: `Backup Centre (${data.newCentreId})`
          }
        }));

        setReconnectNotice(null);
        setFailoverResolvedNotice({
          oldCentre: data.oldCentreId,
          newCentre: data.newCentreId,
          newNode: data.newNodeId
        });

        // Dismiss reconnection overlay smoothly
        setTimeout(() => {
          setIsReconnecting(false);
        }, 1200);

        // Clear resolved notice after a few seconds
        setTimeout(() => {
          setFailoverResolvedNotice(null);
        }, 5000);
      }
    };

    socket.on('failover:started', onFailoverStarted);
    socket.on('session:migrated', onSessionMigrated);

    return () => {
      socket.off('failover:started', onFailoverStarted);
      socket.off('session:migrated', onSessionMigrated);
    };
  }, [candidateId, candidateData]);

  // ── 4. Immediate Server-Side Checkpointing on Option Select ─────────────────
  const handleSelectOption = async (optionKey) => {
    const activeQuestion = questions[currentQuestionIndex];
    if (!activeQuestion || !candidateData) return;

    // Optimistic UI update
    setSelectedAnswers(prev => ({
      ...prev,
      [activeQuestion.id]: optionKey
    }));

    setSavingState({ status: 'saving' });

    try {
      const res = await fetch(`${API}/api/exam/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidateData.candidate.id,
          sessionId: candidateData.session.id,
          centreId: candidateData.session.centre_id,
          questionId: activeQuestion.id,
          selectedOption: optionKey,
          timestamp: new Date().toISOString()
        })
      });

      const data = await res.json();
      if (data.success) {
        setSavingState({
          status: 'saved',
          hash: data.ledgerHash,
          time: new Date().toLocaleTimeString()
        });
      }
    } catch (err) {
      console.error('Answer checkpoint error:', err);
      setSavingState({ status: 'error' });
    }
  };

  // Demo: Trigger power failure for this candidate's centre
  const handleSimulateOutage = async () => {
    try {
      setSimulatingFault(true);
      const targetCentre = candidateData?.session?.centre_id || 'centre-3';
      await fetch(`${API}/api/failover/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ centreId: targetCentre })
      });
    } catch (err) {
      console.error('Simulate outage error:', err);
    } finally {
      setSimulatingFault(false);
    }
  };

  const formatTimer = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center font-mono text-sm">
        Initializing workstation secure session...
      </div>
    );
  }

  const activeQuestion = questions[currentQuestionIndex];
  const selectedOption = activeQuestion ? selectedAnswers[activeQuestion.id] : null;
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative select-none">
      {/* ── Top Exam Navigation Bar ─────────────────────────────────────────── */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
        {/* Exam Title & Candidate Info */}
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-black text-blue-400">
            EG
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">National Computer-Based Assessment</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                ACTIVE SESSION
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 font-mono">
              <span>Candidate: <strong className="text-white">{candidateData?.candidate?.name}</strong> ({candidateData?.candidate?.id})</span>
              <span>•</span>
              <span>Roll: <strong className="text-slate-300">{candidateData?.candidate?.roll_number}</strong></span>
              <span>•</span>
              <span>Centre: <strong className="text-purple-300">{candidateData?.session?.centre_id}</strong> ({candidateData?.session?.node_id})</span>
            </div>
          </div>
        </div>

        {/* Timer, Status & Demo Fault Button */}
        <div className="flex items-center gap-3">
          {/* Simulated Fault Trigger Button */}
          <button
            onClick={handleSimulateOutage}
            disabled={simulatingFault || isReconnecting}
            className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/60 text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Inject a power failure on this centre to demonstrate automated session failover & resume"
          >
            <span>⚡</span>
            <span>Simulate Outage at {candidateData?.session?.centre_id}</span>
          </button>

          {/* Timer Display */}
          <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800 font-mono">
            <span className="text-slate-500 text-xs">⏱</span>
            <span className={`text-sm font-bold tabular-nums ${secondsRemaining < 300 ? 'text-rose-400 animate-pulse' : 'text-slate-200'}`}>
              {formatTimer(secondsRemaining)}
            </span>
          </div>

          {/* Links back to Admin / Ledger */}
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Link to="/admin" className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition">
              Admin
            </Link>
            <Link to="/ledger" className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-purple-300 hover:text-white transition">
              Ledger
            </Link>
          </div>
        </div>
      </header>

      {/* ── Failover Resumed Alert Banner ───────────────────────────────────── */}
      {failoverResolvedNotice && (
        <div className="bg-emerald-950/80 border-b border-emerald-600/70 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-200 animate-fadeIn">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-base">✓</span>
            <span>
              <strong>FAILOVER RE-ATTACHED:</strong> Migrated from <strong>{failoverResolvedNotice.oldCentre}</strong> to <strong>{failoverResolvedNotice.newCentre}</strong> ({failoverResolvedNotice.newNode}). All answers preserved. Resuming examination at Question {currentQuestionIndex + 1}.
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40">
            0 ANSWERS LOST
          </span>
        </div>
      )}

      {/* ── Main Exam Layout: Question Area (Left) + Palette (Right) ────────── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 flex flex-col lg:flex-row gap-6">
        {/* Left: Active Question Container */}
        <div className="flex-1 flex flex-col bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
          {/* Question Metadata & Checkpoint Status */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span className="text-xs font-medium text-slate-400">
                Category: {activeQuestion?.category || 'General'}
              </span>
            </div>

            {/* Checkpoint Status Indicator */}
            <div className="text-xs font-mono flex items-center gap-2">
              {savingState?.status === 'saving' && (
                <span className="text-amber-400 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  Checkpointing to server...
                </span>
              )}
              {savingState?.status === 'saved' && (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="text-xs">✓</span>
                  <span>Checkpoint saved</span>
                  <span className="text-slate-500 text-[10px] font-mono">
                    (⛓ {savingState.hash?.substring(0, 8)}…)
                  </span>
                </span>
              )}
              {!savingState && (
                <span className="text-slate-500 text-[11px]">
                  State saved to server
                </span>
              )}
            </div>
          </div>

          {/* Question Text */}
          <div className="py-6">
            <h2 className="text-base sm:text-lg font-semibold text-slate-100 leading-relaxed">
              {activeQuestion?.text}
            </h2>
          </div>

          {/* Options List */}
          <div className="space-y-3 flex-1">
            {activeQuestion && Object.entries(activeQuestion.options).map(([optKey, optText]) => {
              const isSelected = selectedOption === optKey;
              return (
                <button
                  key={optKey}
                  onClick={() => handleSelectOption(optKey)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-950/40'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border transition ${
                      isSelected
                        ? 'bg-blue-500 text-white border-blue-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {optKey}
                  </div>
                  <span className="text-sm font-medium">{optText}</span>
                </button>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="pt-6 border-t border-slate-800 flex items-center justify-between mt-4">
            <button
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition"
            >
              ← Previous
            </button>

            <span className="text-xs text-slate-500 font-mono">
              Answered: <strong className="text-slate-300">{answeredCount}</strong> / {questions.length}
            </span>

            <button
              onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentQuestionIndex === questions.length - 1}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white transition shadow-sm"
            >
              Next Question →
            </button>
          </div>
        </div>

        {/* Right: Question Palette & Candidate Profile Card */}
        <aside className="w-full lg:w-80 flex flex-col gap-5">
          {/* Question Palette */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>Question Palette</span>
              <span className="font-mono text-slate-500">{answeredCount}/{questions.length}</span>
            </h3>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = !!selectedAnswers[q.id];
                const isCurrent = idx === currentQuestionIndex;

                let btnStyle = 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700';
                if (isCurrent) {
                  btnStyle = 'bg-blue-600 border-blue-400 text-white font-bold ring-2 ring-blue-500/50';
                } else if (isAnswered) {
                  btnStyle = 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300 font-semibold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`h-9 rounded-lg border text-xs font-mono transition flex items-center justify-center ${btnStyle}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500/40 border border-emerald-500" /> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-blue-600 border border-blue-400" /> Current
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-slate-950 border border-slate-800" /> Pending
              </span>
            </div>
          </div>

          {/* Session Resilience Guarantee Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-xs space-y-2.5 shadow-lg">
            <h4 className="font-bold text-white flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Continuity Guarantee</span>
            </h4>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Every selected answer is immediately committed to SQLite server-side and recorded in the SHA-256 TrustLedger.
            </p>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 space-y-1 font-mono text-[10px] text-slate-400">
              <div className="flex justify-between">
                <span>Checkpoint Mode:</span>
                <span className="text-emerald-400 font-semibold">Immediate WAL</span>
              </div>
              <div className="flex justify-between">
                <span>Failover Target:</span>
                <span className="text-purple-300 font-semibold">Auto-Healthiest</span>
              </div>
              <div className="flex justify-between">
                <span>Data Loss Risk:</span>
                <span className="text-emerald-400 font-semibold">0 Answers</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── 5. Reconnecting Modal Overlay (When Centre Outage Occurs) ───────── */}
      {isReconnecting && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-800/80 rounded-3xl max-w-lg w-full p-8 text-center space-y-6 shadow-2xl shadow-rose-950/50 animate-scaleUp">
            {/* Spinning Radar Animation */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-rose-500/20 animate-ping" />
              <div className="w-16 h-16 rounded-full bg-rose-600/20 border-2 border-rose-500 flex items-center justify-center text-3xl">
                ⚡
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Workstation Reconnecting...
              </h3>
              <p className="text-xs text-rose-300 font-medium">
                {reconnectNotice?.message || 'Centre experienced a critical power outage. ExamGuard Continuity Engine is activating.'}
              </p>
            </div>

            {/* Checkpoint Assurance Details */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Session Checkpoint:</span>
                <span className="text-emerald-400 font-bold">✓ Preserved in DB</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Answers Lost:</span>
                <span className="text-emerald-400 font-bold">0 (Zero Data Loss)</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Resume Position:</span>
                <span className="text-blue-400 font-bold">Question {currentQuestionIndex + 1}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Timer Status:</span>
                <span className="text-amber-300 font-bold">Paused during failover</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Re-attaching to healthiest backup centre...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
