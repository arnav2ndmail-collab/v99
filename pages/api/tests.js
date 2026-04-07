import fs from 'fs'
import path from 'path'
import { isDBAvailable, dbGet } from '../../lib/db'

function scan(dir, base, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const item of fs.readdirSync(dir).sort((a,b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}))) {
    const full = path.join(dir, item)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) { scan(full, base, out); continue }
    if (!item.endsWith('.json')) continue
    try {
      const d = JSON.parse(fs.readFileSync(full, 'utf8'))
      if (!Array.isArray(d.questions)) continue
      out.push({
        id: d.id || path.relative(base, full).replace(/\\/g, '/'),
        title: d.title || item.replace('.json', ''),
        subject: d.subject || 'Other',
        source: d.source || '',
        dur: d.dur || 180,
        mCor: d.mCor || 4,
        mNeg: d.mNeg || 1,
        savedAt: d.savedAt || stat.mtimeMs,
        questionCount: d.questions.length,
        path: path.relative(base, full).replace(/\\/g, '/'),
        order: d.order ?? 999,
        accentColor: d.accentColor || '',
        imageMode: d.imageMode || false
      })
    } catch (e) {}
  }
  return out
}

function buildTree(tests) {
  const tree = { folders: {}, tests: [] }
  for (const t of tests) {
    const parts = t.path.split('/')
    if (parts.length === 1) {
      tree.tests.push(t)
    } else {
      const folder = parts[0]
      if (!tree.folders[folder]) tree.folders[folder] = { folders: {}, tests: [] }
      tree.folders[folder].tests.push(t)
    }
  }
  tree.tests.sort((a,b) => {
    const od = (a.order??999)-(b.order??999)
    if (od !== 0) return od
    return a.title.localeCompare(b.title, undefined, {numeric:true, sensitivity:'base'})
  })
  for (const f of Object.values(tree.folders)) {
    f.tests.sort((a,b) => {
      const od = (a.order??999)-(b.order??999)
      if (od !== 0) return od
      return a.title.localeCompare(b.title, undefined, {numeric:true, sensitivity:'base'})
    })
  }
  return tree
}

export default async function handler(req, res) {
  const base = path.join(process.cwd(), 'public', 'tests')
  const raw = scan(base, base)
  let merged = raw
  if (isDBAvailable()) {
    merged = await Promise.all(raw.map(async t => {
      try {
        const meta = await dbGet('testmeta:' + t.path)
        if (meta) return { ...t, title: meta.title??t.title, subject: meta.subject??t.subject, dur: meta.dur??t.dur, mCor: meta.mCor??t.mCor, mNeg: meta.mNeg??t.mNeg, order: meta.order??t.order, accentColor: meta.accentColor??t.accentColor }
      } catch(e) {}
      return t
    }))
  }
  res.status(200).json(buildTree(merged))
}
