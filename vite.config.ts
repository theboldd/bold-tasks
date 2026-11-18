import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

const BUILD_ID = String(Date.now())

/** Gera /version.json para as abas abertas perceberem que há versão nova. */
const versionFile = (): Plugin => ({
  name: 'bold-version',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) }) },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
})
