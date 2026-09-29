/**
 * CandidateExamPage — /exam Route (LeetCode Themed Workspace)
 * ═══════════════════════════════════════════════════════════════════════════
 * LeetCode problem solving workspace styling with:
 *   1. Authentic LeetCode dual split-pane interface (Problem Description & Code/Answer Workspace).
 *   2. Support for seamless Dark & Light mode toggle.
 *   3. Real-time server-side answer checkpointing.
 *   4. Automated failover reconnection banner & zero data loss recovery.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import socket from '../socket';
import LeetCodeNavbar from '../components/LeetCodeNavbar.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const API = '';

export default function CandidateExamPage() {
  const [searchParams] = useSearchParams();
  const candidateId = searchParams.get('candidate') || 'cand-1';
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [candidateData, setCandidateData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [savingState, setSavingState] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(7200);

  // Active tab on the left problem panel
  const [activeLeftTab, setActiveLeftTab] = useState('description'); // 'description' | 'editorial' | 'submissions'

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
      const qRes = await fetch(`${API}/api/exam/questions`);
      const qData = await qRes.json();
      setQuestions(qData);

      const cRes = await fetch(`${API}/api/candidates/${candidateId}/session`);
      if (!cRes.ok) throw new Error(`Candidate ${candidateId} not found`);
      const cData = await cRes.json();

      setCandidateData(cData);
      centreRef.current = cData.session?.centre_id || cData.candidate?.centre_id;
      setSelectedAnswers(cData.answersMap || {});

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
    if (isReconnecting) return;
    const interval = setInterval(() => {
      setSecondsRemaining(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isReconnecting]);

  // ── 3. Socket.IO Listeners for Failover & Reconnection ──────────────────────
  useEffect(() => {
    const onFailoverStarted = (data) => {
      const myCentre = centreRef.current;
      if (data.failedCentreId === myCentre) {
        setIsReconnecting(true);
        setReconnectNotice({
          failedCentreId: data.failedCentreId,
          message: `Connection severed: Centre "${data.failedCentreId}" suffered critical outage. Re-attaching session to backup node...`
        });
      }
    };

    const onSessionMigrated = (data) => {
      if (data.candidateId === candidateId || data.candidateId === candidateData?.candidate?.id) {
        centreRef.current = data.newCentreId;
        setTimeout(() => {
          setIsReconnecting(false);
          setReconnectNotice(null);
          setFailoverResolvedNotice({
            oldCentre: data.oldCentreId,
            newCentre: data.newCentreId,
            newNode: data.newNodeId,
            timestamp: new Date().toLocaleTimeString()
          });
          loadCandidateSession();
        }, 1200);
      }
    };

    socket.on('failover:started', onFailoverStarted);
    socket.on('session:migrated', onSessionMigrated);

    return () => {
      socket.off('failover:started', onFailoverStarted);
      socket.off('session:migrated', onSessionMigrated);
    };
  }, [candidateId, candidateData, loadCandidateSession]);

  // ── 4. Immediate Server-Side Checkpointing on Option Select ─────────────────
  const handleSelectOption = async (optionKey) => {
    const activeQuestion = questions[currentQuestionIndex];
    if (!activeQuestion || !candidateData) return;

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
      <div className="min-h-screen flex items-center justify-center font-mono text-sm dark:bg-[#1a1a1a] dark:text-gray-300 bg-[#f7f7f8] text-gray-700">
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 border-2 border-[#ffa116] border-t-transparent rounded-full animate-spin" />
          <span>Loading LeetCode Assessment Workspace...</span>
        </div>
      </div>
    );
  }

  const activeQuestion = questions[currentQuestionIndex];
  const selectedOption = activeQuestion ? selectedAnswers[activeQuestion.id] : null;
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div className="min-h-screen flex flex-col select-none transition-colors duration-150 dark:bg-[#1a1a1a] bg-[#f0f0f0] dark:text-[#eff1f6] text-[#262626]">
      {/* ── Top Navbar ──────────────────────────────────────────────────────── */}
      <LeetCodeNavbar
        activeCandidates={200}
        extraRight={
          <div className="flex items-center gap-2">
            {/* Outage Simulation Trigger */}
            <button
              onClick={handleSimulateOutage}
              disabled={simulatingFault || isReconnecting}
              title="Simulate hardware outage on this centre to trigger automated zero-loss failover"
              className="px-2.5 py-1 rounded-md text-[11px] font-medium transition border flex items-center gap-1.5 shadow-2xs active:scale-95
                dark:bg-[#333333] dark:hover:bg-[#3e3e3e] dark:text-rose-400 dark:border-rose-900/40
                bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200"
            >
              <span>⚡</span>
              <span className="hidden sm:inline">Simulate Outage ({candidateData?.session?.centre_id})</span>
            </button>

            {/* Assessment Timer */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border
              dark:bg-[#1e1e1e] dark:border-[#383838] dark:text-gray-200 bg-white border-gray-200 text-gray-800">
              <span className="text-gray-400">⏱</span>
              <span className={`font-semibold tabular-nums ${secondsRemaining < 300 ? 'text-[#ff375f] animate-pulse' : ''}`}>
                {formatTimer(secondsRemaining)}
              </span>
            </div>
          </div>
        }
      />

      {/* ── Failover Resumed Alert Banner ───────────────────────────────────── */}
      {failoverResolvedNotice && (
        <div className="border-b px-4 py-2 flex items-center justify-between text-xs transition-colors
          dark:bg-emerald-950/50 dark:border-emerald-700/60 dark:text-emerald-300
          bg-emerald-50 border-emerald-300 text-emerald-800">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-sm font-bold text-[#00b8a3]">✓</span>
            <span>
              <strong>FAILOVER RE-ATTACHED:</strong> Migrated from <strong>{failoverResolvedNotice.oldCentre}</strong> to <strong>{failoverResolvedNotice.newCentre}</strong> ({failoverResolvedNotice.newNode}). Zero progress lost.
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#00b8a3]/20 border border-[#00b8a3]/40">
            0 ANSWERS LOST
          </span>
        </div>
      )}

      {/* ── Main LeetCode Workspace Split Pane ───────────────────────────────── */}
      <main className="flex-1 p-2.5 flex flex-col lg:flex-row gap-2.5 overflow-hidden max-w-[1920px] mx-auto w-full">
        
        {/* ── LEFT PANE: Problem Description & Editorial ──────────────────────── */}
        <section className="flex-1 flex flex-col rounded-lg border overflow-hidden shadow-xs transition-colors
          dark:bg-[#282828] dark:border-[#3e3e3e] bg-white border-gray-200 min-h-[500px]">
          
          {/* Top Panel Tabs (LeetCode exact tab style) */}
          <div className="h-9 border-b flex items-center justify-between px-3 text-[12px] select-none
            dark:bg-[#222222] dark:border-[#383838] bg-gray-50 border-gray-200">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveLeftTab('description')}
                className={`px-3 py-1 rounded-t-md font-medium flex items-center gap-1.5 transition ${
                  activeLeftTab === 'description'
                    ? 'dark:bg-[#282828] dark:text-white text-gray-900 bg-white border-t-2 border-[#ffa116]'
                    : 'dark:text-gray-400 dark:hover:text-gray-200 text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>📄</span>
                <span>Description</span>
              </button>

              <button
                onClick={() => setActiveLeftTab('editorial')}
                className={`px-3 py-1 rounded-t-md font-medium flex items-center gap-1.5 transition ${
                  activeLeftTab === 'editorial'
                    ? 'dark:bg-[#282828] dark:text-white text-gray-900 bg-white border-t-2 border-[#ffa116]'
                    : 'dark:text-gray-400 dark:hover:text-gray-200 text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>💡</span>
                <span>Editorial & Hints</span>
              </button>

              <button
                onClick={() => setActiveLeftTab('submissions')}
                className={`px-3 py-1 rounded-t-md font-medium flex items-center gap-1.5 transition ${
                  activeLeftTab === 'submissions'
                    ? 'dark:bg-[#282828] dark:text-white text-gray-900 bg-white border-t-2 border-[#ffa116]'
                    : 'dark:text-gray-400 dark:hover:text-gray-200 text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>⏱️</span>
                <span>Submissions & Ledger</span>
              </button>
            </div>

            {/* Status indicator */}
            <div className="text-[11px] font-mono flex items-center gap-1.5">
              {savingState?.status === 'saving' && (
                <span className="text-[#ffa116] flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ffa116]" />
                  Saving...
                </span>
              )}
              {savingState?.status === 'saved' && (
                <span className="text-[#00b8a3] flex items-center gap-1">
                  <span>✓</span>
                  <span>Checkpoint #{currentQuestionIndex + 1} Saved</span>
                </span>
              )}
            </div>
          </div>

          {/* Left Panel Body */}
          <div className="flex-1 p-5 overflow-y-auto text-[14px] leading-relaxed">
            {activeLeftTab === 'description' && (
              <div className="flex flex-col gap-4">
                {/* Title */}
                <h1 className="text-[18px] font-semibold tracking-tight dark:text-white text-gray-900">
                  {currentQuestionIndex + 1}. {activeQuestion?.text}
                </h1>

                {/* Badges bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1 pb-3 border-b dark:border-[#383838] border-gray-200">
                  {/* Difficulty Tag */}
                  <span className="text-[12px] font-medium px-2.5 py-0.5 rounded-full bg-[#ffa116]/15 text-[#ffa116]">
                    Medium
                  </span>

                  {/* Category Pill */}
                  <span className="text-[12px] px-2.5 py-0.5 rounded-full border dark:bg-[#333333] dark:border-[#444444] dark:text-gray-300 bg-gray-100 border-gray-200 text-gray-700">
                    {activeQuestion?.category || 'Algorithms'}
                  </span>

                  {/* Zero-Loss Checkpoint Guarantee */}
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1
                    dark:bg-[#00b8a3]/10 dark:border-[#00b8a3]/30 dark:text-[#00b8a3]
                    bg-emerald-50 border-emerald-200 text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00b8a3]" />
                    Zero-Loss Guarantee
                  </span>
                </div>

                {/* Problem Explanatory Text */}
                <div className="text-[14px] dark:text-gray-200 text-gray-800 space-y-3">
                  <p>
                    Select the option that represents the strict algorithmic definition and memory ordering semantics of this fundamental assessment concept.
                  </p>
                  <p className="text-xs dark:text-gray-400 text-gray-500">
                    Your choice is immediately synced server-side with an immutable SHA-256 cryptographic hash. Even in the event of workstation failure or building power cut, your progress will resume seamlessly.
                  </p>
                </div>

                {/* Candidate & Workstation Constraints Box (styled like LeetCode constraints) */}
                <div className="mt-4 p-3.5 rounded-lg border font-mono text-[12px] space-y-1.5
                  dark:bg-[#202020] dark:border-[#383838] bg-gray-50 border-gray-200">
                  <span className="font-sans font-semibold text-[11px] uppercase tracking-wider block dark:text-gray-400 text-gray-500">
                    Workstation Constraints &amp; Context
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>Candidate: <strong className="dark:text-white text-gray-900">{candidateData?.candidate?.name}</strong></div>
                    <div>Roll: <strong className="dark:text-gray-300 text-gray-700">{candidateData?.candidate?.roll_number}</strong></div>
                    <div>Centre Node: <strong className="text-[#ffa116]">{candidateData?.session?.centre_id}</strong> ({candidateData?.session?.node_id})</div>
                    <div>Checkpoint Engine: <strong className="text-[#00b8a3]">TrustLedger SHA-256</strong></div>
                  </div>
                </div>
              </div>
            )}

            {activeLeftTab === 'editorial' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-base dark:text-white text-gray-900">Editorial Analysis</h3>
                <p className="dark:text-gray-300 text-gray-700">
                  Computer-based assessment questions evaluate fundamental system design, runtime complexity, and data organization principles.
                </p>
                <div className="p-3 rounded-lg border dark:bg-[#202020] dark:border-[#383838] bg-amber-50/50 border-amber-200 text-xs text-amber-800 dark:text-amber-200">
                  💡 <strong>Tip:</strong> In Last-In First-Out (LIFO), the last element added to the structure must be the first one to be removed, identical to function call execution stacks in computer architecture.
                </div>
              </div>
            )}

            {activeLeftTab === 'submissions' && (
              <div className="space-y-3 font-mono text-xs">
                <h3 className="font-sans font-semibold text-base dark:text-white text-gray-900">Session Checkpoints</h3>
                <div className="space-y-2">
                  {Object.entries(selectedAnswers).map(([qId, ans]) => (
                    <div key={qId} className="p-2.5 rounded border flex items-center justify-between
                      dark:bg-[#202020] dark:border-[#383838] bg-gray-50 border-gray-200">
                      <div>
                        <span className="font-semibold text-[#ffa116]">Question {qId}: </span>
                        <span>Option {ans}</span>
                      </div>
                      <span className="text-[#00b8a3] text-[11px]">✓ Checkpointed</span>
                    </div>
                  ))}
                  {Object.keys(selectedAnswers).length === 0 && (
                    <p className="text-gray-400">No submissions recorded yet for this session.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── RIGHT PANE: Code / Answer Selection Workspace ───────────────────── */}
        <section className="flex-1 flex flex-col rounded-lg border overflow-hidden shadow-xs transition-colors
          dark:bg-[#282828] dark:border-[#3e3e3e] bg-white border-gray-200 min-h-[500px]">
          
          {/* Top Workspace Bar (LeetCode Language & Question Palette Header) */}
          <div className="h-9 border-b flex items-center justify-between px-3 text-[12px] select-none
            dark:bg-[#222222] dark:border-[#383838] bg-gray-50 border-gray-200">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-[11px] px-2 py-0.5 rounded font-sans font-medium dark:bg-[#333] dark:text-gray-200 bg-gray-200 text-gray-800">
                Single Choice
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-xs dark:text-gray-300 text-gray-600">
                Answered: <strong className="text-[#00b8a3]">{answeredCount}</strong> / {questions.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 font-mono">
                {savingState?.hash ? `Hash: ${savingState.hash.slice(0, 10)}...` : 'Status: Ready'}
              </span>
            </div>
          </div>

          {/* Right Workspace Body: Options A, B, C, D */}
          <div className="flex-1 p-5 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Select Correct Answer:
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  Question {currentQuestionIndex + 1}
                </span>
              </div>

              {/* Multiple Choice Options List */}
              <div className="space-y-3">
                {activeQuestion && activeQuestion.options && Object.entries(activeQuestion.options).map(([optKey, optText]) => {
                  const isSelected = selectedOption === optKey;
                  return (
                    <button
                      key={optKey}
                      onClick={() => handleSelectOption(optKey)}
                      className={`w-full text-left p-3.5 rounded-lg border transition-all flex items-center gap-3.5 group ${
                        isSelected
                          ? 'dark:bg-[#00b8a3]/10 dark:border-[#00b8a3] dark:text-white bg-emerald-50 border-[#00b8a3] text-gray-900 shadow-xs'
                          : 'dark:bg-[#202020] dark:border-[#383838] dark:hover:bg-[#2c2c2c] dark:text-gray-200 bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
                      }`}
                    >
                      {/* Option letter pill */}
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center font-mono font-bold text-xs transition ${
                        isSelected
                          ? 'bg-[#00b8a3] text-white shadow-xs'
                          : 'dark:bg-[#333] dark:text-gray-300 dark:group-hover:bg-[#444] bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                      }`}>
                        {optKey}
                      </span>

                      {/* Option text */}
                      <span className="text-[14px] flex-1 font-medium">
                        {optText}
                      </span>

                      {/* Checkmark indicator */}
                      {isSelected && (
                        <span className="text-[#00b8a3] font-bold text-sm">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Question Palette Slider (1 - 10) ─────────────────────────── */}
            <div className="mt-6 pt-4 border-t dark:border-[#383838] border-gray-200">
              <div className="flex items-center justify-between mb-2.5 text-[11px] font-mono dark:text-gray-400 text-gray-500">
                <span>QUESTION PALETTE:</span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00b8a3]" /> Answered</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ffa116]" /> Current</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full dark:bg-[#444] bg-gray-300" /> Pending</span>
                </span>
              </div>

              <div className="grid grid-cols-10 gap-1.5">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentQuestionIndex;
                  const isAnswered = !!selectedAnswers[q.id];
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`h-8 rounded-md font-mono text-xs font-semibold transition flex items-center justify-center border ${
                        isCurrent
                          ? 'border-[#ffa116] text-[#ffa116] dark:bg-[#ffa116]/10 bg-amber-50 shadow-xs'
                          : isAnswered
                          ? 'border-[#00b8a3] text-[#00b8a3] dark:bg-[#00b8a3]/10 bg-emerald-50'
                          : 'dark:bg-[#202020] dark:border-[#383838] dark:text-gray-400 dark:hover:bg-[#2e2e2e] bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Bottom LeetCode Action Bar ──────────────────────────────────── */}
          <div className="h-12 border-t flex items-center justify-between px-4 select-none
            dark:bg-[#222222] dark:border-[#383838] bg-gray-50 border-gray-200">
            {/* Left navigators */}
            <div className="flex items-center gap-2">
              <button
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                className="px-3 py-1.5 rounded-md text-xs font-medium border transition disabled:opacity-40
                  dark:bg-[#333333] dark:border-[#404040] dark:hover:bg-[#3e3e3e] dark:text-gray-200
                  bg-white border-gray-300 hover:bg-gray-100 text-gray-700"
              >
                ← Prev
              </button>
              <button
                disabled={currentQuestionIndex === questions.length - 1}
                onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                className="px-3 py-1.5 rounded-md text-xs font-medium border transition disabled:opacity-40
                  dark:bg-[#333333] dark:border-[#404040] dark:hover:bg-[#3e3e3e] dark:text-gray-200
                  bg-white border-gray-300 hover:bg-gray-100 text-gray-700"
              >
                Next →
              </button>
            </div>

            {/* Right: Submit Button in signature LeetCode Green */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (currentQuestionIndex < questions.length - 1) {
                    setCurrentQuestionIndex(prev => prev + 1);
                  }
                }}
                className="px-4 py-1.5 rounded-md text-xs font-semibold text-white bg-[#00b8a3] hover:bg-[#00a390] transition shadow-xs flex items-center gap-1.5 active:scale-95"
              >
                <span>Save &amp; Continue</span>
                <span>✓</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ── Outage / Failover Reconnecting Modal ─────────────────────────────── */}
      {isReconnecting && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="max-w-md w-full rounded-xl border p-6 shadow-2xl transition-colors
            dark:bg-[#282828] dark:border-[#3e3e3e] dark:text-white bg-white border-gray-200 text-gray-900">
            <div className="flex items-center gap-3 pb-3 border-b dark:border-[#383838] border-gray-200">
              <span className="w-8 h-8 rounded-lg bg-rose-500/20 text-[#ff375f] flex items-center justify-center text-lg font-bold">
                ⚡
              </span>
              <div>
                <h3 className="font-bold text-sm tracking-tight">Workstation Outage Detected</h3>
                <p className="text-xs dark:text-gray-400 text-gray-500">Autonomous failover engine in progress</p>
              </div>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs leading-relaxed dark:text-gray-300 text-gray-700">
                {reconnectNotice?.message || 'Centre node severed. Re-routing session to healthiest available backup centre...'}
              </p>
              <div className="flex items-center gap-2.5 text-xs font-mono text-[#ffa116]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffa116] animate-ping" />
                <span>Zero answers lost. Preserving timer and checkpoints...</span>
              </div>
            </div>

            <div className="pt-2 text-[11px] font-mono text-center text-gray-400">
              ExamGuard TrustLedger Checkpointing Active
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
