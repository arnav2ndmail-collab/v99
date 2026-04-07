import { IncomingForm } from 'formidable'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { verifyAdminToken } from '../../../lib/auth'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
  const tok = req.headers.authorization?.replace('Bearer ', '')
  if (!verifyAdminToken(tok)) return res.status(401).json({ error: 'Unauthorized' })

  const form = new IncomingForm({ uploadDir: '/tmp', keepExtensions: true, maxFileSize: 50 * 1024 * 1024 })
  
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Upload failed: ' + err.message })
    
    const file = Array.isArray(files.zip) ? files.zip[0] : files.zip
    if (!file) return res.status(400).json({ error: 'No zip file received' })

    try {
      const zip = new AdmZip(file.filepath || file.path)
      const entries = zip.getEntries()
      const testsBase = path.join(process.cwd(), 'public', 'tests')
      let added = 0, skipped = 0, errors = []

      for (const entry of entries) {
        if (entry.isDirectory) continue
        const name = entry.entryName
        // Only process .json files
        if (!name.endsWith('.json')) continue
        // Strip leading slashes or weird paths
        const safeName = name.replace(/^[./\\]+/, '').replace(/\\/g, '/')
        if (!safeName || safeName.includes('..')) continue

        try {
          const content = entry.getData().toString('utf8')
          const parsed = JSON.parse(content)
          if (!Array.isArray(parsed.questions)) { skipped++; continue }
          
          // Write to public/tests/
          const dest = path.join(testsBase, safeName)
          const dir = path.dirname(dest)
          fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(dest, content, 'utf8')
          added++
        } catch(e) {
          errors.push(name + ': ' + e.message)
        }
      }

      // Cleanup temp file
      try { fs.unlinkSync(file.filepath || file.path) } catch(e) {}

      res.status(200).json({ ok: true, added, skipped, errors })
    } catch(e) {
      res.status(500).json({ error: 'Failed to process zip: ' + e.message })
    }
  })
}
