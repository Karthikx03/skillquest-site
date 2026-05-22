// seed.js — demo data permanently disabled.
// All leaderboard and admin data comes from the live PostgreSQL backend only.
(function removeFakeData() {
  try {
    // Remove any previously seeded demo_ users from localStorage
    const users = JSON.parse(localStorage.getItem('sq_users') || '[]');
    const real  = users.filter(u => !u.id || !String(u.id).startsWith('demo_'));
    if (real.length !== users.length) {
      localStorage.setItem('sq_users', JSON.stringify(real));
    }
    // Remove leftover demo_ points and progress keys
    Object.keys(localStorage)
      .filter(k => k.includes('demo_'))
      .forEach(k => localStorage.removeItem(k));
    // Clear old seed flag so future users are not affected
    localStorage.removeItem('sq_seeded');
  } catch (_) {}
})();
