import serverRoom from './assets/card-backgrounds/server-room.jpg'
import circuitBoard from './assets/card-backgrounds/circuit-board.jpg'
import radioTelescopes from './assets/card-backgrounds/radio-telescopes.jpg'
import computerMemory from './assets/card-backgrounds/computer-memory.jpg'
import { getDailyImage, markDailyImageUnavailable } from './dailyImage.js'

const WIDTH = 1080
const HEIGHT = 1350
const DAILY_BACKGROUNDS = [serverRoom, circuitBoard, radioTelescopes, computerMemory]

function dailyBackground() {
  const now = new Date()
  const localDay = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000)
  return DAILY_BACKGROUNDS[localDay % DAILY_BACKGROUNDS.length]
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.trim().split(/\s+/).filter(Boolean).flatMap((word) => {
    if (ctx.measureText(word).width <= maxWidth) return [word]
    const pieces = []
    let piece = ''
    for (const character of word) {
      if (piece && ctx.measureText(piece + character).width > maxWidth) {
        pieces.push(piece)
        piece = character
      } else {
        piece += character
      }
    }
    if (piece) pieces.push(piece)
    return pieces
  })
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  if (lines.length > maxLines) {
    const visible = lines.slice(0, maxLines)
    let last = visible[maxLines - 1]
    while (last.length && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
    visible[maxLines - 1] = `${last.trimEnd()}…`
    return visible
  }
  return lines
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timeout = setTimeout(() => reject(new Error('Image loading timed out.')), 4000)
    image.onload = () => { clearTimeout(timeout); resolve(image) }
    image.onerror = () => { clearTimeout(timeout); reject(new Error('Image could not be loaded.')) }
    if (/^https?:/i.test(src)) image.crossOrigin = 'anonymous'
    image.src = src
  })
}

function drawCover(ctx, image, x, y, width, height) {
  const ratio = Math.max(width / image.width, height / image.height)
  const scaledWidth = image.width * ratio
  const scaledHeight = image.height * ratio
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, width, height)
  ctx.clip()
  ctx.drawImage(image, x - (scaledWidth - width) / 2, y - (scaledHeight - height) / 2, scaledWidth, scaledHeight)
  ctx.restore()
}

