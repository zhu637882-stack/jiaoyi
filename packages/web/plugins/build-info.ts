import type { Plugin } from 'vite'
import { execSync } from 'child_process'

export function buildInfoPlugin(): Plugin {
  return {
    name: 'build-info',
    transformIndexHtml(html) {
      const buildTime = new Date().toISOString()
      const gitHash = (() => {
        try {
          return execSync('git rev-parse --short HEAD').toString().trim()
        } catch {
          return 'unknown'
        }
      })()
      
      const buildInfo = `
    <meta name="build-time" content="${buildTime}" />
    <meta name="git-hash" content="${gitHash}" />
    <script>
      window.__BUILD_INFO__ = {
        time: '${buildTime}',
        gitHash: '${gitHash}',
        version: '${process.env.npm_package_version || '1.0.0'}'
      }
    </script>`
      
      return html.replace(
        '<meta http-equiv="Expires" content="0" />',
        `<meta http-equiv="Expires" content="0" />${buildInfo}`
      )
    }
  }
}
