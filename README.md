# SkillQuest

A free, gamified learning platform for essential 21st-century skills, aligned with UN SDG 4: Quality Education.

---

## Running the site

### Option A — Frontend only (no backend needed)
Just open `index.html` in a browser. Everything uses `localStorage` automatically when no backend is detected.

### Option B — Full stack with backend (recommended)

```bash
# 1. Install dependencies (only needed once)
npm install

# 2. Start the server
npm start

# 3. Open in browser
# http://localhost:3000
```

For development with auto-restart on file changes (Node 18+):
```bash
npm run dev
```

The backend creates a SQLite database at `data/skillquest.db` automatically on first run.

---

## Tech stack

| Layer     | Technology                                  |
|-----------|---------------------------------------------|
| Frontend  | Vanilla HTML/CSS/JavaScript                 |
| Backend   | Node.js + Express                           |
| Database  | SQLite via sql.js (pure JS, no compilation) |
| Auth      | bcryptjs (passwords) + JWT (sessions)       |

---

## API Reference

All API routes are prefixed with `/api`.

| Method | Endpoint                  | Auth | Description                  |
|--------|---------------------------|------|------------------------------|
| POST   | `/auth/signup`            | No   | Register a new user          |
| POST   | `/auth/login`             | No   | Login → returns JWT token    |
| GET    | `/user/me`                | Yes  | Current user profile         |
| GET    | `/user/points`            | Yes  | Total points                 |
| POST   | `/user/points/add`        | Yes  | Add points                   |
| POST   | `/user/points/deduct`     | Yes  | Deduct points                |
| GET    | `/user/progress`          | Yes  | All course progress          |
| PUT    | `/user/progress`          | Yes  | Save course progress         |
| GET    | `/user/activity`          | Yes  | Recent quiz activity         |
| POST   | `/user/activity`          | Yes  | Log a completed quiz         |
| GET    | `/leaderboard`            | No   | Top learners by points       |
| POST   | `/contact`                | No   | Submit contact form          |

Authenticated requests require an `Authorization: Bearer <token>` header.

---

## Project structure

```
skillquest-site/
  index.html          Homepage
  dashboard.html      User dashboard
  courses.html        Course browser
  leaderboard.html    Leaderboard
  about.html          About / SDG 4
  login.html          Login
  signup.html         Sign up
  css/
    style.css         All styles
  js/
    api.js            Backend API client (with localStorage fallback)
    auth.js           Authentication helpers
    data.js           Course data (subjects, courses, lessons, quizzes)
    icons.js          SVG icon library
    utils.js          Shared UI: navbar, footer, toasts
  server.js           Express backend
  package.json        Node dependencies
  data/
    skillquest.db     SQLite database (auto-created on first run)
```

---

## Features

- 6 subject areas: Financial Literacy, AI Fundamentals, Cybersecurity, Digital Skills, Career Readiness, Entrepreneurship
- 24 complete courses with lesson content and quizzes
- Points system proportional to quiz scores
- Leaderboard showing real registered users only
- Rewards lottery: redeem points for prizes
- Course certificates (score 80%+)
- User authentication via backend API with localStorage fallback
- Progress tracking per lesson and course
- Dashboard with stats, subject progress, and recent activity
- Fully responsive, mobile-first design
- No emojis in UI — consistent SVG icon library throughout
- Aligned with UN SDG 4: Quality Education
