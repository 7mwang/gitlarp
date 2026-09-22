import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, ArrowSquareOut, CalendarBlank, Camera,
  ChartBar, Check, Code, GitBranch, GitCommit, GithubLogo,
  DownloadSimple, Image as ImageIcon, Lightning, MagnifyingGlass,
  Plus, ShareNetwork, SpinnerGap, UserCircle, X
} from '@phosphor-icons/react'
import { downloadShareCard, drawShareCard } from './shareCard.js'

const STORAGE_REPO = 'gitlarp-repo'
const STORAGE_ENTRIES = 'gitlarp-entries'
const CACHE_PREFIX = 'gitlarp-repo-cache:'
const DEMO_REPO = 'demo'

const readStorage = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

const dateKey = (date) => new Date(date).toLocaleDateString('en-CA')
const dayBefore = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return dateKey(date)
}

const demoDays = [
  { ago: 0, title: 'Rebuilt the project dashboard', messages: ['Build dashboard layout and stats', 'Add recent activity feed', 'Tighten mobile navigation'], additions: 428, deletions: 93, repo: 'gitlarp / web' },
  { ago: 2, title: 'Connected the repository form', messages: ['Add repository connection flow', 'Handle API loading and errors'], additions: 216, deletions: 42, repo: 'gitlarp / web' },
  { ago: 4, title: 'Mapped commit history', messages: ['Create contribution graph', 'Group commits by day', 'Add weekly totals'], additions: 312, deletions: 67, repo: 'gitlarp / web' },
  { ago: 7, title: 'Set the type and layout', messages: ['Set up Vite and React', 'Create design tokens'], additions: 185, deletions: 19, repo: 'gitlarp / web' },
  { ago: 11, title: 'Opened the project', messages: ['Initial commit', 'Write first product notes'], additions: 74, deletions: 0, repo: 'gitlarp / web' }
].map((item, index) => ({
  ...item, date: dayBefore(item.ago), id: `demo-${index}`,
  commits: item.messages.map((message, n) => ({ sha: `demo-${index}-${n}`, message, url: '#', author: ['You', 'Maya', 'Sam'][n % 3], avatar: null }))
}))

function parseRepo(value) {
  const cleaned = value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git\/?$/, '').replace(/\/$/, '')
  const match = cleaned.match(/^([\w.-]+)\/([\w.-]+)$/)
  return match ? `${match[1]}/${match[2]}` : null
}

async function githubJson(url, signal, token) {
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
  if (!response.ok) {
    if (response.status === 404) throw new Error('Repository not found. Check the name and make sure it is public.')
    if (response.status === 401) throw new Error('GitHub rejected that token. Check it and try again.')
    if (response.status === 403 || response.status === 429) {
      const exhausted = response.headers.get('x-ratelimit-remaining') === '0'
      const reset = Number(response.headers.get('x-ratelimit-reset'))
      const resetText = Number.isFinite(reset) && reset > 0
        ? ` The limit resets at ${new Date(reset * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
        : ''
      const error = new Error(exhausted
        ? `GitHub's ${token ? 'authenticated' : 'public'} API limit is exhausted.${resetText} ${token ? 'Try again after the reset or use another token.' : 'Add a valid token in Connect a repository to load now.'}`
        : `GitHub blocked the request (${response.status}). Check the repository and token, then try again.`)
      error.rateLimited = exhausted
      throw error
    }
    throw new Error(`GitHub could not load this repository (${response.status}).`)
  }
  return response.json()
}

