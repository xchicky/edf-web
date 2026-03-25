import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-demo-edf',
      configureServer(server) {
        // Dev-only middleware: serve demo.edf for easier development testing
        // TODO: Remove this plugin before production deployment
        server.middlewares.use('/edf/demo.edf', (req, res) => {
          // Resolve to the demo.edf file in the parent project's edf directory
          const demoPath = path.resolve(__dirname, '../../edf-web/edf/demo.edf')
          if (fs.existsSync(demoPath)) {
            const stat = fs.statSync(demoPath)
            res.setHeader('Content-Type', 'application/octet-stream')
            res.setHeader('Content-Length', stat.size)
            fs.createReadStream(demoPath).pipe(res)
          } else {
            res.statusCode = 404
            res.end('demo.edf not found')
          }
        })
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    fs: {
      // Allow serving files from parent directories
      strict: false,
    },
  },
})
