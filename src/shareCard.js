import serverRoom from './assets/card-backgrounds/server-room.jpg'
import circuitBoard from './assets/card-backgrounds/circuit-board.jpg'
import radioTelescopes from './assets/card-backgrounds/radio-telescopes.jpg'
import computerMemory from './assets/card-backgrounds/computer-memory.jpg'

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

function label(ctx, text, x, y) {
  ctx.fillStyle = '#a34b32'
  ctx.font = '800 20px "DM Sans Variable", sans-serif'
  ctx.fillText(text, x, y)
}

export async function drawShareCard(canvas, day, entry) {
  await document.fonts.ready
  const contributors = [...new Map(day.commits.map(commit => [commit.author, { name: commit.author, avatar: commit.avatar }])).values()].slice(0, 4)
  const owner = day.repo.split('/')[0].trim()
  const ownerUrl = day.repo.includes(' / ') ? null : `https://avatars.githubusercontent.com/${encodeURIComponent(owner)}?size=128`
  const [image, ownerImage, ...contributorImages] = await Promise.all([
    loadImage(entry?.image || dailyBackground()),
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
  ctx.font = '800 34px "Manrope Variable", sans-serif'
  ctx.fillText('gitlarp.', 76, 58)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#f4f3ea'
  ctx.font = '700 24px "DM Sans Variable", sans-serif'
  const dateLabel = new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  ctx.fillText(dateLabel, WIDTH - 76, 71)
  ctx.textAlign = 'left'

  drawAvatar(ctx, ownerImage, owner, 76, 143, 54)
  ctx.font = '700 27px "DM Sans Variable", sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(wrapText(ctx, day.repo, 730, 1)[0], 148, 154)
  ctx.fillStyle = '#f4a479'
  ctx.font = '800 20px "DM Sans Variable", sans-serif'
  ctx.fillText('WORK LOG', 76, 230)

  const title = day.title || day.commits[0]?.message || 'Untitled work day'
  ctx.font = '800 76px "Manrope Variable", sans-serif'
  ctx.fillStyle = '#ffffff'
  const titleLines = wrapText(ctx, title, 924, 3)
  titleLines.forEach((line, index) => ctx.fillText(line, 72, 268 + index * 86))

  label(ctx, 'CONTRIBUTORS', 76, 605)
  contributors.forEach((person, index) => drawAvatar(ctx, contributorImages[index], person.name, 76 + index * 60, 642, 54))
  ctx.fillStyle = '#344138'
  ctx.font = '700 26px "DM Sans Variable", sans-serif'
  ctx.fillText(wrapText(ctx, contributors.map(person => person.name).join(', ') || 'Contributor', 650, 1)[0], 88 + contributors.length * 60, 655)

  ctx.fillStyle = '#c9cec2'
  ctx.fillRect(76, 719, 928, 2)
  ctx.fillRect(539, 744, 2, 351)
  ctx.fillRect(76, 917, 928, 2)

  const note = entry?.note?.trim()
  const changed = day.additions === null || day.deletions === null ? null : day.additions + day.deletions
  const stats = [
    { label: 'COMMITS', value: day.commits.length.toLocaleString(), detail: 'checked in' },
    { label: 'LINES CHANGED', value: changed === null ? '—' : changed.toLocaleString(), detail: changed === null ? 'counts available in the log' : 'added + removed' },
    { label: 'ADDITIONS', value: day.additions === null ? '—' : `+${day.additions.toLocaleString()}`, detail: 'lines added' },
    { label: 'DELETIONS', value: day.deletions === null ? '—' : `−${day.deletions.toLocaleString()}`, detail: 'lines removed' }
  ]
  stats.forEach((stat, index) => {
    const x = index % 2 ? 574 : 76
    const y = index < 2 ? 747 : 944
    label(ctx, stat.label, x, y)
    ctx.fillStyle = index === 1 ? '#a34b32' : '#1e2b24'
    let size = 82
    ctx.font = `800 ${size}px "Manrope Variable", sans-serif`
    while (ctx.measureText(stat.value).width > 423 && size > 48) {
      size -= 2
      ctx.font = `800 ${size}px "Manrope Variable", sans-serif`
    }
    ctx.fillText(stat.value, x - 4, y + 37)
    ctx.fillStyle = '#5a695e'
    ctx.font = '600 22px "DM Sans Variable", sans-serif'
    ctx.fillText(stat.detail, x, y + 126)
  })

  ctx.fillStyle = '#c9cec2'
  ctx.fillRect(76, 1118, 928, 2)
  label(ctx, note ? 'YOUR NOTE' : 'COMMIT LOG', 76, 1148)
  ctx.fillStyle = '#344138'
  ctx.font = '500 28px "DM Sans Variable", sans-serif'
  const logText = note || day.commits.map(commit => commit.message).join('  ·  ')
  wrapText(ctx, logText, 928, 2).forEach((line, index) => ctx.fillText(line, 76, 1183 + index * 38))

  ctx.fillStyle = '#c9cec2'
  ctx.fillRect(76, 1288, 928, 2)
  ctx.fillStyle = '#526156'
  ctx.font = '700 20px "DM Sans Variable", sans-serif'
  ctx.fillText('GITHUB ACTIVITY / ONE WORK DAY', 76, 1305)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#a34b32'
  ctx.font = '800 22px "Manrope Variable", sans-serif'
  ctx.fillText('GITLARP', WIDTH - 76, 1302)
}

export function downloadShareCard(canvas, date) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('The card could not be exported.')); return }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `gitlarp-${date}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      resolve()
    }, 'image/png')
  })
}