async function loadRepo(repo, signal, token) {
  const base = `https://api.github.com/repos/${repo}`
  const commits = await githubJson(`${base}/commits?per_page=18`, signal, token)
  const listed = commits.map((commit) => ({
      sha: commit.sha,
      date: commit.commit.author?.date || commit.commit.committer?.date,
      message: commit.commit.message.split('\n')[0],
      url: commit.html_url,
      author: commit.author?.login || commit.commit.author?.name || 'Contributor',
      avatar: commit.author?.avatar_url || commit.committer?.avatar_url || null,
      additions: null,
      deletions: null
    }))
  const detailed = token ? await Promise.all(listed.map(async (commit) => {
    const detail = await githubJson(`${base}/commits/${commit.sha}`, signal, token)
    return { ...commit, additions: detail.stats?.additions ?? null, deletions: detail.stats?.deletions ?? null }
  })) : listed
  const groups = new Map()
  detailed.forEach((commit) => {
    const date = dateKey(commit.date)
    if (!groups.has(date)) groups.set(date, { id: date, date, commits: [], additions: token ? 0 : null, deletions: token ? 0 : null, repo })
    const group = groups.get(date)
    group.commits.push(commit)
    if (group.additions !== null && commit.additions !== null) group.additions += commit.additions
    else group.additions = null
    if (group.deletions !== null && commit.deletions !== null) group.deletions += commit.deletions
    else group.deletions = null
  })
  return { days: [...groups.values()].sort((a, b) => b.date.localeCompare(a.date)) }
}

function formattedDate(date, options = { month: 'long', day: 'numeric' }) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', options)
}

function getTitle(day) {
  return day.title || day.commits[0]?.message || 'Untitled work day'
}

function contributorsForDay(day) {
  return [...new Map(day.commits.map(commit => [commit.author, { name: commit.author, avatar: commit.avatar }])).values()]
}

function keepCachedLineCounts(days, cached) {
  if (!cached?.days) return days
  const known = new Map(cached.days.flatMap(day => day.commits.map(commit => [commit.sha, commit])))
  return days.map(day => {
    const commits = day.commits.map(commit => {
      const previous = known.get(commit.sha)
      return commit.additions === null && previous?.additions != null && previous?.deletions != null
        ? { ...commit, additions: previous.additions, deletions: previous.deletions }
        : commit
    })
    const complete = commits.every(commit => commit.additions != null && commit.deletions != null)
    return {
      ...day,
      commits,
      additions: complete ? commits.reduce((sum, commit) => sum + commit.additions, 0) : null,
      deletions: complete ? commits.reduce((sum, commit) => sum + commit.deletions, 0) : null
    }
  })
}

function ProfileAvatar({ name, src, className = '' }) {
  const [failed, setFailed] = useState(false)
  return src && !failed
    ? <img className={`profile-avatar ${className}`} src={src} alt={name} title={name} onError={() => setFailed(true)} />
    : <span className={`profile-avatar avatar-fallback ${className}`} title={name} aria-label={name}><UserCircle size="75%" weight="fill" /></span>
}

function Heatmap({ days }) {
  const scrollRef = useRef(null)
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth }, [days])
  const values = new Map(days.map(day => [day.date, day.commits.length]))
  const cells = Array.from({ length: 84 }, (_, index) => {
    const d = new Date()
    d.setDate(d.getDate() - (83 - index))
    const key = dateKey(d)
    return { key, count: values.get(key) || 0 }
  })
  const total = cells.reduce((sum, cell) => sum + cell.count, 0)
  return <section className="activity-panel" aria-labelledby="activity-heading">
    <div className="section-top activity-top">
      <div><h2 id="activity-heading">Activity</h2><p>Commits by day, across the last 12 weeks.</p></div>
      <div className="activity-total"><span className="pulse-dot" /> {total} commits <span>in the last 12 weeks</span></div>
    </div>
    <div className="heatmap-scroll" ref={scrollRef}><div className="heatmap-wrap">
      <div className="week-labels"><span>Mon</span><span>Wed</span><span>Fri</span></div>
      <div className="heatmap" role="img" aria-label={`${total} commits shown across the last 12 weeks`}>
        {cells.map(cell => <span key={cell.key} className={`heat-cell level-${Math.min(cell.count, 4)}`} title={`${formattedDate(cell.key)}: ${cell.count} commit${cell.count === 1 ? '' : 's'}`} />)}
      </div>
    </div></div>
    <div className="heatmap-footer"><span>12 weeks ago</span><span>Today</span><span className="legend">Less <i className="level-0" /><i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /> More</span></div>
  </section>
}

