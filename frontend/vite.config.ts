import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

function checkPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(400)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('error', () => {
      resolve(false)
    })
    socket.connect(port, host)
  })
}

function getPythonConfig(rootDir: string): { exe: string; args: string[]; cwd: string } | null {
  const backendDir = path.resolve(rootDir, '../backend')
  if (!fs.existsSync(backendDir)) return null

  const isWin = process.platform === 'win32'
  const candidateVenvs = [
    path.join(backendDir, 'venv', isWin ? 'Scripts/python.exe' : 'bin/python'),
    path.join(backendDir, '.venv', isWin ? 'Scripts/python.exe' : 'bin/python'),
  ]

  for (const candidate of candidateVenvs) {
    if (fs.existsSync(candidate)) {
      return {
        exe: candidate,
        args: ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000', '--reload'],
        cwd: backendDir,
      }
    }
  }

  return {
    exe: isWin ? 'python' : 'python3',
    args: ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000', '--reload'],
    cwd: backendDir,
  }
}

function dgymBackendAutoStartPlugin(): Plugin {
  let backendProc: ChildProcess | null = null

  return {
    name: 'dgym-backend-autostart',
    async configureServer(server) {
      const isAlreadyRunning = await checkPortOpen(8000)
      if (isAlreadyRunning) {
        console.log('\x1b[32m[DGym Backend]\x1b[0m ⚡ Backend API is already active on http://127.0.0.1:8000')
        return
      }

      const pyConfig = getPythonConfig(import.meta.dirname)
      if (!pyConfig) {
        console.warn('\x1b[33m[DGym Backend]\x1b[0m ⚠️ Backend directory not found.')
        return
      }

      console.log('\x1b[36m[DGym Backend]\x1b[0m 🚀 Auto-starting FastAPI backend on http://127.0.0.1:8000...')
      try {
        backendProc = spawn(pyConfig.exe, pyConfig.args, {
          cwd: pyConfig.cwd,
          stdio: 'inherit',
          shell: false,
        })

        backendProc.on('error', (err) => {
          console.error('\x1b[31m[DGym Backend]\x1b[0m Failed to spawn backend:', err.message)
        })

        const cleanup = () => {
          if (backendProc && backendProc.pid && !backendProc.killed) {
            try {
              if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', String(backendProc.pid), '/f', '/t'])
              } else {
                backendProc.kill('SIGTERM')
              }
            } catch {
              // ignore
            }
          }
        }

        process.on('exit', cleanup)
        process.on('SIGINT', () => {
          cleanup()
          process.exit()
        })
        process.on('SIGTERM', () => {
          cleanup()
          process.exit()
        })
        server.httpServer?.on('close', cleanup)
      } catch (err: any) {
        console.error('\x1b[31m[DGym Backend]\x1b[0m Could not auto-start backend:', err.message)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dgymBackendAutoStartPlugin(),
  ],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
