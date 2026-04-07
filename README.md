# TestZyro v3 — CBT Platform

## 🚀 Deploy to Vercel (5 min)

```bash
# 1. Unzip & push to GitHub
unzip testzyro_v3.zip && mv tz3 testzyro && cd testzyro
git init && git add . && git commit -m "TestZyro v3"
git remote add origin https://github.com/YOU/testzyro.git
git push -u origin main

# 2. Import at vercel.com → New Project → Deploy
```

## 🗄️ Set up Upstash Redis (FREE — for user accounts & cross-device sync)

**Vercel does NOT have a built-in KV anymore. Use Upstash instead (also free):**

1. Go to **upstash.com** → Sign up (free)
2. Click **Create Database** → name it anything → select region → **Create**
3. In the database page, copy **REST URL** and **REST Token**
4. In **Vercel** → Your Project → **Settings** → **Environment Variables**
5. Add:
   - `UPSTASH_REDIS_REST_URL` = your REST URL
   - `UPSTASH_REDIS_REST_TOKEN` = your REST Token
6. Redeploy: Vercel Dashboard → Deployments → **Redeploy**

That's it! Users can now sign up and see results synced across all devices.

## 🔐 Admin Panel

Visit `/admin` on your site.
- **Email:** `lastnitro51@gmail.com`
- **Password:** `lastnitro51`

### Admin features:
- 📋 **Tests tab** — See all tests, edit title/subject/duration/marks/sort order/accent color, delete
- 📤 **Upload tab** — Drop .json files to add to any folder
- 👥 **Users tab** — View users, see their attempts, delete users

## 📁 Folder Structure

```
testzyro/
├── pages/
│   ├── index.js              ← Main app
│   ├── admin.js              ← Admin panel at /admin
│   └── api/
│       ├── auth.js           ← User auth (signup/login/logout)
│       ├── attempts.js       ← Save/get/delete attempts
│       ├── tests.js          ← Scan public/tests/ folder
│       ├── test/[...].js     ← Serve individual test JSON
│       └── admin/
│           ├── login.js      ← Admin auth
│           └── ops.js        ← Admin CRUD
├── lib/
│   ├── db.js                 ← Upstash Redis wrapper
│   └── auth.js               ← Auth logic
├── public/
│   └── tests/
│       └── JEE-2026/         ← 3 pre-built tests included!
└── styles/globals.css
```

## ➕ Adding Tests

### Via Admin panel (easiest)
Go to `/admin` → Upload tab → drop .json files

### Via GitHub (for pre-built tests)
Put `.json` files in `public/tests/` → subfolders become library folders → push → auto-redeploys

### JSON Format
```json
{
  "title": "JEE Main 2026 Physics",
  "subject": "JEE",
  "source": "Eduniti",
  "dur": 180,
  "mCor": 4,
  "mNeg": 1,
  "order": 1,
  "accentColor": "#6366f1",
  "questions": [
    { "type": "MCQ", "text": "...", "opts": ["A","B","C","D"], "ans": "B", "hasImage": false },
    { "type": "INTEGER", "text": "...", "ans": "42" }
  ]
}
```

## 🖼️ Diagrams

**For PDF-converted tests:** Diagrams are extracted and embedded automatically during conversion.

**For pre-built JSON tests:** When a user clicks "🖼️ Diagram", the app fetches the original PDF from `public/tests/` and renders the relevant page live in the browser.

To enable diagrams for pre-built tests:
1. Mark questions with `"hasImage": true` in the JSON
2. Add the corresponding `pageIdx` (0-based page number) to each question
3. Put the original PDF alongside the JSON in `public/tests/JEE-2026/yourtest.pdf`

## 🔑 Gemini API (PDF → CBT converter)
Get free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
Key stays in user's browser — never stored on server.
