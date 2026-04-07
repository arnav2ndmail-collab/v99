import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

const ADM_KEY = 'tz_adm_tok'
const SUBJ_ORDER = ['Physics','Chemistry','Maths','Mathematics','English & LR']
const OPT_MAP = {'1':'A','2':'B','3':'C','4':'D'}

// Normalize subject names so the CBT navigator works correctly
const SUBJ_NORMALIZE = {
  'Mathematics': 'Maths',
  'Math':        'Maths',
  'English':     'English & LR',
  'English & Logical Reasoning': 'English & LR',
}
const normalizeSubj = s => SUBJ_NORMALIZE[s] || s

// Preferred display order in CBT
const DISPLAY_ORDER = ['Physics','Chemistry','Maths','English & LR']

// Load JSZip from CDN
async function loadJSZip() {
  if (window.JSZip) return window.JSZip
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    s.onload = () => res(window.JSZip)
    s.onerror = () => rej(new Error('Failed to load JSZip'))
    document.head.appendChild(s)
  })
}

// Process BITSAT zip entirely in browser
async function processBitsatZip(file, testName, onProgress) {
  const JSZip = await loadJSZip()
  onProgress('Reading zip file...')
  const zip = await JSZip.loadAsync(file)

  // Find data.json (may be at root or in subfolder)
  let dataFile = zip.file('data.json')
  if (!dataFile) {
    // look inside subfolder
    zip.forEach((path, f) => { if (path.endsWith('data.json') && !dataFile) dataFile = f })
  }
  if (!dataFile) throw new Error('data.json not found in zip')

  onProgress('Parsing question data...')
  const dataText = await dataFile.async('text')
  let data
  try { data = JSON.parse(dataText) }
  catch(e) { throw new Error('data.json is not valid JSON: ' + e.message) }

  const pcd = data.pdfCropperData
  const ak  = data.testAnswerKey
  if (!pcd || !ak) throw new Error('Missing pdfCropperData or testAnswerKey in data.json')

  // Build image map: "Subject__--__qnum__--__idx" -> base64
  onProgress('Loading question images...')
  const imageMap = {}
  const imgPromises = []
  zip.forEach((relPath, zipEntry) => {
    const filename = relPath.split('/').pop()
    if (!/\.(png|jpg|jpeg)$/i.test(filename)) return
    const key = filename.replace(/\.(png|jpg|jpeg)$/i, '')
    imgPromises.push(
      zipEntry.async('base64').then(b64 => { imageMap[key] = b64 })
    )
  })
  await Promise.all(imgPromises)

  onProgress(`Processing ${Object.keys(imageMap).length} images...`)

  const questions = []
  let globalQnum = 0

  // Build ordered subject list: use DISPLAY_ORDER preference, then any remaining from pcd
  const pcdSubjects = Object.keys(pcd)
  const orderedSubjects = [
    ...DISPLAY_ORDER.filter(s => pcdSubjects.includes(s) || pcdSubjects.includes(Object.keys(SUBJ_NORMALIZE).find(k => SUBJ_NORMALIZE[k]===s))),
    ...pcdSubjects.filter(s => {
      const norm = normalizeSubj(s)
      return !DISPLAY_ORDER.includes(norm) && !DISPLAY_ORDER.includes(s)
    })
  ]
  // Actually just use pcd keys directly in display order — Bonus always last
  const finalOrder = [
    ...pcdSubjects.filter(s => ['Physics'].includes(s)),
    ...pcdSubjects.filter(s => ['Chemistry'].includes(s)),
    ...pcdSubjects.filter(s => ['Maths','Mathematics','Math'].includes(s)),
    ...pcdSubjects.filter(s => ['English & LR','English','English & Logical Reasoning'].includes(s)),
    ...pcdSubjects.filter(s => !['Physics','Chemistry','Maths','Mathematics','Math','English & LR','English','English & Logical Reasoning','Bonus'].includes(s)),
    ...pcdSubjects.filter(s => ['Bonus'].includes(s)), // Bonus always last
  ]

  for (const subj of finalOrder) {
    const subjData = pcd[subj]
    const normalizedSubj = normalizeSubj(subj)
    const isBonus = subj === 'Bonus' || normalizedSubj === 'Bonus'

    for (const [sectionName, sectionQs] of Object.entries(subjData)) {
      const ansSection = (ak[subj] || {})[sectionName] || {}
      const sortedKeys = Object.keys(sectionQs).sort((a,b) => parseInt(a)-parseInt(b))
      for (const qnumStr of sortedKeys) {
        globalQnum++
        const q = sectionQs[qnumStr]
        const ansNum = String(ansSection[qnumStr] || '')
        const ansLetter = OPT_MAP[ansNum] || ansNum

        // Collect images: try original subject name AND normalized name
        const images = []
        for (let i = 1; i <= 10; i++) {
          const key1 = `${subj}__--__${qnumStr}__--__${i}`
          const key2 = `${normalizedSubj}__--__${qnumStr}__--__${i}`
          const img = imageMap[key1] || imageMap[key2]
          if (img) images.push(img)
          else break
        }

        const numOpts = parseInt(q.answerOptions) || 4
        questions.push({
          qnum: globalQnum,
          subject: isBonus ? 'Bonus' : normalizedSubj,
          isBonus: isBonus || undefined,
          type: q.type === 'mcq' ? 'MCQ' : 'INTEGER',
          text: `Q${globalQnum}`,
          opts: ['A','B','C','D'].slice(0, numOpts),
          ans: ansLetter,
          hasImage: images.length > 0,
          images,
          mCor: q.marks?.cm || 3,
          mNeg: Math.abs(q.marks?.im || 1),
        })
      }
    }
  }

  if (!questions.length) throw new Error('No questions found. Check zip format.')

  const bonusCount = questions.filter(q => q.isBonus).length

  return {
    id: 'bitsat_' + Date.now(),
    title: testName,
    subject: 'BITSAT',
    dur: 180,
    mCor: 3,
    mNeg: 1,
    order: 999,
    hasBonus: bonusCount > 0,
    questions
  }
}

