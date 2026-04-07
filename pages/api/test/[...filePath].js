import fs from 'fs'
import path from 'path'

export default function handler(req, res) {
  const { filePath } = req.query
  if (!filePath) return res.status(400).end()
  const base = path.join(process.cwd(), 'public', 'tests')
  const safe = path.join(base, ...(Array.isArray(filePath) ? filePath : [filePath]))
  if (!safe.startsWith(base)) return res.status(403).end()
  if (!fs.existsSync(safe)) return res.status(404).end()
  try { res.status(200).json(JSON.parse(fs.readFileSync(safe, 'utf8'))) }
  catch { res.status(500).end() }
}
