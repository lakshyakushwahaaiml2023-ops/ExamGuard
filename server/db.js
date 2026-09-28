/**
 * ExamGuard — Database Layer (better-sqlite3)
 * Manages SQLite connection, schema definition, and core data operations.
 *
 * incidents table enhanced with:
 *   - affected_candidates  INTEGER
 *   - escalation_level     TEXT  ('NOTIFY_CENTRE_ADMIN' | 'NOTIFY_EXAM_CONTROLLER')
 *   - escalation_target    TEXT  (human-readable target label)
 *   - acknowledged_at      DATETIME
 *   - status supports:     'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'examguard.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// WAL mode for high write throughput, fallback if shared memory restricted
try {
  db.pragma('journal_mode = WAL');
} catch (e) {
  console.warn('[DB] Journal mode WAL unavailable, using default DELETE:', e.message);
  db.pragma('journal_mode = DELETE');
}

try {
  db.pragma('foreign_keys = ON');
} catch (e) {
  // ignore
}

// ── Schema ────────────────────────────────────────────────────────────────────
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS centres (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      city         TEXT NOT NULL,
      total_nodes  INTEGER DEFAULT 40,
      status       TEXT DEFAULT 'active',
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id           TEXT PRIMARY KEY,
      centre_id    TEXT NOT NULL,
      name         TEXT NOT NULL,
      roll_number  TEXT NOT NULL UNIQUE,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(centre_id) REFERENCES centres(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id               TEXT PRIMARY KEY,
      candidate_id     TEXT NOT NULL,
      centre_id        TEXT NOT NULL,
      node_id          TEXT NOT NULL,
      status           TEXT DEFAULT 'active',
      current_question INTEGER DEFAULT 1,
      time_remaining   INTEGER DEFAULT 7200,
      last_heartbeat   DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(candidate_id) REFERENCES candidates(id),
      FOREIGN KEY(centre_id)    REFERENCES centres(id)
    );

    CREATE TABLE IF NOT EXISTS answers (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      TEXT NOT NULL,
      candidate_id    TEXT NOT NULL,
      centre_id       TEXT NOT NULL,
      question_id     INTEGER NOT NULL,
      selected_option TEXT NOT NULL,
      submitted_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      hash            TEXT,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id                   TEXT PRIMARY KEY,
      centre_id            TEXT NOT NULL,
      type                 TEXT NOT NULL,
      severity             TEXT NOT NULL,
      status               TEXT DEFAULT 'OPEN',
      details              TEXT,
      affected_candidates  INTEGER DEFAULT 0,
      escalation_level     TEXT NOT NULL DEFAULT 'NOTIFY_CENTRE_ADMIN',
      escalation_target    TEXT NOT NULL DEFAULT 'Centre Administrator',
      detected_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
      acknowledged_at      DATETIME,
      resolved_at          DATETIME,
      FOREIGN KEY(centre_id) REFERENCES centres(id)
    );

    CREATE TABLE IF NOT EXISTS ledger_events (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      centre_id     TEXT,
      event_type    TEXT NOT NULL,
      payload       TEXT NOT NULL,
      previous_hash TEXT NOT NULL,
      hash          TEXT NOT NULL,
      timestamp     DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS failover_logs (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      failed_centre_id     TEXT NOT NULL,
      backup_centre_id     TEXT NOT NULL,
      candidates_affected  INTEGER NOT NULL,
      candidates_recovered INTEGER NOT NULL,
      recovery_time_sec    REAL NOT NULL,
      answers_lost         INTEGER DEFAULT 0,
      details              TEXT,
      started_at           DATETIME NOT NULL,
      completed_at         DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id                  TEXT PRIMARY KEY,
      incident_id         TEXT NOT NULL,
      centre_id           TEXT NOT NULL,
      recommendation      TEXT NOT NULL,
      reasoning           TEXT NOT NULL,
      metrics             TEXT NOT NULL,
      evidence_ledger_ids TEXT NOT NULL,
      status              TEXT DEFAULT 'PENDING',
      final_decision      TEXT,
      decided_by          TEXT,
      override_reason     TEXT,
      created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
      decided_at          DATETIME
    );
  `);

  // ── Non-destructive migrations for existing DBs ───────────────────────────
  // Add new columns to incidents if they don't exist yet (ALTER TABLE is safe)
  const incidentCols = db.prepare("PRAGMA table_info(incidents)").all().map(c => c.name);

  const addCol = (col, def) => {
    if (!incidentCols.includes(col)) {
      db.exec(`ALTER TABLE incidents ADD COLUMN ${col} ${def}`);
    }
  };
  addCol('affected_candidates', 'INTEGER DEFAULT 0');
  addCol('escalation_level',    "TEXT NOT NULL DEFAULT 'NOTIFY_CENTRE_ADMIN'");
  addCol('escalation_target',   "TEXT NOT NULL DEFAULT 'Centre Administrator'");
  addCol('acknowledged_at',     'DATETIME');

  // Add columns to ledger_events if they don't exist yet
  const ledgerCols = db.prepare("PRAGMA table_info(ledger_events)").all().map(c => c.name);
  if (!ledgerCols.includes('type')) {
    db.exec(`ALTER TABLE ledger_events ADD COLUMN type TEXT`);
    db.exec(`UPDATE ledger_events SET type = event_type WHERE type IS NULL`);
  }
  if (!ledgerCols.includes('prev_hash')) {
    db.exec(`ALTER TABLE ledger_events ADD COLUMN prev_hash TEXT`);
    db.exec(`UPDATE ledger_events SET prev_hash = previous_hash WHERE prev_hash IS NULL`);
  }

  // Migrate any old ACTIVE/status values to OPEN so the UI stays consistent
  db.exec(`UPDATE incidents SET status = 'OPEN' WHERE status = 'ACTIVE'`);
}

// ── TrustLedger: SHA-256 hash-chained append-only event log ──────────────────
// Formula: hash = SHA-256(prev_hash + timestamp + type + payload)
const GENESIS_HASH = '0'.repeat(64);

function appendLedgerEvent(arg1, arg2, arg3) {
  let centreId, type, payload;

  if (typeof arg3 !== 'undefined') {
    if (typeof arg1 === 'string' && (arg1.startsWith('centre-') || arg1 === 'SYSTEM' || arg1 === 'GLOBAL')) {
      centreId = arg1;
      type = arg2;
      payload = arg3;
    } else {
      type = arg1;
      payload = arg2;
      centreId = arg3;
    }
  } else {
    type = arg1;
    payload = arg2;
    centreId = 'SYSTEM';
  }

  const lastEvent = db.prepare('SELECT hash FROM ledger_events ORDER BY id DESC LIMIT 1').get();
  const prevHash = lastEvent ? lastEvent.hash : GENESIS_HASH;
  const timestamp = new Date().toISOString();
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // Exact formula: SHA-256(prev_hash + timestamp + type + payload)
  const dataToHash = `${prevHash}${timestamp}${type}${payloadStr}`;
  const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

  const insert = db.prepare(`
    INSERT INTO ledger_events (centre_id, event_type, type, payload, previous_hash, prev_hash, hash, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insert.run(centreId, type, type, payloadStr, prevHash, prevHash, hash, timestamp);

  return { id: result.lastInsertRowid, centreId, type, payload: payloadStr, prev_hash: prevHash, hash, timestamp };
}

initSchema();

module.exports = { db, initSchema, appendLedgerEvent };