export default function AdminPage() {
  const [tok, setTok]       = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [tab, setTab]       = useState('bitsat')
  const [tests, setTests]   = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]       = useState({txt:'',ok:true})
  const [editTest, setEditTest] = useState(null)

  // BITSAT processor
  const [zipFile, setZipFile]     = useState(null)
  const [testName, setTestName]   = useState('')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress]   = useState('')
  const [result, setResult]       = useState(null)
  const [zipDrag, setZipDrag]     = useState(false)
  const zipRef = useRef()

  useEffect(() => {
    const t = localStorage.getItem(ADM_KEY)
    if (t) { setTok(t); setLoggedIn(true); loadTests(t) }
  }, [])

  const adm = async (action, body, t) => {
    const r = await fetch(`/api/admin/ops?action=${action}`, {
      method: body?'POST':'GET',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+(t||tok)},
      body: body?JSON.stringify(body):undefined
    })
    return r.json()
  }

  const loadTests = async (t) => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/ops?action=list-tests',{headers:{Authorization:'Bearer '+(t||tok)}})
      const d = await r.json()
      if (Array.isArray(d)) setTests(d)
    } catch(e) {}
    setLoading(false)
  }

  const login = async () => {
    setLoginErr('')
    const r = await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})})
    const d = await r.json()
    if (d.error){setLoginErr(d.error);return}
    localStorage.setItem(ADM_KEY,d.token)
    setTok(d.token); setLoggedIn(true); loadTests(d.token)
  }

  const logout = () => {localStorage.removeItem(ADM_KEY);setLoggedIn(false);setTok('')}
  const flash = (txt,ok=true) => {setMsg({txt,ok});setTimeout(()=>setMsg({txt:'',ok:true}),4000)}

  const handleDrop = (e) => {
    e.preventDefault(); setZipDrag(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.zip')) {
      setZipFile(f); setResult(null)
      setTestName(f.name.replace(/\.zip$/i,'').replace(/[-_]/g,' ').trim())
    } else flash('Please drop a .zip file', false)
  }

  const processZip = async () => {
    if (!zipFile || !testName.trim()) return
    setProcessing(true); setResult(null)
    try {
      const testData = await processBitsatZip(zipFile, testName.trim(), setProgress)
      setProgress('Done! ✅')
      setResult({ ok:true, testData, questions: testData.questions.length })
      setZipFile(null); setTestName('')
    } catch(e) {
      setResult({ ok:false, error: e.message })
      flash('❌ '+e.message, false)
    }
    setProcessing(false)
  }

  const downloadJSON = (testData) => {
    const blob = new Blob([JSON.stringify(testData, null, 2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${testData.title.replace(/\s+/g,'_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const saveTest = async () => {
    const d = await adm('rename-test', editTest)
    if (d.ok){flash('✅ Saved!');setEditTest(null);loadTests()}
    else flash('❌ '+d.error,false)
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  if (!loggedIn) return (
    <>
      <Head><title>Admin — TestZyro</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`${BASE}
        body{background:linear-gradient(135deg,#0d1b4b 0%,#1a237e 100%);display:flex;align-items:center;justify-content:center;min-height:100vh}
        .card{background:white;border-radius:20px;padding:44px 40px;width:380px;box-shadow:0 32px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:14px}
        .logo-row{display:flex;align-items:center;gap:12px;margin-bottom:8px}
        .logo-mk{width:42px;height:42px;background:#1a237e;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#ffeb3b;font-weight:800;font-size:.9rem}
        h2{font-size:1.5rem;font-weight:800;color:#1a237e}
        .sub{font-size:.8rem;color:#999;margin-top:-8px}
        input{background:#f5f7ff;border:1.5px solid #e0e4ff;border-radius:10px;padding:12px 14px;font-family:'Inter',sans-serif;font-size:.9rem;outline:none;width:100%;color:#212121}
        input:focus{border-color:#1a237e}
        .btn{background:linear-gradient(135deg,#1a237e,#3949ab);color:white;border:none;padding:14px;border-radius:10px;font-weight:700;font-size:.92rem;cursor:pointer;width:100%}
        .btn:hover{opacity:.9}
        .err{background:#fff0f0;border:1px solid #ffcdd2;color:#c62828;padding:10px 14px;border-radius:8px;font-size:.8rem}
      `}</style>
      <div className="card">
        <div className="logo-row"><div className="logo-mk">TZ</div><div><h2>Admin</h2><div className="sub">TestZyro Control Panel</div></div></div>
        <input type="email" placeholder="Admin email" value={email} onChange={e=>setEmail(e.target.value)}/>
        <input type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}/>
        {loginErr && <div className="err">{loginErr}</div>}
        <button className="btn" onClick={login}>Sign In →</button>
      </div>
    </>
  )

  // ── Admin Panel ───────────────────────────────────────────────────────────
  const folders = [...new Set(tests.map(t=>t.path.includes('/')?t.path.split('/')[0]:'root'))]

  return (
    <>
      <Head><title>Admin — TestZyro</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      </Head>
      <style>{`${BASE}${PANEL}`}</style>

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="s-mark">TZ</div>
            <div className="s-name">TestZyro<br/><span>Admin</span></div>
          </div>
          <nav className="sidebar-nav">
            {[['bitsat','📦','BITSAT ZIP'],['tests','📋','All Tests'],['solutions','📄','Solutions'],['json','📤','JSON Upload']].map(([t,ic,lb])=>(
              <button key={t} className={`s-btn${tab===t?' on':''}`} onClick={()=>setTab(t)}>
                <span className="s-ic">{ic}</span><span>{lb}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <a href="/" className="s-link">← Back to Site</a>
            <button className="s-logout" onClick={logout}>Sign Out</button>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          {/* Toast */}
          {msg.txt && <div className={`toast ${msg.ok?'tok':'terr'}`}>{msg.txt}</div>}

          {/* ═══ BITSAT ZIP ═══ */}
          {tab==='bitsat' && (
            <div className="section">
              <div className="sec-head">
                <h1>📦 Add BITSAT Test from ZIP</h1>
                <p>Upload your BITSAT paper zip — questions & images auto-extracted, download ready JSON</p>
              </div>

              {/* Format box */}
              <div className="format-box">
                <div className="fb-title">Expected ZIP structure:</div>
                <div className="fb-files">
                  <div className="fb-file"><span className="fb-ic">📄</span><div><b>data.json</b><span>pdfCropperData + testAnswerKey</span></div></div>
                  <div className="fb-file"><span className="fb-ic">🖼️</span><div><b>Subject__--__QNum__--__1.png</b><span>e.g. Maths__--__5__--__1.png</span></div></div>
                </div>
                <div className="fb-subjs">
                  {SUBJ_ORDER.map(s=><span key={s} className="fb-pill">{s}</span>)}
                </div>
              </div>

              {/* Drop zone */}
              <div
                className={`dropzone${zipDrag?' drag':''}`}
                onDragOver={e=>{e.preventDefault();setZipDrag(true)}}
                onDragLeave={()=>setZipDrag(false)}
                onDrop={handleDrop}
                onClick={()=>!zipFile&&zipRef.current.click()}
              >
                {!zipFile ? (
                  <div className="dz-empty">
                    <div className="dz-icon">📦</div>
                    <div className="dz-title">Drop BITSAT ZIP here</div>
                    <div className="dz-sub">or click to browse · Max 200MB</div>
                    <button className="dz-btn" onClick={e=>{e.stopPropagation();zipRef.current.click()}}>Choose ZIP File</button>
                  </div>
                ) : (
                  <div className="dz-file">
                    <span style={{fontSize:'2rem'}}>📦</span>
                    <div className="dz-file-info">
                      <div className="dz-file-name">{zipFile.name}</div>
                      <div className="dz-file-size">{(zipFile.size/1024/1024).toFixed(2)} MB</div>
                    </div>
                    <button className="dz-remove" onClick={e=>{e.stopPropagation();setZipFile(null);setResult(null);setTestName('')}}>✕ Remove</button>
                  </div>
                )}
                <input ref={zipRef} type="file" accept=".zip" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(f){setZipFile(f);setResult(null);setTestName(f.name.replace(/\.zip$/i,'').replace(/[-_]/g,' ').trim())}}}/>
              </div>

              {/* Name + Process */}
              {zipFile && (
                <div className="action-row">
                  <div className="field-wrap">
                    <label className="flabel">Test Name</label>
                    <input className="finput" value={testName} onChange={e=>setTestName(e.target.value)} placeholder="e.g. BITSAT 2024 Paper 11"/>
                  </div>
                  <button className="proc-btn" onClick={processZip} disabled={processing||!testName.trim()}>
                    {processing ? <><span className="spin"/>Processing…</> : '⚡ Generate JSON'}
                  </button>
                </div>
              )}

              {/* Progress */}
              {processing && (
                <div className="prog-box">
                  <div className="prog-bar"><div className="prog-fill"/></div>
                  <div className="prog-txt">{progress}</div>
                </div>
              )}

              {/* Result */}
              {result?.ok && (
                <div className="result-ok">
                  <div className="result-ok-header">
                    <span className="result-ok-ic">✅</span>
                    <div>
                      <div className="result-ok-title">JSON Generated!</div>
                      <div className="result-ok-sub">{result.questions} questions across {[...new Set(result.testData.questions.map(q=>q.subject))].length} subjects</div>
                    </div>
                  </div>
                  <div className="result-stats">
                    {[...new Set(result.testData.questions.map(q=>q.subject))].map(s=>{
                      const count = result.testData.questions.filter(q=>q.subject===s).length
                      if (!count) return null
                      const withImg = result.testData.questions.filter(q=>q.subject===s&&q.images?.length>0).length
                      return (
                        <div key={s} className="stat-pill">
                          <span className="stat-subj">{s}</span>
                          <span className="stat-n">{count} Qs</span>
                          {withImg > 0 && <span className="stat-img">🖼️ {withImg}</span>}
                        </div>
                      )
                    })}
                  </div>
                  <div className="result-actions">
                    <button className="dl-btn" onClick={()=>downloadJSON(result.testData)}>
                      📥 Download JSON File
                    </button>
                    <div className="dl-hint">
                      Save this file to <code>public/tests/BITSAT/</code> in your GitHub repo → push → test appears in library
                    </div>
                  </div>
                </div>
              )}
              {result?.ok===false && (
                <div className="result-err">
                  <span style={{fontSize:'1.4rem'}}>❌</span>
                  <div>
                    <div style={{fontWeight:700,marginBottom:4}}>Processing Failed</div>
                    <div style={{fontSize:'.84rem',color:'#c62828'}}>{result.error}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ TESTS LIST ═══ */}
          {tab==='tests' && (
            <div className="section">
              <div className="sec-head">
                <h1>📋 All Tests</h1>
                <p>{tests.length} tests loaded from public/tests/</p>
              </div>
              <button className="refresh-btn" onClick={()=>loadTests()}>🔄 Refresh</button>
              {loading && <div className="loading">Loading…</div>}
              {folders.map(folder=>{
                const ft = tests.filter(t=>(t.path.includes('/')?t.path.split('/')[0]:'root')===folder)
                return (
                  <div key={folder} className="folder-group">
                    <div className="folder-label">📁 {folder} <span style={{color:'#bbb',fontWeight:400}}>({ft.length})</span></div>
                    {ft.map(t=>(
                      <div key={t.path} className="test-row">
                        <div className="test-bar" style={{background:t.accentColor||'#1a237e'}}/>
                        <div className="test-info">
                          <div className="test-title">{t.title}</div>
                          <div className="test-meta">{t.path} · {t.questionCount} Qs · {t.subject} · +{t.mCor}/−{t.mNeg} · {t.dur}min</div>
                        </div>
                        <button className="edit-btn" onClick={()=>setEditTest({...t})}>✏️</button>
                      </div>
                    ))}
                  </div>
                )
              })}
              {!loading&&tests.length===0&&<div className="empty">No tests yet. Use BITSAT ZIP tab to add one.</div>}
            </div>
          )}

          {/* ═══ SOLUTIONS ═══ */}
          {tab==='solutions' && (
            <div className="section">
              <div className="sec-head">
                <h1>📄 Solutions / Answer Keys</h1>
                <p>Upload PDF solution files — organised by folder just like your test series</p>
              </div>
              <div className="format-box">
                <div className="fb-title">📁 Folder structure (in GitHub repo)</div>
                <pre className="code" style={{marginTop:8}}>{`public/solutions/
  BITSAT SERIES 1/
    BITSAT-1-SOL.pdf    ← name it same as test
    BITSAT-2-SOL.pdf
  BITSAT SERIES 2/
    BITSAT-1-SOL.pdf
  BITSAT SERIES 3 (PYQ)/
    BITSAT-PYQ-1-SOL.pdf`}</pre>
              </div>
              <div className="format-box" style={{marginTop:14}}>
                <div className="fb-title">✅ Steps to add solutions</div>
                <div style={{fontSize:'.84rem',color:'#333',lineHeight:2.2}}>
                  <b>1.</b> Go to your GitHub repo<br/>
                  <b>2.</b> Navigate to <code style={{background:'#f0f0f0',padding:'1px 6px',borderRadius:4,fontFamily:'monospace'}}>public/solutions/</code><br/>
                  <b>3.</b> Create a folder matching your series name (e.g. <code style={{background:'#f0f0f0',padding:'1px 6px',borderRadius:4,fontFamily:'monospace'}}>BITSAT SERIES 1</code>)<br/>
                  <b>4.</b> Upload your PDF file inside it<br/>
                  <b>5.</b> Commit &amp; push → appears on Solutions page instantly ✅
                </div>
              </div>
              <div style={{marginTop:16,textAlign:'center'}}>
                <a href="/solutions" target="_blank" className="proc-btn" style={{display:'inline-flex',textDecoration:'none'}}>
                  👁 View Solutions Page →
                </a>
              </div>
            </div>
          )}

          {/* ═══ JSON UPLOAD ═══ */}
          {tab==='json' && (
            <div className="section">
              <div className="sec-head">
                <h1>📤 Upload JSON Test File</h1>
                <p>Directly upload a pre-built .json test file to your saved library (browser only, no server)</p>
              </div>
              <div className="json-info">
                <b>Note:</b> Since Vercel filesystem is read-only, uploaded JSON tests are saved to your <b>browser's local storage</b> only (visible on this device). To add to all users, download the JSON from the BITSAT ZIP tab and commit it to GitHub.
              </div>
              <div className="format-box" style={{marginTop:16}}>
                <div className="fb-title">JSON format:</div>
                <pre className="code">{`{
  "title": "BITSAT Mock 3",
  "subject": "BITSAT",
  "dur": 180, "mCor": 3, "mNeg": 1,
  "questions": [
    { "subject": "Physics", "type": "MCQ",
      "text": "Q1", "opts":["A","B","C","D"],
      "ans": "B", "images": [] }
  ]
}`}</pre>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Edit modal */}
      {editTest && (
        <div className="modal-bg" onClick={()=>setEditTest(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3 style={{color:'#1a237e',marginBottom:16}}>✏️ Edit Test</h3>
            <label className="flabel">Title</label>
            <input className="finput" value={editTest.title} onChange={e=>setEditTest({...editTest,title:e.target.value})}/>
            <label className="flabel">Subject</label>
            <select className="finput" value={editTest.subject} onChange={e=>setEditTest({...editTest,subject:e.target.value})}>
              {['BITSAT','JEE','NEET','GATE','Board','Other'].map(s=><option key={s}>{s}</option>)}
            </select>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label className="flabel">Duration (min)</label><input className="finput" type="number" value={editTest.dur} onChange={e=>setEditTest({...editTest,dur:e.target.value})}/></div>
              <div><label className="flabel">Order</label><input className="finput" type="number" value={editTest.order} onChange={e=>setEditTest({...editTest,order:e.target.value})}/></div>
              <div><label className="flabel">+Marks</label><input className="finput" type="number" value={editTest.mCor} onChange={e=>setEditTest({...editTest,mCor:e.target.value})}/></div>
              <div><label className="flabel">−Marks</label><input className="finput" type="number" value={editTest.mNeg} onChange={e=>setEditTest({...editTest,mNeg:e.target.value})}/></div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button className="proc-btn" style={{flex:1}} onClick={saveTest}>💾 Save</button>
              <button onClick={()=>setEditTest(null)} style={{padding:'10px 20px',border:'1px solid #ddd',borderRadius:8,cursor:'pointer',background:'white'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const BASE = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;background:#f0f2f8;color:#1a1a2e;min-height:100vh}`

const PANEL = `
.layout{display:flex;min-height:100vh}
/* Sidebar */
.sidebar{width:220px;background:linear-gradient(180deg,#0d1b4b 0%,#1a237e 100%);display:flex;flex-direction:column;padding:0;flex-shrink:0;position:sticky;top:0;height:100vh}
.sidebar-logo{padding:24px 20px 20px;border-bottom:1px solid rgba(255,255,255,.1)}
.s-mark{width:36px;height:36px;background:#ffeb3b;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem;color:#1a237e;margin-bottom:8px}
.s-name{font-weight:800;font-size:1.05rem;color:white;line-height:1.2}
.s-name span{font-size:.68rem;color:rgba(255,255,255,.5);font-weight:400}
.sidebar-nav{padding:16px 10px;display:flex;flex-direction:column;gap:4px;flex:1}
.s-btn{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;border:none;background:transparent;color:rgba(255,255,255,.65);font-family:'Inter',sans-serif;font-weight:600;font-size:.84rem;cursor:pointer;text-align:left;transition:all .15s}
.s-btn:hover{background:rgba(255,255,255,.1);color:white}
.s-btn.on{background:rgba(255,255,255,.18);color:white}
.s-ic{font-size:1.1rem;width:22px;text-align:center}
.sidebar-bottom{padding:16px 10px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:6px}
.s-link{color:rgba(255,255,255,.55);font-size:.76rem;text-decoration:none;padding:8px 14px;border-radius:8px;display:block}
.s-link:hover{color:white;background:rgba(255,255,255,.08)}
.s-logout{background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#fca5a5;padding:8px 14px;border-radius:8px;font-size:.76rem;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif}
/* Main */
.main{flex:1;padding:32px 36px;overflow-y:auto;max-width:860px}
.toast{position:fixed;top:20px;right:20px;padding:12px 22px;border-radius:12px;font-weight:700;font-size:.84rem;z-index:999;box-shadow:0 8px 24px rgba(0,0,0,.2)}
.tok{background:#e8f5e9;color:#1b5e20;border:1px solid #a5d6a7}
.terr{background:#ffebee;color:#c62828;border:1px solid #ef9a9a}
.section{}
.sec-head{margin-bottom:24px}
.sec-head h1{font-size:1.5rem;font-weight:800;color:#1a237e;margin-bottom:6px}
.sec-head p{font-size:.85rem;color:#888}
/* Format box */
.format-box{background:white;border-radius:14px;padding:18px 20px;margin-bottom:20px;border:1px solid #e8eaf6;box-shadow:0 2px 8px rgba(26,35,126,.06)}
.fb-title{font-size:.7rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px}
.fb-files{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.fb-file{display:flex;align-items:center;gap:12px;padding:10px 14px;background:#f8f9ff;border-radius:8px;border:1px solid #e8eaf6;font-size:.84rem}
.fb-ic{font-size:1.4rem}
.fb-file b{display:block;font-weight:700;color:#1a237e;margin-bottom:2px}
.fb-file span{font-size:.72rem;color:#888}
.fb-subjs{display:flex;gap:6px;flex-wrap:wrap}
.fb-pill{background:#e8eaf6;color:#1a237e;font-size:.7rem;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #c5cae9}
/* Dropzone */
.dropzone{background:white;border:2.5px dashed #c5cae9;border-radius:16px;padding:40px;text-align:center;cursor:pointer;transition:all .22s;margin-bottom:18px;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.dropzone:hover,.dropzone.drag{border-color:#1a237e;background:#f0f3ff;box-shadow:0 4px 20px rgba(26,35,126,.12)}
.dz-empty{}
.dz-icon{font-size:3.2rem;margin-bottom:12px}
.dz-title{font-size:1.1rem;font-weight:800;color:#1a237e;margin-bottom:6px}
.dz-sub{font-size:.82rem;color:#888;margin-bottom:18px}
.dz-btn{background:#1a237e;color:white;border:none;padding:11px 30px;border-radius:9px;font-family:'Inter',sans-serif;font-weight:700;font-size:.86rem;cursor:pointer}
.dz-btn:hover{background:#283593}
.dz-file{display:flex;align-items:center;gap:16px}
.dz-file-info{flex:1;text-align:left}
.dz-file-name{font-weight:700;font-size:.95rem;color:#1a237e;margin-bottom:3px}
.dz-file-size{font-size:.72rem;color:#888}
.dz-remove{background:#ffebee;border:1px solid #ef9a9a;color:#c62828;padding:7px 14px;border-radius:8px;cursor:pointer;font-weight:600;font-size:.76rem;font-family:'Inter',sans-serif;white-space:nowrap}
/* Action row */
.action-row{display:flex;gap:12px;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap}
.field-wrap{flex:1;min-width:200px}
.flabel{font-size:.68rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.8px;display:block;margin-bottom:5px}
.finput{width:100%;background:#f8f9ff;border:1.5px solid #e0e4ff;border-radius:9px;padding:11px 14px;font-family:'Inter',sans-serif;font-size:.9rem;color:#212121;outline:none;transition:border-color .2s;margin-bottom:10px}
.finput:focus{border-color:#1a237e}
.proc-btn{background:linear-gradient(135deg,#1a237e,#3949ab);color:white;border:none;padding:12px 28px;border-radius:9px;font-family:'Inter',sans-serif;font-weight:700;font-size:.88rem;cursor:pointer;display:flex;align-items:center;gap:8px;white-space:nowrap;box-shadow:0 4px 14px rgba(26,35,126,.3)}
.proc-btn:hover{opacity:.92;transform:translateY(-1px)}
.proc-btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.spin{width:16px;height:16px;border:2.5px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* Progress */
.prog-box{background:white;border-radius:12px;padding:18px;margin-bottom:16px;border:1px solid #e8eaf6;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.prog-bar{height:8px;background:#e8eaf6;border-radius:99px;overflow:hidden;margin-bottom:10px}
.prog-fill{height:100%;background:linear-gradient(90deg,#1a237e,#3949ab,#1a237e);background-size:200%;border-radius:99px;animation:shimmer 1.5s ease infinite}
@keyframes shimmer{0%{background-position:0%}100%{background-position:200%}}
.prog-txt{font-size:.8rem;color:#666}
/* Result ok */
.result-ok{background:white;border-radius:16px;border:1px solid #a5d6a7;overflow:hidden;margin-bottom:16px;box-shadow:0 4px 20px rgba(46,125,50,.1)}
.result-ok-header{display:flex;align-items:center;gap:14px;padding:20px 22px;background:linear-gradient(135deg,#e8f5e9,#f1f8f3);border-bottom:1px solid #c8e6c9}
.result-ok-ic{font-size:2rem}
.result-ok-title{font-size:1.05rem;font-weight:800;color:#1b5e20;margin-bottom:3px}
.result-ok-sub{font-size:.8rem;color:#2e7d32}
.result-stats{padding:16px 22px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid #e8f5e9}
.stat-pill{background:#f1f8f3;border:1px solid #c8e6c9;border-radius:20px;padding:6px 14px;display:flex;align-items:center;gap:6px}
.stat-subj{font-weight:700;font-size:.78rem;color:#1b5e20}
.stat-n{font-size:.74rem;color:#555}
.stat-img{font-size:.7rem;color:#888}
.result-actions{padding:16px 22px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.dl-btn{background:linear-gradient(135deg,#1a237e,#3949ab);color:white;border:none;padding:12px 28px;border-radius:9px;font-family:'Inter',sans-serif;font-weight:700;font-size:.9rem;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 14px rgba(26,35,126,.25)}
.dl-btn:hover{opacity:.9;transform:translateY(-1px)}
.dl-hint{font-size:.76rem;color:#666;line-height:1.7}
.dl-hint code{background:#f0f2f8;border:1px solid #e0e4ff;padding:1px 7px;border-radius:4px;font-family:monospace;font-size:.75rem}
/* Result err */
.result-err{background:#fff5f5;border:1px solid #ef9a9a;border-radius:14px;padding:18px 22px;display:flex;align-items:flex-start;gap:14px;margin-bottom:16px}
/* Tests */
.refresh-btn{background:white;border:1.5px solid #e0e4ff;color:#1a237e;padding:8px 16px;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer;margin-bottom:20px;font-family:'Inter',sans-serif}
.folder-group{margin-bottom:24px}
.folder-label{font-size:.72rem;font-weight:800;color:#1a237e;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px}
.test-row{background:white;border:1px solid #e8eaf6;border-radius:12px;display:flex;align-items:center;overflow:hidden;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.05);transition:transform .15s,box-shadow .15s}
.test-row:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.08)}
.test-bar{width:6px;align-self:stretch;flex-shrink:0}
.test-info{flex:1;padding:12px 16px;min-width:0}
.test-title{font-weight:700;font-size:.92rem;color:#1a237e;margin-bottom:3px}
.test-meta{font-size:.65rem;color:#aaa;display:flex;gap:4px;flex-wrap:wrap}
.edit-btn{padding:8px 14px;margin:10px;border-radius:8px;background:#f0f3ff;border:1px solid #e0e4ff;color:#1a237e;font-size:.78rem;cursor:pointer;font-weight:600;font-family:'Inter',sans-serif}
.edit-btn:hover{background:#e8eaf6}
.loading{color:#888;font-size:.84rem;padding:20px 0;text-align:center}
.empty{color:#ccc;font-size:.84rem;padding:48px 0;text-align:center}
/* JSON info */
.json-info{background:#fff8e1;border:1px solid #ffe082;border-radius:12px;padding:14px 18px;font-size:.82rem;color:#5d4037;line-height:1.8;margin-bottom:16px}
.code{background:#1e2a3a;color:#80cbc4;border-radius:10px;padding:16px;font-size:.74rem;overflow-x:auto;line-height:1.7}
/* Modal */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:white;border-radius:18px;padding:28px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,.25)}
/* Bonus */
.bonus-section{background:#fff8e1;border:1px solid #ffe082;border-radius:12px;padding:16px 18px;margin-bottom:16px}
.bonus-toggle-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px}
.bonus-toggle-label{display:flex;align-items:center;gap:8px;font-weight:700;font-size:.88rem;color:#5d4037;cursor:pointer}
.bonus-toggle-label input{width:16px;height:16px;cursor:pointer;accent-color:#e65100}
.bonus-note{font-size:.7rem;color:#888;font-style:italic}
.bonus-body{margin-top:14px;display:flex;flex-direction:column;gap:12px}
.bonus-zip-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bonus-pick-btn{background:#e65100;color:white;border:none;padding:8px 16px;border-radius:7px;font-family:'Inter',sans-serif;font-weight:700;font-size:.78rem;cursor:pointer}
.bonus-pick-btn:hover{background:#bf360c}
.bonus-file-row{display:flex;align-items:center;gap:8px}
.bonus-file-name{font-size:.78rem;color:#333;font-weight:600}
.bonus-remove{background:none;border:1px solid #ccc;border-radius:4px;padding:2px 8px;cursor:pointer;color:#999;font-size:.75rem}
.bonus-count-row{display:flex;align-items:center;gap:10px}
.bonus-ans-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:6px}
.bonus-ans-cell{display:flex;align-items:center;gap:5px;background:white;border:1px solid #ffe082;border-radius:6px;padding:5px 8px}
.bonus-ans-num{font-size:.65rem;font-weight:800;color:#e65100;font-family:monospace;min-width:22px}
.bonus-ans-sel{border:none;background:transparent;font-family:'Inter',sans-serif;font-size:.82rem;font-weight:700;color:#1a237e;cursor:pointer;outline:none;padding:0}
`
