# ExamGuard 🛡️
### Resilience and Trust Platform for High-Stakes Computer-Based Examinations (CBT)

ExamGuard is an autonomous, mission-critical resilience platform designed to safeguard large-scale computer-based exams against infrastructure breakdowns, power outages, network degradations, and integrity disputes.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph EdgeCentres["Examination Centres (Simulated Nodes)"]
        C1["Centre 1 (North Campus)<br/>40 Workstations"]
        C2["Centre 2 (South Campus)<br/>40 Workstations"]
        C3["Centre 3 (East Cyber Centre)<br/>40 Workstations"]
        C4["Centre 4 (West Tech Hub)<br/>40 Workstations"]
        C5["Centre 5 (Central Exam Hall)<br/>40 Workstations"]
    end

    subgraph SentinelCore["ExamGuard Sentinel Core (Node.js & Express)"]
        Telemetry["Telemetry Ingestion<br/>(CPU, RAM, Latency, Power, Heartbeats)"]
        TriageAI["TriageAI Engine<br/>• Rolling Z-Score Anomaly Detector<br/>• Latency Spike (3x &gt; 500ms)<br/>• Missed Heartbeats (3x)"]
        Continuity["Continuity & Failover Engine<br/>• Zero-Loss Server Checkpointing<br/>• Healthiest Backup Selector<br/>• Auto Session Re-attachment"]
        DSS["Decision Support System (DSS)<br/>• Impact Assessment & Rule Engine<br/>• Statutory Rationale Generator<br/>• Controller Approve / Override"]
        Ledger["TrustLedger Module<br/>• SHA-256 Hash-Chained Blocks<br/>• Tamper Detection & Repair<br/>• Full Cryptographic Audit Trail"]
        DB[("SQLite Database<br/>(WAL Mode, Foreign Keys)")]
    end

    subgraph ClientInterfaces["Web Interfaces (React + Vite + Tailwind)"]
        AdminUI["Sentinel Dashboard<br/>/admin"]
        CandidateUI["Candidate Workstation<br/>/exam?candidate=cand-1"]
        StatusUI["Public Status Portal<br/>/status (Mobile-Friendly)"]
        LedgerUI["TrustLedger Explorer<br/>/ledger"]
        DecisionUI["Decision Support Console<br/>/decisions"]
    end

    EdgeCentres -->|Socket.IO Telemetry & Answers| Telemetry
    Telemetry --> TriageAI
    TriageAI -->|Incident Raised / Recovered| DB
    TriageAI -->|Trigger Failover on Critical| Continuity
    TriageAI -->|Auto-Evaluate on Resolution| DSS
    Continuity -->|Re-route Sessions & Preserve Time| DB
    Continuity -->|Log Failover Events| Ledger
    DSS -->|Log Adjudications| Ledger
    Ledger -->|Append Block: SHA-256(prev_hash + ts + type + payload)| DB

    SentinelCore -->|Real-time Socket.IO Broadcasts| ClientInterfaces
```

---

## 🚀 Quick Setup & Installation

### Prerequisites
- **Node.js** (v18.0 or higher recommended)
- **npm** (v9.0 or higher)

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/your-org/examguard.git
cd examguard

# Install root dependencies (Express, better-sqlite3, socket.io, puppeteer)
npm install

# Install client dependencies (React, Vite, Tailwind CSS, Lucide)
npm run client:install
```

### 2. Initialize / Reset Database
Populates 5 examination centres, 200 registered candidates with active exam sessions, questions, and the cryptographic TrustLedger Genesis block:
```bash
npm run reset
# or: npm run seed:reset
```

### 3. Run the Platform
To run all services concurrently in development mode:
```bash
npm run dev
```

Or run each service independently in separate terminals:
```bash
# Terminal 1 — Backend Server (Port 4000)
npm start

# Terminal 2 — Telemetry & Candidate Simulation Daemon
npm run simulator

# Terminal 3 — Frontend Web Application (Port 3000)
npm run client
```

---

## 🌐 Web Interfaces & Portals

| Portal | URL | Purpose & Audience |
| :--- | :--- | :--- |
| **Sentinel Operations Grid** | `http://localhost:3000/admin` | Live 5-centre telemetry cards, incident feed with escalation targets, failover alerts, and acknowledge actions. |
| **Candidate Public Status** | `http://localhost:3000/status` | Public, mobile-friendly status page (no login). Real-time overall status, auto-generated plain-language updates timeline, and per-centre health. |
| **TrustLedger Explorer** | `http://localhost:3000/ledger` | Visual SHA-256 hash-chain explorer with interactive "Verify Integrity" audit button, tamper demonstration, and repair tool. |
| **Decision Support System** | `http://localhost:3000/decisions` | Post-incident impact assessments, automated statutory rule evaluations, TrustLedger cryptographic evidence modal, and Approve/Override workflow. |
| **Candidate Workstation** | `http://localhost:3000/exam?candidate=cand-1` | Live exam interface with zero-loss answer saving, reconnecting overlay, and automated session resumption with remaining time preserved. |

