const API = 'https://commons.wikimedia.org/w/api.php'
const CATEGORY = 'Category:Featured pictures from NASA'
const CACHE_KEY = 'gitlarp-daily-image:v1'
const IMAGE_HOSTS = new Set(['thumb.wikimedia.org', 'upload.wikimedia.org'])

function localDay() {
  const now = new Date()
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const number = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000)
  return { day, number }
}

function validImageUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && IMAGE_HOSTS.has(url.hostname)
  } catch { return false }
}

function validSourceUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'commons.wikimedia.org' && decodeURIComponent(url.pathname).startsWith('/wiki/File:')
  } catch { return false }
}

function readCache(day) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY))
    if (cached?.day !== day) return null
    if (cached.photo && validImageUrl(cached.photo.url) && validSourceUrl(cached.photo.sourceUrl)
      && typeof cached.photo.title === 'string' && ['Public domain', 'CC0'].some(value => cached.photo.license?.startsWith(value))) return cached.photo
    if (cached.retryAfter > Date.now()) return false
  } catch { /* The daily image cache is optional. */ }
  return null
}

function writeCache(value) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)) } catch { /* The daily image cache is optional. */ }
}

async function commonsJson(params, signal) {
  const url = new URL(API)
  url.search = new URLSearchParams({ action: 'query', format: 'json', origin: '*', ...params })
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Commons returned ${response.status}.`)
  return response.json()
}

export async function getDailyImage() {
  const { day, number } = localDay()
  const cached = readCache(day)
  if (cached !== null) return cached || null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)
  try {
    const listing = await commonsJson({ list: 'categorymembers', cmtitle: CATEGORY, cmtype: 'file', cmlimit: '500' }, controller.signal)
    const titles = (listing.query?.categorymembers || [])
      .map(item => item.title)
      .filter(title => /\.(jpe?g|png|webp)$/i.test(title))
      .sort((a, b) => a.localeCompare(b))
    if (!titles.length) throw new Error('No daily images are available.')

    // A stride spreads adjacent days across the alphabetical category list.
    const start = (number * 37) % titles.length
    const candidates = Array.from({ length: Math.min(20, titles.length) }, (_, index) => titles[(start + index) % titles.length])
    const details = await commonsJson({
      prop: 'imageinfo',
      titles: candidates.join('|'),
      iiprop: 'url|extmetadata|mime|size',
      iiurlwidth: '1600',
      iiextmetadatafilter: 'LicenseShortName|LicenseUrl'
    }, controller.signal)
    const pages = new Map(Object.values(details.query?.pages || {}).map(page => [page.title, page]))
    for (const title of candidates) {
      const info = pages.get(title)?.imageinfo?.[0]
      const license = info?.extmetadata?.LicenseShortName?.value?.trim() || ''
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(info?.mime)) continue
      if (license.toLowerCase() !== 'public domain' && !/^cc0(?:\b|$)/i.test(license)) continue
      const imageUrl = info.thumburl || info.url
      if (!validImageUrl(imageUrl)) continue
      const photo = {
        url: imageUrl,
        sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
        title: title.replace(/^File:/, '').replace(/\.[^.]+$/, '').replaceAll('_', ' '),
        license
      }
      writeCache({ day, photo })
      return photo
    }
    throw new Error('No reusable image was found today.')
  } catch {
    writeCache({ day, photo: null, retryAfter: Date.now() + 30 * 60 * 1000 })
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export function markDailyImageUnavailable() {
  const { day } = localDay()
  writeCache({ day, photo: null, retryAfter: Date.now() + 30 * 60 * 1000 })
}
