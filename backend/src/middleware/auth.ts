import { FastifyRequest, FastifyReply } from 'fastify'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' })
  }
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: number
    organizationId: number
    email: string
  }
}
