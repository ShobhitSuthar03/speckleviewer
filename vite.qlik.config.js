import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist-qlik',
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        // Create smaller chunks for better loading
        manualChunks: {
          'speckle-core': ['@speckle/viewer'],
        },
        // Optimize for Qlik's requirements
        format: 'iife',
        name: 'SpeckleViewer'
      }
    },
    // Aggressive optimization for Qlik
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info']
      },
      mangle: {
        toplevel: true
      }
    },
    // Enable tree shaking
    treeshake: true,
    // Target modern browsers (Qlik typically runs on modern browsers)
    target: 'es2020'
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['@speckle/viewer']
  }
})
