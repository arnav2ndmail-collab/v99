import { createUser, validateUser, createSession, getSession, deleteSession } from '../../lib/auth'
import { isDBAvailable } from '../../lib/db'

export default async function handler(req, res) {
  const { action } = req.query

  if (!isDBAvailable()) {
    return res.status(503).json({
      error: 'Database not configured. Please add Upstash Redis env vars (see README).',
      setup: true
    })
  }

  if (action === 'signup' && req.method === 'POST') {
    const { username, password } = req.body || {}
    if (!username || !password) return res.status(400).json({ error: 'Fill in all fields' })
    const u = username.trim()
    if (u.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    if (!/^[a-zA-Z0-9_]+$/.test(u)) return res.status(400).json({ error: 'Username: letters, numbers, underscores only' })
    const result = await createUser(u, password)
    if (result.error) return res.status(409).json({ error: result.error })
    const token = await createSession(result.user.username)
    return res.status(200).json({ token, user: { username: result.user.username } })
  }

  if (action === 'login' && req.method === 'POST') {
    const { username, password } = req.body || {}
    if (!username || !password) return res.status(400).json({ error: 'Fill in all fields' })
    const user = await validateUser(username.trim(), password)
    if (!user) return res.status(401).json({ error: 'Wrong username or password' })
    const token = await createSession(user.username)
    return res.status(200).json({ token, user: { username: user.username } })
  }

  if (action === 'me' && req.method === 'GET') {
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    const sess = await getSession(token)
    if (!sess) return res.status(401).json({ error: 'Not authenticated' })
    return res.status(200).json({ username: sess.username })
  }

  if (action === 'logout' && req.method === 'POST') {
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    await deleteSession(token)
    return res.status(200).json({ ok: true })
  }

  res.status(404).end()
}
