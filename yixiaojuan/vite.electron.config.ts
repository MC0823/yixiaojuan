import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  ssr: {
    noExternal: true,
    external: ['electron', 'better-sqlite3', 'sql.js', 'sharp']
  },
  build: {
    outDir: 'dist-electron/main',
    ssr: true,
    rollupOptions: {
      input: resolve(__dirname, 'electron/main/index.ts'),
      output: {
        format: 'cjs',
        entryFileNames: 'index.js'
      }
    },
    minify: false,
    emptyOutDir: true
  }
})