function drawAvatar(ctx, image, name, x, y, size) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = '#d9ded1'
  ctx.fillRect(x, y, size, size)
  if (image) drawCover(ctx, image, x, y, size, size)
  else {
    ctx.fillStyle = '#405b47'
    ctx.beginPath()
    ctx.arc(x + size * .5, y + size * .38, size * .13, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(x + size * .5, y + size * .82, size * .29, size * .22, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function label(ctx, text, x, y, accent) {
  ctx.fillStyle = accent
  ctx.font = '800 23px "DM Sans Variable", sans-serif'
  ctx.fillText(text, x, y)
}

function drawActivityChart(ctx, day, historyDays, accent) {
  const selected = new Set(day.selectedDates || [day.date])
  const first = new Date(`${selected.size > 1 ? day.startDate : day.date}T12:00:00`)
  if (selected.size === 1) first.setDate(first.getDate() - 6)
  const end = new Date(`${day.date}T12:00:00`)
  const counts = new Map(historyDays.map(item => [item.date, item.commits.length]))
  const daily = []
  for (const date = new Date(first); date <= end; date.setDate(date.getDate() + 1)) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    daily.push({ date: new Date(date), count: counts.get(key) || 0, selected: selected.has(key) })
  }
  const buckets = Math.min(daily.length, 28)
  const series = Array.from({ length: buckets }, (_, index) => {
    const slice = daily.slice(Math.floor(index * daily.length / buckets), Math.floor((index + 1) * daily.length / buckets))
    return { date: slice[0].date, count: slice.reduce((sum, item) => sum + item.count, 0), selected: slice.some(item => item.selected) }
  })
  label(ctx, daily.length > 28 ? 'COMMITS OVER TIME' : 'COMMITS BY DAY', 76, 1022, accent)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#526456'
  ctx.font = '700 20px "DM Sans Variable", sans-serif'
  ctx.fillText(selected.size > 1 ? `${selected.size} SELECTED DAYS IN COLOR` : 'SELECTED DAY IN COLOR', 1004, 1025)
  ctx.textAlign = 'left'
  const max = Math.max(1, ...series.map(item => item.count))
  const slot = 928 / series.length
  const width = Math.min(82, Math.max(8, slot * .64))
  ctx.fillStyle = '#b9c7b8'
  ctx.fillRect(76, 1127, 928, 2)
  series.forEach((item, index) => {
    const x = 76 + slot * index + (slot - width) / 2
    const height = item.count ? Math.max(10, Math.round(item.count / max * 66)) : 4
    ctx.fillStyle = item.selected ? accent : '#8fa995'
    ctx.fillRect(x, 1127 - height, width, height)
    if (series.length <= 10) {
      ctx.textAlign = 'center'
      ctx.fillStyle = item.selected ? '#28372d' : '#657266'
      ctx.font = '800 20px "DM Sans Variable", sans-serif'
      if (item.count) ctx.fillText(String(item.count), x + width / 2, 1127 - height - 25)
      ctx.font = '700 18px "DM Sans Variable", sans-serif'
      ctx.fillText(item.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), x + width / 2, 1135)
    }
  })
  if (series.length > 10) {
    ctx.fillStyle = '#657266'
    ctx.font = '700 19px "DM Sans Variable", sans-serif'
    ctx.fillText(first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(), 76, 1135)
    ctx.textAlign = 'right'
    ctx.fillText(end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(), 1004, 1135)
  }
  ctx.textAlign = 'left'
}

export async function drawShareCard(canvas, day, entry, { historyDays = [day], accent = '#a34b32' } = {}) {
  await document.fonts.ready
  const contributors = [...new Map(day.commits.map(commit => [commit.author, { name: commit.author, avatar: commit.avatar }])).values()].slice(0, 4)
  const owner = day.repo.split('/')[0].trim()
  const ownerUrl = day.repo.includes(' / ') ? null : `https://avatars.githubusercontent.com/${encodeURIComponent(owner)}?size=128`
  const background = entry?.image
    ? loadImage(entry.image).then(image => ({ image, photo: null }))
    : getDailyImage().then(async photo => {
      if (photo) {
        try { return { image: await loadImage(photo.url), photo } }
        catch { markDailyImageUnavailable() }
      }
      return { image: await loadImage(dailyBackground()), photo: null }
    })
  const [{ image, photo }, ownerImage, ...contributorImages] = await Promise.all([
    background,
    ownerUrl ? loadImage(ownerUrl).catch(() => null) : Promise.resolve(null),
    ...contributors.map(person => person.avatar ? loadImage(person.avatar).catch(() => null) : Promise.resolve(null))
  ])
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser could not create the card image.')

  ctx.fillStyle = '#f4f2ec'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  drawCover(ctx, image, 0, 0, WIDTH, 570)
  const shade = ctx.createLinearGradient(0, 0, 0, 570)
  shade.addColorStop(0, 'rgba(12, 22, 18, .62)')
  shade.addColorStop(.4, 'rgba(12, 22, 18, .32)')
  shade.addColorStop(1, 'rgba(12, 22, 18, .88)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, WIDTH, 570)

  ctx.textBaseline = 'top'
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 38px "Manrope Variable", sans-serif'
  ctx.fillText('gitlarp.', 76, 58)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#f4f3ea'
  ctx.font = `${day.startDate && day.startDate !== day.date ? '700 21px' : '700 24px'} "DM Sans Variable", sans-serif`
  const endLabel = new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  const startLabel = day.startDate && day.startDate !== day.date
    ? new Date(`${day.startDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
    : null
  const dateLabel = startLabel ? `${startLabel} – ${endLabel}` : endLabel
  ctx.fillText(dateLabel, WIDTH - 76, 71)
  ctx.textAlign = 'left'

  drawAvatar(ctx, ownerImage, owner, 76, 140, 62)
  ctx.font = '700 31px "DM Sans Variable", sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(wrapText(ctx, day.repo, 730, 1)[0], 155, 154)
  ctx.fillStyle = '#f4a479'
  ctx.font = '800 20px "DM Sans Variable", sans-serif'
  ctx.fillText('WORK LOG', 76, 230)

  const title = day.title || day.commits[0]?.message || 'Untitled work day'
  ctx.font = '800 86px "Manrope Variable", sans-serif'
  ctx.fillStyle = '#ffffff'
  const titleLines = wrapText(ctx, title, 924, 3)
  titleLines.forEach((line, index) => ctx.fillText(line, 72, 266 + index * 93))

  label(ctx, 'CONTRIBUTORS', 76, 587, accent)
  contributors.forEach((person, index) => drawAvatar(ctx, contributorImages[index], person.name, 76 + index * 69, 625, 62))
  ctx.fillStyle = '#344138'
  ctx.font = '700 30px "DM Sans Variable", sans-serif'
  ctx.fillText(wrapText(ctx, contributors.map(person => person.name).join(', ') || 'Contributor', 650, 1)[0], 91 + contributors.length * 69, 640)

  ctx.fillStyle = '#c9cec2'
  ctx.fillRect(76, 701, 928, 2)
  ctx.fillRect(539, 714, 2, 282)
  ctx.fillRect(76, 856, 928, 2)

  const note = entry?.note?.trim()
  const changed = day.additions === null || day.deletions === null ? null : day.additions + day.deletions
  const stats = [
    { label: 'COMMITS', value: day.commits.length.toLocaleString(), detail: 'checked in', color: '#202b26' },
    { label: 'LINES CHANGED', value: changed === null ? '—' : changed.toLocaleString(), detail: changed === null ? 'load counts in the log' : 'added + removed', color: accent },
    { label: 'ADDITIONS', value: day.additions === null ? '—' : `+${day.additions.toLocaleString()}`, detail: 'lines added', color: '#365a42' },
    { label: 'DELETIONS', value: day.deletions === null ? '—' : `−${day.deletions.toLocaleString()}`, detail: 'lines removed', color: '#202b26' }
  ]
  stats.forEach((stat, index) => {
    const x = index % 2 ? 574 : 76
    const y = index < 2 ? 716 : 870
    label(ctx, stat.label, x, y, accent)
    ctx.fillStyle = stat.color
    let size = index < 2 ? 90 : 74
    ctx.font = `800 ${size}px "Manrope Variable", sans-serif`
    while (ctx.measureText(stat.value).width > 423 && size > 50) {
      size -= 2
      ctx.font = `800 ${size}px "Manrope Variable", sans-serif`
    }
    ctx.fillText(stat.value, x - 4, y + 31)
    ctx.fillStyle = '#5a695e'
    ctx.font = '600 23px "DM Sans Variable", sans-serif'
    ctx.fillText(stat.detail, x, y + 113)
  })

  ctx.fillStyle = '#e8eee5'
  ctx.fillRect(0, 1009, WIDTH, 153)
  drawActivityChart(ctx, day, historyDays, accent)
  ctx.fillStyle = '#c9cec2'
  ctx.fillRect(76, 1163, 928, 2)
  label(ctx, note ? 'YOUR NOTE' : 'RECENT COMMITS', 76, 1177, accent)
  ctx.fillStyle = '#344138'
  ctx.font = '600 29px "DM Sans Variable", sans-serif'
  if (note) {
    wrapText(ctx, note, 928, 2).forEach((line, index) => ctx.fillText(line, 76, 1213 + index * 37))
  } else {
    const recent = day.commits.slice(0, 2)
    recent.forEach((commit, index) => {
      const y = 1214 + index * 38
      ctx.fillStyle = accent
      ctx.fillRect(76, y + 10, 7, 7)
      ctx.fillStyle = '#344138'
      ctx.fillText(wrapText(ctx, commit.message || 'Untitled commit', 902, 1)[0], 94, y)
    })
    if (day.commits.length > 2) {
      ctx.textAlign = 'right'
      ctx.fillStyle = '#657266'
      ctx.font = '700 20px "DM Sans Variable", sans-serif'
      ctx.fillText(`+${day.commits.length - 2} MORE`, 1004, 1180)
      ctx.textAlign = 'left'
    }
  }

  ctx.fillStyle = '#c9cec2'
  ctx.fillRect(76, 1294, 928, 2)
  ctx.fillStyle = '#526156'
  ctx.font = '700 20px "DM Sans Variable", sans-serif'
  const dayCount = day.selectedDates?.length || 1
  ctx.fillText(photo ? `PHOTO: WIKIMEDIA COMMONS · ${photo.license.toUpperCase()}` : `GITHUB ACTIVITY / ${dayCount === 1 ? 'ONE WORK DAY' : `${dayCount} WORK DAYS`}`, 76, 1305)
  ctx.textAlign = 'right'
  ctx.fillStyle = accent
  ctx.font = '800 22px "Manrope Variable", sans-serif'
  ctx.fillText('GITLARP', WIDTH - 76, 1302)
  return { photo, source: entry?.image ? 'upload' : photo ? 'commons' : 'bundled' }
}

export function downloadShareCard(canvas, date, title) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('The card could not be exported.')); return }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const slug = title?.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
      link.download = `gitlarp-${slug || date}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      resolve()
    }, 'image/png')
  })
}
