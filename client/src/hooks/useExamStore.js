/**
 * useExamStore – Central Socket.IO data hook
 * Manages live telemetry, centres, incidents with acknowledgement,
 * and live candidate submission activities.
 */
import { useState, useEffect, useCallback } from 'react';
import socket from '../socket';

const API = '';

export default function useExamStore() {
  const [connected, setConnected]         = useState(socket.connected);
  const [centres, setCentres]             = useState({});
  const [incidents, setIncidents]         = useState([]);
  const [candidateActivity, setActivity]  = useState([]);
  const [ledgerCount, setLedgerCount]     = useState(0);

  // ── Manual Acknowledge Function ─────────────────────────────────────────────
  const acknowledgeIncident = useCallback(async (incidentId) => {
    try {
      const res = await fetch(`${API}/api/incidents/${incidentId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success && data.incident) {
        setIncidents(prev =>
          prev.map(i => i.id === incidentId ? { ...i, ...data.incident, status: 'acknowledged' } : i)
        );
      }
    } catch {
      // Fallback: emit via socket
      socket.emit('incident:acknowledge', { incidentId });
    }
  }, []);

  useEffect(() => {
    // 1. Initial fetch of centres
    fetch(`${API}/api/centres`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        data.forEach(c => { map[c.id] = { ...c, activeCandidates: 40 }; });
        setCentres(map);
      })
      .catch(() => {});

    // 2. Initial fetch of incidents
    fetch(`${API}/api/incidents`)
      .then(r => r.json())
      .then(data => setIncidents(data))
      .catch(() => {});

    // 3. Initial fetch of ledger count
    fetch(`${API}/api/ledger?limit=1`)
      .then(r => r.json())
      .then(data => setLedgerCount(data.length > 0 ? data[0].id : 0))
      .catch(() => {});

    // ── Socket listeners ──────────────────────────────────────────────────────
    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    // Telemetry tick
    const onTelemetry = (data) => {
      setCentres(prev => ({
        ...prev,
        [data.centreId]: {
          ...(prev[data.centreId] || {}),
          status: data.powerStatus === 'FAIL' || data.powerStatus === false
            ? 'offline'
            : data.latency > 300
            ? 'degraded'
            : 'active',
          telemetry: data,
        }
      }));
    };

    // TriageAI: New incident opened
    const onIncidentNew = (inc) => {
      setIncidents(prev => {
        // Prevent duplicates
        if (prev.some(item => item.id === inc.id)) return prev;
        return [inc, ...prev.slice(0, 49)];
      });
    };

    // TriageAI: Incident acknowledged
    const onIncidentAcknowledged = (updated) => {
      setIncidents(prev =>
        prev.map(i => i.id === updated.id ? { ...i, ...updated, status: 'acknowledged' } : i)
      );
    };

    // TriageAI: Incident resolved
    const onIncidentResolved = (res) => {
      setIncidents(prev =>
        prev.map(i => i.id === res.id ? { ...i, status: 'resolved', resolved_at: res.resolved_at || new Date().toISOString() } : i)
      );
    };

    // Candidate answer submitted
    const onCandidateUpdate = (update) => {
      setActivity(prev => [update, ...prev.slice(0, 19)]);
      setLedgerCount(n => n + 1);
    };

    // Failover lifecycle listeners
    const onFailoverStarted = (data) => {
      setFailoverState({ status: 'in_progress', ...data });
    };

    const onFailoverCompleted = (data) => {
      setFailoverState({ status: 'completed', ...data });
    };

    socket.on('connect',               onConnect);
    socket.on('disconnect',            onDisconnect);
    socket.on('telemetry:update',      onTelemetry);
    socket.on('incident:new',          onIncidentNew);
    socket.on('incident:acknowledged', onIncidentAcknowledged);
    socket.on('incident:resolved',     onIncidentResolved);
    socket.on('candidate:update',      onCandidateUpdate);
    socket.on('failover:started',      onFailoverStarted);
    socket.on('failover:completed',    onFailoverCompleted);

    // Initial fetch of latest failover status
    fetch(`${API}/api/failover/latest`)
      .then(r => r.json())
      .then(data => {
        if (data && (data.failed_centre_id || (data.status && data.status !== 'idle'))) {
          setFailoverState({ status: 'completed', ...data });
        }
      })
      .catch(() => {});

    return () => {
      socket.off('connect',               onConnect);
      socket.off('disconnect',            onDisconnect);
      socket.off('telemetry:update',      onTelemetry);
      socket.off('incident:new',          onIncidentNew);
      socket.off('incident:acknowledged', onIncidentAcknowledged);
      socket.off('incident:resolved',     onIncidentResolved);
      socket.off('candidate:update',      onCandidateUpdate);
      socket.off('failover:started',      onFailoverStarted);
      socket.off('failover:completed',    onFailoverCompleted);
    };
  }, []);

  const [failoverState, setFailoverState] = useState(null);

  const dismissFailoverSummary = useCallback(() => {
    setFailoverState(null);
  }, []);

  // Derived metrics
  const totalActiveCandidates = Object.keys(centres).length * 40;
  const offlineCentres  = Object.values(centres).filter(c => c.status === 'offline').length;
  const degradedCentres = Object.values(centres).filter(c => c.status === 'degraded').length;
  const openIncidents   = incidents.filter(i => (i.status || '').toLowerCase() === 'open').length;
  const activeIncidents = incidents.filter(i => {
    const s = (i.status || '').toLowerCase();
    return s === 'open' || s === 'acknowledged';
  }).length;

  return {
    connected,
    centres,
    incidents,
    candidateActivity,
    ledgerCount,
    totalActiveCandidates,
    offlineCentres,
    degradedCentres,
    activeIncidents,
    openIncidents,
    acknowledgeIncident,
    failoverState,
    dismissFailoverSummary
  };
}
