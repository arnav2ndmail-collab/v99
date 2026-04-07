import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

export default function Solutions() {
  const [solutions, setSolutions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [openFolders, setOpenFolders] = useState({})

  useEffect(() => {
    fetch('/api/solutions')
      .then(r => r.json())
      .then(d => {
        setSolutions(Array.isArray(d) ? d : [])
        // open all folders by default
        const folders = [...new Set((Array.isArray(d)?d:[]).map(s => s.folder))]
        const open = {}
        folders.forEach(f => { open[f] = true })
        setOpenFolders(open)
      })
      .catch(() => setSolutions([]))
      .finally(() => setLoading(false))
  }, [])

  const fmtSize = bytes => {
    if (bytes > 1024*1024) return (bytes/1024/1024).toFixed(1)+' MB'
    return (bytes/1024).toFixed(0)+' KB'
  }

  // Group by folder
  const folders = [...new Set(solutions.map(s => s.folder))]
  const filtered = solutions.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.folder.toLowerCase().includes(search.toLowerCase())
  )

  const FOLDER_COLORS = [
    '#1a237e','#1b5e20','#b71c1c','#4a148c','#e65100','#006064','#37474f','#880e4f'
  ]

  return (
    <>
      <Head>
        <title>TestZyro — Solutions</title>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      </Head>
      <style>{CSS}</style>

      {/* Header */}
      <header className="hdr">
        <div className="logo" onClick={()=>window.location.href='/'}>
          <div className="logo-mark">TZ</div>
          <div className="logo-txt">Test<span>Zyro</span></div>
        </div>
        <nav className="nav">
          <a href="/" className="nb">📚 Library</a>
          <a href="/analyser" className="nb">📊 Analyser</a>
          <span className="nb active">📄 Solutions</span>
          <a href="/admin" className="nb">⚙️ Admin</a>
        </nav>
      </header>

      <div className="wrap anim">
        <div className="page-top">
          <div>
            <h2>📄 Solutions</h2>
            <p>Download answer keys and solutions for all tests</p>
          </div>
          <div className="top-right">
            <span className="total-badge">{solutions.length} files</span>
          </div>
        </div>

        <div className="search-row">
          <input
            className="search-inp"
            placeholder="🔍 Search solutions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading && (
          <div className="loading-state">
            <div className="spinner"/>
            <span>Loading solutions...</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <h3>No solutions found</h3>
            <p>Ask your admin to upload PDF solution files to <code>public/solutions/</code></p>
            <a href="/admin" className="btn-admin">Go to Admin →</a>
          </div>
        )}

        {!loading && folders.map((folder, fi) => {
          const folderSols = filtered.filter(s => s.folder === folder)
          if (!folderSols.length) return null
          const color = FOLDER_COLORS[fi % FOLDER_COLORS.length]
          const isOpen = openFolders[folder] !== false
          return (
            <div key={folder} className="folder-section">
              {/* Folder header */}
              <div
                className="folder-hdr"
                style={{borderLeft: `4px solid ${color}`}}
                onClick={()=>setOpenFolders(p=>({...p,[folder]:!p[folder]}))}
              >
                <div className="folder-hdr-left">
                  <span className="folder-icon">{isOpen ? '📂' : '📁'}</span>
                  <span className="folder-name">{folder}</span>
                  <span className="folder-count" style={{background:color+'18',color,border:`1px solid ${color}30`}}>
                    {folderSols.length} file{folderSols.length!==1?'s':''}
                  </span>
                </div>
                <span className="folder-chevron" style={{color}}>{isOpen ? '▾' : '▸'}</span>
              </div>

              {/* Files */}
              {isOpen && (
                <div className="files-list">
                  {folderSols.map((sol, i) => (
                    <div key={sol.path} className="file-card" style={{'--accent': color}}>
                      <div className="file-icon-wrap" style={{background:color+'12'}}>
                        <span className="file-pdf-icon">📄</span>
                      </div>
                      <div className="file-info">
                        <div className="file-name">{sol.name}</div>
                        <div className="file-meta">
                          <span className="meta-tag">{sol.folder}</span>
                          <span className="meta-dot">·</span>
                          <span className="meta-size">{fmtSize(sol.size)}</span>
                          <span className="meta-dot">·</span>
                          <span className="meta-type">PDF</span>
                        </div>
                      </div>
                      <a
                        href={`/solutions/${sol.path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="view-btn"
                        style={{background:color}}
                      >
                        👁 View
                      </a>
                      <a
                        href={`/solutions/${sol.path}`}
                        download={sol.filename}
                        className="dl-btn"
                        style={{color,borderColor:color+'44',background:color+'0d'}}
                      >
                        📥 Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* How to add solutions */}
        {!loading && solutions.length === 0 && (
          <div className="how-to-card">
            <div className="ht-title">📋 How to add solution PDFs</div>
            <div className="ht-steps">
              <div className="ht-step">
                <div className="ht-num">1</div>
                <div>Go to your GitHub repo</div>
              </div>
              <div className="ht-step">
                <div className="ht-num">2</div>
                <div>Create folder: <code>public/solutions/BITSAT SERIES 1/</code></div>
              </div>
              <div className="ht-step">
                <div className="ht-num">3</div>
                <div>Upload your PDF: <code>BITSAT-1-SOL.pdf</code></div>
              </div>
              <div className="ht-step">
                <div className="ht-num">4</div>
                <div>Commit & push → appears here instantly ✅</div>
              </div>
            </div>
            <div className="ht-example">
              <div className="ht-ex-title">Example folder structure:</div>
              <pre className="ht-code">{`public/solutions/
  BITSAT SERIES 1/
    BITSAT-1-SOL.pdf
    BITSAT-2-SOL.pdf
  BITSAT SERIES 2/
    BITSAT-1-SOL.pdf
  BITSAT SERIES 3 (PYQ)/
    BITSAT-PYQ-1-SOL.pdf`}</pre>
            </div>
          </div>
        )}
      </div>
    </>
  )
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
.wrap{max-width:900px;margin:0 auto;padding:28px 18px 80px}
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.anim{animation:up .3s ease both}
.page-top{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px}
.page-top h2{font-size:1.5rem;font-weight:700;color:#1a237e}
.page-top p{font-size:.82rem;color:#666;margin-top:4px}
.top-right{display:flex;align-items:center;gap:8px}
.total-badge{background:#e8eaf6;color:#1a237e;border:1px solid #c5cae9;padding:4px 12px;border-radius:20px;font-size:.72rem;font-weight:700;font-family:'Roboto Mono',monospace}
.search-row{margin-bottom:24px}
.search-inp{width:100%;max-width:420px;background:white;border:1.5px solid #ccc;border-radius:6px;padding:9px 14px;color:#212121;font-family:'Roboto',sans-serif;font-size:.84rem;outline:none;transition:border-color .2s;display:block}
.search-inp:focus{border-color:#1a237e}
.search-inp::placeholder{color:#aaa}

/* Loading */
.loading-state{display:flex;align-items:center;gap:12px;padding:40px 0;color:#888;font-size:.86rem}
.spinner{width:20px;height:20px;border:2.5px solid #e0e0e0;border-top-color:#1a237e;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* Empty state */
.empty-state{text-align:center;padding:60px 20px}
.empty-icon{font-size:3rem;margin-bottom:14px}
.empty-state h3{font-size:1.1rem;font-weight:700;color:#555;margin-bottom:6px}
.empty-state p{font-size:.82rem;color:#888;margin-bottom:16px}
.empty-state code{background:#f0f0f0;padding:2px 6px;border-radius:4px;font-family:'Roboto Mono',monospace;font-size:.78rem}
.btn-admin{display:inline-block;background:#1a237e;color:white;padding:9px 20px;border-radius:6px;font-weight:700;font-size:.82rem;text-decoration:none}

/* Folder */
.folder-section{margin-bottom:20px}
.folder-hdr{display:flex;align-items:center;justify-content:space-between;background:white;border:1px solid #e0e0e0;border-radius:10px;padding:13px 16px;cursor:pointer;transition:all .15s;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.folder-hdr:hover{border-color:#1a237e;box-shadow:0 2px 10px rgba(26,35,126,.1)}
.folder-hdr-left{display:flex;align-items:center;gap:10px}
.folder-icon{font-size:1.2rem}
.folder-name{font-weight:700;font-size:.95rem;color:#212121}
.folder-count{font-size:.62rem;font-weight:700;padding:2px 9px;border-radius:20px;font-family:'Roboto Mono',monospace}
.folder-chevron{font-size:.9rem;font-weight:700}

/* Files */
.files-list{display:flex;flex-direction:column;gap:8px;padding-left:8px}
.file-card{background:white;border:1px solid #e0e0e0;border-radius:8px;display:flex;align-items:center;gap:12px;padding:12px 14px;transition:all .18s;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.file-card:hover{transform:translateY(-2px);box-shadow:0 4px 14px rgba(0,0,0,.1);border-color:var(--accent)}
.file-icon-wrap{width:44px;height:44px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.file-pdf-icon{font-size:1.5rem}
.file-info{flex:1;min-width:0}
.file-name{font-weight:600;font-size:.9rem;color:#212121;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.meta-tag{font-size:.62rem;background:#f0f0f0;color:#666;padding:1px 7px;border-radius:10px;font-family:'Roboto Mono',monospace}
.meta-dot{color:#ccc;font-size:.7rem}
.meta-size{font-size:.68rem;color:#999;font-family:'Roboto Mono',monospace}
.meta-type{font-size:.62rem;background:#ffebee;color:#c62828;padding:1px 7px;border-radius:10px;font-weight:700;font-family:'Roboto Mono',monospace}
.view-btn{display:inline-flex;align-items:center;gap:5px;color:white;padding:7px 14px;border-radius:6px;font-family:'Roboto',sans-serif;font-weight:700;font-size:.76rem;text-decoration:none;flex-shrink:0;transition:opacity .15s}
.view-btn:hover{opacity:.88}
.dl-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 13px;border-radius:6px;font-family:'Roboto',sans-serif;font-weight:600;font-size:.76rem;text-decoration:none;border:1.5px solid;flex-shrink:0;transition:all .15s}
.dl-btn:hover{opacity:.8}

/* How to card */
.how-to-card{background:white;border:1px solid #e0e0e0;border-radius:12px;padding:24px;margin-top:20px}
.ht-title{font-weight:700;font-size:.95rem;color:#1a237e;margin-bottom:16px}
.ht-steps{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
.ht-step{display:flex;align-items:center;gap:12px;font-size:.84rem;color:#555}
.ht-num{width:24px;height:24px;border-radius:50%;background:#1a237e;color:white;font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ht-step code{background:#f5f5f5;padding:1px 7px;border-radius:4px;font-family:'Roboto Mono',monospace;font-size:.76rem}
.ht-ex-title{font-size:.75rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
.ht-code{background:#f5f5f5;border-radius:8px;padding:14px;font-family:'Roboto Mono',monospace;font-size:.74rem;color:#1b5e20;line-height:1.8;overflow-x:auto}

@media(max-width:600px){
  .file-card{flex-wrap:wrap}
  .view-btn,.dl-btn{flex:1;justify-content:center}
  .hdr{padding:0 12px}
}
`
