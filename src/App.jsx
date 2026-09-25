import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, ArrowSquareOut, CalendarBlank, Camera,
  ChartBar, Check, Code, GitBranch, GitCommit, GithubLogo,
  DownloadSimple, Image as ImageIcon, Lightning, MagnifyingGlass,
  Plus, ShareNetwork, SpinnerGap, UserCircle, X
} from '@phosphor-icons/react'
import { downloadShareCard, drawShareCard } from './shareCard.js'
import { buildCardData } from './cardData.js'

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

async function githubJson(url, signal, token, includeLink = false) {
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
    if (response.status === 401) throw new Error('GitHub rejected your token. Check it and try again.')
    if (response.status === 403 || response.status === 429) {
      const exhausted = response.headers.get('x-ratelimit-remaining') === '0'
      const reset = Number(response.headers.get('x-ratelimit-reset'))
      const resetText = Number.isFinite(reset) && reset > 0
        ? ` The limit resets at ${new Date(reset * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
        : ''
      const error = new Error(exhausted
        ? `GitHub's ${token ? 'authenticated' : 'public'} API limit is exhausted.${resetText} ${token ? 'Try again after the reset or use another token.' : 'Add your own token in Connect a repository to load now.'}`
        : `GitHub blocked the request (${response.status}). Check the repository and token, then try again.`)
      error.rateLimited = exhausted
      throw error
    }
    throw new Error(`GitHub could not load this repository (${response.status}).`)
  }
  const data = await response.json()
  return includeLink ? { data, next: response.headers.get('link')?.match(/<([^>]+)>; rel="next"/)?.[1] || null } : data
}

function groupCommits(commits, repo) {
  const groups = new Map()
  commits.forEach((commit) => {
    const date = dateKey(commit.date)
    if (!groups.has(date)) groups.set(date, { id: date, date, commits: [], additions: 0, deletions: 0, repo })
    const group = groups.get(date)
    group.commits.push(commit)
    if (group.additions !== null && commit.additions !== null) group.additions += commit.additions
    else group.additions = null
    if (group.deletions !== null && commit.deletions !== null) group.deletions += commit.deletions
    else group.deletions = null
  })
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date))
}

