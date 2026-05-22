# SkillQuest — Deployment Guide
**Get a real public URL so friends can register and you can see everything in the admin.**

This takes about 15–20 minutes. Both services used (Supabase + Render) are free.

---

## Your Admin Credentials

| Field    | Value                  |
|----------|------------------------|
| Email    | `admin@skillquest.tw`  |
| Password | `SkillQuest2026!`      |

> Change these in Render's environment variables after deploying (see Step 3).

---

## Step 1 — Create a Free PostgreSQL Database (Supabase)

1. Go to **https://supabase.com** → click **Start your project** → sign up free
2. Click **New project** → choose any name (e.g. `skillquest`) → pick any region → click **Create new project**
3. Wait ~2 minutes for the project to set up
4. Go to **Settings → Database** (left sidebar)
5. Scroll to **Connection string → URI** section
6. Copy the connection string — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres
   ```
7. **Save this string** — you'll need it in Step 3

> The database tables are created automatically when the server first starts (no manual setup needed).

---

## Step 2 — Push Your Code to GitHub

1. Go to **https://github.com** → sign in → click **New repository**
2. Name it `skillquest` → keep it **Private** → click **Create repository**
3. Open **Terminal** on your Mac and run:

```bash
cd "/Users/karthikeyan/Documents/Claude/Projects/web programing/skillquest-site"

git init
git add .
git commit -m "SkillQuest v2 — final version"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/skillquest.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 3 — Deploy the Backend (Render)

1. Go to **https://render.com** → sign up free with GitHub
2. Click **New → Web Service**
3. Connect your GitHub account if prompted → select the `skillquest` repository
4. Fill in the settings:
   - **Name**: `skillquest`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Scroll to **Environment Variables** → click **Add Environment Variable** for each:

   | Key              | Value                                           |
   |------------------|-------------------------------------------------|
   | `DATABASE_URL`   | (paste your Supabase connection string)         |
   | `JWT_SECRET`     | (any long random string, e.g. `sq_jwt_9f2a...`) |
   | `ADMIN_EMAIL`    | `admin@skillquest.tw`                           |
   | `ADMIN_PASSWORD` | `SkillQuest2026!`                               |

6. Click **Create Web Service** → wait 3–5 minutes for first deploy
7. Your site is now live at a URL like: **`https://skillquest.onrender.com`**

> **Send this URL to your friends.** Everyone who registers goes into the same database.

---

## Step 4 — Access Your Admin Dashboard

Go to: `https://skillquest.onrender.com/admin.html`

Log in with:
- Email: `admin@skillquest.tw`
- Password: `SkillQuest2026!`

You will see every registered user, their points, courses completed, and the leaderboard — all updated in real time as your friends use the site.

---

## Important Notes

- **Free tier "spin-down"**: Render's free tier pauses after 15 minutes of inactivity. The first request after a pause takes ~30 seconds to wake up. Upgrade to Render's $7/month Starter plan to avoid this.
- **Custom domain**: You can connect a custom domain (e.g. `skillquest.uedu.tw`) in Render's Settings → Custom Domains.
- **Supabase limits**: The free tier allows 500 MB storage and 2 GB bandwidth per month — more than enough for a class project with dozens of users.
- **Change credentials**: Update `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Render's environment variables at any time. Changes take effect after a redeploy.

---

## Troubleshooting

**Site loads but login doesn't work**
→ Check that `DATABASE_URL` is set correctly in Render env vars. It must start with `postgresql://`.

**"This site can't be reached"**
→ Render's free tier may be spinning up. Wait 30 seconds and refresh.

**Leaderboard is empty**
→ The leaderboard only shows users who have completed at least one quiz and earned points. Ask your friends to finish a course first.

**Friends get an error when signing up**
→ Check Render's logs (Dashboard → skillquest → Logs) for the exact error.
