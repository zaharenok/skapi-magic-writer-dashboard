// ═══════════════════════════════════════════════
// API CONTRACT — типы ДОЛЖНЫ совпадать с server.py
// ═══════════════════════════════════════════════

export type UserState = 'trial' | 'subscribed' | 'trial_expired' | 'churned'

export interface DashboardStats {
  total_users: number
  made_request: number
  active_24h: number
  requests_today: number
  states: Record<UserState, number>
  conversion_rate: number
  mrr_estimate: number
  daily_new_users: Record<string, number>
  daily_new_subscribers: Record<string, number>
  members_over_time: { date: string; event_type: 'joined' | 'left'; count: number }[]
  trial_days: number
  community_price: number
  community_slug: string
}

export interface Funnel {
  total: number
  made_request: number
  trial_active: number
  subscribed: number
  trial_expired: number
  churned: number
}

export interface DashboardUser {
  id: number
  skool_user_id: string
  display_name: string
  created_at: string
  last_active_at: string
  joined_at: string | null
  left_at: string | null
  state: UserState
  trial_end: string | null
  requests_today: number
  requests_total: number
}

export interface MembershipEvent {
  id: number
  community_slug: string
  skool_user_id: string
  username: string
  name: string
  event_type: 'joined' | 'left'
  detected_at: string
}

export interface SyncRun {
  id: number
  community_slug: string
  started_at: string
  finished_at: string
  status: 'running' | 'success' | 'error'
  members_found: number
  joined_count: number
  left_count: number
  error: string | null
  triggered_by: string
}

export interface UserDetail {
  id: number
  skool_user_id: string
  display_name: string
  client_id: string
  created_at: string
  last_seen_at: string
  is_banned: boolean
  membership_events: { event_type: 'joined' | 'left'; detected_at: string; community_slug: string }[]
  recent_requests: { endpoint: string; status_code: number; success: boolean; created_at: string }[]
}

export const STATE_LABELS: Record<UserState, string> = {
  trial: 'Триал',
  subscribed: 'Подписан',
  trial_expired: 'Просрочен',
  churned: 'Отписался',
}

export const STATE_COLORS: Record<UserState, string> = {
  trial: '#3b82f6',
  subscribed: '#22c55e',
  trial_expired: '#f59e0b',
  churned: '#ef4444',
}
