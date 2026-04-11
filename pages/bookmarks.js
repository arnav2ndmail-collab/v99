import { useState, useEffect } from 'react'
import Head from 'next/head'

const BM_KEY = 'tz_bookmarks_v1'

// Bookmarks storage: { notebookName: [ {qnum,subject,text,opts,correctAnswer,testTitle,testPath,savedAt}, ... ] }
function loadBooks() {
  try { return JSON.parse(localStorage.getItem(BM_KEY)||'{}') } catch(e) { return {} }
}
function saveBooks(books) {
  try { localStorage.setItem(BM_KEY, JSON.stringify(books)) } catch(e) {}
}

const SUBJ_COLORS = {
  'Physics':      { bg:'#1a237e', light:'#e8eaf6', label:'PHY' },
  'Chemistry':    { bg:'#1b5e20', light:'#e8f5e9', label:'CHEM' },
  'Maths':        { bg:'#b71c1c', light:'#ffebee', label:'MATH' },
  'English & LR': { bg:'#4a148c', light:'#f3e5f5', label:'ENG'  },
  'Bonus':        { bg:'#c2410c', light:'#fff7ed', label:'BON'  },
}
const getSC = s => SUBJ_COLORS[s] || { bg:'#37474f', light:'#eceff1', label:'Q' }

