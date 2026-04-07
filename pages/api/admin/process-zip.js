import { IncomingForm } from 'formidable'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { verifyAdminToken } from '../../../lib/auth'

export const config = { api: { bodyParser: false } }

const OPT_MAP = { '1':'A', '2':'B', '3':'C', '4':'D' }
const SUBJ_ORDER = ['Physics','Chemistry','Maths','English & LR']

function processZip(zipPath, testName) {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()

  // Find data.json
  const dataEntry = entries.find(e => e.entryName.replace(/^.*\//, '') === 'data.json')
  if (!dataEntry) throw new Error('data.json not found in zip')
  const data = JSON.parse(dataEntry.getData().toString('utf8'))

  const pcd = data.pdfCropperData
  const ak  = data.testAnswerKey
  if (!pcd || !ak) throw new Error('Invalid format: missing pdfCropperData or testAnswerKey')

  // Build image map: "Subject__--__qnum__--__idx" -> base64
  const imageMap = {}
  for (const entry of entries) {
    const name = entry.entryName.replace(/^.*\//, '')
    if (!name.endsWith('.png') && !name.endsWith('.jpg') && !name.endsWith('.jpeg')) continue
    const key = name.replace(/\.(png|jpg|jpeg)$/i, '')
    imageMap[key] = entry.getData().toString('base64')
  }

  const questions = []
  let globalQnum = 0

  for (const subj of SUBJ_ORDER) {
    if (!pcd[subj]) continue
    const subjData = pcd[subj]
    for (const [sectionName, sectionQs] of Object.entries(subjData)) {
      const ansSection = (ak[subj] || {})[sectionName] || {}
      const sortedKeys = Object.keys(sectionQs).sort((a,b) => parseInt(a)-parseInt(b))
      for (const qnumStr of sortedKeys) {
        globalQnum++
        const q = sectionQs[qnumStr]
        const ansNum = String(ansSection[qnumStr] || '')
        const ansLetter = OPT_MAP[ansNum] || ansNum

        // Collect images for this question
        const images = []
        for (let i = 1; i <= 10; i++) {
          const key = `${subj}__--__${qnumStr}__--__${i}`
          if (imageMap[key]) images.push(imageMap[key])
          else break
        }

        const numOpts = parseInt(q.answerOptions) || 4
        const opts = ['A','B','C','D'].slice(0, numOpts)

        questions.push({
          qnum: globalQnum,
          subject: subj,
          type: q.type === 'mcq' ? 'MCQ' : 'INTEGER',
          text: `Q${globalQnum}`,
          opts,
          ans: ansLetter,
          hasImage: images.length > 0,
          images,
          mCor: q.marks?.cm || 3,
          mNeg: Math.abs(q.marks?.im || 1),
        })
      }
    }
  }

  if (questions.length === 0) throw new Error('No questions found in zip')

  return {
    id: 'bitsat_' + Date.now(),
    title: testName,
    subject: 'BITSAT',
    dur: 180,
    mCor: 3,
    mNeg: 1,
    order: 999,
    questions
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const tok = req.headers.authorization?.replace('Bearer ','')
  if (!verifyAdminToken(tok)) return res.status(401).json({ error: 'Unauthorized' })

  const form = new IncomingForm({ uploadDir:'/tmp', keepExtensions:true, maxFileSize:200*1024*1024 })

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Upload failed: ' + err.message })

    const file = Array.isArray(files.zip) ? files.zip[0] : files.zip
    if (!file) return res.status(400).json({ error: 'No zip file' })

    const testName = Array.isArray(fields.testName) ? fields.testName[0] : (fields.testName || 'BITSAT Test')
    const folder   = 'BITSAT'

    try {
      const testData = processZip(file.filepath || file.path, testName)
      
      // Save to public/tests/BITSAT/
      const testsBase = path.join(process.cwd(), 'public', 'tests', folder)
      fs.mkdirSync(testsBase, { recursive: true })
      
      const safeName = testName.replace(/[^a-zA-Z0-9_\-\s]/g,'').replace(/\s+/g,'_').toLowerCase()
      const fileName = `${safeName}_${Date.now()}.json`
      const dest = path.join(testsBase, fileName)
      
      fs.writeFileSync(dest, JSON.stringify(testData, null, 2), 'utf8')
      try { fs.unlinkSync(file.filepath || file.path) } catch(e) {}

      res.status(200).json({
        ok: true,
        path: `${folder}/${fileName}`,
        questions: testData.questions.length,
        title: testName
      })
    } catch(e) {
      try { fs.unlinkSync(file.filepath || file.path) } catch(e2) {}
      res.status(500).json({ error: e.message })
    }
  })
}
