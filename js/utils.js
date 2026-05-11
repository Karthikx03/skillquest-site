/* ============================================================
   SkillQuest — utils.js
   Shared UI: navbar, footer, toasts, modal helpers, formatters
   ============================================================ */

function renderNav() {
  const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  function isActive(page) { return currentPage === page ? 'active' : ''; }

  let authHtml;
  if (user) {
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const firstName = user.name.split(' ')[0];
    authHtml = `
      <div class="nav-user" id="navUserWrap">
        <button class="nav-user-btn" id="navUserBtn" onclick="toggleUserDropdown()" aria-haspopup="true" aria-expanded="false">
          <div class="nav-user-avatar">${initials}</div>
          <span class="nav-username">${firstName}</span>
          <svg class="nav-user-arrow" width="10" height="7" viewBox="0 0 10 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg>
        </button>
        <div class="nav-user-dropdown" id="navUserDropdown" role="menu">
          <a href="dashboard.html" class="nav-dropdown-item" role="menuitem">My Profile</a>
          <a href="dashboard.html" class="nav-dropdown-item" role="menuitem">Dashboard</a>
          <button onclick="logout()" class="nav-dropdown-item nav-dropdown-logout" role="menuitem">Log out</button>
        </div>
      </div>`;
  } else {
    authHtml = `
      <a href="login.html" class="btn btn-ghost btn-sm ${isActive('login.html')}">Log in</a>
      <a href="signup.html" class="btn btn-primary btn-sm ${isActive('signup.html')}">Get started</a>`;
  }

  const html = `
    <nav class="navbar" id="navbar">
      <div class="nav-container">
        <a href="index.html" class="nav-logo" aria-label="SkillQuest home">
          <div class="logo-icon" aria-hidden="true">SQ</div>
          <div class="logo-text">
            <span class="logo-title">SkillQuest</span>
            <span class="logo-sub">Learn what school skipped</span>
          </div>
        </a>
        <div class="nav-links" id="navLinks" role="navigation" aria-label="Main navigation">
          <a href="index.html" class="nav-link ${isActive('index.html')}">Home</a>
          <a href="courses.html" class="nav-link ${isActive('courses.html')}">Courses</a>
          <a href="leaderboard.html" class="nav-link ${isActive('leaderboard.html')}">Leaderboard</a>
          <a href="about.html" class="nav-link ${isActive('about.html')}">About</a>
          <div class="nav-auth">${authHtml}</div>
        </div>
        <button class="hamburger" id="hamburger" onclick="toggleMenu()" aria-label="Toggle navigation menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
  `;

  const container = document.getElementById('navbar');
  if (container) container.outerHTML = html;
  else document.body.insertAdjacentHTML('afterbegin', html);

  window.addEventListener('scroll', () => {
    const nav = document.querySelector('.navbar');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
  });
}

function toggleMenu() {
  const links = document.getElementById('navLinks');
  const btn   = document.getElementById('hamburger');
  const open  = links && links.classList.toggle('open');
  if (btn) { btn.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); }
}

function toggleUserDropdown() {
  const dropdown = document.getElementById('navUserDropdown');
  const btn = document.getElementById('navUserBtn');
  if (!dropdown) return;
  const isOpen = dropdown.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', String(isOpen));
}

function renderFooter() {
  const html = `
    <footer class="footer" id="footer">
      <div class="footer-container">
        <div class="footer-grid">

          <div class="footer-brand">
            <a href="index.html" class="footer-logo" style="display:flex;align-items:center;gap:10px;margin-bottom:16px;text-decoration:none;" aria-label="SkillQuest home">
              <div class="logo-icon" aria-hidden="true">SQ</div>
              <span class="logo-title" style="color:white;font-size:18px;font-weight:800;">SkillQuest</span>
            </a>
            <p class="footer-desc">Bridging the skills gap for students in Taiwan and beyond &mdash; free, gamified, and built around what you actually need to know.</p>
            <p style="margin-top:16px;font-size:12px;color:rgba(255,255,255,0.35);">Built in Taiwan &mdash; free for everyone, always.</p>
          </div>

          <div class="footer-links">
            <h4>Platform</h4>
            <a href="courses.html">Browse courses</a>
            <a href="leaderboard.html">Leaderboard</a>
            <a href="rewards.html">Rewards</a>
            <a href="about.html">About</a>
            <a href="contact.html">Contact</a>
          </div>

          <div class="footer-links">
            <h4>Subjects</h4>
            <a href="subject.html?id=finance">Financial Literacy</a>
            <a href="subject.html?id=ai-tech">AI Fundamentals</a>
            <a href="subject.html?id=cybersecurity">Cybersecurity</a>
            <a href="subject.html?id=digital">Digital Skills</a>
            <a href="subject.html?id=career">Career Readiness</a>
            <a href="subject.html?id=entrepreneurship">Entrepreneurship</a>
          </div>

          <div class="footer-newsletter">
            <h4>Stay in the loop</h4>
            <p>New courses and updates, straight to your inbox.</p>
            <div class="newsletter-form">
              <input type="email" placeholder="your@email.com" class="newsletter-input" id="footerEmail" aria-label="Email for newsletter">
              <button class="btn btn-primary btn-sm" onclick="subscribeNewsletter()">Subscribe</button>
            </div>
            <p style="margin-top:8px;font-size:12px;color:rgba(255,255,255,0.35);">No spam, ever. Unsubscribe any time.</p>
            <p style="margin-top:14px;font-size:13px;color:rgba(255,255,255,0.45);">
              Questions? <a href="mailto:skillquest@uedu.tw" style="color:rgba(255,255,255,0.7);text-decoration:underline;">skillquest@uedu.tw</a>
            </p>
          </div>

        </div>
        <div class="footer-bottom">
          <p>&copy; 2026 SkillQuest. All rights reserved.</p>
          <p>Made in Taiwan &mdash; free for everyone, always.</p>
        </div>
      </div>
    </footer>
  `;

  const container = document.getElementById('footer');
  if (container) container.outerHTML = html;
  else document.body.insertAdjacentHTML('beforeend', html);
}

