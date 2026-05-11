/**
 * SkillQuest Backend — Express + sql.js (pure-JS SQLite, no native bindings)
 *
 * Start:  node server.js   or   npm start
 * Dev:    npm run dev        (auto-restarts on file change, Node ≥ 18)
 *
 * API Endpoints:
 *   POST   /api/auth/signup         register new user
 *   POST   /api/auth/login          login → returns JWT
 *   GET    /api/user/me             current user info      (auth required)
 *   GET    /api/user/points         points total           (auth required)
 *   POST   /api/user/points/add     add points             (auth required)
 *   POST   /api/user/points/deduct  deduct points          (auth required)
 *   GET    /api/user/progress       all course progress    (auth required)
 *   PUT    /api/user/progress       save course progress   (auth required)
 *   GET    /api/user/activity       recent quiz activity   (auth required)
 *   POST   /api/user/activity       log a completed quiz   (auth required)
 *   GET    /api/leaderboard         top learners by points (public)
 *   POST   /api/contact             submit contact form    (public)
 */

'use strict';

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const initSql  = require('sql.js');

/* ── Config ────────────────────────────────────────────── */
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'skillquest_secret_change_in_production';
const DATA_DIR   = path.join(__dirname, 'data');
const DB_FILE    = path.join(DATA_DIR, 'skillquest.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* ── sql.js database (async init, sync queries) ─────── */
let db; // set after initSql() resolves

function saveDb() {
  const data = db.export();          // Uint8Array
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function get(sql, params = []) {
  const stmt   = db.prepare(sql);
  stmt.bind(params);
  const result = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return result;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function schema() {
  // Using TEXT for booleans/integers where sql.js returns them fine
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password   TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_points (
      user_id    TEXT PRIMARY KEY,
      total      INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS points_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL,
      delta      INTEGER NOT NULL,
      total      INTEGER NOT NULL,
      note       TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS progress (
      user_id    TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      course_id  TEXT NOT NULL,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, subject_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS activity (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT NOT NULL,
      subject_id    TEXT NOT NULL,
      course_id     TEXT NOT NULL,
      score         INTEGER NOT NULL DEFAULT 0,
      total_q       INTEGER NOT NULL DEFAULT 5,
      points_earned INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      type       TEXT,
      message    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  saveDb();
}

/* ── Helpers ────────────────────────────────────────────── */
function genId() {
  return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

/* ── Express setup ──────────────────────────────────────── */
const app = express();
app.use(cors());
app.use(express.json());

// Serve the static frontend from the same folder
app.use(express.static(path.join(__dirname)));

/* ══════════════════════════════════════════════════════════
   AUTH ROUTES
══════════════════════════════════════════════════════════ */

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password)
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const exists = get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (exists) return res.status(409).json({ error: 'An account with this email already exists.' });

  const hash = await bcrypt.hash(password, 10);
  const id   = genId();

  run('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
      [id, name.trim(), email.trim().toLowerCase(), hash]);
  run('INSERT INTO user_points (user_id, total) VALUES (?, 0)', [id]);

  const token = jwt.sign({ id, name: name.trim(), email: email.trim().toLowerCase() }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, user: { id, name: name.trim(), email: email.trim().toLowerCase() } });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email?.trim() || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  const user = get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

/* ══════════════════════════════════════════════════════════
   USER ROUTES (auth required)
══════════════════════════════════════════════════════════ */

// GET /api/user/me
app.get('/api/user/me', authMiddleware, (req, res) => {
  const user = get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(user);
});

// GET /api/user/points
app.get('/api/user/points', authMiddleware, (req, res) => {
  const row = get('SELECT total FROM user_points WHERE user_id = ?', [req.user.id]);
  res.json({ points: row ? Number(row.total) : 0 });
});

// POST /api/user/points/add
app.post('/api/user/points/add', authMiddleware, (req, res) => {
  const { points, note } = req.body || {};
  if (!points || Number(points) <= 0)
    return res.status(400).json({ error: 'points must be a positive number.' });

  const row  = get('SELECT total FROM user_points WHERE user_id = ?', [req.user.id]);
  const prev = row ? Number(row.total) : 0;
  const next = prev + Math.floor(Number(points));

  if (row) run('UPDATE user_points SET total = ? WHERE user_id = ?', [next, req.user.id]);
  else     run('INSERT INTO user_points (user_id, total) VALUES (?, ?)', [req.user.id, next]);
  run('INSERT INTO points_log (user_id, delta, total, note) VALUES (?, ?, ?, ?)',
      [req.user.id, Math.floor(Number(points)), next, note || null]);
  res.json({ points: next });
});

// POST /api/user/points/deduct
app.post('/api/user/points/deduct', authMiddleware, (req, res) => {
  const { points } = req.body || {};
  if (!points || Number(points) <= 0)
    return res.status(400).json({ error: 'points must be a positive number.' });

  const row  = get('SELECT total FROM user_points WHERE user_id = ?', [req.user.id]);
  const prev = row ? Number(row.total) : 0;
  const next = Math.max(0, prev - Math.floor(Number(points)));

  if (row) run('UPDATE user_points SET total = ? WHERE user_id = ?', [next, req.user.id]);
  run('INSERT INTO points_log (user_id, delta, total, note) VALUES (?, ?, ?, ?)',
      [req.user.id, -Math.floor(Number(points)), next, 'deduction']);
  res.json({ points: next });
});

// GET /api/user/progress
app.get('/api/user/progress', authMiddleware, (req, res) => {
  const rows = all('SELECT subject_id, course_id, data FROM progress WHERE user_id = ?', [req.user.id]);
  const out  = {};
  for (const r of rows) {
    if (!out[r.subject_id]) out[r.subject_id] = {};
    try { out[r.subject_id][r.course_id] = JSON.parse(r.data); } catch { out[r.subject_id][r.course_id] = {}; }
  }
  res.json(out);
});

// PUT /api/user/progress
app.put('/api/user/progress', authMiddleware, (req, res) => {
  const { subjectId, courseId, data } = req.body || {};
  if (!subjectId || !courseId || !data)
    return res.status(400).json({ error: 'subjectId, courseId and data are required.' });

  const json    = JSON.stringify(data);
  const exists  = get('SELECT user_id FROM progress WHERE user_id = ? AND subject_id = ? AND course_id = ?',
                      [req.user.id, subjectId, courseId]);
  if (exists) {
    run('UPDATE progress SET data = ?, updated_at = datetime("now") WHERE user_id = ? AND subject_id = ? AND course_id = ?',
        [json, req.user.id, subjectId, courseId]);
  } else {
    run('INSERT INTO progress (user_id, subject_id, course_id, data) VALUES (?, ?, ?, ?)',
        [req.user.id, subjectId, courseId, json]);
  }
  res.json({ ok: true });
});

// GET /api/user/activity
app.get('/api/user/activity', authMiddleware, (req, res) => {
  const rows = all(`SELECT subject_id AS subjectId, course_id AS courseId, score,
                           total_q AS totalQuestions, points_earned AS points, created_at AS date
                    FROM activity WHERE user_id = ?
                    ORDER BY created_at DESC LIMIT 20`, [req.user.id]);
  res.json(rows);
});

// POST /api/user/activity
app.post('/api/user/activity', authMiddleware, (req, res) => {
  const { subjectId, courseId, score, totalQuestions, pointsEarned } = req.body || {};
  if (!subjectId || !courseId) return res.status(400).json({ error: 'subjectId and courseId are required.' });
  run('INSERT INTO activity (user_id, subject_id, course_id, score, total_q, points_earned) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, subjectId, courseId, score || 0, totalQuestions || 5, pointsEarned || 0]);
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════════════════ */

// GET /api/leaderboard
app.get('/api/leaderboard', (_req, res) => {
  // Count completed courses from progress JSON blobs
  const users = all(`SELECT u.id, u.name, COALESCE(p.total, 0) AS points
                     FROM users u
                     LEFT JOIN user_points p ON p.user_id = u.id
                     ORDER BY points DESC LIMIT 100`);

  const result = users.map(u => {
    const rows     = all('SELECT data FROM progress WHERE user_id = ?', [u.id]);
    const completed = rows.filter(r => {
      try { return JSON.parse(r.data).completed === true; } catch { return false; }
    }).length;
    return { id: u.id, name: u.name, points: Number(u.points), coursesCompleted: completed };
  }).filter(u => u.points > 0 || u.coursesCompleted > 0);

  res.json(result);
});

// POST /api/contact
app.post('/api/contact', (req, res) => {
  const { name, email, type, message } = req.body || {};
  if (!name?.trim() || !email?.trim() || !message?.trim())
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  run('INSERT INTO contacts (name, email, type, message) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim(), type || 'General', message.trim()]);
  res.json({ ok: true, message: 'Message received. We will get back to you shortly.' });
});

/* ── SPA fallback ───────────────────────────────────────── */
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

/* ══════════════════════════════════════════════════════════
   BOOTSTRAP — load or create database, then start server
══════════════════════════════════════════════════════════ */
initSql().then(SQL => {
  // Load existing DB file or start fresh
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  schema(); // create tables if they don't exist

  app.listen(PORT, () => {
    console.log('\n  SkillQuest is running.');
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`  API:     http://localhost:${PORT}/api`);
    console.log(`  DB:      ${DB_FILE}\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
