import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

// Plugin to fix electron module references
function electronFix(): Plugin {
  return {
    name: 'electron-fix',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const fileName in bundle) {
        const chunk = bundle[fileName]
        if (chunk.type === 'chunk' && fileName === 'index.js') {
          // Replace electron namespace with destructured imports
          chunk.code = chunk.code
            .replace(
              'const electron = require("electron");',
              'const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell, screen, session, desktopCapturer } = require("electron");'
            )
            .replace(/electron\.app/g, 'app')
            .replace(/electron\.BrowserWindow/g, 'BrowserWindow')
            .replace(/electron\.ipcMain/g, 'ipcMain')
            .replace(/electron\.Tray/g, 'Tray')
            .replace(/electron\.Menu/g, 'Menu')
            .replace(/electron\.nativeImage/g, 'nativeImage')
            .replace(/electron\.dialog/g, 'dialog')
            .replace(/electron\.shell/g, 'shell')
            .replace(/electron\.screen/g, 'screen')
            .replace(/electron\.session/g, 'session')
            .replace(/electron\.desktopCapturer/g, 'desktopCapturer')
        }
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process entry
        entry: 'electron/main/index.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          plugins: [electronFix()],
          build: {
            outDir: 'dist-electron/main',
            minify: false,
            lib: {
              entry: 'electron/main/index.ts',
              formats: ['cjs'],
              fileName: () => 'index.js'
            },
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'sql.js', 'sharp', 'path', 'fs', 'crypto'],
              output: {
                format: 'cjs',
                inlineDynamicImports: true
              }
            }
          }
        }
      },
      {
        // Preload scripts entry
        entry: 'electron/preload/index.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron'),
      'electron': 'electron'
    }
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        modifyVars: {
          // Ant Design 主题定制 - 绿白配色
          '@primary-color': '#87bd76',
          '@success-color': '#4d7c3e',
          '@warning-color': '#faad14',
          '@error-color': '#f5222d',
          '@font-size-base': '14px',
          '@border-radius-base': '8px',
          '@text-color-secondary': '#666666',
          '@text-color': '#000000'
        }
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  }
})