function subscribeNewsletter() {
  const input = document.getElementById('footerEmail');
  if (!input) return;
  const email = input.value.trim();
  if (!email || !email.includes('@')) { showToast('Please enter a valid email address.', 'error'); return; }
  input.value = '';
  showToast('Subscribed. You\'ll hear from us when there\'s something worth sharing.', 'success');
}

/* ---- Toast notifications ---- */
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const colors = { success:'#10b981', error:'#ef4444', info:'#3b82f6', warning:'#f59e0b' };
  const icons  = { success:'&#10003;', error:'&#10007;', info:'&#9432;', warning:'&#9888;' };
  const toast  = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${message}</span><button class="toast-close" onclick="this.parentElement.remove()" aria-label="Dismiss">&times;</button>`;
  toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;align-items:center;gap:10px;background:${colors[type]||colors.info};color:#fff;padding:14px 18px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-size:14px;font-weight:500;max-width:380px;animation:slideInRight 0.3s ease;`;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.style.animation = 'fadeOut 0.3s ease forwards'; }, 3500);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 3900);
}

/* ---- Modal helpers ---- */
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
}

/* ---- Formatters ---- */
function formatPoints(n) { return Number(n).toLocaleString(); }

/* ---- Lookup helpers ---- */
function getSubjectColor(color) {
  return { purple:'#7c3aed', amber:'#d97706', red:'#dc2626', cyan:'#0891b2', emerald:'#059669', pink:'#db2777' }[color] || '#2563eb';
}
function getSubjectById(id) {
  if (typeof SUBJECTS === 'undefined') return null;
  return SUBJECTS.find(s => s.id === id) || null;
}
function getCourseById(subjectId, courseId) {
  const s = getSubjectById(subjectId);
  return s ? (s.courses.find(c => c.id === courseId) || null) : null;
}
function getDifficultyColor(d) {
  return { Beginner:'#10b981', Intermediate:'#f59e0b', Advanced:'#ef4444' }[d] || '#6b7280';
}

/* ---- Page init ---- */
function initPage() {
  renderNav();
  renderFooter();

  /* Close mobile menu on outside click */
  document.addEventListener('click', e => {
    const links     = document.getElementById('navLinks');
    const hamburger = document.getElementById('hamburger');
    if (links && links.classList.contains('open') && !links.contains(e.target) && !hamburger?.contains(e.target)) {
      links.classList.remove('open');
      hamburger?.classList.remove('open');
      hamburger?.setAttribute('aria-expanded', 'false');
    }
  });

  /* Close user dropdown on outside click */
  document.addEventListener('click', e => {
    const wrap = document.getElementById('navUserWrap');
    if (wrap && !wrap.contains(e.target)) {
      const dd = document.getElementById('navUserDropdown');
      const btn = document.getElementById('navUserBtn');
      if (dd) dd.classList.remove('open');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  });

  /* Close modals on backdrop click */
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.style.display = 'none';
      document.body.style.overflow = '';
    }
  });

  /* Close modals on Escape */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => {
        if (m.style.display === 'flex') { m.style.display = 'none'; document.body.style.overflow = ''; }
      });
      const dd = document.getElementById('navUserDropdown');
      if (dd && dd.classList.contains('open')) {
        dd.classList.remove('open');
        document.getElementById('navUserBtn')?.setAttribute('aria-expanded', 'false');
      }
    }
  });
}

/* ---- Animation keyframes (injected once) ---- */
(function () {
  const s = document.createElement('style');
  s.textContent = `
    @keyframes slideInRight { from { transform:translateX(110%);opacity:0; } to { transform:translateX(0);opacity:1; } }
    @keyframes fadeOut      { from { opacity:1; } to { opacity:0;transform:translateY(8px); } }
    .toast-close { background:none;border:none;color:#fff;cursor:pointer;font-size:18px;padding:0;margin-left:4px;opacity:0.8;line-height:1; }
    .toast-close:hover { opacity:1; }
  `;
  document.head.appendChild(s);
})();
