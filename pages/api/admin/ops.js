import fs from 'fs'
import path from 'path'
import { isAdminSession, getAllUsers, getUserAttempts, deleteAttempt, deleteUser, getAllAttemptCount, ADMIN_EMAIL } from '../../../lib/auth'
import { isDBAvailable, dbGet, dbSet, dbDel, dbScan } from '../../../lib/db'

// Vercel filesystem is READ-ONLY at runtime.
// Test metadata edits (title/order/color) are stored in Redis, merged at read time.

async function checkAdmin(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return false
  if (token.startsWith('admin_no_db_')) {
    try { return Buffer.from(token.replace('admin_no_db_', ''), 'base64').toString() === ADMIN_EMAIL } catch { return false }
  }
  return await isAdminSession(token)
}

const BASE = () => path.join(process.cwd(), 'public', 'tests')
const META = 'testmeta:'

function scan(dir, base, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const item of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, item)
    if (fs.statSync(full).isDirectory()) { scan(full, base, out); continue }
    if (!item.endsWith('.json')) continue
    try {
      const d = JSON.parse(fs.readFileSync(full, 'utf8'))
      if (!Array.isArray(d.questions)) continue
      out.push({
        path: path.relative(base, full).replace(/\\/g, '/'),
        title: d.title || item.replace('.json', ''),
        subject: d.subject || 'Other',
        questionCount: d.questions.length,
        dur: d.dur || 180,
        mCor: d.mCor || 4,
        mNeg: d.mNeg || 1,
        order: d.order ?? 999,
        accentColor: d.accentColor || ''
      })
    } catch {}
  }
  return out
}

export const config = { api: { bodyParser: { sizeLimit: '50mb' } } }

export default async function handler(req, res) {
  if (!await checkAdmin(req)) return res.status(403).json({ error: 'Forbidden' })
  const { action } = req.query

  if (action === 'list-tests') {
    const raw = scan(BASE(), BASE())
    if (isDBAvailable()) {
      const merged = await Promise.all(raw.map(async t => {
        const m = await dbGet(META + t.path)
        return m ? { ...t, ...m } : t
      }))
      merged.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      return res.status(200).json(merged)
    }
    return res.status(200).json(raw)
  }

  if (action === 'rename-test' && req.method === 'POST') {
    if (!isDBAvailable()) return res.status(503).json({ error: 'Upstash Redis not configured — cannot save metadata. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars in Vercel.' })
    const { path: p, title, subject, dur, mCor, mNeg, order, accentColor } = req.body || {}
    if (!p) return res.status(400).json({ error: 'No path' })
    const ex = await dbGet(META + p) || {}
    await dbSet(META + p, { ...ex, path: p, title, subject, dur: Number(dur), mCor: Number(mCor), mNeg: Number(mNeg), order: Number(order), accentColor })
    return res.status(200).json({ ok: true })
  }

  if (action === 'delete-test' && req.method === 'POST') {
    return res.status(400).json({ error: 'Vercel filesystem is read-only. To delete a test, remove the .json file from your GitHub repo (public/tests/) and push — it will redeploy automatically.', vercelLimit: true })
  }

  if (action === 'upload-test' && req.method === 'POST') {
    return res.status(400).json({ error: 'Vercel filesystem is read-only. To add tests, put .json files in public/tests/ in your GitHub repo and push.', vercelLimit: true })
  }

  if (action === 'create-folder' && req.method === 'POST') {
    return res.status(400).json({ error: 'Vercel filesystem is read-only. Create folders in your GitHub repo instead.', vercelLimit: true })
  }

  if (action === 'list-users') {
    if (!isDBAvailable()) return res.status(200).json([])
    return res.status(200).json(await getAllUsers())
  }

  if (action === 'delete-user' && req.method === 'POST') {
    if (!isDBAvailable()) return res.status(503).json({ error: 'DB not configured' })
    await deleteUser(req.body?.username)
    return res.status(200).json({ ok: true })
  }

  if (action === 'user-attempts') {
    if (!isDBAvailable()) return res.status(200).json([])
    return res.status(200).json(await getUserAttempts(req.query.username))
  }

  if (action === 'delete-attempt' && req.method === 'POST') {
    if (!isDBAvailable()) return res.status(503).json({ error: 'DB not configured' })
    await deleteAttempt(req.body?.userId, req.body?.attemptId)
    return res.status(200).json({ ok: true })
  }

  if (action === 'stats') {
    const tests = scan(BASE(), BASE())
    if (!isDBAvailable()) return res.status(200).json({ users: 0, tests: tests.length, attempts: 0, dbStatus: 'not configured' })
    return res.status(200).json({ users: (await getAllUsers()).length, tests: tests.length, attempts: await getAllAttemptCount(), dbStatus: 'connected ✓' })
  }

  res.status(404).end()
}
