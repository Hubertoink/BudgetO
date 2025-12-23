export type UserRole = 'ADMIN' | 'KASSE' | 'READONLY'

export interface User {
  id: number
  name: string
  username: string | null
  email: string | null
  role: UserRole
  isActive: boolean
  lastLogin: string | null
}
