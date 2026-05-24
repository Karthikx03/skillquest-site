/**
 * SkillQuest API Client
 *
 * Wraps all backend fetch() calls.
 * When the backend is not running (offline / pure frontend mode),
 * every method falls back to localStorage — so the site still works
 * without spinning up Node.
 *
 * Usage: include BEFORE auth.js and utils.js
 *   <script src="js/api.js"></script>
 */

const API = (() => {
  const BASE    = '/api';
  const TOKEN_KEY = 'sq_token';

  /* ── Helpers ─────────────────────────────────────────── */
  function getToken()      { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t)     { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken()    { localStorage.removeItem(TOKEN_KEY); }

  function authHeader() {
    const t = getToken();
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  }

  async function req(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeader() }
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const r = await fetch(BASE + path, opts);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Request failed');
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /* ── Auth ─────────────────────────────────────────────── */
  async function signup(name, email, password) {
    const res = await req('POST', '/auth/signup', { name, email, password });
    if (res.ok) {
      setToken(res.data.token);
      // Mirror to localStorage so legacy auth.js helpers still work
      _setLocalUser(res.data.user);
    }
    return res;
  }

  async function login(email, password) {
    const res = await req('POST', '/auth/login', { email, password });
    if (res.ok) {
      setToken(res.data.token);
      _setLocalUser(res.data.user);
    }
    return res;
  }

  function logout() {
    clearToken();
    localStorage.removeItem('sq_current_user');
    window.location.href = 'index.html';
  }

  /* ── Points ───────────────────────────────────────────── */
  async function getPoints(userId) {
    const localPoints = parseInt(localStorage.getItem('sq_points_' + userId) || '0');
    const res = await req('GET', '/user/points');
    if (res.ok) {
      const backendPoints = res.data.points || 0;
      // Never let a stale backend wipe local progress — use the higher value
      const maxPoints = Math.max(backendPoints, localPoints);
      localStorage.setItem('sq_points_' + userId, maxPoints);
      // If local is ahead (backend missed a fire-and-forget), push the delta up now
      if (localPoints > backendPoints && localPoints > 0) {
        const diff = localPoints - backendPoints;
        await req('POST', '/user/points/add', { points: diff, note: 'sync' }).catch(() => {});
      }
      return maxPoints;
    }
    return localPoints;
  }

  async function addPoints(userId, points, note) {
    // Optimistically update localStorage
    const current = parseInt(localStorage.getItem('sq_points_' + userId) || '0');
    const next    = current + points;
    localStorage.setItem('sq_points_' + userId, next);
    // Sync to backend
    req('POST', '/user/points/add', { points, note }).catch(() => {});
    return next;
  }

  async function deductPoints(userId, points) {
    const current = parseInt(localStorage.getItem('sq_points_' + userId) || '0');
    const next    = Math.max(0, current - points);
    localStorage.setItem('sq_points_' + userId, next);
    req('POST', '/user/points/deduct', { points }).catch(() => {});
    return next;
  }

  /* ── Progress ─────────────────────────────────────────── */
  async function getProgress(userId) {
    const localProgress = JSON.parse(localStorage.getItem('sq_progress_' + userId) || '{}');
    const res = await req('GET', '/user/progress');
    if (res.ok) {
      const backendProgress = res.data || {};
      // Merge: start from local (most up-to-date), then fill in any backend-only entries
      const merged = JSON.parse(JSON.stringify(localProgress));
      for (const sid in backendProgress) {
        if (!merged[sid]) merged[sid] = {};
        for (const cid in backendProgress[sid]) {
          if (!merged[sid][cid]) merged[sid][cid] = backendProgress[sid][cid];
        }
      }
      // Push any local-only completed courses up to backend (missed fire-and-forget)
      for (const sid in localProgress) {
        for (const cid in localProgress[sid]) {
          const lc = localProgress[sid][cid];
          const bc = backendProgress[sid] && backendProgress[sid][cid];
          if (!bc || (lc.completed && !bc.completed)) {
            req('PUT', '/user/progress', { subjectId: sid, courseId: cid, data: lc }).catch(() => {});
          }
        }
      }
      localStorage.setItem('sq_progress_' + userId, JSON.stringify(merged));
      return merged;
    }
    return localProgress;
  }

  async function saveProgress(userId, progress) {
    localStorage.setItem('sq_progress_' + userId, JSON.stringify(progress));
    // Sync each course to backend
    for (const subjectId in progress) {
      for (const courseId in progress[subjectId]) {
        req('PUT', '/user/progress', { subjectId, courseId, data: progress[subjectId][courseId] }).catch(() => {});
      }
    }
  }

  /* ── Activity ─────────────────────────────────────────── */
  async function logActivity(userId, { subjectId, courseId, score, totalQuestions, pointsEarned }) {
    const activity = JSON.parse(localStorage.getItem('sq_activity_' + userId) || '[]');
    const entry    = { subjectId, courseId, score, totalQuestions: totalQuestions || 5, points: pointsEarned, date: new Date().toISOString() };
    activity.unshift(entry);
    localStorage.setItem('sq_activity_' + userId, JSON.stringify(activity.slice(0, 20)));
    req('POST', '/user/activity', { subjectId, courseId, score, totalQuestions, pointsEarned }).catch(() => {});
  }

  /* ── Leaderboard ──────────────────────────────────────── */
  async function getLeaderboard() {
    const res = await req('GET', '/leaderboard');
    if (res.ok) return res.data;
    // Fallback: build from localStorage
    return _buildLocalLeaderboard();
  }

  /* ── Contact ──────────────────────────────────────────── */
  async function submitContact({ name, email, type, subject, message }) {
    // Always save locally first
    const contacts = JSON.parse(localStorage.getItem('sq_contacts') || '[]');
    contacts.push({ name, email, type, subject: subject || '', message, date: new Date().toISOString() });
    localStorage.setItem('sq_contacts', JSON.stringify(contacts));
    // Then send to backend
    return req('POST', '/contact', { name, email, type, subject: subject || '', message });
  }

  /* ── Private helpers ──────────────────────────────────── */
  function _setLocalUser(user) {
    localStorage.setItem('sq_current_user', JSON.stringify(user));
  }

  function _buildLocalLeaderboard() {
    try {
      const users = JSON.parse(localStorage.getItem('sq_users') || '[]');
      return users.map(u => ({
        id: u.id, name: u.name,
        points: parseInt(localStorage.getItem('sq_points_' + u.id) || '0'),
        coursesCompleted: _countCompleted(u.id)
      })).filter(u => u.points > 0 || u.coursesCompleted > 0)
         .sort((a, b) => b.points - a.points);
    } catch { return []; }
  }

  function _countCompleted(userId) {
    try {
      const p = JSON.parse(localStorage.getItem('sq_progress_' + userId) || '{}');
      return Object.values(p).flatMap(s => Object.values(s)).filter(c => c.completed).length;
    } catch { return 0; }
  }

  return { signup, login, logout, getToken, getPoints, addPoints, deductPoints, getProgress, saveProgress, logActivity, getLeaderboard, submitContact };
})();
