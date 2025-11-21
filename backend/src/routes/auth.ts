import { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { getDatabase } from '../config/database.js'
import { AuthenticatedRequest } from '../middleware/auth.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  organizationName: z.string().min(2)
})

const authRoutes: FastifyPluginAsync = async (app) => {
  // Login
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const db = getDatabase()

    const result = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.organization_id, o.name as organization_name
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1 AND u.is_active = true`,
      [body.email]
    )

    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const user = result.rows[0]
    const validPassword = await bcrypt.compare(body.password, user.password_hash)

    if (!validPassword) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const token = app.jwt.sign({
      userId: user.id,
      organizationId: user.organization_id,
      email: user.email
    }, {
      expiresIn: '7d'
    })

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organization_id,
        organizationName: user.organization_name
      }
    }
  })

  // Register
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)
    const db = getDatabase()

    const client = await db.connect()
    try {
      await client.query('BEGIN')

      // Create organization
      const orgResult = await client.query(
        `INSERT INTO organizations (name, created_at, updated_at)
         VALUES ($1, NOW(), NOW())
         RETURNING id`,
        [body.organizationName]
      )
      const organizationId = orgResult.rows[0].id

      // Hash password
      const passwordHash = await bcrypt.hash(body.password, 10)

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, organization_id, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())
         RETURNING id, email`,
        [body.email, passwordHash, organizationId]
      )

      await client.query('COMMIT')

      const user = userResult.rows[0]
      const token = app.jwt.sign({
        userId: user.id,
        organizationId,
        email: user.email
      }, {
        expiresIn: '7d'
      })

      return reply.status(201).send({
        token,
        user: {
          id: user.id,
          email: user.email,
          organizationId,
          organizationName: body.organizationName
        }
      })

    } catch (err: any) {
      await client.query('ROLLBACK')
      if (err.code === '23505') {
        return reply.status(409).send({ error: 'Email already exists' })
      }
      throw err
    } finally {
      client.release()
    }
  })

  // Get current user
  app.get('/me', {
    onRequest: [app.authenticate]
  }, async (request: AuthenticatedRequest) => {
    const db = getDatabase()
    const result = await db.query(
      `SELECT u.id, u.email, u.organization_id, o.name as organization_name
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [request.user.userId]
    )

    if (result.rows.length === 0) {
      return { error: 'User not found' }
    }

    const user = result.rows[0]
    return {
      id: user.id,
      email: user.email,
      organizationId: user.organization_id,
      organizationName: user.organization_name
    }
  })
}

export default authRoutes
