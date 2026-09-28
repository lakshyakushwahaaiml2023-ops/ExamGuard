/**
 * DemoControls — Interactive Simulation & Demonstration Control Panel
 * ═══════════════════════════════════════════════════════════════════════════
 * Replaces CLI terminal commands with interactive buttons:
 *   - ⚡ Fail Power (Centre 3)   -> POST /api/demo/fail-power
 *   - 📶 Spike Latency (Centre 2) -> POST /api/demo/spike-latency
 *   - 🔄 Recover All             -> POST /api/demo/recover
 *   - 🚀 Run Full Demo           -> POST /api/demo/run-scenario
 *   - ♻️ Reset System            -> POST /api/demo/reset
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
    <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 shadow-lg backdrop-blur-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-500/20 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">🎮</span>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
              Demo Controls &amp; Fault Simulator
            </h4>
            <p className="text-[11px] text-slate-400">
              Trigger real-time faults, automated failovers, statutory adjudications, and integrity resets.
            </p>
          </div>
        </div>

        {actionFeedback && (
          <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full animate-fadeIn">
            {actionFeedback}
          </span>
        )}
      </div>

      {/* Live Demo Progress Banner */}
      {demoProgress && (
        <div className="p-2.5 rounded-xl bg-purple-950/50 border border-purple-500/40 text-xs space-y-1.5 animate-pulse">
          <div className="flex items-center justify-between font-bold text-purple-200 text-[11px]">
            <span>🚀 Live Demo Running: Step {demoProgress.step}/5 — {demoProgress.title}</span>
            <span>{demoProgress.progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${demoProgress.progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-300">{demoProgress.details}</p>
        </div>
      )}

      {/* Button Controls Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
        {/* 1. Fail Power */}
        <button
          onClick={() => triggerAction('failPower', '/api/demo/fail-power', { centreId: 'centre-3' })}
          disabled={loadingAction !== null}
          className="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-200 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
          title="Cut power to Centre 3 to trigger automated failover"
        >
          <span>⚡</span>
          <span>{loadingAction === 'failPower' ? 'Triggering...' : 'Fail Power (C3)'}</span>
        </button>

        {/* 2. Spike Latency */}
        <button
          onClick={() => triggerAction('spikeLatency', '/api/demo/spike-latency', { centreId: 'centre-2' })}
          disabled={loadingAction !== null}
          className="px-3 py-2 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 text-amber-200 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
          title="Spike latency on Centre 2 to trigger TriageAI warning"
        >
          <span>📶</span>
          <span>{loadingAction === 'spikeLatency' ? 'Spiking...' : 'Spike Latency (C2)'}</span>
        </button>

        {/* 3. Recover All */}
        <button
          onClick={() => triggerAction('recover', '/api/demo/recover', { centreId: 'all' })}
          disabled={loadingAction !== null}
          className="px-3 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-200 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
          title="Restore all centres to normal healthy operation"
        >
          <span>🔄</span>
          <span>{loadingAction === 'recover' ? 'Recovering...' : 'Recover All'}</span>
        </button>

        {/* 4. Run Full Demo */}
        <button
          onClick={() => triggerAction('runScenario', '/api/demo/run-scenario', { fast: true })}
          disabled={loadingAction !== null || demoProgress !== null}
          className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md shadow-purple-950/50 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
          title="Run the automated 5-step end-to-end resilience scenario"
        >
          <span>🚀</span>
          <span>{loadingAction === 'runScenario' ? 'Starting...' : 'Run Full Demo'}</span>
        </button>

        {/* 5. Reset */}
        <button
          onClick={() => triggerAction('reset', '/api/demo/reset')}
          disabled={loadingAction !== null}
          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 col-span-2 sm:col-span-1"
          title="Wipe database back to fresh Genesis state"
        >
          <span>♻️</span>
          <span>{loadingAction === 'reset' ? 'Resetting...' : 'Reset System'}</span>
        </button>
      </div>
    </div>
  );
}
