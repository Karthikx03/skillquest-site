/**
 * SkillQuest — auth.js
 *
 * Authentication layer. All operations try the backend API first
 * (via api.js) and fall back to localStorage so the site works
 * without a running server.
 *
 * Load order in HTML: api.js → data.js → auth.js → utils.js
 */

const AUTH_KEY  = 'sq_current_user';
const USERS_KEY = 'sq_users';

/* ── User store (localStorage — legacy compat) ─────────── */
function getUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
}

function setCurrentUser(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function isLoggedIn() {
  // If backend JWT exists, trust it; otherwise check localStorage
  if (typeof API !== 'undefined' && API.getToken()) return true;
  return getCurrentUser() !== null;
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
  }
}

/* ── Signup ─────────────────────────────────────────────── */
async function signup(name, email, password) {
  if (!name || !email || !password)
    return { success: false, error: 'All fields are required.' };
  if (password.length < 6)
    return { success: false, error: 'Password must be at least 6 characters.' };

  // Try backend
  if (typeof API !== 'undefined') {
    const res = await API.signup(name, email, password);
    if (res.ok) return { success: true, user: res.data.user };
    // If backend is unreachable (network error), fall through to localStorage
    if (!res.error.includes('already exists')) {
      // Fallback to localStorage signup
    } else {
      return { success: false, error: res.error };
    }
  }

  // localStorage fallback
  const users = getUsers();
  if (users.find(u => u.email === email.toLowerCase().trim()))
    return { success: false, error: 'An account with this email already exists.' };

  const user = {
    id: 'u_' + Date.now(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  const { password: _, ...safeUser } = user;
  setCurrentUser(safeUser);
  return { success: true, user: safeUser };
}

/* ── Login ──────────────────────────────────────────────── */
async function login(email, password) {
  if (!email || !password)
    return { success: false, error: 'Email and password are required.' };

  // Try backend
  if (typeof API !== 'undefined') {
    const res = await API.login(email, password);
    if (res.ok) return { success: true, user: res.data.user };
    // If error is auth-related, don't fall through
    if (res.error && !res.error.toLowerCase().includes('fetch') && !res.error.toLowerCase().includes('network')) {
      return { success: false, error: res.error };
    }
  }

  // localStorage fallback
  const users = getUsers();
  const user  = users.find(u => u.email === email.toLowerCase().trim() && u.password === password);
  if (!user) return { success: false, error: 'Invalid email or password.' };
  const { password: _, ...safeUser } = user;
  setCurrentUser(safeUser);
  return { success: true, user: safeUser };
}

/* ── Logout ─────────────────────────────────────────────── */
function logout() {
  if (typeof API !== 'undefined') { API.logout(); return; }
  localStorage.removeItem(AUTH_KEY);
  window.location.href = 'index.html';
}

/* ── Points ─────────────────────────────────────────────── */
function getUserPoints(userId) {
  return parseInt(localStorage.getItem('sq_points_' + userId) || '0');
}

function addUserPoints(userId, points) {
  const current = getUserPoints(userId);
  const next    = current + points;
  localStorage.setItem('sq_points_' + userId, next);

  const log = JSON.parse(localStorage.getItem('sq_points_log_' + userId) || '[]');
  log.unshift({ points, total: next, date: new Date().toISOString() });
  localStorage.setItem('sq_points_log_' + userId, JSON.stringify(log.slice(0, 20)));

  // Sync to backend (fire-and-forget)
  if (typeof API !== 'undefined') API.addPoints(userId, points).catch(() => {});
  return next;
}

function deductUserPoints(userId, points) {
  const current = getUserPoints(userId);
  const next    = Math.max(0, current - points);
  localStorage.setItem('sq_points_' + userId, next);
  if (typeof API !== 'undefined') API.deductPoints(userId, points).catch(() => {});
  return next;
}

function getPointsLog(userId) {
  return JSON.parse(localStorage.getItem('sq_points_log_' + userId) || '[]');
}

/* ── Progress ────────────────────────────────────────────── */
function getProgress(userId) {
  return JSON.parse(localStorage.getItem('sq_progress_' + userId) || '{}');
}

function saveProgress(userId, progress) {
  localStorage.setItem('sq_progress_' + userId, JSON.stringify(progress));
  if (typeof API !== 'undefined') API.saveProgress(userId, progress).catch(() => {});
}

function markLessonComplete(userId, subjectId, courseId, lessonId) {
  const progress = getProgress(userId);
  if (!progress[subjectId]) progress[subjectId] = {};
  if (!progress[subjectId][courseId]) progress[subjectId][courseId] = { lessonsCompleted: [], quizScore: null, completed: false };
  if (!progress[subjectId][courseId].lessonsCompleted.includes(lessonId)) {
    progress[subjectId][courseId].lessonsCompleted.push(lessonId);
  }
  saveProgress(userId, progress);
}

function markCourseComplete(userId, subjectId, courseId, score, points, totalQuestions) {
  const progress = getProgress(userId);
  if (!progress[subjectId]) progress[subjectId] = {};
  if (!progress[subjectId][courseId]) progress[subjectId][courseId] = { lessonsCompleted: [], quizScore: null, completed: false };
  progress[subjectId][courseId].quizScore        = score;
  progress[subjectId][courseId].totalQuestions   = totalQuestions || 5;
  progress[subjectId][courseId].completed        = true;
  progress[subjectId][courseId].completedAt      = new Date().toISOString();
  progress[subjectId][courseId].pointsEarned     = points;
  saveProgress(userId, progress);

  // Log activity
  const activity = JSON.parse(localStorage.getItem('sq_activity_' + userId) || '[]');
  activity.unshift({ subjectId, courseId, score, totalQuestions: totalQuestions || 5, points, date: new Date().toISOString() });
  localStorage.setItem('sq_activity_' + userId, JSON.stringify(activity.slice(0, 20)));

  if (typeof API !== 'undefined') {
    API.logActivity(userId, { subjectId, courseId, score, totalQuestions, pointsEarned: points }).catch(() => {});
  }
}

function getCourseProgress(userId, subjectId, courseId) {
  const progress = getProgress(userId);
  if (!progress[subjectId] || !progress[subjectId][courseId])
    return { lessonsCompleted: [], quizScore: null, completed: false };
  return progress[subjectId][courseId];
}

function getCoursesCompleted(userId) {
  const progress = getProgress(userId);
  let count = 0;
  for (const s in progress) for (const c in progress[s]) if (progress[s][c].completed) count++;
  return count;
}

function getSubjectsStarted(userId) {
  const progress = getProgress(userId);
  return Object.keys(progress).filter(s => Object.keys(progress[s]).length > 0).length;
}

function getRecentActivity(userId) {
  return JSON.parse(localStorage.getItem('sq_activity_' + userId) || '[]');
}
