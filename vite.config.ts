import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { writeFileSync, mkdirSync, cpSync, existsSync } from 'fs'
import { config } from 'dotenv'

// Load .env file
config()

// Simple plugin to copy static assets after build
function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const dist = resolve(__dirname, 'dist')
      // Copy manifest.json
      cpSync(resolve(__dirname, 'manifest.json'), resolve(dist, 'manifest.json'))
      // Copy icons
      const iconsSrc = resolve(__dirname, 'public', 'icons')
      const iconsDest = resolve(dist, 'icons')
      if (existsSync(iconsSrc)) {
        cpSync(iconsSrc, iconsDest, { recursive: true })
      }
      // Also copy src/assets icons
      const assetsSrc = resolve(__dirname, 'src', 'assets')
      if (existsSync(assetsSrc)) {
        mkdirSync(iconsDest, { recursive: true })
        cpSync(assetsSrc, iconsDest, { recursive: true })
      }
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    copyStaticAssets(),
  ],
  define: {
    __GEMINI_API_KEY__: JSON.stringify(process.env.VITE_GEMINI_API_KEY || ''),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        onboarding: resolve(__dirname, 'src/onboarding/index.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js'
          if (chunkInfo.name === 'content') return 'content.js'
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      }
    },
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    }
  }
})
