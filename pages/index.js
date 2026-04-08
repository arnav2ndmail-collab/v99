import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'

const pad = n => String(n).padStart(2,'0')
const fmt = s => `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`
const SAVED_KEY  = 'tz_saved_v3'
const RESUME_KEY = 'tz_resume_v1'

// ── EDIT THIS to update the "What's New" panel on the library page ─────────
const WHATS_NEW = [
  { date: '08 Apr 2025', text: '🎁 Bonus questions added — unlocks after all main Qs attempted' },
  { date: '08 Apr 2025', text: '⏸ Resume feature — close tab anytime, continue where you left off' },
  { date: '07 Apr 2025', text: '📄 Solutions page — download answer key PDFs by series' },
  { date: '06 Apr 2025', text: '🔢 Test sorting fixed — tests now appear in correct order (1,2,3…10)' },
]
// ──────────────────────────────────────────────────────────────────────────  // auto-saved in-progress test

const BITSAT_SUBJECTS = ['Physics','Chemistry','Maths','English & LR']
const SUBJECT_COLORS = {
  'Physics':      { bg:'#1a237e', light:'#e8eaf6', dot:'#3949ab', label:'PHY' },
  'Chemistry':    { bg:'#1b5e20', light:'#e8f5e9', dot:'#388e3c', label:'CHEM' },
  'Maths':        { bg:'#b71c1c', light:'#ffebee', dot:'#c62828', label:'MATH' },
  'English & LR': { bg:'#4a148c', light:'#f3e5f5', dot:'#7b1fa2', label:'ENG' },
}
function getSubjColor(subj) {
  return SUBJECT_COLORS[subj] || { bg:'#37474f', light:'#eceff1', dot:'#546e7a', label:'Q' }
}

