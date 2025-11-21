// Fastify module augmentation for JWT
import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: number
      organizationId: number
      email: string
    }
    user: {
      userId: number
      organizationId: number
      email: string
    }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any
  }
}
