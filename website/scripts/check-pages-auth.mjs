import { pathToFileURL } from 'node:url'

export async function checkPagesAuth({ accountId, token, fetcher = fetch }) {
  if (!/^[a-f0-9]{32}$/i.test(accountId || '') || !token?.trim()) {
    throw new Error('Cloudflare deployment credentials are missing or malformed.')
  }
  let response
  let payload
  try {
    response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/goagent`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(15000)
    })
    payload = await response.json()
  } catch {
    // Never surface raw network errors or API bodies which can contain account information.
    throw new Error('Cloudflare Pages authorization check could not be completed.')
  }
  if (!response.ok || payload.success !== true || payload.result?.name !== 'goagent') {
    throw new Error(`Cloudflare Pages authorization failed (HTTP ${response.status}). Check the existing project-scoped deployment token.`)
  }
  return true
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await checkPagesAuth({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN })
    console.log('Cloudflare Pages authorization verified for goagent.')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