export default function TestZyro() {
  const [page, setPage] = useState('library')
  const [tree, setTree] = useState({ folders:{}, tests:[] })
  const [savedTests, setSavedTests] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [openFolders, setOpenFolders] = useState({})
  const [treeLoad, setTreeLoad] = useState(true)
  const [cbtOn, setCbtOn] = useState(false)
  const [Qs, setQs] = useState([])
  const [ans, setAns] = useState([])      // null | 'A'|'B'|'C'|'D'|number string
  const [marked, setMarked] = useState([]) // bool[] — marked for review
  const [visited, setVisited] = useState([]) // bool[] — visited at least once
  const [cur, setCur] = useState(0)
  const [secs, setSecs] = useState(0)
  const [done, setDone] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [cfg, setCfg] = useState({})
  const [result, setResult] = useState(null)
  const [activeNavSubj, setActiveNavSubj] = useState(null)
  const [uploadMsg, setUploadMsg] = useState('')
  const [resumeData, setResumeData] = useState(null)
  const [cbtLoading, setCbtLoading] = useState(false) // global — blocks ALL start buttons // saved in-progress test
  const timerRef = useRef(null)
  const startRef = useRef(null)
  const cbtAns = useRef([])

  useEffect(() => {
    setSavedTests(JSON.parse(localStorage.getItem(SAVED_KEY)||'[]'))
    // Check for a resumable test
    try {
      const saved = localStorage.getItem(RESUME_KEY)
      if (saved) {
        const rd = JSON.parse(saved)
        if (rd && rd.Qs?.length > 0 && rd.cfg && rd.savedAt &&
            Date.now() - rd.savedAt < 6*60*60*1000) {
          setResumeData(rd)
        } else {
          localStorage.removeItem(RESUME_KEY)
        }
      }
    } catch(e) { localStorage.removeItem(RESUME_KEY) }
    loadTree()
  }, [])

  const loadTree = async () => {
    setTreeLoad(true)
    try {
      const r = await fetch('/api/tests')
      const d = await r.json()
      setTree(d)
      const keys = Object.keys(d.folders||{})
      if (keys.length) setOpenFolders({ [keys[0]]: true })
    } catch(e) {}
    setTreeLoad(false)
  }

  const startFromTree = async (testPath) => {
    if (cbtLoading) return
    setCbtLoading(true)
    try {
      const r = await fetch(`/api/test/${testPath}`)
      const d = await r.json()
      if (!d.questions) throw new Error('bad file')
      doLaunch(d.questions, { title:d.title, dur:d.dur||180, mCor:d.mCor||3, mNeg:d.mNeg||1, id:d.id||testPath, subject:d.subject, pageImages:d.pageImages||null })
    } catch(e) { alert('Failed: '+e.message); setCbtLoading(false) }
  }

  const startFromSaved = (t) => {
    if (cbtLoading) return
    setCbtLoading(true)
    doLaunch(t.questions, { title:t.title, dur:t.dur||180, mCor:t.mCor||3, mNeg:t.mNeg||1, id:t.id, subject:t.subject })
  }

  const isBITSAT = (subj) => (subj||'').toUpperCase().includes('BITSAT')

  const doLaunch = (qs, c) => {
    const blankAns = new Array(qs.length).fill(null)
    setQs(qs); setCfg(c)
    setAns(blankAns); cbtAns.current = blankAns
    setMarked(new Array(qs.length).fill(false))
    setVisited(new Array(qs.length).fill(false))
    setCur(0); setDone(false); setReviewing(false); setResult(null)
    setSecs(c.dur*60)
    if (isBITSAT(c.subject||'')) {
      const firstSubj = qs.find(q => q.subject)?.subject || BITSAT_SUBJECTS[0]
      setActiveNavSubj(firstSubj)
    } else {
      setActiveNavSubj(null)
    }
    setCbtOn(true)
    startRef.current = Date.now()
    clearInterval(timerRef.current)
    // Save immediately so resume works even if window closed right away
    setTimeout(() => {
      try {
        localStorage.setItem(RESUME_KEY, JSON.stringify({
          cfg: c, Qs: qs, ans: blankAns,
          marked: new Array(qs.length).fill(false),
          visited: new Array(qs.length).fill(false),
          cur: 0, elapsed: 0, savedAt: Date.now()
        }))
      } catch(e) {}
    }, 300)
  }

  useEffect(() => {
    if (!cbtOn || done) { clearInterval(timerRef.current); return }
    timerRef.current = setInterval(() => setSecs(s => {
      if (s <= 1) { clearInterval(timerRef.current); doSubmit(true); return 0 }
      return s - 1
    }), 1000)
    return () => clearInterval(timerRef.current)
  }, [cbtOn, done])

  // Ref always has fresh state — avoids stale closure in saveProgress
  const cbtStateRef = useRef({})
  useEffect(() => {
    cbtStateRef.current = { cbtOn, done, Qs, cfg, marked, visited, cur }
  })

  // Stable save function — reads from ref so never stale
  const saveProgress = useCallback(() => {
    const s = cbtStateRef.current
    if (!s.cbtOn || s.done || !s.Qs?.length) return
    try {
      const saveData = {
        cfg: s.cfg, Qs: s.Qs, ans: cbtAns.current,
        marked: s.marked, visited: s.visited, cur: s.cur,
        elapsed: Math.round((Date.now() - startRef.current) / 1000),
        savedAt: Date.now()
      }
      localStorage.setItem(RESUME_KEY, JSON.stringify(saveData))
    } catch(e) {}
  }, []) // no deps — always reads fresh from ref

  // Register once when CBT starts, remove when it ends
  useEffect(() => {
    if (!cbtOn || done) return
    const interval = setInterval(saveProgress, 10000)
    window.addEventListener('beforeunload', saveProgress)
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', saveProgress)
    }
  }, [cbtOn, done]) // saveProgress is stable so not needed in deps

  const exitCBT = () => {
    if (!confirm('Exit? Progress is auto-saved — you can resume later.')) return
    clearInterval(timerRef.current)
    saveProgress() // save immediately before exit
    setCbtOn(false); setResult(null)
  }

  // Resume a saved test
  const resumeTest = (rd) => {
    setQs(rd.Qs); setCfg(rd.cfg)
    setAns(rd.ans); cbtAns.current = rd.ans
    setMarked(rd.marked || new Array(rd.Qs.length).fill(false))
    setVisited(rd.visited || new Array(rd.Qs.length).fill(false))
    setCur(rd.cur || 0)
    setDone(false); setReviewing(false); setResult(null)
    // Restore remaining time
    const remainingSecs = Math.max(0, (rd.cfg.dur * 60) - rd.elapsed)
    setSecs(remainingSecs)
    if (isBITSAT(rd.cfg.subject||'')) {
      const firstSubj = rd.Qs[rd.cur||0]?.subject || BITSAT_SUBJECTS[0]
      setActiveNavSubj(firstSubj)
    } else {
      setActiveNavSubj(null)
    }
    setCbtOn(true)
    startRef.current = Date.now() - (rd.elapsed * 1000)
    clearInterval(timerRef.current)
    setResumeData(null)
  }

  const discardResume = () => {
    localStorage.removeItem(RESUME_KEY)
    setResumeData(null)
  }

  const setAnswer = useCallback((val) => {
    setAns(prev => {
      const a = [...prev]; a[cur] = val
      cbtAns.current = a; return a
    })
  }, [cur])

  const markVisited = useCallback((idx) => {
    setVisited(prev => { const v=[...prev]; v[idx]=true; return v })
  }, [])

  const saveAndNext = () => {
    markVisited(cur)
    setMarked(prev => { const m=[...prev]; m[cur]=false; return m })
    // Find next non-bonus question (skip bonus if not unlocked)
    let next = cur + 1
    while (next < Qs.length) {
      if (!Qs[next]?.isBonus) break  // always allow main qs
      // bonus q — only go there if unlocked
      const mIdxs = Qs.map((_,i)=>i).filter(i=>!Qs[i].isBonus)
      const done = mIdxs.every(i => cbtAns.current[i] !== null && cbtAns.current[i] !== undefined)
      if (done) break
      next++  // skip this bonus q
    }
    if (next < Qs.length) setCur(next)
  }

  const markForReview = () => {
    markVisited(cur)
    setMarked(prev => { const m=[...prev]; m[cur]=true; return m })
    if (!ans[cur] || ans[cur] === 'skip') setAnswer('skip')
    // Same logic — skip bonus if not unlocked
    let next = cur + 1
    while (next < Qs.length) {
      if (!Qs[next]?.isBonus) break
      const mIdxs = Qs.map((_,i)=>i).filter(i=>!Qs[i].isBonus)
      const done = mIdxs.every(i => cbtAns.current[i] !== null && cbtAns.current[i] !== undefined)
      if (done) break
      next++
    }
    if (next < Qs.length) setCur(next)
  }

  const clearQ = () => {
    setAnswer(null)
    setMarked(prev => { const m=[...prev]; m[cur]=false; return m })
  }

  const goTo = (idx) => {
    markVisited(cur)
    setCur(idx)
  }

  const doSubmit = useCallback((auto=false) => {
    if (!auto && !confirm('Submit test? This cannot be undone.')) return
    clearInterval(timerRef.current)
    const finalAns = cbtAns.current
    const elapsed = Math.round((Date.now() - startRef.current)/1000)
    let cor=0,wrg=0,skp=0,un=0
    const subjStats = {}
    finalAns.forEach((a,i) => {
      const q = Qs[i]
      const ak = (q?.ans||'').toString().trim()
      const subj = q?.subject || 'Other'
      if (!subjStats[subj]) subjStats[subj] = { cor:0,wrg:0,skp:0,un:0 }
      if (!a) { un++; subjStats[subj].un++; return }
      if (a==='skip') { skp++; subjStats[subj].skp++; return }
      const parts = ak.split(/\s+or\s+/i).map(s=>s.trim().toUpperCase())
      if (parts.includes(a.toString().toUpperCase().trim())) { cor++; subjStats[subj].cor++ }
      else { wrg++; subjStats[subj].wrg++ }
    })
    const score = cor*(cfg.mCor||3) - wrg*(cfg.mNeg||1)
    const max = Qs.length*(cfg.mCor||3)
    setResult({ cor,wrg,skp,un,score,max,elapsed,pct:Math.round(cor/Qs.length*100),answers:finalAns,subjStats })
    setDone(true)
    // Clear saved progress
    try { localStorage.removeItem(RESUME_KEY) } catch(e) {}
  }, [Qs, cfg])

  const downloadOutputFile = (res) => {
    const data = {
      testId:cfg.id, testTitle:cfg.title, subject:cfg.subject,
      date:new Date().toISOString(), score:res.score, maxScore:res.max,
      correct:res.cor, wrong:res.wrg, skipped:res.skp, unattempted:res.un,
      duration:res.elapsed, accuracy:res.pct, marksCorrect:cfg.mCor, marksWrong:cfg.mNeg,
      subjStats:res.subjStats,
      questions:Qs.map((q,i)=>({
        qnum:q.qnum||i+1, subject:q.subject||'Other', type:q.type, text:q.text,
        opts:q.opts, images:q.images||null, hasImage:q.hasImage||false,
        correctAnswer:q.ans, yourAnswer:res.answers[i],
        result: !res.answers[i]?'unattempted':res.answers[i]==='skip'?'skipped':
          ((q.ans||'').toUpperCase().trim()===(res.answers[i]||'').toUpperCase().trim())?'correct':'wrong'
      }))
    }
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url
    a.download=`${cfg.title||'test'}_result_${new Date().toISOString().slice(0,10)}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  const onJsonFiles = async (files) => {
    let ok=0, fail=0
    const current = [...savedTests]
    for (const f of files) {
      try {
        const d = JSON.parse(await f.text())
        if (!Array.isArray(d.questions)) throw new Error('no questions')
        current.unshift({ id:d.id||'json_'+Date.now()+'_'+ok, title:d.title||f.name.replace('.json',''), subject:d.subject||'Other', source:d.source||'', questions:d.questions, dur:d.dur||180, mCor:d.mCor||3, mNeg:d.mNeg||1, savedAt:Date.now() })
        ok++
      } catch { fail++ }
    }
    setSavedTests(current)
    try { localStorage.setItem(SAVED_KEY,JSON.stringify(current)) } catch(e) {}
    setUploadMsg(`✅ Loaded ${ok} test(s)${fail?`, ${fail} failed`:''}`)
    setTimeout(()=>setUploadMsg(''),3000)
    setPage('library')
  }

  const q = Qs[cur]
  const ua = ans[cur]
  const ak = (q?.ans||'').toUpperCase().trim()

  const getDotState = (i) => {
    const a = ans[i]; const m = marked[i]; const v = visited[i] || i === 0
    const hasAns = a && a !== 'skip'
    if (hasAns && m)  return 'answered-marked'
    if (hasAns)       return 'answered'
    if (m)            return 'marked-only'
    if (v || a === 'skip') return 'skipped'
    return 'untouched'
  }

  const stats = {
    a:  Qs.filter((_,i) => getDotState(i)==='answered').length,
    am: Qs.filter((_,i) => getDotState(i)==='answered-marked').length,
    s:  Qs.filter((_,i) => { const s=getDotState(i); return s==='skipped'||s==='marked-only' }).length,
    r:  Qs.filter((_,i) => getDotState(i)==='untouched').length
  }

  const optCls = (lbl) => {
    const sel = ua===lbl
    if (reviewing) return lbl===ak?'opt cor':sel?'opt wrg':'opt'
    return sel?'opt sel':'opt'
  }

  const filt = t => {
    const q2 = search.toLowerCase()
    return (!q2||t.title.toLowerCase().includes(q2))&&(filter==='all'||t.subject===filter)
  }
  const countAll = (tr) => {
    if (!tr) return 0
    let n=(tr.tests||[]).filter(filt).length
    Object.values(tr.folders||{}).forEach(f=>n+=countAll(f))
    return n
  }
  const renderTree = (tr, depth=0, prefix='') => {
    if (!tr) return null
    return (
      <div style={{marginLeft:depth>0?18:0}}>
        {Object.entries(tr.folders||{}).map(([name,sub]) => {
          if (!countAll(sub)) return null
          const key=prefix+name, open=openFolders[key], cnt=countAll(sub)
          return (
            <div key={key} style={{marginBottom:8}}>
              <div className="folder-row" onClick={()=>setOpenFolders(p=>({...p,[key]:!p[key]}))}>
                <span>{open?'📂':'📁'}</span>
                <span style={{fontWeight:700,fontSize:'.88rem',flex:1}}>{name}</span>
                <span className="folder-count">{cnt} test{cnt!==1?'s':''}</span>
                <span style={{color:'#888',fontSize:'.78rem'}}>{open?'▾':'▸'}</span>
              </div>
              {open&&<div style={{marginTop:8,paddingLeft:10,borderLeft:'2px solid #e0e0e0'}}>{renderTree(sub,depth+1,key+'/')}</div>}
            </div>
          )
        })}
        {(tr.tests||[]).filter(filt).length>0&&(
          <div className="test-grid" style={{marginTop:depth>0?10:0}}>
            {(tr.tests||[]).filter(filt).map((t,i)=>(
              <TestCard key={t.path||t.id} t={t} ci={i} globalLoading={cbtLoading} onCBT={()=>startFromTree(t.path)}/>
            ))}
          </div>
        )}
      </div>
    )
  }

  const isBitsatTest = isBITSAT(cfg.subject||'')
  const subjGroups = {}
  if (isBitsatTest) {
    Qs.forEach((q2,i)=>{
      const s=q2.subject||'Other'
      if(!subjGroups[s]) subjGroups[s]=[]
      subjGroups[s].push(i)
    })
  }
  const navSubjects = isBitsatTest ? BITSAT_SUBJECTS.filter(s=>subjGroups[s]?.length>0) : []

  // Bonus logic
  const bonusQs = Qs.filter(q=>q.isBonus)
  const mainQs  = Qs.filter(q=>!q.isBonus)
  const hasBonus = bonusQs.length > 0
  // All main questions must be answered (not null, not skip counts as attempted)
  const mainAllAttempted = mainQs.length > 0 && mainQs.every((_,i) => {
    const globalIdx = Qs.indexOf(mainQs[i]) >= 0 ? Qs.indexOf(mainQs[i]) : i
    return ans[globalIdx] !== null && ans[globalIdx] !== undefined
  })
  // Simpler: count by index
  const mainIndices  = Qs.map((_,i)=>i).filter(i=>!Qs[i].isBonus)
  const bonusIndices = Qs.map((_,i)=>i).filter(i=>Qs[i].isBonus)
  const mainAllDone  = mainIndices.length > 0 && mainIndices.every(i => ans[i] !== null && ans[i] !== undefined)
  const bonusUnlocked = mainAllDone
  const inBonus = bonusIndices.includes(cur)

  return (
    <>
      <Head>
        <title>TestZyro — BITSAT CBT</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎯</text></svg>"/>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      </Head>
      <style>{CSS}</style>

      <header className="hdr">
        <div className="logo" onClick={()=>setPage('library')}>
          <div className="logo-mark">TZ</div>
          <div className="logo-txt">Test<span>Zyro</span></div>
        </div>
        <nav className="nav">
          {[['library','📚 Library'],['upload-json','📤 Upload JSON']].map(([p,l])=>(
            <button key={p} className={`nb${page===p?' active':''}`} onClick={()=>setPage(p)}>{l}</button>
          ))}
          <a href="/analyser" className="nb">📊 Analyser</a>
          <a href="/solutions" className="nb">📄 Solutions</a>
          <a href="/admin" className="nb">⚙️ Admin</a>
        </nav>
      </header>

      {page==='library' && (
        <div className="wrap anim">
          {uploadMsg && <div className="flash-msg">{uploadMsg}</div>}

          {/* ── Resume banner ── */}
          {resumeData && (
            <div className="resume-banner">
              <div className="resume-banner-left">
                <div className="resume-icon">⏸️</div>
                <div>
                  <div className="resume-title">Unfinished Test Found</div>
                  <div className="resume-meta">
                    <strong>{resumeData.cfg?.title}</strong>
                    &nbsp;·&nbsp;
                    {resumeData.ans?.filter(a=>a&&a!=='skip').length||0} answered
                    &nbsp;·&nbsp;
                    {fmt(Math.max(0,(resumeData.cfg?.dur*60||0)-resumeData.elapsed))} remaining
                    &nbsp;·&nbsp;
                    Saved {Math.round((Date.now()-resumeData.savedAt)/60000)} min ago
                  </div>
                </div>
              </div>
              <div className="resume-banner-right">
                <button className="resume-btn" onClick={()=>resumeTest(resumeData)}>▶ Resume Test</button>
                <button className="discard-btn" onClick={discardResume}>✕ Discard</button>
              </div>
            </div>
          )}

          <div className="page-top">
            <div><h2>📚 Test Library</h2><p>BITSAT Full Mock Tests — CBT mode</p></div>
            <button className="btn-sm" onClick={loadTree}>🔄 Refresh</button>
          </div>

          {/* What's New */}
          {WHATS_NEW.length > 0 && (
            <div className="whats-new">
              <div className="wn-title">🆕 What's New</div>
              <div className="wn-list">
                {WHATS_NEW.map((item, i) => (
                  <div key={i} className="wn-item">
                    <span className="wn-date">{item.date}</span>
                    <span className="wn-text">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="toolbar">
            <input className="search-inp" placeholder="🔍 Search tests…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <div className="fbtns">{['all','BITSAT'].map(f=><button key={f} className={`fbtn${filter===f?' on':''}`} onClick={()=>setFilter(f)}>{f.toUpperCase()}</button>)}</div>
          </div>
          <SecTitle>📁 Available Tests</SecTitle>
          {treeLoad ? <div className="loading-txt">Loading…</div> : renderTree(tree)}
          {savedTests.filter(filt).length>0&&<>
            <SecTitle style={{marginTop:32}}>💾 Saved Tests</SecTitle>
            <div className="test-grid">{savedTests.filter(filt).map((t,i)=><TestCard key={t.id} t={t} ci={i} globalLoading={cbtLoading} onCBT={()=>startFromSaved(t)} onDel={()=>{if(confirm('Delete?')){const l=savedTests.filter(x=>x.id!==t.id);setSavedTests(l);try{localStorage.setItem(SAVED_KEY,JSON.stringify(l))}catch(e){}}}}/>)}</div>
          </>}
        </div>
      )}

      {page==='upload-json'&&(
        <div className="wrap anim narrow">
          <div className="page-hero"><h2>📤 Upload JSON Test</h2><p>Add pre-built .json test files to your saved library</p></div>
          <DropZone multi onFiles={onJsonFiles}>
            <div className="up-icon">📋</div>
            <div className="up-title">Drop .json test files here</div>
            <div className="up-sub">TestZyro format JSON files</div>
            <label htmlFor="json-inp" className="btn-primary" style={{cursor:'pointer',display:'inline-block',padding:'9px 24px'}}>Choose JSON File(s)</label>
            <input id="json-inp" type="file" accept=".json" multiple style={{display:'none'}} onChange={e=>e.target.files.length&&onJsonFiles(Array.from(e.target.files))}/>
          </DropZone>
          <div className="info-card" style={{marginTop:18}}>
            <div className="info-card-title">📄 JSON Format (BITSAT)</div>
            <pre className="code-block">{`{
  "title": "BITSAT Mock Test 3",
  "subject": "BITSAT",
  "dur": 180, "mCor": 3, "mNeg": 1,
  "questions": [
    { "subject": "Physics", "type": "MCQ",
      "text": "Question text here...",
      "opts": ["Option A","Option B","Option C","Option D"],
      "ans": "B" },
    { "subject": "Maths", "type": "MCQ",
      "text": "Question text here...",
      "opts": ["Option A","Option B","Option C","Option D"],
      "ans": "C" }
  ]
}`}</pre>
          </div>
        </div>
      )}

      {cbtOn&&!result&&(
        <div className="cbt-app">
          <div className="cbt-top">
            <div className="cbt-top-left">
              <div className="cbt-test-title">{cfg.title}</div>
              <div className="cbt-test-meta">{Qs.length} Questions · +{cfg.mCor}/−{cfg.mNeg} · {cfg.dur} min</div>
            </div>
            <div className="cbt-top-right">
              <div className={`cbt-timer${secs<=300?' warn':''}`}>⏱ Time Left: <strong>{fmt(secs)}</strong></div>
              <button className="cbt-submit-btn" onClick={()=>doSubmit()}>Submit Test</button>
              <button className="cbt-exit-btn" title="Progress auto-saved — resume anytime" onClick={exitCBT}>⏸ Save & Exit</button>
            </div>
          </div>

          {isBitsatTest && navSubjects.length>0 && (
            <div className="subj-tabs">
              {navSubjects.map(s => {
                const sc = getSubjColor(s)
                const indices = subjGroups[s]||[]
                const answered = indices.filter(i=>ans[i]&&ans[i]!=='skip').length
                const isActive = activeNavSubj===s && !inBonus
                return (
                  <button key={s} className={`subj-tab${isActive?' active':''}`}
                    style={isActive?{background:sc.bg,color:'#fff',borderColor:sc.bg}:{}}
                    onClick={()=>{
                      setActiveNavSubj(s)
                      const firstIdx = subjGroups[s]?.[0]
                      if (firstIdx !== undefined) goTo(firstIdx)
                    }}>
                    <span className="subj-tab-label">{sc.label}</span>
                    <span className="subj-tab-name">{s}</span>
                    <span className="subj-tab-count">{answered}/{indices.length}</span>
                  </button>
                )
              })}
              {/* Bonus tab */}
              {hasBonus && (
                <button
                  className={`subj-tab bonus-tab${inBonus?' active':''} ${bonusUnlocked?'unlocked':'locked'}`}
                  onClick={()=>{
                    if (!bonusUnlocked) {
                      const remaining = mainIndices.filter(i=>ans[i]===null||ans[i]===undefined).length
                      alert(`⚠️ Attempt all ${mainIndices.length} main questions first!\n${remaining} question${remaining!==1?'s':''} still unanswered.`)
                      return
                    }
                    const firstBonus = bonusIndices[0]
                    if (firstBonus !== undefined) { setActiveNavSubj('Bonus'); goTo(firstBonus) }
                  }}>
                  <span className="subj-tab-label">{bonusUnlocked?'🎁':'🔒'}</span>
                  <span className="subj-tab-name">Bonus</span>
                  <span className="subj-tab-count">
                    {bonusUnlocked
                      ? `${bonusIndices.filter(i=>ans[i]&&ans[i]!=='skip').length}/${bonusIndices.length}`
                      : `${mainIndices.filter(i=>ans[i]===null||ans[i]===undefined).length} left`}
                  </span>
                </button>
              )}
            </div>
          )}

          <div className="cbt-body">
            <div className="qpanel">
              {q?.subject && (
                <div className="section-banner" style={{
                  background: q.isBonus ? '#fff8e1' : getSubjColor(q.subject).light,
                  borderColor: q.isBonus ? '#ff9800' : getSubjColor(q.subject).dot,
                  color: q.isBonus ? '#e65100' : getSubjColor(q.subject).bg
                }}>
                  Section: <strong>{q.isBonus ? '🎁 Bonus' : q.subject}</strong>
                  {q.type==='INTEGER'&&<span className="type-badge int">Integer Type</span>}
                  {q.type==='MCQ'&&<span className="type-badge mcq">Single Correct</span>}
                </div>
              )}
              <div className="q-header-row">
                <span className="qnum-label">Question {cur+1} of {Qs.length}</span>
                <span className="marks-info">+{q?.mCor||cfg.mCor||3} / −{q?.mNeg||cfg.mNeg||1}</span>
              </div>

              {q?.images && q.images.length>0 ? (
                <div className="q-images">{q.images.map((img,i)=><img key={i} src={`data:image/png;base64,${img}`} alt={`Q${cur+1}`} style={{maxWidth:'100%',display:'block',margin:'0 auto 8px'}}/>)}</div>
              ) : q?.pageRef!=null && cfg.pageImages?.[String(q.pageRef)] ? (
                <div className="q-images"><img src={`data:image/jpeg;base64,${cfg.pageImages[String(q.pageRef)]}`} alt={`Q${cur+1}`} style={{maxWidth:'100%',display:'block',margin:'0 auto'}}/></div>
              ) : (
                <div className="qtext" dangerouslySetInnerHTML={{__html:(q?.text||'').replace(/\n/g,'<br/>')}}/>
              )}

              {q?.type==='MCQ'
                ?<div className="opts">{['A','B','C','D'].map((lbl,i)=>(
                  <div key={lbl} className={optCls(lbl)} onClick={()=>{if(!done&&!reviewing)setAnswer(lbl)}}>
                    <span className="olbl">{lbl}</span>
                    <span className="otext">{q.opts?.[i]||`Option ${lbl}`}</span>
                  </div>
                ))}</div>
                :<div className="int-section">
                  <div className="int-label">Enter numeric answer:</div>
                  <input className="int-inp" type="text" inputMode="decimal"
                    value={(ua&&ua!=='skip')?ua:''}
                    disabled={done||reviewing}
                    onChange={e=>setAnswer(e.target.value.trim()||null)}
                    placeholder="Type answer…"/>
                </div>
              }

              {reviewing && <div className="ans-banner">✓ Correct Answer: <strong>{q?.ans||'?'}</strong></div>}

              {!done&&!reviewing&&(
                <div className="action-row">
                  <button className="btn-save-next" onClick={saveAndNext}>Save &amp; Next</button>
                  <button className="btn-skip" onClick={markForReview}>Mark for Review &amp; Next</button>
                  <button className="btn-clear" onClick={clearQ}>Clear Response</button>
                </div>
              )}
              <div className="nav-row">
                <button className="btn-prev" onClick={()=>goTo(Math.max(0,cur-1))}>← Previous</button>
                <button className="btn-next" onClick={()=>{
                  let next = cur + 1
                  // Skip into bonus only if unlocked
                  if (next < Qs.length && Qs[next]?.isBonus && !bonusUnlocked) return
                  if (next < Qs.length) goTo(next)
                }}>Next →</button>
              </div>
            </div>

            <div className="sb">
              <div className="sb-title">Question Paper</div>
              <div className="sb-legend">
                <div className="leg-item"><div className="leg-dot answered"/>Answered</div>
                <div className="leg-item"><div className="leg-dot skipped"/>Skipped</div>
                <div className="leg-item"><div className="leg-dot marked-only"/>Marked</div>
                <div className="leg-item"><div className="leg-dot answered-marked"/>Ans+Marked</div>
              </div>
              <div className="sb-stats-row">
                <div className="sb-stat"><span className="sb-stat-n green">{stats.a}</span><span className="sb-stat-l">Answered</span></div>
                <div className="sb-stat"><span className="sb-stat-n purple">{stats.am}</span><span className="sb-stat-l">Ans+Marked</span></div>
                <div className="sb-stat"><span className="sb-stat-n red">{stats.s}</span><span className="sb-stat-l">Marked</span></div>
                <div className="sb-stat"><span className="sb-stat-n gray">{stats.r}</span><span className="sb-stat-l">Remaining</span></div>
              </div>

              {isBitsatTest ? (
                <div className="sb-sections">
                  {navSubjects.map(s => {
                    const sc=getSubjColor(s)
                    const indices=subjGroups[s]||[]
                    const isActiveSection=activeNavSubj===s && !inBonus
                    return (
                      <div key={s} className={`sb-section${isActiveSection?' active':''}`}>
                        <div className="sb-section-hdr"
                          style={{background:sc.light,color:sc.bg,borderLeft:`4px solid ${sc.dot}`}}
                          onClick={()=>{
                            setActiveNavSubj(s)
                            const firstIdx = subjGroups[s]?.[0]
                            if (firstIdx !== undefined) goTo(firstIdx)
                          }}>
                          <span className="sb-section-label">{sc.label}</span>
                          <span className="sb-section-name">{s}</span>
                          <span className="sb-section-count">{indices.filter(i=>ans[i]&&ans[i]!=='skip').length}/{indices.length}</span>
                        </div>
                        {isActiveSection && (
                          <div className="qgrid">
                            {indices.map(i=>{
                              const state = getDotState(i)
                              const isCur = i===cur
                              const cls = `qdot${isCur?' current':' '+state}`
                              return (
                                <div key={i} className={cls} onClick={()=>{goTo(i);setActiveNavSubj(s)}} style={{position:'relative'}}>
                                  {i+1}
                                  {state==='answered-marked' && <span className="dot-arrow">▸</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {/* Bonus section in sidebar */}
                  {hasBonus && (
                    <div className={`sb-section${inBonus?' active':''}`}>
                      <div className="sb-section-hdr"
                        style={{background:bonusUnlocked?'#fff8e1':'#f5f5f5',color:bonusUnlocked?'#e65100':'#aaa',borderLeft:`4px solid ${bonusUnlocked?'#ff9800':'#ccc'}`}}
                        onClick={()=>{
                          if(!bonusUnlocked){
                            const rem=mainIndices.filter(i=>ans[i]===null||ans[i]===undefined).length
                            alert(`⚠️ Attempt all ${mainIndices.length} main questions first!\n${rem} still unanswered.`)
                            return
                          }
                          setActiveNavSubj('Bonus')
                          if(bonusIndices[0]!==undefined) goTo(bonusIndices[0])
                        }}>
                        <span className="sb-section-label">{bonusUnlocked?'🎁':'🔒'}</span>
                        <span className="sb-section-name">Bonus</span>
                        <span className="sb-section-count">
                          {bonusUnlocked
                            ? `${bonusIndices.filter(i=>ans[i]&&ans[i]!=='skip').length}/${bonusIndices.length}`
                            : 'Locked'}
                        </span>
                      </div>
                      {inBonus && bonusUnlocked && (
                        <div className="qgrid">
                          {bonusIndices.map(i=>{
                            const state=getDotState(i), isCur=i===cur
                            return (
                              <div key={i} className={`qdot${isCur?' current':' '+state}`}
                                onClick={()=>{goTo(i);setActiveNavSubj('Bonus')}} style={{position:'relative'}}>
                                {i+1}
                                {state==='answered-marked'&&<span className="dot-arrow">▸</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="qgrid" style={{padding:'8px'}}>
                  {Qs.map((_,i)=>{
                    const state = getDotState(i)
                    const isCur = i===cur
                    const cls = `qdot${isCur?' current':' '+state}`
                    return (
                      <div key={i} className={cls} onClick={()=>goTo(i)} style={{position:'relative'}}>
                        {i+1}
                        {state==='answered-marked' && <span className="dot-arrow">▸</span>}
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="sb-submit-area">
                <button className="sb-submit-btn" onClick={()=>doSubmit()}>Submit Test</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {result&&(
        <div className="result-overlay">
          <div className="result-box">
            <div className="res-head">
              <div className="res-trophy">{result.pct>=80?'🏆':result.pct>=60?'🎯':result.pct>=40?'📚':'💪'}</div>
              <div className="res-title">Test Submitted!</div>
              <div className="res-test-name">{cfg.title}</div>
              <div className="res-score" style={{color:result.score>=0?'#4ade80':'#f87171'}}>{result.score}</div>
              <div className="res-max">out of {result.max} (+{cfg.mCor}/−{cfg.mNeg})</div>
              <div className="res-pct" style={{color:result.pct>=60?'#4ade80':'#fbbf24'}}>{result.pct}% accuracy</div>
            </div>

            {result.subjStats && Object.keys(result.subjStats).length>1 && (
              <div className="res-subj-breakdown">
                <div className="res-subj-title">Subject-wise Performance</div>
                {Object.entries(result.subjStats).map(([s,st])=>{
                  const sc=getSubjColor(s)
                  const total=st.cor+st.wrg+st.skp+st.un
                  const pct=total?Math.round(st.cor/total*100):0
                  return (
                    <div key={s} className="res-subj-row">
                      <span className="res-subj-badge" style={{background:sc.light,color:sc.bg}}>{sc.label}</span>
                      <span className="res-subj-name">{s}</span>
                      <span style={{color:'#4ade80',fontWeight:700,fontSize:'.8rem'}}>✓{st.cor}</span>
                      <span style={{color:'#f87171',fontWeight:700,fontSize:'.8rem'}}>✗{st.wrg}</span>
                      <span style={{fontWeight:700,fontSize:'.8rem',color:pct>=60?'#4ade80':'#fbbf24'}}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="res-grid">
              {[['✓',result.cor,'Correct','#4ade80'],['✗',result.wrg,'Wrong','#f87171'],['↩',result.skp,'Marked','#fbbf24'],['—',result.un,'Not Attempted','#888']].map(([ic,n,l,c])=>(
                <div key={l} className="res-cell">
                  <div className="res-cell-n" style={{color:c}}>{n}</div>
                  <div className="res-cell-l">{ic} {l}</div>
                </div>
              ))}
            </div>

            <div className="res-actions">
              <button className="btn-download" onClick={()=>downloadOutputFile(result)}>📥 Download Output File</button>
              <button className="btn-review" onClick={()=>{setReviewing(true);setResult(null);setCur(0)}}>📖 Review Answers</button>
              <button className="btn-back-lib" onClick={()=>{setResult(null);setCbtOn(false);setPage('library')}}>📚 Library</button>
            </div>
            <div className="res-download-note">
              💡 Download the output file to analyse on the <strong>Test Analyser</strong> page
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SecTitle({children,style}) {
  return <div style={{fontSize:'.7rem',fontFamily:'Roboto Mono,monospace',color:'#888',letterSpacing:2,textTransform:'uppercase',marginBottom:12,display:'flex',alignItems:'center',gap:10,...style}}>{children}<div style={{flex:1,height:1,background:'#e0e0e0'}}/></div>
}

function TestCard({t, ci, onCBT, onDel, globalLoading}) {
  const PALETTE=['#1a237e','#1b5e20','#b71c1c','#4a148c','#e65100','#006064','#37474f']
  const accent = t.accentColor||PALETTE[ci%PALETTE.length]
  const subj = t.subject||'BITSAT'
  const isBitsat = subj.toUpperCase().includes('BITSAT')
  return (
    <div className={`tc${globalLoading?' tc-dimmed':''}`}>
      <div style={{height:5,background:accent}}/>
      <div style={{padding:'14px 16px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span className="tc-badge" style={{background:`${accent}18`,color:accent,border:`1px solid ${accent}30`}}>{subj}</span>
          {t.source&&<span style={{fontSize:'.6rem',color:'#999',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.source}</span>}
        </div>
        <div className="tc-title">{t.title}</div>
        <div className="tc-meta">
          <span>{t.questionCount||t.questions?.length||'?'} Questions</span>
          <span>·</span><span>{t.dur||180} min</span>
          <span>·</span><span>+{t.mCor||3} / −{t.mNeg||1}</span>
        </div>
        {isBitsat&&(
          <div className="tc-sections">
            {['PHY','CHEM','MATH','ENG'].map(s=><span key={s} className="tc-section-dot">{s}</span>)}
            {t.hasBonus&&<span className="tc-section-dot" style={{background:'#fff8e1',color:'#e65100',border:'1px solid #ffcc80'}}>🎁 BON</span>}
          </div>
        )}
        {globalLoading && <div className="tc-loading-notice">⏳ Loading test… please wait</div>}
        <div className="tc-actions">
          <button className="tc-cbt-btn"
            style={{background: globalLoading ? '#9e9e9e' : accent, cursor: globalLoading ? 'not-allowed' : 'pointer'}}
            onClick={globalLoading ? undefined : onCBT}
            disabled={globalLoading}>
            {globalLoading ? '⏳ Loading…' : '🎯 Start CBT'}
          </button>
          {onDel&&!globalLoading&&<button className="tc-del-btn" onClick={onDel}>✕</button>}
        </div>
      </div>
    </div>
  )
}

function DropZone({children,onFile,onFiles,multi}) {
  const [drag,setDrag]=useState(false)
  const handle=files=>{if(!files.length)return;if(multi&&onFiles)onFiles(Array.from(files));else if(onFile)onFile(files[0])}
  return <div className={`up-zone${drag?' drag':''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);handle(e.dataTransfer.files)}}>{children}</div>
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f5f5f5;color:#212121;font-family:'Roboto',sans-serif;min-height:100vh}
.hdr{background:#1a237e;color:white;padding:0 24px;display:flex;align-items:center;height:56px;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.3);position:sticky;top:0;z-index:100}
.logo{display:flex;align-items:center;gap:8px;cursor:pointer}
.logo-mark{width:32px;height:32px;background:#ffeb3b;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:'Roboto Mono',monospace;font-weight:700;font-size:.8rem;color:#1a237e}
.logo-txt{font-weight:700;font-size:1.1rem;color:white}.logo-txt span{color:#ffeb3b}
.nav{display:flex;align-items:center;gap:4px;flex:1}
.nb{padding:6px 14px;border-radius:4px;font-family:'Roboto',sans-serif;font-weight:500;font-size:.82rem;cursor:pointer;border:none;background:transparent;color:rgba(255,255,255,.8);transition:all .15s;text-decoration:none;display:inline-block}
.nb:hover{color:white;background:rgba(255,255,255,.1)}.nb.active{background:rgba(255,255,255,.2);color:white}
.wrap{max-width:1060px;margin:0 auto;padding:28px 18px 80px}.narrow{max-width:800px}
.anim{animation:up .3s ease both}
.page-top{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px}
.page-top h2{font-size:1.5rem;font-weight:700;color:#1a237e}.page-top p{font-size:.82rem;color:#666;margin-top:4px}
.page-hero{margin-bottom:20px}.page-hero h2{font-size:1.5rem;font-weight:700;color:#1a237e;margin-bottom:4px}.page-hero p{font-size:.83rem;color:#666}
.toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.search-inp{flex:1;min-width:160px;background:white;border:1.5px solid #ccc;border-radius:6px;padding:8px 12px;color:#212121;font-family:'Roboto',sans-serif;font-size:.82rem;outline:none;transition:border-color .2s}
.search-inp:focus{border-color:#1a237e}
.fbtns{display:flex;gap:4px;flex-wrap:wrap}
.fbtn{padding:6px 12px;border-radius:4px;font-size:.72rem;font-weight:700;cursor:pointer;border:1.5px solid #ddd;background:white;color:#666;font-family:'Roboto Mono',monospace;transition:all .13s}
.fbtn.on,.fbtn:hover{border-color:#1a237e;color:#1a237e;background:#e8eaf6}
.folder-row{display:flex;align-items:center;gap:8px;cursor:pointer;background:white;border:1px solid #ddd;border-radius:8px;padding:10px 13px;transition:all .15s;user-select:none;margin-bottom:4px}
.folder-row:hover{border-color:#1a237e}
.folder-count{font-size:.65rem;font-family:'Roboto Mono',monospace;color:#888;background:#f5f5f5;padding:2px 8px;border-radius:4px}
.loading-txt{color:#888;font-size:.82rem;padding:16px 0}
.test-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.flash-msg{background:#e8f5e9;border:1px solid #4caf50;color:#1b5e20;padding:10px 16px;border-radius:6px;margin-bottom:14px;font-size:.83rem;font-weight:500}
/* What's New */
.whats-new{background:white;border:1px solid #e8eaf6;border-left:4px solid #1a237e;border-radius:8px;padding:12px 16px;margin-bottom:18px}
.wn-title{font-size:.72rem;font-weight:800;color:#1a237e;text-transform:uppercase;letter-spacing:1px;font-family:'Roboto Mono',monospace;margin-bottom:8px}
.wn-list{display:flex;flex-direction:column;gap:5px}
.wn-item{display:flex;align-items:baseline;gap:10px;font-size:.8rem}
.wn-date{font-family:'Roboto Mono',monospace;font-size:.65rem;color:#aaa;flex-shrink:0;min-width:80px}
.wn-text{color:#333}
.resume-banner{background:linear-gradient(135deg,#1a237e,#283593);border-radius:10px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;box-shadow:0 4px 16px rgba(26,35,126,.3);animation:pulse-border 2s ease infinite}
@keyframes pulse-border{0%,100%{box-shadow:0 4px 16px rgba(26,35,126,.3)}50%{box-shadow:0 4px 24px rgba(26,35,126,.55)}}
.resume-banner-left{display:flex;align-items:center;gap:12px;flex:1}
.resume-icon{font-size:1.8rem}
.resume-title{font-weight:700;font-size:.92rem;color:white;margin-bottom:3px}
.resume-meta{font-size:.72rem;color:rgba(255,255,255,.75);font-family:'Roboto Mono',monospace}
.resume-banner-right{display:flex;gap:8px;flex-shrink:0}
.resume-btn{background:#ffeb3b;color:#1a237e;border:none;padding:9px 20px;border-radius:6px;font-family:'Roboto',sans-serif;font-weight:700;font-size:.82rem;cursor:pointer;transition:all .15s}
.resume-btn:hover{background:#ffd600;transform:translateY(-1px)}
.discard-btn{background:rgba(255,255,255,.12);color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.25);padding:8px 14px;border-radius:6px;font-family:'Roboto',sans-serif;font-size:.78rem;cursor:pointer}
.discard-btn:hover{background:rgba(255,255,255,.2)}
.tc{background:white;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;transition:all .18s;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.tc:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,.12)}
.tc-dimmed{opacity:.65;pointer-events:none}
.tc-dimmed .tc-cbt-btn{background:#9e9e9e!important}
.tc-badge{font-size:.62rem;font-weight:700;padding:3px 9px;border-radius:20px;font-family:'Roboto Mono',monospace}
.tc-title{font-weight:700;font-size:.92rem;color:#212121;margin-bottom:8px;line-height:1.35}
.tc-meta{display:flex;gap:6px;font-size:.72rem;color:#888;font-family:'Roboto Mono',monospace;margin-bottom:10px;flex-wrap:wrap}
.tc-sections{display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap}
.tc-section-dot{font-size:.6rem;font-weight:700;font-family:'Roboto Mono',monospace;padding:2px 6px;border-radius:3px;background:#f5f5f5;color:#555;border:1px solid #ddd}
.tc-actions{display:flex;gap:7px}
.tc-loading-notice{font-size:.72rem;color:#e65100;background:#fff8e1;border:1px solid #ffcc80;border-radius:5px;padding:5px 10px;margin-bottom:8px;font-weight:600;animation:pulse-txt .8s ease infinite}
@keyframes pulse-txt{0%,100%{opacity:1}50%{opacity:.6}}
.tc-cbt-btn{flex:1;padding:8px;border-radius:6px;font-family:'Roboto',sans-serif;font-weight:700;font-size:.78rem;cursor:pointer;border:none;color:white;transition:all .13s}
.tc-cbt-btn:hover{opacity:.9}
.tc-del-btn{padding:8px 12px;border-radius:6px;font-size:.72rem;cursor:pointer;border:1px solid #ffcdd2;background:#ffebee;color:#c62828}
.btn-sm{background:white;border:1px solid #ccc;color:#212121;padding:7px 13px;border-radius:6px;font-size:.78rem;font-weight:500;cursor:pointer;font-family:'Roboto',sans-serif}
.btn-sm:hover{border-color:#888}
.btn-primary{background:#1a237e;color:white;border:none;padding:9px 18px;border-radius:6px;font-weight:700;font-size:.82rem;cursor:pointer;font-family:'Roboto',sans-serif}
.btn-primary:hover{background:#283593}
.up-zone{background:white;border:2px dashed #ccc;border-radius:10px;padding:36px 22px;text-align:center;transition:all .22s}
.up-zone.drag,.up-zone:hover{border-color:#1a237e;background:#e8eaf6}
.up-icon{font-size:2.2rem;margin-bottom:9px}.up-title{font-size:.96rem;font-weight:700;color:#212121;margin-bottom:5px}.up-sub{font-size:.76rem;color:#888;margin-bottom:15px}
.info-card{background:white;border:1px solid #e0e0e0;border-radius:8px;padding:16px}
.info-card-title{font-size:.75rem;font-weight:700;color:#555;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;font-family:'Roboto Mono',monospace}
.code-block{background:#f5f5f5;border-radius:6px;padding:14px;font-size:.72rem;color:#1b5e20;overflow-x:auto;font-family:'Roboto Mono',monospace;line-height:1.7}
.cbt-app{position:fixed;inset:0;z-index:500;background:#f5f5f5;display:flex;flex-direction:column}
.cbt-top{background:white;border-bottom:2px solid #e0e0e0;padding:8px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:10px;box-shadow:0 2px 4px rgba(0,0,0,.08)}
.cbt-test-title{font-weight:700;font-size:.95rem;color:#1a237e}
.cbt-test-meta{font-size:.68rem;color:#666;font-family:'Roboto Mono',monospace;margin-top:2px}
.cbt-top-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cbt-timer{font-family:'Roboto Mono',monospace;font-size:.88rem;color:#1b5e20;background:#e8f5e9;border:1px solid #a5d6a7;padding:5px 12px;border-radius:4px}
.cbt-timer.warn{color:#b71c1c;border-color:#ef9a9a;background:#ffebee;animation:warn 1s infinite}
.cbt-submit-btn{background:#1a237e;color:white;border:none;padding:7px 16px;border-radius:4px;font-family:'Roboto',sans-serif;font-weight:700;font-size:.78rem;cursor:pointer}
.cbt-submit-btn:hover{background:#283593}
.cbt-exit-btn{background:#ffebee;color:#c62828;border:1px solid #ef9a9a;padding:6px 12px;border-radius:4px;font-family:'Roboto',sans-serif;font-size:.76rem;font-weight:500;cursor:pointer}
.subj-tabs{background:#eeeeee;border-bottom:1px solid #ccc;display:flex;overflow-x:auto;flex-shrink:0}
.subj-tab{display:flex;align-items:center;gap:6px;padding:8px 16px;border:none;border-right:1px solid #ccc;background:transparent;cursor:pointer;font-family:'Roboto',sans-serif;font-size:.78rem;font-weight:500;color:#555;white-space:nowrap;transition:all .15s;flex-shrink:0}
.subj-tab:hover{background:#e0e0e0;color:#212121}.subj-tab.active{font-weight:700;color:white}
.bonus-tab.locked{color:#aaa;border-right:1px solid #ccc;background:#f9f9f9}
.bonus-tab.locked:hover{background:#f0f0f0}
.bonus-tab.unlocked{color:#e65100;background:#fff8e1}
.bonus-tab.unlocked:hover{background:#ffecb3}
.bonus-tab.unlocked.active{background:#e65100!important;color:white!important;border-color:#e65100!important}
.subj-tab-label{font-family:'Roboto Mono',monospace;font-size:.65rem;font-weight:700;background:rgba(0,0,0,.15);padding:1px 5px;border-radius:3px}
.subj-tab-name{font-size:.78rem}
.subj-tab-count{font-family:'Roboto Mono',monospace;font-size:.65rem;background:rgba(0,0,0,.12);padding:1px 6px;border-radius:10px}
.cbt-body{display:flex;flex:1;overflow:hidden;min-height:0}
.qpanel{flex:1;padding:20px 24px;overflow-y:auto;background:white;border-right:1px solid #e0e0e0}
.section-banner{padding:8px 14px;border-radius:6px;border:1px solid;margin-bottom:14px;font-size:.82rem;display:flex;align-items:center;gap:10px}
.type-badge{font-size:.65rem;font-weight:700;font-family:'Roboto Mono',monospace;padding:2px 8px;border-radius:20px}
.type-badge.mcq{background:#e3f2fd;color:#1565c0;border:1px solid #90caf9}
.type-badge.int{background:#fff3e0;color:#e65100;border:1px solid #ffcc02}
.q-header-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.qnum-label{font-size:.82rem;font-weight:700;color:#333;background:#f5f5f5;padding:4px 12px;border-radius:4px;border:1px solid #ddd;font-family:'Roboto Mono',monospace}
.marks-info{font-size:.72rem;font-family:'Roboto Mono',monospace;color:#1b5e20;background:#e8f5e9;padding:3px 10px;border-radius:4px;border:1px solid #a5d6a7}
.qtext{font-size:.93rem;line-height:1.85;color:#212121;background:#fafafa;border:1px solid #e0e0e0;border-radius:6px;padding:16px;margin-bottom:16px;white-space:pre-wrap;font-family:'Roboto',sans-serif}
.q-images{margin-bottom:16px;text-align:center;background:#fafafa;border:1px solid #e0e0e0;border-radius:6px;padding:10px}
.opts{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
.opt{display:flex;align-items:flex-start;gap:12px;background:white;border:1.5px solid #ddd;border-radius:6px;padding:11px 14px;cursor:pointer;transition:all .12s}
.opt:hover{border-color:#1a237e;background:#e8eaf6}
.opt.sel{border-color:#1a237e;background:#e8eaf6}
.opt.cor{border-color:#2e7d32!important;background:#e8f5e9!important}
.opt.wrg{border-color:#c62828!important;background:#ffebee!important}
.olbl{font-family:'Roboto Mono',monospace;font-size:.72rem;font-weight:700;color:#1a237e;min-width:20px;flex-shrink:0;background:#e8eaf6;border-radius:3px;text-align:center;padding:2px 6px}
.opt.sel .olbl{background:#1a237e;color:white}
.opt.cor .olbl{background:#2e7d32;color:white}
.opt.wrg .olbl{background:#c62828;color:white}
.otext{font-size:.88rem;color:#212121;line-height:1.65}
.int-section{margin-bottom:18px}
.int-label{font-size:.74rem;color:#666;margin-bottom:8px;font-family:'Roboto Mono',monospace}
.int-inp{background:white;border:1.5px solid #ccc;border-radius:6px;padding:10px 14px;color:#212121;font-family:'Roboto Mono',monospace;font-size:1rem;width:200px;outline:none;transition:border-color .2s}
.int-inp:focus{border-color:#1a237e}
.ans-banner{background:#fff8e1;border:1px solid #ffc107;border-radius:6px;padding:8px 14px;margin-bottom:14px;font-size:.82rem;color:#e65100}
.action-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.btn-save-next{padding:9px 18px;border-radius:4px;font-family:'Roboto',sans-serif;font-weight:700;font-size:.78rem;cursor:pointer;border:none;background:#1a237e;color:white}
.btn-save-next:hover{background:#283593}
.btn-skip{padding:9px 14px;border-radius:4px;font-family:'Roboto',sans-serif;font-weight:500;font-size:.78rem;cursor:pointer;background:#fff8e1;color:#e65100;border:1px solid #ffc107}
.btn-clear{padding:9px 14px;border-radius:4px;font-family:'Roboto',sans-serif;font-weight:500;font-size:.78rem;cursor:pointer;background:#ffebee;color:#c62828;border:1px solid #ef9a9a}
.nav-row{display:flex;justify-content:space-between;padding-top:14px;border-top:1px solid #eee}
.btn-prev,.btn-next{padding:8px 16px;border-radius:4px;font-family:'Roboto',sans-serif;font-size:.78rem;font-weight:500;cursor:pointer;border:1px solid #ccc;background:white;color:#333}
.btn-prev:hover,.btn-next:hover{border-color:#1a237e;color:#1a237e}
.sb{width:260px;background:#fafafa;flex-shrink:0;overflow-y:auto;display:flex;flex-direction:column;border-left:1px solid #e0e0e0}
.sb-title{padding:10px 14px;border-bottom:1px solid #e0e0e0;font-size:.78rem;font-weight:700;color:#1a237e;background:white;text-transform:uppercase;letter-spacing:1px;font-family:'Roboto Mono',monospace}
.sb-legend{padding:8px 12px;display:flex;flex-wrap:wrap;gap:8px;border-bottom:1px solid #e0e0e0;background:white}
.leg-item{display:flex;align-items:center;gap:4px;font-size:.62rem;color:#555}
.leg-dot{width:14px;height:14px;border-radius:3px;flex-shrink:0}
.leg-dot.answered{background:#2e7d32}
.leg-dot.skipped{background:#c62828}
.leg-dot.marked-only{background:#7b1fa2}
.leg-dot.answered-marked{background:#7b1fa2;outline:2px solid #2e7d32;outline-offset:1px}
.leg-dot.untouched{background:#e0e0e0;border:1px solid #ccc}
.sb-stats-row{display:flex;padding:8px 12px;gap:8px;border-bottom:1px solid #e0e0e0;background:white}
.sb-stat{display:flex;flex-direction:column;align-items:center;flex:1}
.sb-stat-n{font-family:'Roboto Mono',monospace;font-size:1.1rem;font-weight:700}
.sb-stat-n.green{color:#2e7d32}.sb-stat-n.red{color:#c62828}.sb-stat-n.gray{color:#888}.sb-stat-n.purple{color:#7b1fa2}
.sb-stat-l{font-size:.58rem;color:#888;text-transform:uppercase;font-family:'Roboto Mono',monospace}
.sb-sections{flex:1;overflow-y:auto}
.sb-section{border-bottom:1px solid #e0e0e0}
.sb-section-hdr{display:flex;align-items:center;gap:6px;padding:7px 12px;cursor:pointer;font-size:.76rem}
.sb-section-label{font-family:'Roboto Mono',monospace;font-size:.62rem;font-weight:700;padding:1px 5px;border-radius:3px;background:rgba(0,0,0,.08)}
.sb-section-name{flex:1;font-weight:600}
.sb-section-count{font-family:'Roboto Mono',monospace;font-size:.62rem;color:#666}
.qgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;padding:8px}
.qdot{height:28px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:'Roboto Mono',monospace;font-size:.6rem;font-weight:700;cursor:pointer;background:#e0e0e0;color:#555;border:1.5px solid transparent;transition:all .1s;position:relative}
.qdot:hover{transform:scale(1.08)}
.qdot.current{border-color:#1a237e;background:#e8eaf6;color:#1a237e;border-width:2px}
.qdot.answered{background:#2e7d32;color:white}
.qdot.skipped{background:#c62828;color:white}
.qdot.marked-only{background:#7b1fa2;color:white}
.qdot.answered-marked{background:#7b1fa2;color:white}
.qdot.untouched{background:#e0e0e0;color:#555}
.dot-arrow{position:absolute;top:-6px;right:-5px;font-size:.55rem;background:#2e7d32;color:white;border-radius:50%;width:11px;height:11px;display:flex;align-items:center;justify-content:center;line-height:1;border:1.5px solid white}
.sb-submit-area{padding:12px;border-top:1px solid #e0e0e0;background:white;margin-top:auto}
.sb-submit-btn{width:100%;padding:10px;background:#1a237e;color:white;border:none;border-radius:6px;font-family:'Roboto',sans-serif;font-weight:700;font-size:.82rem;cursor:pointer}
.sb-submit-btn:hover{background:#283593}
.result-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
.result-box{background:#1a1a2e;color:white;border-radius:12px;overflow:hidden;width:100%;max-width:560px;box-shadow:0 8px 40px rgba(0,0,0,.4);animation:up .32s ease both}
.res-head{background:linear-gradient(135deg,#1a237e,#283593);padding:28px;text-align:center}
.res-trophy{font-size:2.5rem;margin-bottom:8px}
.res-title{font-size:1.2rem;font-weight:700;margin-bottom:4px}
.res-test-name{font-size:.78rem;opacity:.8;margin-bottom:14px}
.res-score{font-family:'Roboto Mono',monospace;font-size:3rem;font-weight:700;margin-bottom:2px}
.res-max{font-size:.76rem;opacity:.75;margin-bottom:6px}
.res-pct{font-size:.9rem;font-weight:700}
.res-subj-breakdown{padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.1)}
.res-subj-title{font-size:.72rem;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;font-family:'Roboto Mono',monospace;margin-bottom:10px}
.res-subj-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:.82rem}
.res-subj-badge{font-size:.62rem;font-weight:700;font-family:'Roboto Mono',monospace;padding:2px 7px;border-radius:4px}
.res-subj-name{flex:1;font-size:.8rem;color:#ddd}
.res-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,.1)}
.res-cell{background:#1f2944;padding:14px 10px;text-align:center}
.res-cell-n{font-family:'Roboto Mono',monospace;font-size:1.4rem;font-weight:700;margin-bottom:4px}
.res-cell-l{font-size:.62rem;color:#aaa;text-transform:uppercase}
.res-actions{display:flex;gap:8px;padding:16px 18px;flex-wrap:wrap;justify-content:center}
.btn-download{background:#e65100;color:white;border:none;padding:10px 18px;border-radius:6px;font-family:'Roboto',sans-serif;font-weight:700;font-size:.82rem;cursor:pointer}
.btn-download:hover{background:#bf360c}
.btn-review{background:#1a237e;color:white;border:none;padding:10px 18px;border-radius:6px;font-family:'Roboto',sans-serif;font-weight:700;font-size:.82rem;cursor:pointer}
.btn-review:hover{background:#283593}
.btn-back-lib{background:rgba(255,255,255,.1);color:white;border:1px solid rgba(255,255,255,.2);padding:10px 18px;border-radius:6px;font-family:'Roboto',sans-serif;font-weight:700;font-size:.82rem;cursor:pointer}
.res-download-note{padding:0 18px 16px;font-size:.72rem;color:#aaa;text-align:center}
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes warn{0%,100%{opacity:1}50%{opacity:.4}}
@media(max-width:660px){
  .cbt-body{flex-direction:column-reverse}
  .sb{width:100%;max-height:200px}
  .res-grid{grid-template-columns:repeat(2,1fr)}
  .qgrid{grid-template-columns:repeat(8,1fr)}
  .hdr{padding:0 12px}
}
`
