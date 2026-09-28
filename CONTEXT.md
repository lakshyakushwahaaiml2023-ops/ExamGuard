# ExamGuard — Context & Brief

## Overview
**ExamGuard** is a hackathon MVP: a resilience and trust platform for large-scale computer-based exams.
All exam centres, candidate sessions, and anomalies are **SIMULATED** (no physical exam centres or live test-takers).

---

## Technology Stack
- **Backend:** Node.js 20, Express, Socket.IO, `better-sqlite3`
- **Frontend:** React, Vite, Tailwind CSS
- **Language:** Plain JavaScript (`.js` / `.jsx`), **no TypeScript**
- **Constraints:**
  - No Docker
  - No external APIs / third-party SaaS
  - No authentication (MVP speed and simplicity)

---

## Core Modules & Features

1. **Sentinel (Centre Health Monitoring)**
   - Simulates and monitors exam centre telemetry (connectivity, power, node heartbeats, workstation dropouts).
   - Real-time stream to the dashboard via Socket.IO.

2. **TriageAI (Incident Detection & Classification)**
   - Heuristic / rule-based anomaly detection (network jitter, mass disconnection, power failover, session stall).
   - Classifies incident severity: Low, Medium, High, Critical.

3. **Continuity (Session Checkpoint & Failover)**
   - Periodic candidate state checkpointing (current question, answers, remaining time, local drift).
   - Seamless failover/recovery simulation to restore a candidate's session without data loss.

4. **TrustLedger (SHA-256 Hash-Chained Event Log)**
   - Append-only audit log where each event is cryptographically linked to the previous block hash (`previousHash`, `timestamp`, `eventType`, `payload`, `hash`).
   - Ensures post-exam auditability and tamper detection.

5. **Decision Support (Operational Recommendations)**
   - Evaluates incident impact across impacted nodes/centres.
   - Recommends actionable responses:
     - `No Action`
     - `Partial Re-conduct` (for isolated affected candidate cohorts)
     - `Full Reschedule` (for severe or unrecoverable centre outages)

6. **Candidate Status Page**
   - Transparent, public-facing status page showing exam health, real-time announcements, and verification of session integrity.

---

## Development Principles & Rules
- **MVP-simple:** Favour working functionality over complex abstractions.
- **Small files:** Keep modular, readable, single-responsibility files.
- **In-code comments:** Add clear commentary explaining what each module does and why.
- **Self-contained:** Zero external cloud dependencies; runs locally with SQLite and standard npm scripts.
