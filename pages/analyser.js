import { useState, useRef } from 'react'
import Head from 'next/head'

const SUBJ_ORDER = ['Physics','Chemistry','Maths','English & LR','Bonus']
const SC = {
  'Physics':      { bg:'#1565c0', grd:'linear-gradient(135deg,#1565c0,#1976d2)', light:'#dbeafe', dot:'#3b82f6', label:'PHY', emoji:'⚡' },
  'Chemistry':    { bg:'#15803d', grd:'linear-gradient(135deg,#15803d,#16a34a)', light:'#dcfce7', dot:'#4ade80', label:'CHEM', emoji:'🧪' },
  'Maths':        { bg:'#b91c1c', grd:'linear-gradient(135deg,#b91c1c,#dc2626)', light:'#fee2e2', dot:'#f87171', label:'MATH', emoji:'📐' },
  'English & LR': { bg:'#7c3aed', grd:'linear-gradient(135deg,#7c3aed,#8b5cf6)', light:'#ede9fe', dot:'#a78bfa', label:'ENG',  emoji:'📖' },
  'Bonus':        { bg:'#c2410c', grd:'linear-gradient(135deg,#c2410c,#ea580c)', light:'#fff7ed', dot:'#fb923c', label:'BON',  emoji:'🎁' },
}
const getSC = s => SC[s] || { bg:'#475569',grd:'linear-gradient(135deg,#475569,#64748b)',light:'#f1f5f9',dot:'#94a3b8',label:'Q',emoji:'📝' }
const RES = {
  correct:     { color:'#15803d', bg:'#dcfce7', border:'#86efac', label:'✓ Correct' },
  wrong:       { color:'#b91c1c', bg:'#fee2e2', border:'#fca5a5', label:'✗ Wrong' },
  skipped:     { color:'#c2410c', bg:'#ffedd5', border:'#fdba74', label:'↩ Skipped' },
  unattempted: { color:'#475569', bg:'#f1f5f9', border:'#cbd5e1', label:'— Not Attempted' },
}
const DOT_COLOR = { correct:'#4ade80', wrong:'#f87171', skipped:'#fb923c', unattempted:'#334155' }