async function loadRepoPage(repo, signal, token, next) {
  const since = new Date(`${dayBefore(83)}T00:00:00`).toISOString()
  const url = next || `https://api.github.com/repos/${repo}/commits?per_page=100&since=${encodeURIComponent(since)}`
  if (next && new URL(next).origin !== 'https://api.github.com') throw new Error('GitHub returned an invalid history page.')
  const result = await githubJson(url, signal, token, true)
  const listed = result.data.map((commit) => ({
      sha: commit.sha,
      date: commit.commit.author?.date || commit.commit.committer?.date,
      message: commit.commit.message.split('\n')[0],
      url: commit.html_url,
      author: commit.author?.login || commit.commit.author?.name || 'Contributor',
      avatar: commit.author?.avatar_url || commit.committer?.avatar_url || null,
      additions: null,
      deletions: null
    })).filter(commit => commit.date && dateKey(commit.date) >= dayBefore(83) && dateKey(commit.date) <= dayBefore(0))
  return { days: groupCommits(listed, repo), next: result.next }
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

function filterDaysByAuthor(days, author) {
  if (author === 'all') return days
  return days.flatMap(day => {
    const commits = day.commits.filter(commit => commit.author === author)
    if (!commits.length) return []
    const complete = commits.every(commit => commit.additions !== null && commit.deletions !== null)
    return [{ ...day, commits, additions: complete ? commits.reduce((sum, commit) => sum + commit.additions, 0) : null, deletions: complete ? commits.reduce((sum, commit) => sum + commit.deletions, 0) : null }]
  })
}

function ProfileAvatar({ name, src, className = '' }) {
  const [failed, setFailed] = useState(false)
  return src && !failed
    ? <img className={`profile-avatar ${className}`} src={src} alt={name} title={name} onError={() => setFailed(true)} />
    : <span className={`profile-avatar avatar-fallback ${className}`} title={name} aria-label={name}><UserCircle size="75%" weight="fill" /></span>
}

function Heatmap({ days, complete, sample, next, onLoadMore, loadingMore, loadError }) {
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
      <div><h2 id="activity-heading">Activity</h2><p>{sample ? 'Sample commits by day.' : complete ? 'Default-branch commits in the last 12 weeks.' : 'Default-branch commits loaded from the last 12 weeks.'}</p></div>
      <div className="activity-total"><span className="pulse-dot" /> {total} commit{total === 1 ? '' : 's'} <span>{sample ? 'in the sample' : complete ? 'in the last 12 weeks' : 'loaded so far'}</span></div>
    </div>
    <div className="heatmap-scroll" ref={scrollRef}><div className="heatmap-wrap">
      <div className="week-labels"><span>Mon</span><span>Wed</span><span>Fri</span></div>
      <div className="heatmap" role="img" aria-label={`${total} default-branch commits ${complete ? 'in' : 'loaded from'} the last 12 weeks`}>
        {cells.map(cell => <span key={cell.key} className={`heat-cell level-${Math.min(cell.count, 4)}`} title={`${formattedDate(cell.key)}: ${cell.count} commit${cell.count === 1 ? '' : 's'}`} />)}
      </div>
    </div></div>
    <div className="heatmap-footer"><span>12 weeks ago</span><span>Today</span><span className="legend">Less <i className="level-0" /><i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /> More</span></div>
    {next && <div className="history-control"><span>Showing {total} commit{total === 1 ? '' : 's'}. Older days may be missing.</span><button type="button" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load up to 100 more'} <ArrowRight size={14} /></button></div>}
    {loadError && <p className="history-error" role="alert">{loadError}</p>}
  </section>
}

const CARD_ACCENTS = [
  { name: 'Rust', color: '#a34b32' },
  { name: 'Pine', color: '#496c53' },
  { name: 'Blue', color: '#426b86' }
]

function ShareCardDialog({ availableDays, entries, repo, initialDates, onClose }) {
  const canvasRef = useRef(null)
  const titleRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [selectedDates, setSelectedDates] = useState(initialDates)
  const [title, setTitle] = useState(() => initialDates.length === 1 ? getTitle(availableDays.find(day => day.date === initialDates[0])) : `${initialDates.length} work days`)
  const [titleEdited, setTitleEdited] = useState(false)
  const [coverMode, setCoverMode] = useState('auto')
  const [customImage, setCustomImage] = useState(null)
  const [accent, setAccent] = useState(CARD_ACCENTS[0].color)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [background, setBackground] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const chosenDays = availableDays.filter(day => selectedDates.includes(day.date))
  const savedPhotoDay = chosenDays.find(day => entries[`${repo}:${day.date}`]?.image)
  const effectiveCover = coverMode === 'auto' ? savedPhotoDay ? 'saved' : 'daily' : coverMode
  const selectedCount = chosenDays.reduce((sum, day) => sum + day.commits.length, 0)

  useEffect(() => {
    titleRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => { if (event.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow }
  }, [])

  useEffect(() => {
    let active = true
    setReady(false); setError(''); setBackground(null)
    if (!chosenDays.length || !title.trim() || (effectiveCover === 'custom' && !customImage)) return () => { active = false }
    const timer = setTimeout(async () => {
      try {
        const card = buildCardData(chosenDays, entries, repo, title)
        const entry = { ...card.entry, image: effectiveCover === 'daily' ? null : effectiveCover === 'custom' ? customImage : card.entry.image }
        const offscreen = document.createElement('canvas')
        const result = await drawShareCard(offscreen, card.day, entry, { historyDays: availableDays, accent })
        if (!active || !canvasRef.current) return
        canvasRef.current.width = offscreen.width
        canvasRef.current.height = offscreen.height
        canvasRef.current.getContext('2d').drawImage(offscreen, 0, 0)
        setBackground(result); setReady(true)
      } catch (cause) { if (active) setError(cause.message) }
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [selectedDates, title, effectiveCover, customImage, accent, availableDays, entries, repo])

  const updateSelection = dates => {
    setSelectedDates(dates)
    if (!titleEdited) setTitle(dates.length === 1 ? getTitle(availableDays.find(day => day.date === dates[0])) : dates.length ? `${dates.length} work days` : '')
  }
  const toggleDay = date => updateSelection(selectedDates.includes(date) ? selectedDates.filter(item => item !== date) : [...selectedDates, date])
  const uploadCover = event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setPhotoError('Choose a JPG, PNG, or WebP image.'); return }
    if (file.size > 2 * 1024 * 1024) { setPhotoError('Choose an image smaller than 2 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => { setCustomImage(reader.result); setCoverMode('custom'); setPhotoError('') }
    reader.onerror = () => setPhotoError('The image could not be read.')
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const download = async () => {
    try { await downloadShareCard(canvasRef.current, chosenDays[0].date, title) }
    catch (cause) { setError(cause.message) }
  }

  return <div className="modal-backdrop share-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="share-dialog card-builder" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <button className="dialog-close" aria-label="Close share card" onClick={onClose}><X size={20} /></button>
      <div className="builder-heading"><span>CARD STUDIO</span><h2 id="share-title">Make a share card</h2><p>Choose work days, name the card, and check the preview before saving.</p></div>
      <div className="builder-layout">
        <div className="builder-controls">
          <section className="builder-section"><div className="builder-section-head"><label htmlFor="card-title">CARD TITLE</label><span>{title.length}/64</span></div><input ref={titleRef} id="card-title" className="builder-title-input" maxLength="64" value={title} onChange={event => { setTitle(event.target.value); setTitleEdited(true) }} placeholder="Name this work" />{!title.trim() && <p className="builder-help">Enter a title to create the card.</p>}</section>
          <section className="builder-section"><div className="builder-section-head"><span>WORK DAYS</span><span>{chosenDays.length} selected · {selectedCount} commit{selectedCount === 1 ? '' : 's'}</span></div><div className="builder-quick"><button type="button" onClick={() => updateSelection(availableDays.slice(0, 7).map(day => day.date))}>Latest 7</button><button type="button" onClick={() => updateSelection(availableDays.map(day => day.date))}>All loaded</button><button type="button" onClick={() => updateSelection([])}>Clear</button></div><div className="builder-day-list" role="group" aria-label="Choose work days">{availableDays.map(day => <label key={day.date} className="builder-day"><input type="checkbox" checked={selectedDates.includes(day.date)} onChange={() => toggleDay(day.date)} /><span>{formattedDate(day.date, { month: 'short', day: 'numeric' })}</span><small>{day.commits.length} commit{day.commits.length === 1 ? '' : 's'}</small></label>)}</div>{!chosenDays.length && <p className="builder-help">Select at least one work day.</p>}</section>
          <section className="builder-section"><div className="builder-section-head"><span>COVER PHOTO</span></div><div className="builder-choice"><label><input type="radio" name="card-cover" checked={coverMode === 'auto'} onChange={() => setCoverMode('auto')} /> Automatic{savedPhotoDay ? ' · saved work-day photo' : ' · daily image'}</label><label><input type="radio" name="card-cover" checked={coverMode === 'daily'} onChange={() => setCoverMode('daily')} /> Daily image</label><label className={!customImage ? 'muted-choice' : ''}><input type="radio" name="card-cover" checked={coverMode === 'custom'} onChange={() => setCoverMode('custom')} disabled={!customImage} /> Uploaded for this card</label></div><label className="builder-upload" htmlFor="card-photo">{customImage ? 'Change uploaded photo' : 'Upload a photo'}<input id="card-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadCover} /></label>{photoError && <p className="builder-help" role="alert">{photoError}</p>}</section>
          <section className="builder-section"><div className="builder-section-head"><span>CHART ACCENT</span></div><div className="builder-colors">{CARD_ACCENTS.map(option => <button key={option.name} type="button" className={accent === option.color ? 'selected' : ''} aria-pressed={accent === option.color} onClick={() => setAccent(option.color)}><i style={{ background: option.color }} />{option.name}</button>)}</div></section>
        </div>
        <div className="builder-output"><div className="share-preview"><canvas ref={canvasRef} role="img" aria-label={`Share card preview: ${title || 'untitled'}`} />{!ready && !error && <span className="share-loading"><SpinnerGap className="spinner" size={22} /> {chosenDays.length && title.trim() ? 'Updating preview…' : 'Choose days and a title'}</span>}</div>{error && <p className="share-error" role="alert">{error}</p>}<button className="primary-button share-download" disabled={!ready} onClick={download}><DownloadSimple size={18} weight="bold" /> Download PNG</button><p className="share-hint">1080 × 1350 PNG · {background?.source === 'upload' ? 'Uses your selected photo.' : background?.photo ? <>Today’s image: <a href={background.photo.sourceUrl} target="_blank" rel="noreferrer">{background.photo.title}</a> · {background.photo.license} via Wikimedia Commons.</> : background ? 'Using a bundled photo. The daily image is unavailable.' : 'Preview updates as you edit.'}</p></div>
      </div>
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
  const [shareStartDates, setShareStartDates] = useState(null)
  const [filter, setFilter] = useState('all')
  const [authorFilter, setAuthorFilter] = useState('all')
  const [nextPage, setNextPage] = useState(null)
  const [historyComplete, setHistoryComplete] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [token, setToken] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [lineLoading, setLineLoading] = useState({})
  const [lineErrors, setLineErrors] = useState({})
  const currentRepoRef = useRef(repo)
  const loadGenerationRef = useRef(0)
  currentRepoRef.current = repo
  const isDemo = repo === DEMO_REPO

  useEffect(() => {
    loadGenerationRef.current += 1
    if (repo === DEMO_REPO) { setDays(demoDays); setInfo(null); setNextPage(null); setHistoryComplete(false); setLoading(false); return }
    const controller = new AbortController()
    setLoading(true); setDays([]); setError(''); setNotice(''); setNextPage(null); setHistoryComplete(false); setLoadingMore(false); setHistoryError(''); setAuthorFilter('all')
    loadRepoPage(repo, controller.signal, token).then(result => {
      const daysWithCache = keepCachedLineCounts(result.days, readStorage(`${CACHE_PREFIX}${repo}`, null))
      setDays(daysWithCache)
      setNextPage(result.next)
      setHistoryComplete(!result.next)
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
    if (showConnect) { setRepoInput(isDemo ? '' : repo); setTokenInput(''); setConnectError('') }
  }, [showConnect])

  const contributors = [...new Set(days.flatMap(day => day.commits.map(commit => commit.author)))].sort((a, b) => a.localeCompare(b))
  const filteredDays = filterDaysByAuthor(days, authorFilter)
  const totalCommits = filteredDays.reduce((sum, day) => sum + day.commits.length, 0)
  const measuredDays = filteredDays.filter(day => day.additions !== null && day.deletions !== null)
  const totalLines = measuredDays.length ? measuredDays.reduce((sum, day) => sum + day.additions + day.deletions, 0) : null
  const activeDays = filteredDays.length
  const visibleDays = filter === 'notes' ? filteredDays.filter(day => entries[`${repo}:${day.date}`]?.note || entries[`${repo}:${day.date}`]?.image) : filteredDays
  const displayName = isDemo ? 'The work adds up.' : info?.name || repo.split('/')[1]
  const subtitle = isDemo ? 'A sample log of commits, changes, and days spent building.' : `Recent activity from ${repo}. Grouped by work day.`
  const saveEntry = (date, value) => {
    const next = { ...entries, [`${repo}:${date}`]: value }
    try { localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(next)); setEntries(next) }
    catch { alert('Your browser storage is full. Try a smaller image. Your latest change was not saved.') }
  }
  const loadMore = async () => {
    if (!nextPage || loadingMore) return
    const requestRepo = repo
    const requestPage = nextPage
    const requestGeneration = loadGenerationRef.current
    setLoadingMore(true); setHistoryError('')
    try {
      const result = await loadRepoPage(requestRepo, undefined, token, requestPage)
      if (currentRepoRef.current !== requestRepo || loadGenerationRef.current !== requestGeneration) return
      const currentCommits = days.flatMap(day => day.commits)
      const merged = [...new Map([...currentCommits, ...result.days.flatMap(day => day.commits)].map(commit => [commit.sha, commit])).values()]
      const updated = keepCachedLineCounts(groupCommits(merged, requestRepo), readStorage(`${CACHE_PREFIX}${requestRepo}`, null))
      setDays(updated)
      setNextPage(result.next)
      setHistoryComplete(!result.next)
      try { localStorage.setItem(`${CACHE_PREFIX}${requestRepo}`, JSON.stringify({ days: updated, savedAt: Date.now() })) } catch { /* Cache is optional. */ }
    } catch (cause) {
      if (currentRepoRef.current === requestRepo && loadGenerationRef.current === requestGeneration) setHistoryError(cause.message)
    } finally {
      if (currentRepoRef.current === requestRepo && loadGenerationRef.current === requestGeneration) setLoadingMore(false)
    }
  }
  const loadDayLines = async (day) => {
    if (lineLoading[day.date]) return
    const requestRepo = repo
    const enriched = day.commits.map(commit => ({ ...commit }))
    const saveProgress = () => {
      setDays(current => {
        if (!current.some(item => item.repo === requestRepo)) return current
        const measured = new Map(enriched.map(commit => [commit.sha, commit]))
        const updated = current.map(item => {
          if (item.date !== day.date) return item
          const commits = item.commits.map(commit => measured.get(commit.sha) || commit)
          const complete = commits.every(commit => commit.additions !== null && commit.deletions !== null)
          return { ...item, commits, additions: complete ? commits.reduce((sum, commit) => sum + commit.additions, 0) : null, deletions: complete ? commits.reduce((sum, commit) => sum + commit.deletions, 0) : null }
        })
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
    setToken(tokenInput.trim() || token); setRepo(parsed); setRefreshKey(value => value + 1); setLineLoading({}); setLineErrors({}); setShowConnect(false); setTokenInput(''); setRepoInput(''); setFilter('all'); setError(''); setNotice(''); setConnectError('')
  }
  const closeConnect = () => { setTokenInput(''); setShowConnect(false) }
  const forgetToken = () => { setToken(''); setTokenInput('') }
  const resetDemo = () => { localStorage.setItem(STORAGE_REPO, JSON.stringify(DEMO_REPO)); setRepo(DEMO_REPO); setToken(''); setTokenInput(''); setShowConnect(false); setError(''); setNotice('') }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-symbol"><GitBranch size={23} weight="bold" /></div><span>gitlarp<span className="brand-period">.</span></span></div>
      <nav aria-label="Main navigation"><a className="nav-item active" href="#overview"><ChartBar size={20} weight="fill" /> Overview</a><a className="nav-item" href="#activity-heading"><CalendarBlank size={20} /> Activity</a><a className="nav-item" href="#journal"><Code size={20} /> Work log</a></nav>
      <div className="sidebar-bottom"><div className="side-caption">REPOSITORY</div><div className="tracked-repo"><div className="repo-icon"><GithubLogo size={21} weight="fill" /></div><div><strong>{isDemo ? 'Sample workspace' : repo}</strong><span>{isDemo ? 'Preview mode' : 'Public repository'}</span></div><span className="repo-status" /></div><button className="switch-repo" onClick={() => setShowConnect(true)}><Plus size={15} /> Connect a repository</button><div className="sidebar-foot">GitHub commits, by work day.</div></div>
    </aside>

    <main id="overview" className="main-content">
      <header className="topbar"><div className="mobile-brand"><GitBranch size={21} weight="bold" /> gitlarp<span>.</span></div><div className="breadcrumb">Workspace <span>/</span> Overview</div><div className="topbar-right"><span className="live-indicator"><span /> {isDemo ? 'DEMO VIEW' : token ? 'YOUR TOKEN · THIS TAB' : 'PUBLIC GITHUB API'}</span><button className="avatar" aria-label="Connect a repository" onClick={() => setShowConnect(true)}>{isDemo ? 'GL' : repo.slice(0, 2).toUpperCase()}</button></div></header>
      <div className="content-wrap">
        {isDemo && <div className="demo-banner"><Lightning size={18} weight="fill" /><span>Sample activity. Add a public repository to see your own work.</span></div>}
        {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setShowConnect(true)}>{token ? 'Change token or retry' : 'Add token or retry'}</button></div>}
        {notice && <div className="demo-banner" role="status"><span>{notice}</span><button onClick={() => setShowConnect(true)}>{token ? 'Change token' : 'Add token'} <ArrowRight size={15} /></button></div>}
        <section className="welcome"><div><div className="welcome-date">WORK LOG <span>/</span> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div><h1>{displayName}</h1><p>{subtitle}</p></div><div className="welcome-actions"><button className="primary-button" disabled={!filteredDays.length || loading} onClick={() => setShareStartDates([filteredDays[0].date])}><ShareNetwork size={17} /> Create card</button><button className="welcome-switch" onClick={() => setShowConnect(true)}><GithubLogo size={17} weight="fill" /> {isDemo ? 'Add a repository' : 'Switch repository'}</button></div></section>
        {!isDemo && <div className="contributor-filter"><label htmlFor="contributor-select">CONTRIBUTOR</label><select id="contributor-select" value={authorFilter} onChange={event => setAuthorFilter(event.target.value)}><option value="all">All contributors</option>{contributors.map(author => <option key={author} value={author}>{author}</option>)}</select><span>{authorFilter === 'all' ? 'Repository activity' : `Showing commits by ${authorFilter}`}</span></div>}
        <section className="stats-grid" aria-label="Progress summary"><div className="stat-card"><span>COMMITS</span><strong>{loading || error ? '—' : totalCommits.toLocaleString()}</strong><small>{isDemo ? 'Sample activity' : historyComplete ? 'Last 12 weeks' : 'Loaded so far'}</small></div><div className="stat-card"><span>LINES CHANGED</span><strong>{loading || error || totalLines === null ? '—' : totalLines.toLocaleString()}</strong><small>{measuredDays.length === filteredDays.length && filteredDays.length ? 'Additions + deletions' : measuredDays.length ? `${measuredDays.length} of ${filteredDays.length} days measured` : 'Load counts in the log'}</small></div><div className="stat-card"><span>ACTIVE DAYS</span><strong>{loading || error ? '—' : activeDays}</strong><small>{isDemo ? 'In this sample' : historyComplete ? 'In the last 12 weeks' : 'In loaded commits'}</small></div></section>
        <Heatmap days={filteredDays} complete={historyComplete} sample={isDemo} next={nextPage} onLoadMore={loadMore} loadingMore={loadingMore} loadError={historyError} />
        <section id="journal" className="journal"><div className="section-top journal-top"><div><h2>Work log</h2><p>Open a day to add context or make a card.</p></div><div className="filter-tabs" role="group" aria-label="Filter work log"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All days</button><button className={filter === 'notes' ? 'selected' : ''} onClick={() => setFilter('notes')}>With notes</button></div></div>
          {loading ? <div className="state-message"><SpinnerGap className="spinner" size={28} /><h3>Loading activity</h3><p>Fetching commits from GitHub.</p></div>
          : visibleDays.length ? <div className="entry-list">{visibleDays.map(day => <EntryCard key={day.id} day={day} entry={entries[`${repo}:${day.date}`]} onSave={value => saveEntry(day.date, value)} onShare={() => setShareStartDates([day.date])} onLoadLines={() => loadDayLines(day)} lineLoading={!!lineLoading[day.date]} lineError={lineErrors[day.date]} isDemo={isDemo} />)}</div>
          : <div className="state-message"><ImageIcon size={30} /><h3>{error ? 'Activity could not load' : filter === 'notes' ? 'No work days with notes' : authorFilter !== 'all' ? 'No commits by this contributor' : 'No commits in this window'}</h3><p>{error ? 'Try again after the limit resets or connect with a valid token.' : filter === 'notes' ? 'Add a note or photo to a work day to see it here.' : authorFilter !== 'all' ? 'Choose another contributor or load more history.' : 'Try a repository with activity in the last 12 weeks.'}</p>{error ? <button className="small-primary" onClick={() => setShowConnect(true)}>{token ? 'Change token or retry' : 'Add token or retry'}</button> : filter === 'notes' ? <button className="small-primary" onClick={() => setFilter('all')}>See all activity</button> : authorFilter !== 'all' && <button className="small-primary" onClick={() => setAuthorFilter('all')}>All contributors</button>}</div>}
        </section>
        <footer>GitLarp · GitHub activity by work day. {isDemo && <button onClick={resetDemo}>Reset demo</button>}</footer>
      </div>
    </main>
    {showConnect && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeConnect() }}>
      <div className="connect-dialog" role="dialog" aria-modal="true" aria-labelledby="connect-title">
        <button className="dialog-close" aria-label="Close" onClick={closeConnect}><X size={20} /></button>
        <div className="dialog-icon"><GithubLogo size={27} weight="fill" /></div>
        <h2 id="connect-title">Connect a repository</h2>
        <p>Load commits from the last 12 weeks of a public GitHub repository.</p>
        <form onSubmit={connect}>
          <label htmlFor="repo-input">Repository URL or owner/repo</label>
          <div className="input-wrap"><MagnifyingGlass size={19} /><input id="repo-input" autoFocus value={repoInput} onChange={e => { setRepoInput(e.target.value); setConnectError('') }} placeholder="e.g. facebook/react" aria-invalid={!!connectError} aria-describedby={connectError ? 'connect-error' : undefined} /></div>
          {connectError && <p className="form-error" id="connect-error" role="alert">{connectError}</p>}
          <label className="token-label" htmlFor="token-input">Your GitHub token <span>optional</span></label>
          {token && <div className="token-status" role="status"><Check size={15} weight="bold" /> Token active for this tab <button type="button" onClick={forgetToken}>Forget token</button></div>}
          <input className="token-input" id="token-input" type="password" autoComplete="off" autoCapitalize="off" spellCheck="false" value={tokenInput} onChange={event => setTokenInput(event.target.value)} placeholder={token ? 'Paste a new token to replace it' : 'Paste a fine-grained token'} />
          <p className="token-help">{token ? 'Leave blank to keep the current token. ' : ''}Choose a fine-grained token for one repository with <strong>Contents: read-only</strong> and a short expiry. A token gives you more API requests; line counts still load when you ask for them. GitLarp sends it directly to GitHub. It stays in this tab's memory and clears on refresh; it is never saved in cookies or localStorage. <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Create your token <ArrowSquareOut size={11} /></a></p>
          <button className="primary-button" type="submit">Load activity <ArrowRight size={17} /></button>
        </form>
        <div className="dialog-foot">Public repositories only · Notes and photos stay in this browser</div>
        {!isDemo && <button className="demo-link" onClick={resetDemo}>Return to sample workspace</button>}
      </div>
    </div>}
    {shareStartDates && <ShareCardDialog availableDays={filteredDays} entries={entries} repo={repo} initialDates={shareStartDates} onClose={() => setShareStartDates(null)} />}
  </div>
}
