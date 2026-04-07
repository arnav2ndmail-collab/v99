import { ADMIN_EMAIL, ADMIN_PASS, registerAdminToken, genToken } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email, password } = req.body || {}
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  const token = genToken()
  registerAdminToken(token)
  return res.status(200).json({ token })
}
