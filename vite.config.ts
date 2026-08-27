import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { writeFileSync, mkdirSync, cpSync, existsSync } from 'fs'


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
      // The supplied logo is copied explicitly below; stale source icons must not overwrite it.
      const logoSrc = resolve(__dirname, 'src', 'assets', 'TerraCart Logo.png')
      const logoDest = resolve(dist, 'assets', 'terracart-logo.png')
      if (existsSync(logoSrc)) {
        mkdirSync(resolve(dist, 'assets'), { recursive: true })
        cpSync(logoSrc, logoDest)
      }
    }
  }
}

// Simple plugin to wrap the content script in an IIFE so that
// repeated injection into the same isolated world does not throw
// "Identifier 'X' has already been declared".
function wrapContentScript() {
  return {
    name: 'wrap-content-script',
    generateBundle(options, bundle) {
      for (const chunk of Object.values(bundle)) {
        const chunkAny = chunk as any
        if (chunkAny.name === 'content' && chunkAny.type === 'chunk') {
          chunkAny.code = `(function(){\n${chunkAny.code}\n})()`
        }
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  base: './',
  plugins: [
    react(),
    copyStaticAssets(),
    wrapContentScript(),
  ],
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
  }
})

