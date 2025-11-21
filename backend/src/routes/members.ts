import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getDatabase } from '../config/database.js'
import { AuthenticatedRequest } from '../middleware/auth.js'

const createMemberSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  street: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  memberNumber: z.string().optional(),
  joinDate: z.string().optional(),
  exitDate: z.string().optional(),
  isActive: z.boolean().default(true)
})

const memberRoutes: FastifyPluginAsync = async (app) => {
  // List members
  app.get('/', {
    onRequest: [app.authenticate]
  }, async (request: AuthenticatedRequest) => {
    const db = getDatabase()
    const { organizationId } = request.user
    const { search, active } = request.query as any

    let query = `SELECT * FROM members WHERE organization_id = $1`
    const params: any[] = [organizationId]

    if (active !== undefined) {
      query += ` AND is_active = $${params.length + 1}`
      params.push(active === 'true')
    }

    if (search) {
      query += ` AND (first_name ILIKE $${params.length + 1} OR last_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`
      params.push(`%${search}%`)
    }

    query += ` ORDER BY last_name, first_name`

    const result = await db.query(query, params)
    return { members: result.rows }
  })

  // Get single member
  app.get('/:id', {
    onRequest: [app.authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string }
    const db = getDatabase()
    const { organizationId } = request.user

    const result = await db.query(
      `SELECT * FROM members WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    )

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    return result.rows[0]
  })

  // Create member
  app.post('/', {
    onRequest: [app.authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    const body = createMemberSchema.parse(request.body)
    const db = getDatabase()
    const { organizationId } = request.user

    const result = await db.query(
      `INSERT INTO members
       (organization_id, first_name, last_name, email, phone, street, zip, city, 
        member_number, join_date, exit_date, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
       RETURNING *`,
      [
        organizationId,
        body.firstName,
        body.lastName,
        body.email,
        body.phone,
        body.street,
        body.zip,
        body.city,
        body.memberNumber,
        body.joinDate,
        body.exitDate,
        body.isActive
      ]
    )

    return reply.status(201).send(result.rows[0])
  })

  // Update member
  app.patch('/:id', {
    onRequest: [app.authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string }
    const body = createMemberSchema.partial().parse(request.body)
    const db = getDatabase()
    const { organizationId } = request.user

    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1

    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        updates.push(`${snakeKey} = $${paramCount++}`)
        values.push(value)
      }
    })

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id, organizationId)

    const result = await db.query(
      `UPDATE members 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND organization_id = $${paramCount++}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    return result.rows[0]
  })

  // Delete member
  app.delete('/:id', {
    onRequest: [app.authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string }
    const db = getDatabase()
    const { organizationId } = request.user

    const result = await db.query(
      `DELETE FROM members WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, organizationId]
    )

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Member not found' })
    }

    return { success: true }
  })
}

export default memberRoutes