function ShareCardDialog({ day, entry, onClose }) {
  const canvasRef = useRef(null)
  const closeRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    closeRef.current?.focus()
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    drawShareCard(canvasRef.current, day, entry).then(() => {
      if (active) setReady(true)
    }).catch((cause) => { if (active) setError(cause.message) })
    return () => { active = false; window.removeEventListener('keydown', onKeyDown) }
  }, [day, entry, onClose])

  const download = async () => {
    try { await downloadShareCard(canvasRef.current, day.date) }
    catch (cause) { setError(cause.message) }
  }

  return <div className="modal-backdrop share-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <button ref={closeRef} className="dialog-close" aria-label="Close share card" onClick={onClose}><X size={20} /></button>
      <div className="share-dialog-heading"><div><h2 id="share-title">Share this day</h2><p>Preview your card, then save the image.</p></div></div>
      <div className="share-preview"><canvas ref={canvasRef} role="img" aria-label={`Share card for ${getTitle(day)}`} />{!ready && !error && <span className="share-loading"><SpinnerGap className="spinner" size={22} /> Generating card…</span>}</div>
      {error && <p className="share-error" role="alert">{error}</p>}
      <button className="primary-button share-download" disabled={!ready} onClick={download}><DownloadSimple size={18} weight="bold" /> Download PNG</button>
      <p className="share-hint">1080 × 1350 PNG · {entry?.image ? 'Uses your photo.' : 'Background photo changes daily.'}</p>
    </div>
  </div>
}

