import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { initializeDatabase } from './config/database.js'
import authRoutes from './routes/auth.js'
import voucherRoutes from './routes/vouchers.js'
import memberRoutes from './routes/members.js'
import { errorHandler } from './middleware/error.js'
import { authenticate } from './middleware/auth.js'

const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HOST || '0.0.0.0'

async function startServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info'
    }
  })

  try {
    // Database initialization
    await initializeDatabase()
    console.log('✓ Database connected')

    // CORS - Erlaube Electron-App Zugriff
    await app.register(cors, {
      origin: (origin, cb) => {
        // Electron apps have null origin or custom protocol
        if (!origin || origin === 'null' || origin.startsWith('file://') || origin.startsWith('http://localhost')) {
          cb(null, true)
        } else if (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*') {
          cb(null, process.env.CORS_ORIGIN === origin)
        } else {
          cb(null, true)
        }
      },
      credentials: true
    })

    // JWT
    await app.register(jwt, {
      secret: process.env.JWT_SECRET || 'dev_secret_change_in_production'
    })

    // Multipart (file uploads)
    await app.register(multipart, {
      limits: {
        fileSize: Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
      }
    })

    // Add authenticate decorator
    app.decorate('authenticate', authenticate)

    // Health check
    app.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() }
    })

    // API Routes
    app.register(authRoutes, { prefix: '/api/auth' })
    app.register(voucherRoutes, { prefix: '/api/vouchers' })
    app.register(memberRoutes, { prefix: '/api/members' })

    // Error handler
    app.setErrorHandler(errorHandler)

    // Start server
    await app.listen({ port: PORT, host: HOST })
    console.log(`🚀 Server listening on http://${HOST}:${PORT}`)
    console.log(`📊 Environment: ${process.env.NODE_ENV}`)

  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }

  // Graceful shutdown
  const signals = ['SIGTERM', 'SIGINT']
  signals.forEach(signal => {
    process.on(signal, async () => {
      console.log(`\n${signal} received, shutting down gracefully...`)
      await app.close()
      process.exit(0)
    })
  })
}

startServer()
