/**
 * ExamGuard — Module 4: TrustLedger
 * ═══════════════════════════════════════════════════════════════════════════
 * Cryptographic audit log for high-stakes computer-based examinations.
 *
 * Implements an immutable SHA-256 hash-chained ledger where every important event
 * (candidate login, answer submission, incident created/updated/resolved,
 * admin acknowledge, decision made) is appended as:
 *   - id
 *   - timestamp
 *   - type
 *   - payload (JSON string)
 *   - prev_hash
 *   - hash = SHA-256(prev_hash + timestamp + type + payload)
 *
 * Genesis block uses a prev_hash of 64 zeros.
 */

const crypto = require('crypto');
const { db } = require('../db');

const GENESIS_PREV_HASH = '0'.repeat(64);

// Optional socket instance to broadcast new blocks
let ioInstance = null;

function setLedgerSocket(io) {
  ioInstance = io;
}

/**
 * Computes SHA-256 hash strictly following the formula:
 * hash = SHA-256(prev_hash + timestamp + type + payload)
 */
function computeHash(prevHash, timestamp, type, payload) {
  const content = `${prevHash}${timestamp}${type}${payload}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Appends a new event to the ledger chain.
 * Polymorphic arguments:
 *   appendLedgerEvent(centreId, type, payload) OR
 *   appendLedgerEvent(type, payload, centreId)
 */
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

  // Get previous block hash (or genesis zeros)
  const lastRow = db.prepare(`
    SELECT hash FROM ledger_events ORDER BY id DESC LIMIT 1
  `).get();

  const prevHash = lastRow ? (lastRow.hash || lastRow.prev_hash) : GENESIS_PREV_HASH;
  const timestamp = new Date().toISOString();
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // Exact formula: SHA-256(prev_hash + timestamp + type + payload)
  const hash = computeHash(prevHash, timestamp, type, payloadStr);

  const insert = db.prepare(`
    INSERT INTO ledger_events (centre_id, event_type, type, payload, previous_hash, prev_hash, hash, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insert.run(
    centreId,
    type,
    type,
    payloadStr,
    prevHash,
    prevHash,
    hash,
    timestamp
  );

  const newEvent = {
    id: result.lastInsertRowid,
    timestamp,
    type,
    payload: payloadStr,
    prev_hash: prevHash,
    hash,
    centre_id: centreId
  };

  // Broadcast to live dashboards
  if (ioInstance) {
    ioInstance.emit('ledger:new_event', newEvent);
  }

  return newEvent;
}

/**
 * Recomputes the entire hash chain from genesis to the latest block.
 * Returns valid: true/false and the first broken event id if compromised.
 */
function verifyLedger() {
  const events = db.prepare(`
    SELECT id, timestamp,
           COALESCE(type, event_type) AS type,
           payload,
           COALESCE(prev_hash, previous_hash) AS prev_hash,
           hash,
           centre_id
    FROM ledger_events
    ORDER BY id ASC
  `).all();

  if (events.length === 0) {
    return { valid: true, brokenEventId: null, totalEvents: 0, message: 'Ledger is empty.' };
  }

  let expectedPrevHash = GENESIS_PREV_HASH;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // 1. Verify previous hash link
    if (event.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        brokenEventId: event.id,
        reason: 'Previous hash mismatch (broken chain pointer)',
        expectedPrevHash,
        actualPrevHash: event.prev_hash,
        totalEvents: events.length,
        message: `Tampering detected at event #${event.id}`
      };
    }

    // 2. Recompute hash: SHA-256(prev_hash + timestamp + type + payload)
    const recalculatedHash = computeHash(event.prev_hash, event.timestamp, event.type, event.payload);

    if (event.hash !== recalculatedHash) {
      return {
        valid: false,
        brokenEventId: event.id,
        reason: 'Cryptographic signature mismatch (payload or metadata modified)',
        recalculatedHash,
        actualHash: event.hash,
        totalEvents: events.length,
        message: `Tampering detected at event #${event.id}`
      };
    }

    // Advance chain pointer
    expectedPrevHash = event.hash;
  }

  return {
    valid: true,
    brokenEventId: null,
    totalEvents: events.length,
    message: 'Chain intact'
  };
}

