import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getDatabase } from '../config/database.js'
import { AuthenticatedRequest } from '../middleware/auth.js'

const createVoucherSchema = z.object({
  voucherDate: z.string(),
  voucherType: z.enum(['RECEIPT', 'INVOICE', 'JOURNAL']),
  description: z.string().optional(),
  bookings: z.array(z.object({
    accountId: z.number(),
    debit: z.number().optional(),
    credit: z.number().optional(),
    text: z.string().optional(),
    taxCode: z.string().optional()
  }))
})

const voucherRoutes: FastifyPluginAsync = async (app) => {
  // List vouchers
  app.get('/', {
    onRequest: [app.authenticate]
  }, async (request: AuthenticatedRequest) => {
    const db = getDatabase()
    const { organizationId } = request.user
    
    const { year, page = '1', limit = '50' } = request.query as any

    const offset = (Number(page) - 1) * Number(limit)

    const result = await db.query(
      `SELECT 
        v.id, v.voucher_number, v.voucher_date, v.voucher_type,
        v.description, v.created_at, v.updated_at,
        COUNT(a.id) as file_count
       FROM vouchers v
       LEFT JOIN attachments a ON v.id = a.voucher_id
       WHERE v.organization_id = $1 
         AND ($2::integer IS NULL OR EXTRACT(YEAR FROM v.voucher_date) = $2)
       GROUP BY v.id
       ORDER BY v.voucher_date DESC, v.voucher_number DESC
       LIMIT $3 OFFSET $4`,
      [organizationId, year || null, Number(limit), offset]
    )

    const countResult = await db.query(
      `SELECT COUNT(*) 
       FROM vouchers 
       WHERE organization_id = $1 
         AND ($2::integer IS NULL OR EXTRACT(YEAR FROM voucher_date) = $2)`,
      [organizationId, year || null]
    )

    return {
      vouchers: result.rows,
      total: Number(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    }
  })

  // Get single voucher with bookings
  app.get('/:id', {
    onRequest: [app.authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string }
    const db = getDatabase()
    const { organizationId } = request.user

    const voucherResult = await db.query(
      `SELECT * FROM vouchers WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    )

    if (voucherResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Voucher not found' })
    }

    const bookingsResult = await db.query(
      `SELECT * FROM bookings WHERE voucher_id = $1 ORDER BY id`,
      [id]
    )

    const attachmentsResult = await db.query(
      `SELECT id, filename, mime_type, size, created_at 
       FROM attachments 
       WHERE voucher_id = $1 
       ORDER BY created_at`,
      [id]
    )

    return {
      ...voucherResult.rows[0],
      bookings: bookingsResult.rows,
      attachments: attachmentsResult.rows
    }
  })

  // Create voucher
  app.post('/', {
    onRequest: [app.authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    const body = createVoucherSchema.parse(request.body)
    const db = getDatabase()
    const { organizationId } = request.user

    const client = await db.connect()
    try {
      await client.query('BEGIN')

      // Generate voucher number
      const year = new Date(body.voucherDate).getFullYear()
      const numberResult = await client.query(
        `SELECT COALESCE(MAX(voucher_number), 0) + 1 as next_number
         FROM vouchers
         WHERE organization_id = $1 AND EXTRACT(YEAR FROM voucher_date) = $2`,
        [organizationId, year]
      )
      const voucherNumber = numberResult.rows[0].next_number

      // Insert voucher
      const voucherResult = await client.query(
        `INSERT INTO vouchers 
         (organization_id, voucher_number, voucher_date, voucher_type, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING *`,
        [organizationId, voucherNumber, body.voucherDate, body.voucherType, body.description]
      )

      const voucherId = voucherResult.rows[0].id

      // Insert bookings
      for (const booking of body.bookings) {
        await client.query(
          `INSERT INTO bookings
           (voucher_id, account_id, debit, credit, text, tax_code, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [voucherId, booking.accountId, booking.debit, booking.credit, booking.text, booking.taxCode]
        )
      }

      await client.query('COMMIT')

      return reply.status(201).send(voucherResult.rows[0])

    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  })

  // Delete voucher
  app.delete('/:id', {
    onRequest: [app.authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    const { id } = request.params as { id: string }
    const db = getDatabase()
    const { organizationId } = request.user

    const result = await db.query(
      `DELETE FROM vouchers WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, organizationId]
    )

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Voucher not found' })
    }

    return { success: true }
  })
}

export default voucherRoutes
