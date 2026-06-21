export type MetaConnection = {
  id: string
  workspace_id: string
  user_id: string
  facebook_user_id: string
  facebook_user_name: string | null
  facebook_user_email: string | null
  facebook_user_picture_url: string | null
  status: 'active' | 'expired' | 'disconnected' | 'error'
  token_expires_at: string | null
  last_error_message: string | null
  last_synced_at: string | null
  granted_scopes: string[] | null
  created_at: string
  updated_at: string
}

export type MetaBusinessManager = {
  id: string
  meta_connection_id: string
  business_manager_id: string
  name: string
  profile_picture_url: string | null
  is_active: boolean
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export type MetaAdAccount = {
  id: string
  meta_connection_id: string
  business_manager_id: string | null
  ad_account_id: string
  name: string
  account_status: number
  currency: string
  timezone_name: string | null
  amount_spent: number
  balance: number
  is_active: boolean
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export const REQUIRED_SCOPES = [
  'email',
  'public_profile',
  'business_management',
  'ads_management',
  'ads_read'
]

export const SCOPE_DESCRIPTIONS: Record<string, string> = {
  email: 'Access your email address',
  public_profile: 'Access your name and profile picture',
  business_management: 'Manage your business assets',
  ads_management: 'Create and manage ads',
  ads_read: 'View ad performance data'
}
