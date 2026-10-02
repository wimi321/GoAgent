import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://goagent.top',
  output: 'static',
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
  vite: {
    server: {
      proxy: {
        '/__dev/stable/catalog.json': {
          target: 'https://download.goagent.top',
          changeOrigin: true,
          rewrite: () => '/channels/stable/catalog.json'
        }
      }
    }
  }
})