function EntryCard({ day, entry, onSave, onShare, onLoadLines, lineLoading, lineError, isDemo }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry?.note || '')
  const fileRef = useRef(null)
  const image = entry?.image
  const contributors = contributorsForDay(day)
  const owner = day.repo.split('/')[0].trim()
  const ownerAvatar = isDemo ? null : `https://avatars.githubusercontent.com/${encodeURIComponent(owner)}?size=80`
  const save = () => { onSave({ ...entry, note: draft.trim() }); setEditing(false) }
  const upload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Choose an image file.'); return }
    if (file.size > 2 * 1024 * 1024) { alert('Choose an image smaller than 2 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => onSave({ ...entry, image: reader.result })
    reader.readAsDataURL(file)
    event.target.value = ''
  }
  return <article className="entry-card">
    <div className="entry-side"><div className="date-badge"><strong>{formattedDate(day.date, { day: 'numeric' })}</strong><span>{formattedDate(day.date, { month: 'short' })}</span></div><span className="timeline-node" /></div>
    <div className="entry-body">
      <div className="entry-head"><div><div className="entry-meta"><ProfileAvatar name={owner} src={ownerAvatar} className="entry-repo-avatar" /><span>{formattedDate(day.date, { weekday: 'long' })}</span><span className="meta-separator">/</span><span>{day.repo}</span></div><h3>{getTitle(day)}</h3></div><span className="commit-pill"><GitCommit size={15} weight="bold" /> {day.commits.length} commit{day.commits.length === 1 ? '' : 's'}</span></div>
      <div className="change-row">{day.additions === null || day.deletions === null
        ? <button className="load-lines" onClick={onLoadLines} disabled={lineLoading}>{lineLoading ? <SpinnerGap className="spinner" size={15} /> : <Code size={15} />} {lineLoading ? 'Loading line counts…' : `Load line counts · ${day.commits.filter(commit => commit.additions == null || commit.deletions == null).length} request${day.commits.filter(commit => commit.additions == null || commit.deletions == null).length === 1 ? '' : 's'}`}</button>
        : <><span className="added">+{day.additions.toLocaleString()} lines</span><span className="removed">−{day.deletions.toLocaleString()} lines</span><span className="change-divider" /><span>{(day.additions + day.deletions).toLocaleString()} changed</span></>}</div>
      {lineError && <p className="line-error" role="alert">{lineError}</p>}
      <div className="commit-list">{day.commits.slice(0, 3).map(commit => isDemo
        ? <span key={commit.sha}><span className="commit-mark" />{commit.message}</span>
        : <a key={commit.sha} href={commit.url} target="_blank" rel="noreferrer"><span className="commit-mark" />{commit.message}<ArrowSquareOut size={13} /></a>)}</div>
      <div className="contributors-row"><div className="contributor-avatars">{contributors.slice(0, 4).map(contributor => <ProfileAvatar key={contributor.name} name={contributor.name} src={contributor.avatar} />)}</div><span>{contributors.length === 1 ? contributors[0].name : `${contributors.slice(0, 3).map(person => person.name).join(', ')}${contributors.length > 3 ? ` +${contributors.length - 3}` : ''}`}</span><small>{contributors.length === 1 ? 'contributor' : 'contributors'}</small></div>
      {image && <div className="entry-image"><img src={image} alt={`Photo attached to ${formattedDate(day.date)}`} /><button aria-label="Remove image" title="Remove image" onClick={() => onSave({ ...entry, image: null })}><X size={16} /></button></div>}
      {editing ? <div className="note-editor"><label htmlFor={`note-${day.id}`}>Your note</label><textarea id={`note-${day.id}`} rows="3" maxLength="500" value={draft} onChange={e => setDraft(e.target.value)} placeholder="What changed that the commits don't say?" /><div className="editor-actions"><span>{draft.length}/500</span><button className="text-button" onClick={() => { setDraft(entry?.note || ''); setEditing(false) }}>Cancel</button><button className="small-primary" onClick={save}><Check size={16} /> Save note</button></div></div> : entry?.note && <div className="saved-note"><span>NOTE</span><p>{entry.note}</p></div>}
      <div className="card-actions"><button onClick={() => { setDraft(entry?.note || ''); setEditing(true) }}><Plus size={16} weight="bold" /> {entry?.note ? 'Edit note' : 'Add note'}</button><button onClick={() => fileRef.current?.click()}><Camera size={17} /> {image ? 'Change photo' : 'Add photo'}</button><button className="share-action" onClick={onShare}><ShareNetwork size={16} /> Make share card</button><input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} /></div>
    </div>
  </article>
}

