/**
 * SkillQuest Backend — Express + PostgreSQL
 *
 * Start:  node server.js   |   npm start
 * Dev:    npm run dev
 *
 * Required environment variables:
 *   DATABASE_URL    PostgreSQL connection string (e.g. from Railway/Supabase/Render)
 *   JWT_SECRET      Secret for signing user tokens (generate a long random string)
 *   ADMIN_EMAIL     Email address used to log in to /admin.html
 *   ADMIN_PASSWORD  Password used to log in to /admin.html
 *   PORT            (optional, defaults to 3000)
 */

'use strict';

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const dns = require('dns'); dns.setDefaultResultOrder('ipv4first');
const { Pool } = require('pg');

/* ── Config ──────────────────────────────────────────────── */
const PORT           = process.env.PORT || 3000;
const JWT_SECRET     = process.env.JWT_SECRET     || 'skillquest_dev_secret_change_me';
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@skillquest.tw';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SkillQuest2026!';
const DATABASE_URL   = process.env.DATABASE_URL;

/* ── PostgreSQL pool ─────────────────────────────────────── */
const pool = new Pool({
  connectionString: DATABASE_URL || 'postgresql://localhost:5432/skillquest',
  ssl: DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  // Force IPv4 — Render free tier does not support IPv6 (ENETUNREACH)
  family: 4
});