/**
 * Demo helper: secretly modifies one past event's payload directly in SQLite
 * without updating any hashes, demonstrating cryptographic tamper detection.
 */
function tamperDemo(targetEventId = null) {
  let target;

  if (targetEventId) {
    target = db.prepare('SELECT * FROM ledger_events WHERE id = ?').get(targetEventId);
  } else {
    // Pick an event in the middle or last non-genesis event
    const countRow = db.prepare('SELECT count(*) as c FROM ledger_events').get();
    const count = countRow.c;

    if (count <= 1) {
      target = db.prepare('SELECT * FROM ledger_events LIMIT 1').get();
    } else {
      const midId = Math.max(2, Math.floor(count / 2));
      target = db.prepare('SELECT * FROM ledger_events WHERE id >= ? ORDER BY id ASC LIMIT 1').get(midId)
        || db.prepare('SELECT * FROM ledger_events WHERE id > 1 ORDER BY id DESC LIMIT 1').get();
    }
  }

  if (!target) {
    throw new Error('No events found in ledger to tamper.');
  }

  const originalPayload = target.payload;
  let modifiedPayload;

  try {
    const parsed = JSON.parse(originalPayload);
    parsed._UNAUTHORIZED_TAMPER_FLAG = true;
    parsed._tampered_at = new Date().toISOString();
    parsed.malicious_modification = 'Score altered from 42 to 99 by rogue actor';
    if (parsed.selectedOption) {
      parsed.selectedOption = parsed.selectedOption === 'A' ? 'B' : 'A';
    }
    modifiedPayload = JSON.stringify(parsed);
  } catch {
    modifiedPayload = `${originalPayload} [TAMPERED_MALICIOUS_INJECTION]`;
  }

  // Update DB directly bypassing appendLedgerEvent
  db.prepare(`
    UPDATE ledger_events
    SET payload = ?
    WHERE id = ?
  `).run(modifiedPayload, target.id);

  console.log(`[LEDGER] ⚠️ DEMO TAMPERING injected into event #${target.id}!`);

  return {
    success: true,
    tamperedEventId: target.id,
    originalPayload,
    newPayload: modifiedPayload,
    message: `Secretly modified payload of event #${target.id} in SQLite directly.`
  };
}

/**
 * Demo helper: recalculates hashes from a given event to restore chain validity.
 */
function repairLedger() {
  const events = db.prepare(`
    SELECT id, timestamp,
           COALESCE(type, event_type) AS type,
           payload,
           COALESCE(prev_hash, previous_hash) AS prev_hash,
           hash
    FROM ledger_events
    ORDER BY id ASC
  `).all();

  let prevHash = GENESIS_PREV_HASH;
  const update = db.prepare(`
    UPDATE ledger_events
    SET prev_hash = ?, previous_hash = ?, hash = ?
    WHERE id = ?
  `);

  const tx = db.transaction(() => {
    for (const ev of events) {
      const newHash = computeHash(prevHash, ev.timestamp, ev.type, ev.payload);
      update.run(prevHash, prevHash, newHash, ev.id);
      prevHash = newHash;
    }
  });

  tx();
  return { success: true, repairedEvents: events.length, message: 'All block hashes re-chained and valid.' };
}

/**
 * Fetch events for ledger viewer.
 */
function getLedgerEvents(limit = 100, offset = 0) {
  return db.prepare(`
    SELECT id, timestamp,
           COALESCE(type, event_type) AS type,
           payload,
           COALESCE(prev_hash, previous_hash) AS prev_hash,
           hash,
           centre_id
    FROM ledger_events
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

function getLedgerEventById(id) {
  const row = db.prepare(`
    SELECT id, timestamp,
           COALESCE(type, event_type) AS type,
           payload,
           COALESCE(prev_hash, previous_hash) AS prev_hash,
           hash,
           centre_id
    FROM ledger_events
    WHERE id = ?
  `).get(id);
  return row || null;
}

module.exports = {
  appendLedgerEvent,
  verifyLedger,
  tamperDemo,
  repairLedger,
  getLedgerEvents,
  getLedgerEventById,
  setLedgerSocket,
  computeHash,
  GENESIS_PREV_HASH
};
