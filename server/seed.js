/**
 * ExamGuard - Database Seeder
 * Populates 5 simulated exam centres and 200 candidates (40 per centre)
 * with initial active session states.
 */

const { db, appendLedgerEvent } = require('./db');

const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Ananya', 'Aryan', 'Deepak', 'Diya', 'Ishaan', 'Kavya',
  'Manish', 'Neha', 'Pooja', 'Pranav', 'Rahul', 'Riya', 'Rohan', 'Sakshi',
  'Siddharth', 'Sneha', 'Tanvi', 'Varun', 'Vikram', 'Zoya', 'Kunal', 'Meera'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Mehta', 'Gupta', 'Iyer',
  'Chatterjee', 'Singh', 'Deshmukh', 'Bose', 'Rao', 'Kulkarni', 'Malhotra'
];

function getRandomName(index) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${first} ${last}`;
}

const CENTRES_DATA = [
  { id: 'centre-1', name: 'North Apex Exam Hub', city: 'New Delhi', nodes: 40 },
  { id: 'centre-2', name: 'Silicon City Institute', city: 'Bengaluru', nodes: 40 },
  { id: 'centre-3', name: 'Coastal Bay Cyber Centre', city: 'Mumbai', nodes: 40 },
  { id: 'centre-4', name: 'Metro City Assessment Centre', city: 'Kolkata', nodes: 40 },
  { id: 'centre-5', name: 'Royal Deccan Tech Campus', city: 'Hyderabad', nodes: 40 }
];

function seedDatabase() {
  console.log('[SEED] Initialising ExamGuard database...');

  // Use a transaction for fast, atomic seeding
  const seedTx = db.transaction(() => {
    // Clear existing data to allow clean re-runs
    db.exec(`
      DELETE FROM answers;
      DELETE FROM incidents;
      DELETE FROM sessions;
      DELETE FROM candidates;
      DELETE FROM centres;
      DELETE FROM ledger_events;
      DELETE FROM failover_logs;
      DELETE FROM decisions;
      DELETE FROM sqlite_sequence WHERE name IN ('answers', 'ledger_events', 'failover_logs', 'decisions');
    `);

    // 1. Insert Centres
    const insertCentre = db.prepare(`
      INSERT INTO centres (id, name, city, total_nodes, status)
      VALUES (?, ?, ?, ?, 'active')
    `);

    for (const c of CENTRES_DATA) {
      insertCentre.run(c.id, c.name, c.city, c.nodes);
    }
    console.log(`[SEED] Created ${CENTRES_DATA.length} exam centres.`);

    // 2. Insert Candidates & Sessions
    const insertCandidate = db.prepare(`
      INSERT INTO candidates (id, centre_id, name, roll_number)
      VALUES (?, ?, ?, ?)
    `);

    const insertSession = db.prepare(`
      INSERT INTO sessions (id, candidate_id, centre_id, node_id, status, current_question, time_remaining)
      VALUES (?, ?, ?, ?, 'active', 1, 7200)
    `);

    let candidateCount = 0;

    CENTRES_DATA.forEach((centre) => {
      for (let node = 1; node <= centre.nodes; node++) {
        candidateCount++;
        const candId = `cand-${candidateCount}`;
        const rollNum = `EG-2026-${String(candidateCount).padStart(4, '0')}`;
        const name = getRandomName(candidateCount);
        const sessionId = `sess-${candId}`;
        const nodeId = `node-${node}`;

        insertCandidate.run(candId, centre.id, name, rollNum);
        insertSession.run(sessionId, candId, centre.id, nodeId);
      }
    });

    console.log(`[SEED] Created ${candidateCount} candidates with active sessions.`);

    // 3. Record Genesis Ledger Event
    appendLedgerEvent('SYSTEM', 'genesis', {
      totalCentres: CENTRES_DATA.length,
      totalCandidates: candidateCount,
      environment: 'SIMULATED',
      timestamp: new Date().toISOString()
    });
    console.log('[SEED] TrustLedger genesis event recorded.');
  });

  seedTx();
  console.log('[SEED] Database seeding complete!\n');
}

// Allow direct CLI execution: node server/seed.js
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