/* ── DB helpers ──────────────────────────────────────────── */
async function q(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}
async function q1(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

/* ── Schema ──────────────────────────────────────────────── */
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_points (
      user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      total      INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS points_log (
      id         SERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delta      INTEGER NOT NULL,
      total      INTEGER NOT NULL,
      note       TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS progress (
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL,
      course_id  TEXT NOT NULL,
      data       JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, subject_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS activity (
      id            SERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id    TEXT NOT NULL,
      course_id     TEXT NOT NULL,
      score         INTEGER NOT NULL DEFAULT 0,
      total_q       INTEGER NOT NULL DEFAULT 5,
      points_earned INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      type       TEXT,
      subject    TEXT,
      message    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS draw_entries (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      draw_tier   TEXT NOT NULL,
      month_key   TEXT NOT NULL,
      points_spent INTEGER NOT NULL,
      entered_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, month_key)
    );
    CREATE TABLE IF NOT EXISTS draw_winners (
      id              SERIAL PRIMARY KEY,
      draw_tier       TEXT NOT NULL,
      month_key       TEXT NOT NULL,
      winner_user_id  TEXT,
      winner_name     TEXT,
      picked_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(draw_tier, month_key)
    );
  `);
  console.log('  Database schema ready.');
}

/* ── Helpers ─────────────────────────────────────────────── */
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

function adminMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Admin authentication required.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.admin) return res.status(403).json({ error: 'Admin access required.' });
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin token.' });
  }
}

/* ── Express setup ───────────────────────────────────────── */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ══════════════════════════════════════════════════════════
   AUTH ROUTES
══════════════════════════════════════════════════════════ */

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password)
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const exists = await q1('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (exists) return res.status(409).json({ error: 'An account with this email already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const id   = genId();
    await q('INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)',
            [id, name.trim(), email.trim().toLowerCase(), hash]);
    await q('INSERT INTO user_points (user_id, total) VALUES ($1, 0)', [id]);

    const token = jwt.sign({ id, name: name.trim(), email: email.trim().toLowerCase() }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { id, name: name.trim(), email: email.trim().toLowerCase() } });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const user = await q1('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

/* ══════════════════════════════════════════════════════════
   USER ROUTES (auth required)
══════════════════════════════════════════════════════════ */

app.get('/api/user/me', authMiddleware, async (req, res) => {
  try {
    const user = await q1('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/user/points', authMiddleware, async (req, res) => {
  try {
    const row = await q1('SELECT total FROM user_points WHERE user_id = $1', [req.user.id]);
    res.json({ points: row ? Number(row.total) : 0 });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.post('/api/user/points/add', authMiddleware, async (req, res) => {
  try {
    const { points, note } = req.body || {};
    if (!points || Number(points) <= 0)
      return res.status(400).json({ error: 'points must be a positive number.' });

    const row  = await q1('SELECT total FROM user_points WHERE user_id = $1', [req.user.id]);
    const prev = row ? Number(row.total) : 0;
    const next = prev + Math.floor(Number(points));

    await q(`INSERT INTO user_points (user_id, total, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (user_id) DO UPDATE SET total = $2, updated_at = NOW()`,
            [req.user.id, next]);
    await q('INSERT INTO points_log (user_id, delta, total, note) VALUES ($1, $2, $3, $4)',
            [req.user.id, Math.floor(Number(points)), next, note || null]);
    res.json({ points: next });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.post('/api/user/points/deduct', authMiddleware, async (req, res) => {
  try {
    const { points } = req.body || {};
    if (!points || Number(points) <= 0)
      return res.status(400).json({ error: 'points must be a positive number.' });

    const row  = await q1('SELECT total FROM user_points WHERE user_id = $1', [req.user.id]);
    const prev = row ? Number(row.total) : 0;
    const next = Math.max(0, prev - Math.floor(Number(points)));

    await q(`INSERT INTO user_points (user_id, total, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (user_id) DO UPDATE SET total = $2, updated_at = NOW()`,
            [req.user.id, next]);
    await q('INSERT INTO points_log (user_id, delta, total, note) VALUES ($1, $2, $3, $4)',
            [req.user.id, -Math.floor(Number(points)), next, 'reward entry']);
    res.json({ points: next });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/user/progress', authMiddleware, async (req, res) => {
  try {
    const rows = await q('SELECT subject_id, course_id, data FROM progress WHERE user_id = $1', [req.user.id]);
    const out  = {};
    for (const r of rows) {
      if (!out[r.subject_id]) out[r.subject_id] = {};
      out[r.subject_id][r.course_id] = r.data;
    }
    res.json(out);
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.put('/api/user/progress', authMiddleware, async (req, res) => {
  try {
    const { subjectId, courseId, data } = req.body || {};
    if (!subjectId || !courseId || !data)
      return res.status(400).json({ error: 'subjectId, courseId and data are required.' });

    await q(`INSERT INTO progress (user_id, subject_id, course_id, data, updated_at) VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (user_id, subject_id, course_id) DO UPDATE SET data = $4, updated_at = NOW()`,
            [req.user.id, subjectId, courseId, JSON.stringify(data)]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/user/activity', authMiddleware, async (req, res) => {
  try {
    const rows = await q(`SELECT subject_id AS "subjectId", course_id AS "courseId",
                                 score, total_q AS "totalQuestions", points_earned AS points,
                                 created_at AS date
                          FROM activity WHERE user_id = $1
                          ORDER BY created_at DESC LIMIT 20`, [req.user.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.post('/api/user/activity', authMiddleware, async (req, res) => {
  try {
    const { subjectId, courseId, score, totalQuestions, pointsEarned } = req.body || {};
    if (!subjectId || !courseId) return res.status(400).json({ error: 'subjectId and courseId are required.' });
    await q('INSERT INTO activity (user_id, subject_id, course_id, score, total_q, points_earned) VALUES ($1, $2, $3, $4, $5, $6)',
            [req.user.id, subjectId, courseId, score || 0, totalQuestions || 5, pointsEarned || 0]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

/* ══════════════════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════════════════ */

// GET /api/leaderboard
app.get('/api/leaderboard', async (_req, res) => {
  try {
    const users = await q(`
      SELECT u.id, u.name, COALESCE(p.total, 0) AS points
      FROM users u
      LEFT JOIN user_points p ON p.user_id = u.id
      WHERE COALESCE(p.total, 0) > 0
      ORDER BY points DESC
      LIMIT 100
    `);

    const result = await Promise.all(users.map(async u => {
      const rows = await q(`SELECT data FROM progress WHERE user_id = $1`, [u.id]);
      const completed = rows.filter(r => r.data && r.data.completed === true).length;
      return { id: u.id, name: u.name, points: Number(u.points), coursesCompleted: completed };
    }));

    res.json(result.filter(u => u.points > 0 || u.coursesCompleted > 0));
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/stats — public platform stats for homepage
app.get('/api/stats', async (_req, res) => {
  try {
    const [userRow]       = await q('SELECT COUNT(*) AS total FROM users');
    const [completionRow] = await q(`SELECT COUNT(*) AS total FROM progress WHERE (data->>'completed')::boolean = true`);
    const [pointsRow]     = await q('SELECT COALESCE(SUM(total), 0) AS total FROM user_points');
    const [activityRow]   = await q('SELECT COUNT(DISTINCT user_id) AS total FROM activity');

    res.json({
      totalUsers:       Number(userRow.total),
      totalCompletions: Number(completionRow.total),
      totalQuizzes:     Number(completionRow.total),
      totalPoints:      Number(pointsRow.total),
      activeStudents:   Number(activityRow.total)
    });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/contact
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, type, subject, message } = req.body || {};
    if (!name?.trim() || !email?.trim() || !message?.trim())
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    await q('INSERT INTO contacts (name, email, type, subject, message) VALUES ($1, $2, $3, $4, $5)',
            [name.trim(), email.trim(), type || 'General', subject || '', message.trim()]);
    res.json({ ok: true, message: 'Message received. I will get back to you shortly.' });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

/* ══════════════════════════════════════════════════════════
   DRAW ROUTES
══════════════════════════════════════════════════════════ */

const DRAW_COSTS = { bronze: 50, gold: 100, diamond: 200 };

// POST /api/draws/enter — spend points to enter a draw
app.post('/api/draws/enter', authMiddleware, async (req, res) => {
  try {
    const { tier } = req.body || {};
    if (!DRAW_COSTS[tier]) return res.status(400).json({ error: 'Invalid draw tier. Must be bronze, gold, or diamond.' });

    const monthKey = new Date().toISOString().slice(0, 7);
    const cost     = DRAW_COSTS[tier];

    // One draw per user per month
    const existing = await q1('SELECT draw_tier FROM draw_entries WHERE user_id = $1 AND month_key = $2', [req.user.id, monthKey]);
    if (existing) return res.status(409).json({ error: 'Already entered this month.', tier: existing.draw_tier });

    // Check balance
    const ptRow = await q1('SELECT total FROM user_points WHERE user_id = $1', [req.user.id]);
    const current = ptRow ? Number(ptRow.total) : 0;
    if (current < cost) return res.status(400).json({ error: 'Not enough points.', required: cost, available: current });

    // Deduct points
    const newTotal = current - cost;
    await q(`UPDATE user_points SET total = $1, updated_at = NOW() WHERE user_id = $2`, [newTotal, req.user.id]);
    await q('INSERT INTO points_log (user_id, delta, total, note) VALUES ($1, $2, $3, $4)',
            [req.user.id, -cost, newTotal, `Entered ${tier} draw`]);

    // Record entry
    await q('INSERT INTO draw_entries (user_id, draw_tier, month_key, points_spent) VALUES ($1, $2, $3, $4)',
            [req.user.id, tier, monthKey, cost]);

    res.json({ ok: true, tier, pointsRemaining: newTotal });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/draws/my-entry — get current user's entry + tier counts + winners + any wins
app.get('/api/draws/my-entry', authMiddleware, async (req, res) => {
  try {
    const monthKey = new Date().toISOString().slice(0, 7);
    const entry    = await q1('SELECT draw_tier, points_spent, entered_at FROM draw_entries WHERE user_id = $1 AND month_key = $2', [req.user.id, monthKey]);
    const counts   = await q('SELECT draw_tier, COUNT(*) AS cnt FROM draw_entries WHERE month_key = $1 GROUP BY draw_tier', [monthKey]);
    const winners  = await q('SELECT draw_tier, winner_name FROM draw_winners WHERE month_key = $1', [monthKey]);
    const tierCounts  = {}; counts.forEach(r  => { tierCounts[r.draw_tier]  = Number(r.cnt); });
    const tierWinners = {}; winners.forEach(w => { tierWinners[w.draw_tier] = w.winner_name; });

    // Check all months for wins by this user — match on BOTH user_id string AND name
    // (name fallback handles records written before user_id was stored correctly)
    const myWinRows = await q(
      `SELECT draw_tier, month_key, picked_at
       FROM draw_winners
       WHERE winner_user_id = $1
          OR winner_name    = $2
       ORDER BY picked_at DESC`,
      [String(req.user.id), String(req.user.name)]
    );

    res.json({ entry: entry || null, tierCounts, tierWinners, monthKey, myWins: myWinRows || [] });
  } catch (err) {
    console.error('[my-entry]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/draws/my-wins — returns all draws the current user has won (any month)
app.get('/api/draws/my-wins', authMiddleware, async (req, res) => {
  try {
    // Match by user_id (new records) OR by name (old records where winner_user_id was NULL)
    const wins = await q(
      `SELECT draw_tier, month_key, picked_at
       FROM draw_winners
       WHERE winner_user_id::text = $1::text
          OR (winner_user_id IS NULL
              AND winner_name = (SELECT name FROM users WHERE id::text = $1::text LIMIT 1))
       ORDER BY picked_at DESC`,
      [String(req.user.id)]
    );
    res.json({ wins });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

/* ══════════════════════════════════════════════════════════
   ADMIN ROUTES
══════════════════════════════════════════════════════════ */

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });
  const emailOk = email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
  const passOk  = password.trim() === ADMIN_PASSWORD.trim();
  if (!emailOk || !passOk)
    return res.status(401).json({ error: 'Incorrect admin credentials.' });
  const token = jwt.sign({ admin: true, email }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// GET /api/admin/stats
app.get('/api/admin/stats', adminMiddleware, async (_req, res) => {
  try {
    const [users]       = await q('SELECT COUNT(*) AS total FROM users');
    const [completions] = await q(`SELECT COUNT(*) AS total FROM progress WHERE (data->>'completed')::boolean = true`);
    const [points]      = await q('SELECT COALESCE(SUM(total), 0) AS total FROM user_points');
    const [messages]    = await q('SELECT COUNT(*) AS total FROM contacts');
    const [avgScore]    = await q(`SELECT ROUND(AVG(score * 100.0 / NULLIF(total_q, 0))::NUMERIC, 1) AS avg FROM activity`);
    const [active]      = await q('SELECT COUNT(DISTINCT user_id) AS total FROM activity');
    const breakdown     = await q(`SELECT subject_id, COUNT(*) AS completions FROM progress WHERE (data->>'completed')::boolean = true GROUP BY subject_id ORDER BY completions DESC`);

    res.json({
      totalUsers:        Number(users.total),
      totalCompletions:  Number(completions.total),
      totalPoints:       Number(points.total),
      totalMessages:     Number(messages.total),
      avgQuizScore:      Number(avgScore.avg) || 0,
      activeStudents:    Number(active.total),
      subjectBreakdown:  breakdown.map(r => ({ subject_id: r.subject_id, completions: Number(r.completions) }))
    });
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/admin/users
app.get('/api/admin/users', adminMiddleware, async (_req, res) => {
  try {
    const users = await q(`
      SELECT u.id, u.name, u.email, u.created_at,
             COALESCE(p.total, 0) AS points
      FROM users u
      LEFT JOIN user_points p ON p.user_id = u.id
      ORDER BY u.created_at DESC
    `);

    const result = await Promise.all(users.map(async u => {
      const progress = await q(`SELECT COUNT(*) AS total FROM progress WHERE user_id = $1 AND (data->>'completed')::boolean = true`, [u.id]);
      const lastActivity = await q1(`SELECT created_at FROM activity WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [u.id]);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        joined: u.created_at,
        points: Number(u.points),
        coursesCompleted: Number(progress[0].total),
        lastActive: lastActivity ? lastActivity.created_at : null
      };
    }));

    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/admin/messages
app.get('/api/admin/messages', adminMiddleware, async (_req, res) => {
  try {
    const rows = await q('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 200');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/admin/draws — all entries + winners for current month
app.get('/api/admin/draws', adminMiddleware, async (_req, res) => {
  try {
    const monthKey = new Date().toISOString().slice(0, 7);
    const entries  = await q(`
      SELECT de.draw_tier, de.points_spent, de.entered_at, u.name, u.email
      FROM draw_entries de
      JOIN users u ON u.id = de.user_id
      WHERE de.month_key = $1
      ORDER BY de.draw_tier, de.entered_at ASC
    `, [monthKey]);
    const winners  = await q('SELECT draw_tier, winner_name, picked_at FROM draw_winners WHERE month_key = $1', [monthKey]);
    const tierWinners = {}; winners.forEach(w => { tierWinners[w.draw_tier] = { name: w.winner_name, pickedAt: w.picked_at }; });
    res.json({ entries, tierWinners, monthKey });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/admin/draws/pick-winner — randomly select winner for a tier
app.post('/api/admin/draws/pick-winner', adminMiddleware, async (req, res) => {
  // Hard 10-second timeout so the request never hangs indefinitely
  const timer = setTimeout(() => {
    if (!res.headersSent) res.status(504).json({ error: 'Request timed out. Please try again.' });
  }, 10000);

  try {
    const { tier } = req.body || {};
    if (!DRAW_COSTS[tier]) {
      clearTimeout(timer);
      return res.status(400).json({ error: 'Invalid tier.' });
    }

    const monthKey = new Date().toISOString().slice(0, 7);

    // Cast both sides to text to avoid any type-mismatch hang on the JOIN
    const entries = await q(`
      SELECT de.user_id, u.name
      FROM draw_entries de
      JOIN users u ON u.id::text = de.user_id::text
      WHERE de.draw_tier = $1 AND de.month_key = $2
    `, [tier, monthKey]);

    if (!entries.length) {
      clearTimeout(timer);
      return res.status(400).json({ error: 'No entries in this draw tier for the current month.' });
    }

    const winner = entries[Math.floor(Math.random() * entries.length)];

    // Use EXCLUDED pseudo-table — avoids $N re-binding issues in ON CONFLICT SET
    await q(`
      INSERT INTO draw_winners (draw_tier, month_key, winner_user_id, winner_name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (draw_tier, month_key) DO UPDATE
        SET winner_user_id = EXCLUDED.winner_user_id,
            winner_name    = EXCLUDED.winner_name,
            picked_at      = NOW()
    `, [tier, monthKey, winner.user_id, winner.name]);

    clearTimeout(timer);
    if (!res.headersSent) res.json({ ok: true, winner: winner.name, tier, totalEntries: entries.length });
  } catch (err) {
    clearTimeout(timer);
    console.error('[pick-winner]', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/admin/export-csv
app.get('/api/admin/export-csv', adminMiddleware, async (_req, res) => {
  try {
    const users = await q(`
      SELECT u.id, u.name, u.email, u.created_at,
             COALESCE(p.total, 0) AS points
      FROM users u
      LEFT JOIN user_points p ON p.user_id = u.id
      ORDER BY points DESC
    `);

    const rows = await Promise.all(users.map(async u => {
      const progress = await q(`SELECT COUNT(*) AS total FROM progress WHERE user_id = $1 AND (data->>'completed')::boolean = true`, [u.id]);
      return [u.name, u.email, Number(u.points), Number(progress[0].total), new Date(u.created_at).toISOString().slice(0,10)];
    }));

    const header = ['Name', 'Email', 'Points', 'Courses Completed', 'Join Date'];
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="skillquest-users-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

/* ── SPA fallback ───────────────────────────────────────── */
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

/* ══════════════════════════════════════════════════════════
   START
══════════════════════════════════════════════════════════ */
(async () => {
  try {
    await initSchema();
    app.listen(PORT, () => {
      console.log('\n  SkillQuest is running.');
      console.log(`  Local:  http://localhost:${PORT}`);
      console.log(`  Admin:  http://localhost:${PORT}/admin.html`);
      console.log(`  DB:     ${DATABASE_URL ? 'PostgreSQL (remote)' : 'PostgreSQL (local)'}`);
      console.log(`  Admin email: ${ADMIN_EMAIL}`);
      console.log(`  Admin pass:  ${ADMIN_PASSWORD}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
})();