export default function Analyser() {
  const [data, setData] = useState(null)
  const [err, setErr]   = useState('')
  const [drag, setDrag] = useState(false)
  const [tab, setTab]   = useState('overview')
  const [activeSubj, setActiveSubj] = useState(null)
  const [filter, setFilter] = useState('all')
  const [curQ, setCurQ] = useState(0)
  const fileRef = useRef()

  const processData = (d) => {
    if (!Array.isArray(d.questions)) throw new Error('No questions array found')
    d.questions = d.questions.map(q => ({
      ...q,
      result: q.result || (!q.yourAnswer ? 'unattempted' : q.yourAnswer==='skip' ? 'skipped' :
        String(q.correctAnswer||'').toUpperCase().trim() === String(q.yourAnswer||'').toUpperCase().trim() ? 'correct' : 'wrong')
    }))
    const first = SUBJ_ORDER.filter(s=>s!=='Bonus').find(s => d.questions.some(q=>q.subject===s)) || d.questions[0]?.subject
    setData(d); setActiveSubj(first); setCurQ(0); setFilter('all'); setTab('overview')
  }

  // Auto-load when redirected from test with ?src=auto
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('src') === 'auto') {
      try {
        const stored = sessionStorage.getItem('tz_analyse')
        if (stored) { processData(JSON.parse(stored)); return }
      } catch(e) {}
      setErr('❌ No test data found. Please upload a result file.')
    }
  }, [])

  const loadFile = async file => {
    setErr(''); setData(null)
    try {
      const d = JSON.parse(await file.text())
      processData(d)
    } catch(e) { setErr('❌ '+e.message) }
  }

  const handleDrop = e => { e.preventDefault(); setDrag(false); loadFile(e.dataTransfer.files[0]) }

  // Upload screen
  if (!data) return (
    <>
      <Head><title>TestZyro — Analyser</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      </Head>
      <style>{BASE_CSS}</style>
      <div className="upload-shell">
        <div className="upload-card">
          <a href="/" className="back-link">← TestZyro</a>
          <div className="upload-icon-wrap"><div className="upload-icon">📊</div></div>
          <h1 className="upload-title">Test Analyser</h1>
          <p className="upload-sub">Upload your result file for detailed subject-wise analysis</p>
          <div className={`dropzone${drag?' drag':''}`}
            onDragOver={e=>{e.preventDefault();setDrag(true)}}
            onDragLeave={()=>setDrag(false)}
            onDrop={handleDrop}
            onClick={()=>fileRef.current.click()}>
            <div style={{fontSize:'2.5rem',marginBottom:12}}>📥</div>
            <div className="dz-title">Drop result .json file here</div>
            <div className="dz-sub">Downloaded after submitting a test on TestZyro</div>
            <div className="dz-btn">Browse File</div>
            <input ref={fileRef} type="file" accept=".json" style={{display:'none'}} onChange={e=>{if(e.target.files[0])loadFile(e.target.files[0])}}/>
          </div>
          {err && <div className="upload-err">{err}</div>}
          <div className="upload-steps">
            <div className="us-step"><div className="us-n">1</div><div>Complete a test on TestZyro</div></div>
            <div className="us-arrow">→</div>
            <div className="us-step"><div className="us-n">2</div><div>Click <b>📥 Download Output File</b></div></div>
            <div className="us-arrow">→</div>
            <div className="us-step"><div className="us-n">3</div><div>Upload it here ✅</div></div>
          </div>
        </div>
      </div>
    </>
  )

  // Computed
  const allQs = data.questions
  const mainQs = allQs.filter(q=>q.subject!=='Bonus')
  const bonusQs = allQs.filter(q=>q.subject==='Bonus')
  const hasBonusQs = bonusQs.length > 0
  const subjects = SUBJ_ORDER.filter(s => allQs.some(q=>q.subject===s))
  if (!subjects.length) subjects.push(allQs[0]?.subject||'All')
  const getSubjQs = s => s ? allQs.filter(q=>q.subject===s) : allQs
  const subjQs = getSubjQs(activeSubj)
  const filteredQs = filter==='all' ? subjQs : subjQs.filter(q=>q.result===filter)
  const curQ2 = filteredQs[curQ] || null
  const ms = (qs) => ({ total:qs.length, cor:qs.filter(q=>q.result==='correct').length, wrg:qs.filter(q=>q.result==='wrong').length, skp:qs.filter(q=>q.result==='skipped').length, un:qs.filter(q=>q.result==='unattempted').length })
  const overall = ms(allQs)
  const mCor=data.marksCorrect||3, mNeg=data.marksWrong||1
  const accuracy = (overall.cor+overall.wrg) ? Math.round(overall.cor/(overall.cor+overall.wrg)*100) : 0

  const switchSubj = s => { setActiveSubj(s); setCurQ(0); setFilter('all') }
  const openReview = (s, f='all') => { switchSubj(s); setFilter(f); setCurQ(0); setTab('review') }

  return (
    <>
      <Head><title>Analyser — {data.testTitle}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      </Head>
      <style>{BASE_CSS+APP_CSS}</style>

      {/* Header */}
      <header className="app-header">
        <div className="app-header-inner">
          <a href="/" className="app-logo"><span className="al-icon">🎯</span><span className="al-text">Test<b>Zyro</b></span></a>
          <div className="app-tabs">
            <button className={`app-tab${tab==='overview'?' on':''}`} onClick={()=>setTab('overview')}>📋 Overview</button>
            <button className={`app-tab${tab==='review'?' on':''}`} onClick={()=>setTab('review')}>📖 Review</button>
          </div>
          <div className="app-header-right">
            <div className="test-chip">{data.testTitle}</div>
            <button className="new-file-btn" onClick={()=>setData(null)}>↩ New File</button>
          </div>
        </div>
      </header>

      {/* ══ OVERVIEW ══ */}
      {tab==='overview' && (
        <div className="a-page fade-up">
          {/* Score hero */}
          <div className="score-hero">
            <div className="sh-bg"/>
            <div className="sh-content">
              <div className="sh-left">
                <div className="sh-label">Total Score</div>
                <div className="sh-score" style={{color:data.score>=0?'#4ade80':'#f87171'}}>
                  {data.score}<span className="sh-max">/{data.maxScore}</span>
                </div>
                <div className="sh-meta">
                  <span>{data.subject}</span>
                  <span>·</span>
                  <span>{new Date(data.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
                  <span>·</span>
                  <span>{Math.floor((data.duration||0)/60)}m {(data.duration||0)%60}s</span>
                </div>
              </div>
              <div className="sh-cards">
                {[['✓ Correct',overall.cor,'#4ade80','rgba(74,222,128,.12)'],['✗ Wrong',overall.wrg,'#f87171','rgba(248,113,113,.12)'],['↩ Skipped',overall.skp,'#fb923c','rgba(251,146,60,.12)'],['— Not Att.',overall.un,'#64748b','rgba(100,116,139,.1)'],['🎯 Accuracy',accuracy+'%','#38bdf8','rgba(56,189,248,.12)']].map(([l,v,c,bg])=>(
                  <div key={l} className="sh-card" style={{background:bg}}>
                    <div className="shc-val" style={{color:c}}>{v}</div>
                    <div className="shc-lbl">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Breakdown table */}
          <div className="a-section">
            <div className="a-sec-title">📊 Performance Breakdown</div>
            <div className="breakdown-table">
              <div className="bt-head">
                <div>Subject</div><div>Score</div><div>Correct</div><div>Wrong</div><div>Not Att.</div><div>Accuracy</div>
              </div>
              {[['overall', allQs], ...subjects.map(s=>[s,getSubjQs(s)])].map(([s,qs])=>{
                const st=ms(qs); const sc=getSC(s); const isOverall=s==='overall'; const isBonus=s==='Bonus'
                const score=st.cor*mCor-st.wrg*mNeg; const pct=(st.cor+st.wrg)?Math.round(st.cor/(st.cor+st.wrg)*100):0
                return(<>
                  {isBonus && <div key="bonus-sep" style={{gridColumn:'1/-1',borderTop:'2px dashed #fb923c22',margin:'0',display:'grid',gridTemplateColumns:'1fr',padding:'4px 20px',background:'#fff7ed',fontSize:'.65rem',color:'#c2410c',fontWeight:700,letterSpacing:1}}>🎁 BONUS SECTION — Optional</div>}
                  <div key={s} className={`bt-row${isOverall?' bt-overall':''}${isBonus?' bt-bonus':''}`} onClick={!isOverall?()=>openReview(s):undefined} style={!isOverall?{cursor:'pointer'}:{}}>
                    <div className="bt-subj-cell">
                      {!isOverall&&<div className="bt-dot" style={{background:sc.bg}}/>}
                      <span style={{fontWeight:700}}>{isOverall?'🔢 Overall':s}</span>
                      {!isOverall&&<span className="bt-sbadge" style={{background:sc.light,color:sc.bg}}>{sc.label}</span>}
                      {isBonus&&st.un===st.total&&<span style={{fontSize:'.6rem',color:'#fb923c',marginLeft:4}}>(not attempted)</span>}
                    </div>
                    <div className="bt-num" style={{color:score>=0?'#4ade80':'#f87171'}}>{isOverall?data.score:(score>=0?'+':'')+score}</div>
                    <div className="bt-num green">{st.cor}<span className="bt-den">/{st.total}</span></div>
                    <div className="bt-num red">{st.wrg}<span className="bt-den">/{st.total}</span></div>
                    <div className="bt-num gray">{st.un+st.skp}<span className="bt-den">/{st.total}</span></div>
                    <div className="bt-acc-cell">
                      <div className="bt-acc-bar-w"><div className="bt-acc-bar" style={{width:pct+'%',background:isOverall?'#6366f1':sc.bg}}/></div>
                      <span style={{color:isOverall?'#818cf8':sc.bg,fontFamily:'JetBrains Mono,monospace',fontSize:'.75rem',fontWeight:700}}>{pct}%</span>
                    </div>
                  </div>
                </>)
              })}
            </div>
          </div>

          {/* Subject cards */}
          <div className="a-section">
            <div className="a-sec-title">⚡ Subject Overview</div>
            <div className="subj-cards-grid">
              {subjects.map(s=>{
                const st=ms(getSubjQs(s)); const sc=getSC(s)
                const score=st.cor*mCor-st.wrg*mNeg; const pct=(st.cor+st.wrg)?Math.round(st.cor/(st.cor+st.wrg)*100):0
                return(
                  <div key={s} className="scard" style={{'--sa':sc.bg,'--sg':sc.grd}}>
                    <div className="scard-top">
                      <div className="scard-emoji">{sc.emoji}</div>
                      <div>
                        <div className="scard-badge" style={{background:sc.grd,color:'#fff'}}>{sc.label}</div>
                        <div className="scard-name">{s}</div>
                      </div>
                    </div>
                    <div className="scard-score" style={{background:`linear-gradient(135deg,${sc.bg}22,${sc.bg}08)`}}>
                      <div className="scard-score-n" style={{color:score>=0?'#4ade80':'#f87171'}}>{score>=0?'+':''}{score}</div>
                      <div className="scard-score-l">marks</div>
                    </div>
                    <div className="scard-bar-wrap"><div className="scard-bar" style={{width:pct+'%',background:sc.grd}}/></div>
                    <div className="scard-stats">
                      <span style={{color:'#4ade80'}}>✓{st.cor}</span>
                      <span style={{color:'#f87171'}}>✗{st.wrg}</span>
                      <span style={{color:'#fb923c'}}>↩{st.skp}</span>
                      <span style={{color:'#64748b'}}>—{st.un}</span>
                      <span style={{color:sc.bg,fontWeight:800}}>{pct}%</span>
                    </div>
                    <button className="scard-btn" style={{background:sc.grd}} onClick={()=>openReview(s)}>Review Questions →</button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ REVIEW ══ */}
      {tab==='review' && (
        <div className="review-shell">
          {/* Subject tabs */}
          <div className="rev-subj-bar">
            {subjects.map(s=>{
              const sc=getSC(s); const st=ms(getSubjQs(s)); const isA=activeSubj===s
              return(
                <button key={s} className={`rsb-btn${isA?' on':''}`}
                  style={isA?{background:sc.grd,color:'white',borderColor:'transparent',boxShadow:`0 4px 16px ${sc.bg}44`}:{color:sc.bg,borderColor:sc.bg+'33'}}
                  onClick={()=>switchSubj(s)}>
                  <span>{sc.emoji}</span>
                  <span className="rsb-label">{sc.label}</span>
                  <span className="rsb-name">{s}</span>
                  <span className="rsb-cnt" style={isA?{background:'rgba(255,255,255,.2)'}:{background:sc.light,color:sc.bg}}>
                    {getSubjQs(s).filter(q=>q.result==='correct').length}/{st.total}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="rev-layout">
            {/* Left nav */}
            <div className="rev-nav">
              <div className="rn-head">Questions <span className="rn-cnt">{filteredQs.length}/{subjQs.length}</span></div>
              {/* Filters */}
              <div className="rn-filters">
                {[['all','All',null],['correct','✓',DOT_COLOR.correct],['wrong','✗',DOT_COLOR.wrong],['skipped','↩',DOT_COLOR.skipped],['unattempted','—','#475569']].map(([m,l,c])=>(
                  <button key={m} className={`rf-btn${filter===m?' on':''}`}
                    style={filter===m&&c?{background:c,borderColor:c,color:filter==='unattempted'?'white':'#000'}:filter===m?{background:'#6366f1',borderColor:'#6366f1',color:'white'}:{}}
                    onClick={()=>{setFilter(m);setCurQ(0)}}>{l}</button>
                ))}
              </div>
              {/* Dot grid */}
              <div className="rn-dots">
                {filteredQs.map((q,i)=>(
                  <div key={i} className={`rn-dot${i===curQ?' rnd-cur':''}`}
                    style={{background:i===curQ?'#6366f1':DOT_COLOR[q.result]||'#334155',boxShadow:i===curQ?'0 0 0 2.5px white,0 0 0 4.5px #6366f1':''}}
                    onClick={()=>setCurQ(i)}>
                    {q.qnum||(subjQs.indexOf(q)+1)}
                  </div>
                ))}
                {!filteredQs.length&&<div style={{color:'#475569',fontSize:'.76rem',gridColumn:'1/-1',textAlign:'center',padding:'16px 0'}}>No questions</div>}
              </div>
              {/* Legend */}
              <div className="rn-legend">
                {Object.entries(RES).map(([k,v])=>(
                  <div key={k} className="rnl-item"><div className="rnl-dot" style={{background:DOT_COLOR[k]}}/><span>{v.label}</span></div>
                ))}
              </div>
            </div>

            {/* Right: question */}
            <div className="rev-qpanel">
              {!curQ2 ? (
                <div className="rev-empty"><div style={{fontSize:'3rem',marginBottom:12}}>🔍</div><div>Select a question to review</div></div>
              ) : (
                <>
                  <div className="rq-header">
                    <div className="rq-hl">
                      <span className="rq-qnum">Q {curQ2.qnum||(subjQs.indexOf(curQ2)+1)}</span>
                      {curQ2.subject&&<span className="rq-subj" style={{background:getSC(curQ2.subject).light,color:getSC(curQ2.subject).bg,border:`1px solid ${getSC(curQ2.subject).dot}44`}}>{getSC(curQ2.subject).emoji} {curQ2.subject}</span>}
                      <span className={`rq-type ${curQ2.type==='INTEGER'?'int':'mcq'}`}>{curQ2.type==='INTEGER'?'Integer':'MCQ'}</span>
                    </div>
                    <div className="rq-result" style={{background:RES[curQ2.result]?.bg,color:RES[curQ2.result]?.color,border:`1px solid ${RES[curQ2.result]?.border}`}}>
                      {RES[curQ2.result]?.label}
                    </div>
                  </div>

                  <div className="rq-body">
                    {curQ2.images&&curQ2.images.length>0?(
                      <div className="rq-img-wrap">{curQ2.images.map((img,i)=><img key={i} src={`data:image/png;base64,${img}`} alt="" style={{maxWidth:'100%',display:'block',margin:'0 auto 8px',borderRadius:8}}/>)}</div>
                    ):(
                      <div className="rq-text" dangerouslySetInnerHTML={{__html:(curQ2.text||'').replace(/\n/g,'<br/>')}}/>
                    )}

                    {curQ2.type==='MCQ'&&curQ2.opts&&(
                      <div className="rq-opts">
                        {['A','B','C','D'].map((lbl,i)=>{
                          const isCor=lbl===(curQ2.correctAnswer||'').toUpperCase().trim()
                          const isYrs=lbl===(curQ2.yourAnswer||'').toUpperCase().trim()
                          return(
                            <div key={lbl} className={`rq-opt${isCor?' rq-cor':isYrs&&!isCor?' rq-wrg':''}`}>
                              <div className="rq-opt-lbl">{lbl}</div>
                              <div className="rq-opt-text">{curQ2.opts[i]||`Option ${lbl}`}</div>
                              <div className="rq-opt-tags">
                                {isCor&&<span className="rqt green">✓ Correct</span>}
                                {isYrs&&!isCor&&<span className="rqt red">✗ Your Answer</span>}
                                {isCor&&isYrs&&<span className="rqt green">✓ Your Answer</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {curQ2.type==='INTEGER'&&(
                      <div className="rq-int-box">
                        <div className="rq-int-row">
                          <span className="rq-int-lbl">Your answer</span>
                          <span className="rq-int-val" style={{color:curQ2.result==='correct'?'#15803d':'#b91c1c',background:curQ2.result==='correct'?'#dcfce7':'#fee2e2'}}>{curQ2.yourAnswer||'—'}</span>
                        </div>
                        <div className="rq-int-row">
                          <span className="rq-int-lbl">Correct answer</span>
                          <span className="rq-int-val" style={{color:'#15803d',background:'#dcfce7'}}>{curQ2.correctAnswer}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rq-nav">
                    <button className="rqn-btn" disabled={curQ===0} onClick={()=>setCurQ(c=>c-1)}>← Prev</button>
                    <span className="rqn-count">{curQ+1} <span style={{color:'#475569'}}>/</span> {filteredQs.length}</span>
                    <button className="rqn-btn primary" disabled={curQ>=filteredQs.length-1} onClick={()=>setCurQ(c=>c+1)}>Next →</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0e1a;--s1:#0d1425;--s2:#111827;--card:#141e35;--card2:#1a2540;--border:rgba(99,102,241,.12);--border2:rgba(99,102,241,.2);--text:#f0f4ff;--muted:#475569;--m2:#94a3b8;--accent:#6366f1}
html,body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:2px}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:fadeUp .4s ease both}

/* Upload */
.upload-shell{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(99,102,241,.2),transparent)}
.upload-card{background:var(--card);border:1px solid var(--border2);border-radius:24px;padding:48px 44px;width:100%;max-width:560px;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,.5)}
.back-link{display:inline-block;color:var(--m2);font-size:.78rem;text-decoration:none;margin-bottom:28px;opacity:.7}
.back-link:hover{opacity:1}
.upload-icon-wrap{width:80px;height:80px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:22px;display:flex;align-items:center;justify-content:center;font-size:2.2rem;margin:0 auto 20px;box-shadow:0 8px 32px rgba(99,102,241,.4)}
.upload-icon{line-height:1}
.upload-title{font-size:1.8rem;font-weight:900;letter-spacing:-1px;margin-bottom:8px}
.upload-sub{color:var(--m2);font-size:.88rem;margin-bottom:28px;line-height:1.6}
.dropzone{background:rgba(99,102,241,.05);border:2px dashed rgba(99,102,241,.25);border-radius:16px;padding:36px 24px;cursor:pointer;transition:all .22s;margin-bottom:16px}
.dropzone:hover,.dropzone.drag{border-color:#6366f1;background:rgba(99,102,241,.1);box-shadow:0 0 0 4px rgba(99,102,241,.1)}
.dz-title{font-size:.98rem;font-weight:700;margin-bottom:6px}
.dz-sub{color:var(--m2);font-size:.78rem;margin-bottom:18px}
.dz-btn{display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:10px 28px;border-radius:10px;font-weight:700;font-size:.84rem;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,.35)}
.upload-err{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);color:#f87171;padding:12px 16px;border-radius:10px;font-size:.82rem;text-align:left;margin-bottom:12px}
.upload-steps{display:flex;align-items:center;gap:8px;margin-top:20px;flex-wrap:wrap;justify-content:center}
.us-step{display:flex;align-items:center;gap:7px;font-size:.76rem;color:var(--m2)}
.us-n{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-size:.64rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.us-arrow{color:var(--muted);font-size:.8rem}
`

const APP_CSS = `
/* App header */
.app-header{background:rgba(10,14,26,.9);backdrop-filter:blur(24px);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;height:58px;display:flex;align-items:center;padding:0 20px}
.app-header-inner{width:100%;display:flex;align-items:center;gap:12px}
.app-logo{display:flex;align-items:center;gap:8px;text-decoration:none;flex-shrink:0}
.al-icon{font-size:1.2rem}
.al-text{font-size:1rem;color:var(--text)}.al-text b{background:linear-gradient(135deg,#818cf8,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.app-tabs{display:flex;gap:4px;flex:1;justify-content:center}
.app-tab{padding:7px 18px;border-radius:9px;border:none;background:transparent;color:var(--m2);font-family:'Inter',sans-serif;font-weight:600;font-size:.82rem;cursor:pointer;transition:all .15s}
.app-tab:hover{background:rgba(255,255,255,.06);color:var(--text)}
.app-tab.on{background:rgba(99,102,241,.15);color:#818cf8;border:1px solid rgba(99,102,241,.2)}
.app-header-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
.test-chip{font-size:.72rem;color:var(--m2);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.new-file-btn{background:rgba(255,255,255,.07);border:1px solid var(--border2);color:var(--m2);padding:5px 12px;border-radius:7px;font-size:.74rem;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif}
.new-file-btn:hover{color:var(--text);background:rgba(255,255,255,.1)}

/* Overview page */
.a-page{max-width:1200px;margin:0 auto;padding:24px 20px 80px}

/* Score hero */
.score-hero{background:linear-gradient(135deg,#0b1220,#141e35);border:1px solid var(--border);border-radius:20px;overflow:hidden;margin-bottom:20px;position:relative}
.sh-bg{position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 0% 50%,rgba(99,102,241,.12),transparent);pointer-events:none}
.sh-content{position:relative;display:flex;align-items:center;gap:24px;padding:28px 32px;flex-wrap:wrap}
.sh-left{flex-shrink:0}
.sh-label{font-size:.65rem;text-transform:uppercase;letter-spacing:2px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:4px}
.sh-score{font-family:'JetBrains Mono',monospace;font-size:3.8rem;font-weight:900;letter-spacing:-3px;line-height:1}
.sh-max{font-size:1.3rem;color:var(--muted);font-weight:400}
.sh-meta{display:flex;gap:8px;font-size:.74rem;color:var(--muted);margin-top:8px;align-items:center}
.sh-cards{display:flex;gap:8px;flex:1;flex-wrap:wrap}
.sh-card{border-radius:12px;padding:14px 18px;text-align:center;flex:1;min-width:80px}
.shc-val{font-family:'JetBrains Mono',monospace;font-size:1.7rem;font-weight:800;margin-bottom:4px}
.shc-lbl{font-size:.58rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px}

/* Section */
.a-section{margin-bottom:24px}
.a-sec-title{font-size:.65rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:2.5px;margin-bottom:14px;display:flex;align-items:center;gap:10px}
.a-sec-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--border),transparent)}

/* Breakdown table */
.breakdown-table{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden}
.bt-head{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1.4fr;padding:10px 20px;background:rgba(255,255,255,.03);font-size:.62rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-family:'JetBrains Mono',monospace}
.bt-row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1.4fr;padding:14px 20px;border-top:1px solid var(--border);align-items:center;transition:background .12s}
.bt-row:hover{background:rgba(255,255,255,.02)}
.bt-overall{background:rgba(99,102,241,.04)}
.bt-bonus{background:rgba(251,146,60,.04)}
.bt-subj-cell{display:flex;align-items:center;gap:8px}
.bt-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.bt-sbadge{font-size:.58rem;font-weight:800;padding:2px 6px;border-radius:6px;font-family:'JetBrains Mono',monospace}
.bt-num{font-family:'JetBrains Mono',monospace;font-size:.9rem;font-weight:700}
.bt-num.green{color:#4ade80}.bt-num.red{color:#f87171}.bt-num.gray{color:#64748b}
.bt-den{font-size:.68rem;color:var(--muted)}
.bt-acc-cell{display:flex;align-items:center;gap:8px}
.bt-acc-bar-w{flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden}
.bt-acc-bar{height:100%;border-radius:99px}

/* Subject cards */
.subj-cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.scard{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;transition:all .2s;position:relative;overflow:hidden}
.scard::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--sg)}
.scard:hover{transform:translateY(-4px);border-color:var(--border2);box-shadow:0 16px 48px rgba(0,0,0,.4)}
.scard-top{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.scard-emoji{font-size:1.6rem}
.scard-badge{font-size:.62rem;font-weight:800;padding:2px 8px;border-radius:20px;font-family:'JetBrains Mono',monospace;margin-bottom:3px;display:inline-block}
.scard-name{font-size:.82rem;font-weight:700;color:var(--m2)}
.scard-score{border-radius:10px;padding:12px 14px;text-align:center;margin-bottom:12px}
.scard-score-n{font-family:'JetBrains Mono',monospace;font-size:2rem;font-weight:900;line-height:1}
.scard-score-l{font-size:.62rem;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
.scard-bar-wrap{height:5px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden;margin-bottom:10px}
.scard-bar{height:100%;border-radius:99px;transition:width .6s}
.scard-stats{display:flex;gap:10px;font-family:'JetBrains Mono',monospace;font-size:.74rem;font-weight:700;margin-bottom:14px;flex-wrap:wrap}
.scard-btn{width:100%;padding:10px;border:none;border-radius:9px;color:white;font-family:'Inter',sans-serif;font-weight:700;font-size:.8rem;cursor:pointer;background:var(--sg);transition:all .15s}
.scard-btn:hover{opacity:.88;transform:translateY(-1px)}

/* Review shell */
.review-shell{display:flex;flex-direction:column;height:calc(100vh - 58px)}
.rev-subj-bar{background:rgba(10,14,26,.95);border-bottom:1px solid var(--border);padding:8px 16px;display:flex;gap:6px;overflow-x:auto;flex-shrink:0}
.rsb-btn{display:flex;align-items:center;gap:7px;padding:8px 16px;border-radius:10px;border:1.5px solid;background:transparent;cursor:pointer;font-family:'Inter',sans-serif;font-size:.78rem;font-weight:600;white-space:nowrap;transition:all .18s;flex-shrink:0}
.rsb-label{font-family:'JetBrains Mono',monospace;font-size:.65rem;font-weight:800}
.rsb-cnt{font-family:'JetBrains Mono',monospace;font-size:.62rem;font-weight:700;padding:2px 7px;border-radius:20px}

/* Review layout */
.rev-layout{display:flex;flex:1;overflow:hidden;min-height:0}
.rev-nav{width:220px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
.rn-head{padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:.62rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
.rn-cnt{color:var(--accent);font-weight:400}
.rn-filters{padding:8px;display:flex;flex-direction:column;gap:4px;border-bottom:1px solid var(--border);flex-shrink:0}
.rf-btn{padding:7px 10px;border-radius:7px;font-size:.76rem;font-weight:600;cursor:pointer;border:1.5px solid rgba(255,255,255,.08);background:transparent;color:var(--m2);font-family:'Inter',sans-serif;text-align:left;transition:all .12s}
.rf-btn:hover{background:rgba(255,255,255,.05);color:var(--text)}
.rf-btn.on{}
.rn-dots{padding:10px;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;overflow-y:auto;flex:1}
.rn-dot{height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:.58rem;font-weight:800;cursor:pointer;color:white;transition:all .12s}
.rn-dot:hover{transform:scale(1.08)}
.rnd-cur{}
.rn-legend{padding:10px 12px;border-top:1px solid var(--border);flex-shrink:0}
.rnl-item{display:flex;align-items:center;gap:6px;font-size:.62rem;color:var(--muted);margin-bottom:5px}
.rnl-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}

/* Right question panel - WHITE */
.rev-qpanel{flex:1;background:white;color:#1a1a2e;overflow-y:auto;padding:24px 28px;display:flex;flex-direction:column;gap:16px}
.rev-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;text-align:center;font-size:.88rem}
.rq-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.rq-hl{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rq-qnum{font-family:'JetBrains Mono',monospace;font-size:.82rem;font-weight:700;background:#f0f2ff;border:1.5px solid #c7d2fe;color:#3730a3;padding:4px 12px;border-radius:8px}
.rq-subj{font-size:.72rem;font-weight:700;padding:4px 11px;border-radius:20px;font-family:'JetBrains Mono',monospace}
.rq-type{font-size:.64rem;font-weight:800;padding:3px 9px;border-radius:20px;font-family:'JetBrains Mono',monospace}
.rq-type.mcq{background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd}
.rq-type.int{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}
.rq-result{font-size:.78rem;font-weight:700;padding:5px 14px;border-radius:20px}
.rq-body{background:#fafbff;border:1px solid #e8eaf6;border-radius:14px;padding:20px}
.rq-img-wrap{text-align:center}
.rq-text{font-size:.95rem;line-height:1.9;color:#1a1a2e;white-space:pre-wrap}
.rq-opts{display:flex;flex-direction:column;gap:9px;margin-top:16px}
.rq-opt{display:flex;align-items:flex-start;gap:12px;border:2px solid #e8eaf6;border-radius:12px;padding:13px 16px;background:white;transition:all .12s}
.rq-cor{border-color:#16a34a!important;background:#f0fdf4!important}
.rq-wrg{border-color:#dc2626!important;background:#fef2f2!important}
.rq-opt-lbl{width:30px;height:30px;border-radius:8px;background:#f0f2ff;border:1.5px solid #c7d2fe;color:#4338ca;font-family:'JetBrains Mono',monospace;font-size:.75rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rq-cor .rq-opt-lbl{background:#16a34a;border-color:#16a34a;color:white}
.rq-wrg .rq-opt-lbl{background:#dc2626;border-color:#dc2626;color:white}
.rq-opt-text{flex:1;font-size:.9rem;color:#1a1a2e;line-height:1.65;padding-top:3px}
.rq-opt-tags{flex-shrink:0;display:flex;flex-direction:column;gap:3px;align-items:flex-end;padding-top:3px}
.rqt{font-size:.62rem;font-weight:800;padding:2px 8px;border-radius:10px;white-space:nowrap}
.rqt.green{background:#dcfce7;color:#15803d;border:1px solid #86efac}
.rqt.red{background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5}
.rq-int-box{margin-top:16px;background:#f8f9ff;border-radius:12px;overflow:hidden;border:1px solid #e8eaf6}
.rq-int-row{display:flex;align-items:center;padding:14px 18px;border-bottom:1px solid #eee}
.rq-int-row:last-child{border-bottom:none}
.rq-int-lbl{font-size:.8rem;color:#666;flex:1}
.rq-int-val{font-family:'JetBrains Mono',monospace;font-size:1.2rem;font-weight:800;padding:6px 18px;border-radius:8px}
.rq-nav{display:flex;align-items:center;justify-content:space-between;background:white;border-top:1px solid #f0f0f0;padding-top:14px;margin-top:auto}
.rqn-btn{padding:10px 24px;border-radius:9px;border:1.5px solid #e0e4ff;background:white;color:#3730a3;font-family:'Inter',sans-serif;font-weight:700;font-size:.82rem;cursor:pointer;transition:all .15s}
.rqn-btn:hover:not(:disabled){background:#eef2ff;border-color:#818cf8}
.rqn-btn.primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border-color:transparent;box-shadow:0 4px 14px rgba(99,102,241,.3)}
.rqn-btn.primary:hover:not(:disabled){opacity:.9}
.rqn-btn:disabled{opacity:.3;cursor:not-allowed}
.rqn-count{font-family:'JetBrains Mono',monospace;font-size:.86rem;color:#475569;font-weight:700}
@media(max-width:768px){
  .rev-layout{flex-direction:column}
  .rev-nav{width:100%;max-height:220px;border-right:none;border-bottom:1px solid var(--border)}
  .rn-dots{grid-template-columns:repeat(8,1fr)}
  .sh-cards{justify-content:center}
  .bt-head,.bt-row{grid-template-columns:2fr 1fr 1fr 1fr}
  .bt-head>:nth-child(5),.bt-row>:nth-child(5),.bt-head>:last-child,.bt-row>:last-child{display:none}
}
`