export default function Bookmarks() {
  const [books, setBooks]           = useState({})
  const [activeNb, setActiveNb]     = useState(null)   // notebook name
  const [activeQ, setActiveQ]       = useState(null)   // question object
  const [userAns, setUserAns]       = useState(null)
  const [checked, setChecked]       = useState(false)
  const [showNew, setShowNew]       = useState(false)
  const [newName, setNewName]       = useState('')
  const [newErr, setNewErr]         = useState('')
  // For fetching image of a bookmarked question
  const [qImg, setQImg]             = useState(null)
  const [imgLoading, setImgLoading] = useState(false)

  useEffect(() => { setBooks(loadBooks()) }, [])

  const nbNames = Object.keys(books)

  const createNotebook = () => {
    const n = newName.trim()
    if (!n) { setNewErr('Enter a name'); return }
    if (books[n]) { setNewErr('Already exists'); return }
    const updated = { ...books, [n]: [] }
    setBooks(updated); saveBooks(updated)
    setShowNew(false); setNewName(''); setNewErr('')
    setActiveNb(n)
  }

  const deleteNotebook = (nb) => {
    if (!confirm(`Delete notebook "${nb}" and all its questions?`)) return
    const updated = { ...books }; delete updated[nb]
    setBooks(updated); saveBooks(updated)
    if (activeNb === nb) setActiveNb(null)
  }

  const removeQ = (nb, idx) => {
    const updated = { ...books, [nb]: books[nb].filter((_,i)=>i!==idx) }
    setBooks(updated); saveBooks(updated)
    if (activeQ === books[nb][idx]) setActiveQ(null)
  }

  const openQ = async (q) => {
    setActiveQ(q); setUserAns(null); setChecked(false); setQImg(null)
    // Fetch image if question has one
    if (q.hasImage && q.testPath) {
      setImgLoading(true)
      try {
        const r = await fetch(`/api/test/${q.testPath}`)
        const d = await r.json()
        const fresh = d.questions?.find(fq => fq.qnum === q.qnum)
        if (fresh?.images?.length) setQImg(fresh.images)
        else if (fresh?.pageRef != null && d.pageImages?.[String(fresh.pageRef)]) {
          setQImg([d.pageImages[String(fresh.pageRef)]])
        }
      } catch(e) {}
      setImgLoading(false)
    }
  }

  const checkAnswer = () => { if (userAns) setChecked(true) }

  const optCls = (lbl) => {
    if (!checked) return userAns===lbl ? 'bm-opt sel' : 'bm-opt'
    const correct = (activeQ?.correctAnswer||'').toUpperCase().trim()
    if (lbl === correct) return 'bm-opt cor'
    if (lbl === userAns && lbl !== correct) return 'bm-opt wrg'
    return 'bm-opt'
  }

  return (
    <>
      <Head>
        <title>TestZyro — Bookmarks</title>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      </Head>
      <style>{CSS}</style>

      <header className="hdr">
        <div className="logo" onClick={()=>window.location.href='/'}>
          <div className="logo-mark">TZ</div>
          <div className="logo-txt">Test<span>Zyro</span></div>
        </div>
        <nav className="nav">
          <a href="/" className="nb">📚 Library</a>
          <a href="/analyser" className="nb">📊 Analyser</a>
          <a href="/solutions" className="nb">📄 Solutions</a>
          <span className="nb active">🔖 Bookmarks</span>
          <a href="/admin" className="nb">⚙️ Admin</a>
        </nav>
      </header>

      <div className="bm-layout">
        {/* Left: Notebooks panel */}
        <div className="bm-sidebar">
          <div className="bm-sb-head">
            <span className="bm-sb-title">🔖 Notebooks</span>
            <button className="bm-new-btn" onClick={()=>{setShowNew(true);setNewName('');setNewErr('')}}>+ New</button>
          </div>

          {showNew && (
            <div className="bm-new-form">
              <input className="bm-inp" autoFocus placeholder="Notebook name…"
                value={newName} onChange={e=>setNewName(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&createNotebook()}/>
              {newErr && <div className="bm-new-err">{newErr}</div>}
              <div className="bm-new-actions">
                <button className="bm-create-btn" onClick={createNotebook}>Create</button>
                <button className="bm-cancel-btn" onClick={()=>setShowNew(false)}>Cancel</button>
              </div>
            </div>
          )}

          {nbNames.length === 0 && !showNew && (
            <div className="bm-empty-nb">No notebooks yet.<br/>Click <b>+ New</b> to create one.</div>
          )}

          {nbNames.map(nb => (
            <div key={nb} className={`bm-nb-row${activeNb===nb?' on':''}`} onClick={()=>{setActiveNb(nb);setActiveQ(null)}}>
              <div className="bm-nb-info">
                <span className="bm-nb-name">{nb}</span>
                <span className="bm-nb-count">{books[nb]?.length||0} qs</span>
              </div>
              <button className="bm-nb-del" onClick={e=>{e.stopPropagation();deleteNotebook(nb)}}>🗑</button>
            </div>
          ))}
        </div>

        {/* Middle: Questions list */}
        <div className="bm-qlist">
          {!activeNb ? (
            <div className="bm-placeholder">
              <div style={{fontSize:'3rem',marginBottom:12}}>🔖</div>
              <div style={{fontWeight:700,fontSize:'1rem',marginBottom:6}}>Select a notebook</div>
              <div style={{color:'#999',fontSize:'.82rem'}}>Open a notebook to see bookmarked questions</div>
            </div>
          ) : (
            <>
              <div className="bm-ql-head">
                <span className="bm-ql-title">{activeNb}</span>
                <span className="bm-ql-count">{books[activeNb]?.length||0} questions</span>
              </div>
              {(books[activeNb]||[]).length === 0 && (
                <div className="bm-empty-q">No questions yet.<br/>Bookmark questions from the Analyser page.</div>
              )}
              {(books[activeNb]||[]).map((q, idx) => {
                const sc = getSC(q.subject)
                return (
                  <div key={idx} className={`bm-q-card${activeQ===q?' active':''}`} onClick={()=>openQ(q)}>
                    <div className="bm-q-top">
                      <span className="bm-q-subj" style={{background:sc.light,color:sc.bg}}>{sc.label}</span>
                      <span className="bm-q-num">Q{q.qnum}</span>
                      {q.testTitle && <span className="bm-q-test">{q.testTitle}</span>}
                      <button className="bm-q-remove" onClick={e=>{e.stopPropagation();removeQ(activeNb,idx)}} title="Remove bookmark">🔖✕</button>
                    </div>
                    {q.text && <div className="bm-q-preview">{q.text.slice(0,80)}{q.text.length>80?'…':''}</div>}
                    {!q.text && q.hasImage && <div className="bm-q-preview" style={{color:'#999'}}>📷 Image question — click to view</div>}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Right: Question viewer */}
        <div className="bm-viewer">
          {!activeQ ? (
            <div className="bm-placeholder">
              <div style={{fontSize:'2.5rem',marginBottom:12}}>📖</div>
              <div style={{fontWeight:700,marginBottom:6}}>Select a question</div>
              <div style={{color:'#999',fontSize:'.82rem'}}>Click a question to practise it</div>
            </div>
          ) : (
            <div className="bm-q-view">
              {/* Question header */}
              <div className="bm-qv-meta">
                {(() => { const sc=getSC(activeQ.subject); return(
                  <span className="bm-qv-subj" style={{background:sc.light,color:sc.bg}}>{sc.label} · {activeQ.subject}</span>
                )})()}
                <span className="bm-qv-num">Q{activeQ.qnum}</span>
                {activeQ.testTitle && <span className="bm-qv-test">{activeQ.testTitle}</span>}
              </div>

              {/* Question content */}
              <div className="bm-qv-content">
                {imgLoading && <div className="bm-img-loading">⏳ Loading image…</div>}
                {qImg && qImg.length > 0 && (
                  <div className="bm-qv-imgs">
                    {qImg.map((img,i)=>(
                      <img key={i} src={`data:image/png;base64,${img}`} alt="" style={{maxWidth:'100%',display:'block',margin:'0 auto 8px'}}/>
                    ))}
                  </div>
                )}
                {!qImg && activeQ.text && (
                  <div className="bm-qv-text" dangerouslySetInnerHTML={{__html:(activeQ.text||'').replace(/\n/g,'<br/>')}}/>
                )}
              </div>

              {/* Options */}
              {activeQ.opts && activeQ.opts.length > 0 && (
                <div className="bm-opts">
                  {['A','B','C','D'].map((lbl,i)=>(
                    <div key={lbl} className={optCls(lbl)} onClick={()=>{if(!checked){setUserAns(lbl)}}}>
                      <span className="bm-olbl">{lbl}</span>
                      <span className="bm-otext">{activeQ.opts[i]||`Option ${lbl}`}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Check answer */}
              {!checked ? (
                <button className="bm-check-btn" onClick={checkAnswer} disabled={!userAns}>
                  Check Answer
                </button>
              ) : (
                <div className="bm-result-banner" style={{background:(activeQ.correctAnswer||'').toUpperCase()===userAns?'#e8f5e9':'#ffebee',borderColor:(activeQ.correctAnswer||'').toUpperCase()===userAns?'#4caf50':'#ef9a9a',color:(activeQ.correctAnswer||'').toUpperCase()===userAns?'#2e7d32':'#c62828'}}>
                  {(activeQ.correctAnswer||'').toUpperCase()===userAns ? '✓ Correct!' : `✗ Wrong — Correct answer: ${activeQ.correctAnswer}`}
                </div>
              )}

              {/* Try again */}
              {checked && (
                <button className="bm-retry-btn" onClick={()=>{setUserAns(null);setChecked(false)}}>↺ Try Again</button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f5f5f5;color:#212121;font-family:'Roboto',sans-serif;min-height:100vh}
.hdr{background:#1a237e;color:white;padding:0 24px;display:flex;align-items:center;height:56px;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.3);position:sticky;top:0;z-index:100}
.logo{display:flex;align-items:center;gap:8px;cursor:pointer}.logo-mark{width:32px;height:32px;background:#ffeb3b;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:'Roboto Mono',monospace;font-weight:700;font-size:.8rem;color:#1a237e}.logo-txt{font-weight:700;font-size:1.1rem;color:white}.logo-txt span{color:#ffeb3b}
.nav{display:flex;align-items:center;gap:4px;flex:1}.nb{padding:6px 14px;border-radius:4px;font-family:'Roboto',sans-serif;font-weight:500;font-size:.82rem;cursor:pointer;border:none;background:transparent;color:rgba(255,255,255,.8);transition:all .15s;text-decoration:none;display:inline-block}.nb:hover{color:white;background:rgba(255,255,255,.1)}.nb.active{background:rgba(255,255,255,.2);color:white}
/* Layout */
.bm-layout{display:flex;height:calc(100vh - 56px);overflow:hidden}
/* Sidebar */
.bm-sidebar{width:220px;flex-shrink:0;background:white;border-right:1px solid #e0e0e0;display:flex;flex-direction:column;overflow:hidden}
.bm-sb-head{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 10px;border-bottom:1px solid #e0e0e0}
.bm-sb-title{font-size:.78rem;font-weight:800;color:#1a237e;text-transform:uppercase;letter-spacing:1px;font-family:'Roboto Mono',monospace}
.bm-new-btn{background:#1a237e;color:white;border:none;padding:5px 11px;border-radius:5px;font-size:.74rem;font-weight:700;cursor:pointer;font-family:'Roboto',sans-serif}
.bm-new-btn:hover{background:#283593}
.bm-new-form{padding:10px 12px;background:#f5f7ff;border-bottom:1px solid #e0e4ff}
.bm-inp{width:100%;border:1.5px solid #c5cae9;border-radius:6px;padding:7px 10px;font-family:'Roboto',sans-serif;font-size:.82rem;color:#212121;outline:none;margin-bottom:6px}
.bm-inp:focus{border-color:#1a237e}
.bm-new-err{font-size:.72rem;color:#c62828;margin-bottom:5px}
.bm-new-actions{display:flex;gap:6px}
.bm-create-btn{flex:1;background:#1a237e;color:white;border:none;padding:7px;border-radius:5px;font-size:.76rem;font-weight:700;cursor:pointer;font-family:'Roboto',sans-serif}
.bm-cancel-btn{padding:7px 10px;border-radius:5px;border:1px solid #ccc;background:white;font-size:.76rem;cursor:pointer;font-family:'Roboto',sans-serif}
.bm-empty-nb{padding:20px 14px;font-size:.78rem;color:#aaa;text-align:center;line-height:1.7}
.bm-nb-row{display:flex;align-items:center;padding:10px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;transition:background .12s}
.bm-nb-row:hover{background:#f5f7ff}
.bm-nb-row.on{background:#e8eaf6;border-left:3px solid #1a237e}
.bm-nb-info{flex:1;display:flex;flex-direction:column;gap:2px}
.bm-nb-name{font-weight:600;font-size:.84rem;color:#212121}
.bm-nb-count{font-size:.65rem;color:#888;font-family:'Roboto Mono',monospace}
.bm-nb-del{background:none;border:none;cursor:pointer;font-size:.8rem;opacity:.4;padding:2px 4px}
.bm-nb-del:hover{opacity:1}
/* Question list */
.bm-qlist{width:280px;flex-shrink:0;background:#fafafa;border-right:1px solid #e0e0e0;overflow-y:auto;display:flex;flex-direction:column}
.bm-ql-head{padding:12px 14px;border-bottom:1px solid #e0e0e0;background:white;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
.bm-ql-title{font-weight:700;font-size:.9rem;color:#1a237e}
.bm-ql-count{font-size:.65rem;color:#888;font-family:'Roboto Mono',monospace}
.bm-empty-q{padding:30px 16px;font-size:.78rem;color:#aaa;text-align:center;line-height:1.7}
.bm-q-card{padding:12px 14px;border-bottom:1px solid #eee;cursor:pointer;transition:background .12s;background:white}
.bm-q-card:hover{background:#f5f7ff}
.bm-q-card.active{background:#e8eaf6;border-left:3px solid #1a237e}
.bm-q-top{display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap}
.bm-q-subj{font-size:.6rem;font-weight:700;padding:2px 7px;border-radius:10px;font-family:'Roboto Mono',monospace}
.bm-q-num{font-size:.68rem;font-weight:700;color:#555;font-family:'Roboto Mono',monospace}
.bm-q-test{font-size:.6rem;color:#aaa;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bm-q-remove{background:none;border:none;cursor:pointer;font-size:.7rem;color:#c62828;opacity:.5;margin-left:auto;padding:2px 4px;flex-shrink:0}
.bm-q-remove:hover{opacity:1}
.bm-q-preview{font-size:.76rem;color:#555;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
/* Viewer */
.bm-viewer{flex:1;background:white;overflow-y:auto;padding:20px 24px}
.bm-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#999;text-align:center}
.bm-q-view{max-width:680px}
.bm-qv-meta{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.bm-qv-subj{font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:20px;font-family:'Roboto Mono',monospace}
.bm-qv-num{font-size:.78rem;font-weight:700;color:#555;font-family:'Roboto Mono',monospace;background:#f5f5f5;border:1px solid #ddd;padding:3px 10px;border-radius:4px}
.bm-qv-test{font-size:.72rem;color:#aaa}
.bm-qv-content{background:#fafafa;border:1px solid #e0e0e0;border-radius:8px;padding:14px;margin-bottom:16px;min-height:60px}
.bm-qv-text{font-size:.92rem;line-height:1.85;color:#212121;white-space:pre-wrap}
.bm-qv-imgs{text-align:center}
.bm-img-loading{color:#888;font-size:.8rem;padding:10px 0}
.bm-opts{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.bm-opt{display:flex;align-items:flex-start;gap:10px;background:white;border:1.5px solid #ddd;border-radius:6px;padding:10px 13px;cursor:pointer;transition:all .12s}
.bm-opt:hover{border-color:#1a237e;background:#e8eaf6}
.bm-opt.sel{border-color:#1a237e;background:#e8eaf6}
.bm-opt.cor{border-color:#2e7d32!important;background:#e8f5e9!important}
.bm-opt.wrg{border-color:#c62828!important;background:#ffebee!important}
.bm-olbl{font-family:'Roboto Mono',monospace;font-size:.72rem;font-weight:700;color:#1a237e;min-width:20px;flex-shrink:0;background:#e8eaf6;border-radius:3px;text-align:center;padding:2px 5px}
.bm-opt.sel .bm-olbl{background:#1a237e;color:white}
.bm-opt.cor .bm-olbl{background:#2e7d32;color:white}
.bm-opt.wrg .bm-olbl{background:#c62828;color:white}
.bm-otext{font-size:.88rem;color:#212121;line-height:1.6;padding-top:2px}
.bm-check-btn{background:#1a237e;color:white;border:none;padding:10px 28px;border-radius:6px;font-family:'Roboto',sans-serif;font-weight:700;font-size:.84rem;cursor:pointer;margin-bottom:10px}
.bm-check-btn:disabled{background:#9e9e9e;cursor:not-allowed}
.bm-check-btn:hover:not(:disabled){background:#283593}
.bm-result-banner{border:1px solid;border-radius:6px;padding:10px 14px;margin-bottom:10px;font-size:.84rem;font-weight:600}
.bm-retry-btn{background:white;border:1.5px solid #1a237e;color:#1a237e;padding:8px 20px;border-radius:6px;font-family:'Roboto',sans-serif;font-weight:600;font-size:.82rem;cursor:pointer}
.bm-retry-btn:hover{background:#e8eaf6}
`
