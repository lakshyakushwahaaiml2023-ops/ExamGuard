/**
 * ExamGuard — Database Layer (Pure WebAssembly SQLite via sql.js)
 * ═══════════════════════════════════════════════════════════════════════════
 * 100% portable SQLite implementation with zero C++ native addons.
 * Eliminates native compilation errors and Linux segmentation faults.
 *
 * Provides a drop-in synchronous API compatible with better-sqlite3:
 *   - db.prepare(sql).all(...params)
 *   - db.prepare(sql).get(...params)
 *   - db.prepare(sql).run(...params)
 *   - db.exec(sql)
 *   - db.pragma(sql)
 *   - db.transaction(fn)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'examguard.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let rawDb = null;
let inTx = false;

function saveDb() {
  if (inTx || !rawDb || !dbPath) return;
  try {
    const data = rawDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (e) {
    // Non-fatal if filesystem is temporarily restricted
  }
}

const db = {
  exec(sql) {
    if (!rawDb) throw new Error('[DB] Database not yet initialized');
    rawDb.run(sql);
    saveDb();
  },

  pragma(sql) {
    if (!rawDb) return;
    try {
      rawDb.run(`PRAGMA ${sql};`);
    } catch (e) {}
  },

  prepare(sql) {
    return {
      all(...params) {
        if (!rawDb) throw new Error('[DB] Database not yet initialized');
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const stmt = rawDb.prepare(sql);
        if (flatParams.length > 0) stmt.bind(flatParams);
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },

      get(...params) {
        if (!rawDb) throw new Error('[DB] Database not yet initialized');
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const stmt = rawDb.prepare(sql);
        if (flatParams.length > 0) stmt.bind(flatParams);
        let result = undefined;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },

      run(...params) {
        if (!rawDb) throw new Error('[DB] Database not yet initialized');
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        if (flatParams.length > 0) {
          rawDb.run(sql, flatParams);
        } else {
          rawDb.run(sql);
        }
        saveDb();
        const lastIdRes = rawDb.exec('SELECT last_insert_rowid() as id;');
        const lastId = lastIdRes[0]?.values[0]?.[0] || 0;
        const changes = rawDb.getRowsModified ? rawDb.getRowsModified() : 1;
        return { lastInsertRowid: lastId, changes };
      }
    };
  },

  transaction(fn) {
    return (...args) => {
      inTx = true;
      rawDb.run('BEGIN TRANSACTION;');
      try {
        const res = fn(...args);
        rawDb.run('COMMIT;');
        inTx = false;
        saveDb();
        return res;
      } catch (err) {
        inTx = false;
        try { rawDb.run('ROLLBACK;'); } catch (e) {}
        throw err;
      }
    };
  }
};

// ── Schema Initialization ─────────────────────────────────────────────────────
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
      type          TEXT,
      payload       TEXT NOT NULL,
      previous_hash TEXT NOT NULL,
      prev_hash     TEXT,
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

  // Migrate columns if needed
  try {
    const incidentCols = db.prepare('PRAGMA table_info(incidents)').all().map(c => c.name);
    const addCol = (col, def) => {
      if (!incidentCols.includes(col)) {
        db.exec(`ALTER TABLE incidents ADD COLUMN ${col} ${def}`);
      }
    };
    addCol('affected_candidates', 'INTEGER DEFAULT 0');
    addCol('escalation_level',    "TEXT NOT NULL DEFAULT 'NOTIFY_CENTRE_ADMIN'");
    addCol('escalation_target',   "TEXT NOT NULL DEFAULT 'Centre Administrator'");
    addCol('acknowledged_at',     'DATETIME');

    const ledgerCols = db.prepare('PRAGMA table_info(ledger_events)').all().map(c => c.name);
    if (!ledgerCols.includes('type')) {
      db.exec('ALTER TABLE ledger_events ADD COLUMN type TEXT');
      db.exec('UPDATE ledger_events SET type = event_type WHERE type IS NULL');
    }
    if (!ledgerCols.includes('prev_hash')) {
      db.exec('ALTER TABLE ledger_events ADD COLUMN prev_hash TEXT');
      db.exec('UPDATE ledger_events SET prev_hash = previous_hash WHERE prev_hash IS NULL');
    }
  } catch (e) {}
}

// ── TrustLedger appendLedgerEvent ─────────────────────────────────────────────
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

  const dataToHash = `${prevHash}${timestamp}${type}${payloadStr}`;
  const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

  const insert = db.prepare(`
    INSERT INTO ledger_events (centre_id, event_type, type, payload, previous_hash, prev_hash, hash, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insert.run(centreId, type, type, payloadStr, prevHash, prevHash, hash, timestamp);

  return { id: result.lastInsertRowid, centreId, type, payload: payloadStr, prev_hash: prevHash, hash, timestamp };
}

// ── Async Database Initialization ─────────────────────────────────────────────
let initPromise = null;

async function initDatabase() {
  if (rawDb) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs();
    if (fs.existsSync(dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(dbPath);
        rawDb = new SQL.Database(fileBuffer);
      } catch (err) {
        rawDb = new SQL.Database();
      }
    } else {
      rawDb = new SQL.Database();
    }

    initSchema();
    return db;
  })();

  return initPromise;
}

module.exports = { db, initDatabase, initSchema, appendLedgerEvent };
