const allowedHosts = new Set(['download.goagent.top', 'github.com'])
export const catalogFetchAttempts = 3

export function safeDownloadUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || url.username || url.password || url.port) return null
    const validPath = url.hostname === 'github.com'
      ? url.pathname.startsWith('/wimi321/lizzieyzy-next/releases/download/')
      : url.pathname.startsWith('/releases/')
    return validPath ? url.href : null
  } catch { return null }
}

export function safeGithubReleaseUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password && !url.port && /^\/wimi321\/lizzieyzy-next\/releases\/tag\/[^/]+$/.test(url.pathname) ? url.href : null
  } catch { return null }
}

export function validateCatalog(catalog) {
  if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.assets) || typeof catalog.releaseTag !== 'string' || !catalog.releaseTag.trim()) throw new Error('Invalid catalog')
  return catalog
}

export async function fetchCatalogWithRetry(url, { fetcher = fetch, timeoutMs = 8000, retryDelayMs = 450 } = {}) {
  let lastError
  for (let attempt = 1; attempt <= catalogFetchAttempts; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(url, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return validateCatalog(await response.json())
    } catch (error) {
      lastError = error
    } finally { clearTimeout(timer) }
    if (attempt < catalogFetchAttempts) await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt))
  }
  throw lastError
}

export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function selectAssets(catalog, { category, flavor = '', arch = '', multipart = 'false' }) {
  let assets = catalog.assets.filter(asset => asset && asset.category === category && (!flavor || asset.flavor === flavor) && (!arch || asset.arch === arch))
  if (multipart === 'true') {
    assets = assets.filter(asset => typeof asset.name === 'string' && /\.7z\.(001|002)$/.test(asset.name)).sort((a, b) => a.name.localeCompare(b.name))
    // Both distinct volumes are necessary; two copies of part 1 are not a complete archive.
    if (assets.length !== 2 || !assets[0].name.endsWith('.001') || assets[1].name !== assets[0].name.slice(0, -3) + '002') return []
  } else { assets = assets.slice(0, 1) }
  const usable = assets.map(asset => ({ asset, url: safeDownloadUrl(asset.downloadUrl) }))
    .filter(item => item.url && Number.isSafeInteger(item.asset.sizeBytes) && item.asset.sizeBytes > 0)
  const requiredAssets = multipart === 'true' ? 2 : 1
  return usable.length !== requiredAssets ? [] : usable
}
