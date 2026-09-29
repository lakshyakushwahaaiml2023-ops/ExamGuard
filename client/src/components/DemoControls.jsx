/**
 * DemoControls — Interactive Simulation & Demonstration Control Panel
 * LeetCode theme styling with dark & light mode support.
 */

import React, { useState, useEffect } from 'react';
import socket from '../socket';

export default function DemoControls() {
  const [loadingAction, setLoadingAction] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [demoProgress, setDemoProgress] = useState(null);

  useEffect(() => {
    const onProgress = (data) => {
      setDemoProgress(data);
    };

    const onCompleted = () => {
      setActionFeedback('✓ Demonstration scenario completed successfully!');
      setTimeout(() => setActionFeedback(null), 5000);
    };

    socket.on('demo:progress', onProgress);
    socket.on('demo:completed', onCompleted);

    return () => {
      socket.off('demo:progress', onProgress);
      socket.off('demo:completed', onCompleted);
    };
  }, []);

  const triggerAction = async (actionKey, endpoint, body = {}) => {
    try {
      setLoadingAction(actionKey);
      setActionFeedback(null);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setActionFeedback(data.message || `Action executed: ${actionKey}`);
      } else {
        setActionFeedback(`Error: ${data.error || data.message || 'Action failed'}`);
      }
    } catch (err) {
      setActionFeedback(`Network error: ${err.message}`);
    } finally {
      setLoadingAction(null);
      setTimeout(() => setActionFeedback(null), 4500);
    }
  };

  return (
    <div className="rounded-lg border p-3.5 space-y-3 transition-colors shadow-xs
      dark:bg-[#282828] dark:border-[#3e3e3e] bg-white border-gray-200">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5
        dark:border-[#383838] border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-base text-[#ffa116]">⚡</span>
          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-wider dark:text-white text-gray-900">
              Demo Controls &amp; Fault Simulator
            </h4>
            <p className="text-[11px] dark:text-gray-400 text-gray-500">
              Interactive judge controls: trigger real-time faults, automated failovers, and ledger resets.
            </p>
          </div>
        </div>

        {actionFeedback && (
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full border animate-fadeIn
            dark:bg-[#00b8a3]/15 dark:border-[#00b8a3]/40 dark:text-[#00b8a3]
            bg-emerald-50 border-emerald-300 text-emerald-800">
            {actionFeedback}
          </span>
        )}
      </div>

      {/* Live Demo Progress Banner */}
      {demoProgress && (
        <div className="p-2.5 rounded-md border text-xs space-y-1.5 animate-pulse
          dark:bg-[#ffa116]/10 dark:border-[#ffa116]/30 dark:text-amber-200
          bg-amber-50 border-amber-200 text-amber-900">
          <div className="flex items-center justify-between font-bold text-[11px]">
            <span>🚀 Live Demo Running: Step {demoProgress.step}/5 — {demoProgress.title}</span>
            <span>{demoProgress.progressPercent}%</span>
          </div>
          <div className="w-full rounded-full h-1.5 overflow-hidden dark:bg-[#333] bg-amber-200">
            <div
              className="bg-[#ffa116] h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${demoProgress.progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] opacity-90">{demoProgress.details}</p>
        </div>
      )}

      {/* Button Controls Row (LeetCode button styling) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-0.5">
        {/* 1. Fail Power */}
        <button
          onClick={() => triggerAction('failPower', '/api/demo/fail-power', { centreId: 'centre-3' })}
          disabled={loadingAction !== null}
          className="px-3 py-1.5 rounded-md border text-xs font-semibold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50
            dark:bg-[#ff375f]/15 dark:hover:bg-[#ff375f]/25 dark:border-[#ff375f]/40 dark:text-[#ff375f]
            bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700"
          title="Cut power to Centre 3 to trigger automated failover"
        >
          <span>⚡</span>
          <span>{loadingAction === 'failPower' ? 'Triggering...' : 'Fail Power (C3)'}</span>
        </button>

        {/* 2. Spike Latency */}
        <button
          onClick={() => triggerAction('spikeLatency', '/api/demo/spike-latency', { centreId: 'centre-2' })}
          disabled={loadingAction !== null}
          className="px-3 py-1.5 rounded-md border text-xs font-semibold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50
            dark:bg-[#ffa116]/15 dark:hover:bg-[#ffa116]/25 dark:border-[#ffa116]/40 dark:text-[#ffa116]
            bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700"
          title="Spike latency on Centre 2 to trigger TriageAI warning"
        >
          <span>📶</span>
          <span>{loadingAction === 'spikeLatency' ? 'Spiking...' : 'Spike Latency (C2)'}</span>
        </button>

        {/* 3. Recover All */}
        <button
          onClick={() => triggerAction('recover', '/api/demo/recover', { centreId: 'all' })}
          disabled={loadingAction !== null}
          className="px-3 py-1.5 rounded-md border text-xs font-semibold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50
            dark:bg-[#00b8a3]/15 dark:hover:bg-[#00b8a3]/25 dark:border-[#00b8a3]/40 dark:text-[#00b8a3]
            bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700"
          title="Restore all centres to normal healthy operation"
        >
          <span>🔄</span>
          <span>{loadingAction === 'recover' ? 'Recovering...' : 'Recover All'}</span>
        </button>

        {/* 4. Run Full Demo (LeetCode Submit Green) */}
        <button
          onClick={() => triggerAction('runScenario', '/api/demo/run-scenario', { fast: true })}
          disabled={loadingAction !== null || demoProgress !== null}
          className="px-3 py-1.5 rounded-md text-xs font-bold text-white bg-[#00b8a3] hover:bg-[#00a390] transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
          title="Run the automated 5-step end-to-end resilience scenario"
        >
          <span>🚀</span>
          <span>{loadingAction === 'runScenario' ? 'Running...' : 'Run Full Demo'}</span>
        </button>

        {/* 5. Reset */}
        <button
          onClick={() => triggerAction('reset', '/api/demo/reset')}
          disabled={loadingAction !== null}
          className="px-3 py-1.5 rounded-md border text-xs font-semibold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 col-span-2 sm:col-span-1
            dark:bg-[#333333] dark:hover:bg-[#3e3e3e] dark:border-[#404040] dark:text-gray-200
            bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700"
          title="Wipe database back to fresh Genesis state"
        >
          <span>♻️</span>
          <span>{loadingAction === 'reset' ? 'Resetting...' : 'Reset System'}</span>
        </button>
      </div>
    </div>
  );
}
