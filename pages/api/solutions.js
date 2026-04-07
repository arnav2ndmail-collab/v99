import fs from 'fs'
import path from 'path'

function scanSolutions(dir, base, out = []) {
  if (!fs.existsSync(dir)) return out
  const items = fs.readdirSync(dir).sort((a,b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}))
  for (const item of items) {
    const full = path.join(dir, item)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) { scanSolutions(full, base, out); continue }
    if (!item.toLowerCase().endsWith('.pdf')) continue
    const rel = path.relative(base, full).replace(/\\/g, '/')
    const parts = rel.split('/')
    out.push({
      name: item.replace(/\.pdf$/i, ''),
      filename: item,
      path: rel,
      folder: parts.length > 1 ? parts[0] : '(root)',
      size: stat.size,
      mtime: stat.mtimeMs
    })
  }
  return out
}

export default function handler(req, res) {
  const base = path.join(process.cwd(), 'public', 'solutions')
  const solutions = scanSolutions(base, base)
  res.status(200).json(solutions)
}
