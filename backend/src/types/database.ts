export interface Organization {
  id: number
  name: string
  created_at: Date
  updated_at: Date
}

export interface User {
  id: number
  organization_id: number
  email: string
  password_hash: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface Account {
  id: number
  organization_id: number
  account_number: string
  name: string
  account_type: string
  category?: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface Voucher {
  id: number
  organization_id: number
  voucher_number: number
  voucher_date: string
  voucher_type: 'RECEIPT' | 'INVOICE' | 'JOURNAL'
  description?: string
  created_at: Date
  updated_at: Date
}

export interface Booking {
  id: number
  voucher_id: number
  account_id: number
  debit?: number
  credit?: number
  text?: string
  tax_code?: string
  created_at: Date
  updated_at: Date
}

export interface Member {
  id: number
  organization_id: number
  member_number?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  street?: string
  zip?: string
  city?: string
  join_date?: string
  exit_date?: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface Attachment {
  id: number
  voucher_id: number
  filename: string
  original_filename: string
  mime_type: string
  size: number
  file_path: string
  created_at: Date
}

export interface Tag {
  id: number
  organization_id: number
  name: string
  color?: string
  created_at: Date
}

export interface MemberPayment {
  id: number
  organization_id: number
  member_id: number
  voucher_id?: number
  amount: number
  payment_date: string
  description?: string
  created_at: Date
  updated_at: Date
}

export interface Setting {
  id: number
  organization_id: number
  key: string
  value?: string
  created_at: Date
  updated_at: Date
}

export interface AuditLog {
  id: number
  organization_id: number
  user_id?: number
  action: string
  entity_type: string
  entity_id?: number
  changes?: Record<string, any>
  created_at: Date
}
