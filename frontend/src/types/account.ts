import type { UserRole } from '@/types/auth'

export interface AccountProfile {
  id: number
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  is_active: boolean
  account_status: string
  profile_picture_url: string | null
  created_at: string
  updated_at: string
}

export interface AccountProfileUpdate {
  full_name?: string
  email?: string
  phone?: string
  current_password?: string
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
  confirm_new_password: string
}

export interface ProfilePictureResponse {
  profile_picture_url: string | null
}

export interface MessageResponse {
  message: string
}