import { getSession, saveAttempt, getUserAttempts, deleteAttempt } from '../../lib/auth'
import { isDBAvailable } from '../../lib/db'

async function auth(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  return await getSession(token)
}

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

export default async function handler(req, res) {
  if (!isDBAvailable()) return res.status(503).json({ error: 'DB not configured' })
  const sess = await auth(req)
  if (!sess) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method === 'GET') {
    const attempts = await getUserAttempts(sess.username)
    return res.status(200).json(attempts)
  }
  if (req.method === 'POST') {
    const id = await saveAttempt(sess.username, req.body)
    return res.status(200).json({ ok: true, id })
  }
  if (req.method === 'DELETE') {
    const { id } = req.body || {}
    if (id) await deleteAttempt(sess.username, id)
    return res.status(200).json({ ok: true })
  }
  res.status(405).end()
}