export default function App() {
  const [repo, setRepo] = useState(() => readStorage(STORAGE_REPO, DEMO_REPO))
  const [repoInput, setRepoInput] = useState('')
  const [days, setDays] = useState(demoDays)
  const [info, setInfo] = useState(null)
  const [entries, setEntries] = useState(() => readStorage(STORAGE_ENTRIES, {}))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [connectError, setConnectError] = useState('')
  const [showConnect, setShowConnect] = useState(false)
  const [shareDay, setShareDay] = useState(null)
  const [filter, setFilter] = useState('all')
  const [token, setToken] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [lineLoading, setLineLoading] = useState({})
  const [lineErrors, setLineErrors] = useState({})
  const currentRepoRef = useRef(repo)
  currentRepoRef.current = repo
  const isDemo = repo === DEMO_REPO

  useEffect(() => {
    if (repo === DEMO_REPO) { setDays(demoDays); setInfo(null); setLoading(false); return }
    const controller = new AbortController()
    setLoading(true); setError(''); setNotice('')
    loadRepo(repo, controller.signal, token).then(result => {
      const daysWithCache = keepCachedLineCounts(result.days, readStorage(`${CACHE_PREFIX}${repo}`, null))
      setDays(daysWithCache)
      setInfo({ name: repo.split('/')[1] })
      try { localStorage.setItem(`${CACHE_PREFIX}${repo}`, JSON.stringify({ days: daysWithCache, savedAt: Date.now() })) } catch { /* Cache is optional. */ }
    }).catch(err => {
      if (err.name === 'AbortError') return
      const cached = readStorage(`${CACHE_PREFIX}${repo}`, null)
      if (cached?.days?.length) {
        setDays(cached.days)
        setInfo({ name: repo.split('/')[1] })
        setNotice(`${err.rateLimited ? "GitHub's API limit is exhausted." : 'GitHub could not refresh this repository.'} Showing saved activity from ${new Date(cached.savedAt).toLocaleString()}. ${token ? 'Try again later or use another token.' : 'Add a token to refresh.'}`)
      } else {
        setError(err.message)
        setDays([])
        setInfo(null)
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [repo, token, refreshKey])

  useEffect(() => {
    if (showConnect) { setRepoInput(isDemo ? '' : repo); setTokenInput(token); setConnectError('') }
  }, [showConnect])

  const totalCommits = days.reduce((sum, day) => sum + day.commits.length, 0)
  const measuredDays = days.filter(day => day.additions !== null && day.deletions !== null)
  const totalLines = measuredDays.length ? measuredDays.reduce((sum, day) => sum + day.additions + day.deletions, 0) : null
  const activeDays = days.length
  const visibleDays = filter === 'notes' ? days.filter(day => entries[`${repo}:${day.date}`]?.note || entries[`${repo}:${day.date}`]?.image) : days
  const displayName = isDemo ? 'The work adds up.' : info?.name || repo.split('/')[1]
  const subtitle = isDemo ? 'A sample log of commits, changes, and days spent building.' : `Recent activity from ${repo}. Grouped by work day.`
  const saveEntry = (date, value) => {
    const next = { ...entries, [`${repo}:${date}`]: value }
    try { localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(next)); setEntries(next) }
    catch { alert('Your browser storage is full. Try a smaller image. Your latest change was not saved.') }
  }
  const loadDayLines = async (day) => {
    if (lineLoading[day.date]) return
    const requestRepo = repo
    const enriched = day.commits.map(commit => ({ ...commit }))
    const saveProgress = () => {
      const complete = enriched.every(commit => commit.additions !== null && commit.deletions !== null)
      const updatedDay = {
        ...day,
        commits: enriched.map(commit => ({ ...commit })),
        additions: complete ? enriched.reduce((sum, commit) => sum + commit.additions, 0) : null,
        deletions: complete ? enriched.reduce((sum, commit) => sum + commit.deletions, 0) : null
      }
      setDays(current => {
        if (!current.some(item => item.repo === requestRepo)) return current
        const updated = current.map(item => item.date === day.date ? updatedDay : item)
        try { localStorage.setItem(`${CACHE_PREFIX}${requestRepo}`, JSON.stringify({ days: updated, savedAt: Date.now() })) } catch { /* Cache is optional. */ }
        return updated
      })
    }
    setLineLoading(current => ({ ...current, [day.date]: true }))
    setLineErrors(current => ({ ...current, [day.date]: '' }))
    try {
      for (let index = 0; index < enriched.length; index++) {
        if (enriched[index].additions !== null && enriched[index].deletions !== null) continue
        const detail = await githubJson(`https://api.github.com/repos/${requestRepo}/commits/${enriched[index].sha}`, undefined, token)
        if (detail.stats?.additions == null || detail.stats?.deletions == null) throw new Error('GitHub did not return line counts for this commit.')
        enriched[index].additions = detail.stats?.additions ?? null
        enriched[index].deletions = detail.stats?.deletions ?? null
      }
      saveProgress()
    } catch (cause) {
      saveProgress()
      if (currentRepoRef.current === requestRepo) setLineErrors(current => ({ ...current, [day.date]: cause.message }))
    } finally {
      if (currentRepoRef.current === requestRepo) setLineLoading(current => ({ ...current, [day.date]: false }))
    }
  }
  const connect = (event) => {
    event.preventDefault()
    const parsed = parseRepo(repoInput)
    if (!parsed) { setConnectError('Enter a repository as owner/repo or paste its GitHub URL.'); return }
    localStorage.setItem(STORAGE_REPO, JSON.stringify(parsed))
    setToken(tokenInput.trim()); setRepo(parsed); setRefreshKey(value => value + 1); setLineLoading({}); setLineErrors({}); setShowConnect(false); setRepoInput(''); setFilter('all'); setError(''); setNotice(''); setConnectError('')
  }
  const resetDemo = () => { localStorage.setItem(STORAGE_REPO, JSON.stringify(DEMO_REPO)); setRepo(DEMO_REPO); setShowConnect(false); setError(''); setNotice('') }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-symbol"><GitBranch size={23} weight="bold" /></div><span>gitlarp<span className="brand-period">.</span></span></div>
      <nav aria-label="Main navigation"><a className="nav-item active" href="#overview"><ChartBar size={20} weight="fill" /> Overview</a><a className="nav-item" href="#activity-heading"><CalendarBlank size={20} /> Activity</a><a className="nav-item" href="#journal"><Code size={20} /> Work log</a></nav>
      <div className="sidebar-bottom"><div className="side-caption">REPOSITORY</div><div className="tracked-repo"><div className="repo-icon"><GithubLogo size={21} weight="fill" /></div><div><strong>{isDemo ? 'Sample workspace' : repo}</strong><span>{isDemo ? 'Preview mode' : 'Public repository'}</span></div><span className="repo-status" /></div><button className="switch-repo" onClick={() => setShowConnect(true)}><Plus size={15} /> Connect a repository</button><div className="sidebar-foot">GitHub commits, by work day.</div></div>
    </aside>

    <main id="overview" className="main-content">
      <header className="topbar"><div className="mobile-brand"><GitBranch size={21} weight="bold" /> gitlarp<span>.</span></div><div className="breadcrumb">Workspace <span>/</span> Overview</div><div className="topbar-right"><span className="live-indicator"><span /> {isDemo ? 'DEMO VIEW' : 'LIVE FROM GITHUB'}</span><button className="avatar" aria-label="Connect a repository" onClick={() => setShowConnect(true)}>{isDemo ? 'GL' : repo.slice(0, 2).toUpperCase()}</button></div></header>
      <div className="content-wrap">
        {isDemo && <div className="demo-banner"><Lightning size={18} weight="fill" /><span>Sample activity. Add a public repository to see your own work.</span></div>}
        {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setShowConnect(true)}>{token ? 'Change token or retry' : 'Add token or retry'}</button></div>}
        {notice && <div className="demo-banner" role="status"><span>{notice}</span><button onClick={() => setShowConnect(true)}>{token ? 'Change token' : 'Add token'} <ArrowRight size={15} /></button></div>}
        <section className="welcome"><div><div className="welcome-date">WORK LOG <span>/</span> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div><h1>{displayName}</h1><p>{subtitle}</p></div><button className="primary-button" onClick={() => setShowConnect(true)}><GithubLogo size={18} weight="fill" /> {isDemo ? 'Add a repository' : 'Switch repository'} <ArrowRight size={16} /></button></section>
        <section className="stats-grid" aria-label="Progress summary"><div className="stat-card"><span>COMMITS</span><strong>{loading || error ? '—' : totalCommits.toLocaleString()}</strong><small>Latest activity</small></div><div className="stat-card"><span>LINES CHANGED</span><strong>{loading || error || totalLines === null ? '—' : totalLines.toLocaleString()}</strong><small>{measuredDays.length === days.length && days.length ? 'Additions + deletions' : measuredDays.length ? `${measuredDays.length} of ${days.length} days measured` : 'Load counts in the log'}</small></div><div className="stat-card"><span>ACTIVE DAYS</span><strong>{loading || error ? '—' : activeDays}</strong><small>In this {isDemo ? 'sample' : 'commit window'}</small></div></section>
        <Heatmap days={days} />
        <section id="journal" className="journal"><div className="section-top journal-top"><div><h2>Work log</h2><p>Open a day to add context or make a card.</p></div><div className="filter-tabs" role="group" aria-label="Filter work log"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All days</button><button className={filter === 'notes' ? 'selected' : ''} onClick={() => setFilter('notes')}>With notes</button></div></div>
          {loading ? <div className="state-message"><SpinnerGap className="spinner" size={28} /><h3>Loading your work</h3><p>Fetching recent commits from GitHub.</p></div>
          : visibleDays.length ? <div className="entry-list">{visibleDays.map(day => <EntryCard key={day.id} day={day} entry={entries[`${repo}:${day.date}`]} onSave={value => saveEntry(day.date, value)} onShare={() => setShareDay(day)} onLoadLines={() => loadDayLines(day)} lineLoading={!!lineLoading[day.date]} lineError={lineErrors[day.date]} isDemo={isDemo} />)}</div>
          : <div className="state-message"><ImageIcon size={30} /><h3>{error ? 'Activity could not load' : filter === 'notes' ? 'No field notes yet' : 'No recent commits found'}</h3><p>{error ? 'Try again after the limit resets or connect with a valid token.' : filter === 'notes' ? 'Add a note or photo to a work day to see it here.' : 'Try a repository with recent activity.'}</p>{error ? <button className="small-primary" onClick={() => setShowConnect(true)}>{token ? 'Change token or retry' : 'Add token or retry'}</button> : filter === 'notes' && <button className="small-primary" onClick={() => setFilter('all')}>See all activity</button>}</div>}
        </section>
        <footer>GitLarp · GitHub activity by work day. {isDemo && <button onClick={resetDemo}>Reset demo</button>}</footer>
      </div>
    </main>
    {showConnect && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowConnect(false) }}>
      <div className="connect-dialog" role="dialog" aria-modal="true" aria-labelledby="connect-title">
        <button className="dialog-close" aria-label="Close" onClick={() => setShowConnect(false)}><X size={20} /></button>
        <div className="dialog-icon"><GithubLogo size={27} weight="fill" /></div>
        <h2 id="connect-title">Connect a repository</h2>
        <p>Load the latest 18 commits from a public GitHub repository.</p>
        <form onSubmit={connect}>
          <label htmlFor="repo-input">Repository URL or owner/repo</label>
          <div className="input-wrap"><MagnifyingGlass size={19} /><input id="repo-input" autoFocus value={repoInput} onChange={e => { setRepoInput(e.target.value); setConnectError('') }} placeholder="e.g. facebook/react" aria-invalid={!!connectError} aria-describedby={connectError ? 'connect-error' : undefined} /></div>
          {connectError && <p className="form-error" id="connect-error" role="alert">{connectError}</p>}
          <label className="token-label" htmlFor="token-input">GitHub token <span>optional</span></label>
          <input className="token-input" id="token-input" type="password" autoComplete="off" value={tokenInput} onChange={event => setTokenInput(event.target.value)} placeholder="Paste a token to avoid the public API limit" />
          <p className="token-help">Without a token, GitLarp lists commits in one request. Load line counts on any work card, or add a token to fetch all counts upfront. The token stays only in this open page. <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Create a token on GitHub <ArrowSquareOut size={11} /></a></p>
          <button className="primary-button" type="submit">Load activity <ArrowRight size={17} /></button>
        </form>
        <div className="dialog-foot">Public repositories only · Notes and photos stay in this browser</div>
        {!isDemo && <button className="demo-link" onClick={resetDemo}>Return to sample workspace</button>}
      </div>
    </div>}
    {shareDay && <ShareCardDialog day={shareDay} entry={entries[`${repo}:${shareDay.date}`]} onClose={() => setShareDay(null)} />}
  </div>
}
