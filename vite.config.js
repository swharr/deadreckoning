import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

function getGitInfo() {
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim()
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
    return { sha, branch }
  } catch {
    return { sha: 'unknown', branch: 'unknown' }
  }
}

const { sha, branch } = getGitInfo()
const buildTime = new Date().toISOString()
const appInsightsConnStr = process.env.APPINSIGHTS_CONNECTION_STRING || ''

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  define: {
    __BUILD_SHA__: JSON.stringify(sha),
    __BUILD_BRANCH__: JSON.stringify(branch),
    __BUILD_TIME__: JSON.stringify(buildTime),
    __APPINSIGHTS_CONNECTION_STRING__: JSON.stringify(appInsightsConnStr),
  },
})
