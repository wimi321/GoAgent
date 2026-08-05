export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.hostname.toLowerCase() === 'www.goagent.top') {
      url.protocol = 'https:'
      url.hostname = 'goagent.top'
      return Response.redirect(url.toString(), 301)
    }
    return env.ASSETS.fetch(request)
  },
}