---

## 🎬 Automated 3-Minute Live Demo

Run the entire end-to-end multi-module resilience scenario with a single command:

```bash
npm run demo
```

*(Tip: To run the scenario in accelerated mode for rapid verification, pass `--fast`:)*
```bash
node demo/run.js --fast
```

### Demo Script Timeline & Milestones:

```
[0:00 - 0:30] STEP 1 — Normal Examination Baseline
              • All 5 exam centres operating at baseline health (CPU ~20%, Latency ~15ms).
              • 200 candidate workstations actively submitting answers with zero data loss.
              • TrustLedger continuously appending SHA-256 blocks for every response.

[0:30 - 1:00] STEP 2 — Latency Spike on Centre-2 (Warning / Degraded)
              • Injects simulated network degradation on Centre-2 (>700ms).
              • TriageAI raises WARNING incident with escalation target "Centre Administrator".
              • Incident is acknowledged by admin; network recovers and incident auto-resolves.

[1:00 - 1:45] STEP 3 — Critical Power Failure on Centre-3 (Failover & Recovery)
              • Main grid power cuts on Centre-3 (Coastal Bay Cyber Centre).
              • TriageAI detects powerStatus=FAIL and raises CRITICAL incident.
              • Continuity Engine automatically identifies healthiest standby centre (e.g. Centre-1/Centre-5).
              • Re-attaches all 40 candidate sessions with 0 answers lost and remaining time intact.
              • Power restored; incident auto-resolves.

[1:45 - 2:15] STEP 4 — Decision Support Impact Assessment & Adjudication
              • DSS calculates impact: 40 affected, 40 recovered, 0 unrecovered, duration < 10m.
              • Rule 3 fires: "No re-conduct needed".
              • Displays explicit reasoning with numbers and TrustLedger evidence blocks.
              • Exam Controller approves decision; signed "decision made" block logged to ledger.

[2:15 - 3:00] STEP 5 — Cryptographic TrustLedger Tamper Attempt & Detection
              • Secretly injects unauthorized payload modification directly into past SQLite record.
              • Full chain integrity check detects tampering at exact block ID with SHA-256 mismatch.
              • Chain repair recomputes valid hashes and restores cryptographic integrity to 100%.
```

---

## 🔄 Clean Reset

To wipe all active incidents, failover logs, candidate answers, and temporary states back to the clean genesis state at any time:
```bash
npm run reset
```

---

## ⚙️ Key API Endpoints

### Telemetry & Simulation
- `POST /api/sim/command` — Inject/recover simulated faults:
  - `{"command": "spike latency centre-2"}`
  - `{"command": "fail power centre-3"}`
  - `{"command": "recover centre-3"}`
  - `{"command": "recover all"}`

### TriageAI & Incidents
- `GET /api/incidents` — List all open, acknowledged, and resolved incidents.
- `POST /api/incidents/:id/acknowledge` — Manual admin acknowledgement.

### Continuity & Failover
- `POST /api/failover/trigger` — Trigger failover for a faulted centre.
- `GET /api/candidate/session` — Fetch active candidate session with saved answers and time remaining.
- `POST /api/candidate/answer` — Save answer server-side immediately and append to TrustLedger.

### TrustLedger
- `GET /api/ledger` — List paginated ledger blocks.
- `GET /api/ledger/event/:id` — Inspect specific cryptographic block.
- `GET /api/ledger/verify` — Recalculates whole SHA-256 chain from genesis. Returns `{ valid, brokenEventId }`.
- `POST /api/ledger/tamper-demo` — Secretly alter a past block's payload in SQLite for demo.
- `POST /api/ledger/repair` — Restores cryptographic chain continuity.

### Decision Support System (DSS)
- `GET /api/decisions` — List all post-incident assessments.
- `POST /api/decisions/evaluate` — Evaluates all resolved incidents against statutory rules.
- `POST /api/decisions/:id/approve` — Approve automated recommendation and sign to ledger.
- `POST /api/decisions/:id/override` — Override with mandatory statutory reason and sign to ledger.

### Public Status
- `GET /api/public-status` — Candidate-facing non-technical status, overall condition, per-centre health, and plain-language updates timeline.

---

## 🔒 Statutory Integrity & Zero-Loss Guarantee
- **Continuous Checkpointing:** No candidate answers live solely on the client. Every selection is timestamped and saved server-side.
- **Timer Preservation:** Examination timers automatically freeze and resume upon reconnection.
- **Cryptographic Immutability:** Every answer, incident, failover, and adjudication is chained with `SHA-256(prev_hash + timestamp + type + payload)`. Any database tampering breaks the cryptographic link and is immediately detectable.
