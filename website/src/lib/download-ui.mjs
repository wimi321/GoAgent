import { fetchCatalogWithRetry, formatSize, safeGithubReleaseUrl, selectAssets } from './download-catalog.mjs'

function fillEntry(hub, entry, catalog) {
  const actions = [...entry.querySelectorAll('[data-action]')]
  const usable = selectAssets(catalog, entry.dataset)
  actions.forEach(action => { action.hidden = true; action.removeAttribute('href'); action.setAttribute('aria-disabled', 'true') })
  const unavailable = entry.querySelector('[data-unavailable]')
  if (unavailable) unavailable.hidden = usable.length > 0
  const size = entry.querySelector('[data-size]')
  if (size) size.textContent = formatSize(usable.reduce((sum, item) => sum + item.asset.sizeBytes, 0))
  usable.forEach((item, index) => {
    const action = actions[index]
    if (!action) return
    action.href = item.url
    action.hidden = false
    action.removeAttribute('aria-disabled')
    action.textContent = entry.dataset.multipart === 'true'
      ? (index === 0 ? hub.dataset.volumeOneLabel : hub.dataset.volumeTwoLabel)
      : (action.dataset.label || hub.dataset.downloadLabel)
    const title = entry.querySelector('h3')?.childNodes[0]?.textContent?.trim() || entry.getAttribute('aria-label') || ''
    action.setAttribute('aria-label', `${action.textContent} ${title}`.trim())
  })
}

function setupPlatforms(hub) {
  const tablist = hub.querySelector('[data-platform-tabs]')
  const tabs = [...hub.querySelectorAll('[data-platform-tab]')]
  const panels = [...hub.querySelectorAll('[data-platform-panel]')]
  if (!tablist) return
  function select(tab) {
    tabs.forEach(item => { item.setAttribute('aria-selected', String(item === tab)); item.tabIndex = item === tab ? 0 : -1 })
    panels.forEach(panel => { panel.hidden = panel.dataset.platformPanel !== tab.dataset.platformTab })
    hub.querySelectorAll('[data-platform-only]').forEach(item => { item.hidden = item.dataset.platformOnly !== tab.dataset.platformTab })
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab))
    tab.addEventListener('keydown', event => {
      const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key]
      if (next === undefined) return
      event.preventDefault()
      select(tabs[next]); tabs[next].focus()
    })
  })
  select(tabs[0])
  tablist.hidden = false
}

export function initDownloads(root) {
  root.querySelectorAll('[data-download-hub]').forEach(hub => {
    if (hub.dataset.initialized) return
    hub.dataset.initialized = 'true'
    setupPlatforms(hub)
    let busy = false
    async function loadCatalog() {
      if (busy) return
      busy = true
      const error = hub.querySelector('[data-download-error]')
      const status = hub.querySelector('[data-release-status]')
      const retry = hub.querySelector('[data-download-retry]')
      hub.setAttribute('aria-busy', 'true')
      if (retry) retry.disabled = true
      if (error) error.hidden = true
      if (status) status.textContent = hub.dataset.loadingLabel
      try {
        const catalog = await fetchCatalogWithRetry(hub.dataset.catalogUrl)
        hub.querySelectorAll('[data-entry]').forEach(entry => fillEntry(hub, entry, catalog))
        const releaseUrl = safeGithubReleaseUrl(catalog.releaseUrl)
        if (releaseUrl) hub.querySelectorAll('[data-amd-release-link], [data-linux-release-link]').forEach(link => { link.href = releaseUrl })
        if (status) status.textContent = `${hub.dataset.releaseLabel} · ${catalog.releaseTag}`
      } catch {
        if (status) status.textContent = hub.dataset.errorLabel
        if (error) error.hidden = false
      } finally {
        busy = false
        if (retry) retry.disabled = false
        hub.setAttribute('aria-busy', 'false')
      }
    }
    hub.querySelector('[data-download-retry]')?.addEventListener('click', loadCatalog)
    loadCatalog()
  })
}
