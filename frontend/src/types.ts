// ═══════════════════════════════════════════════
// API CONTRACT — типы ДОЛЖНЫ совпадать с server.py
// ═══════════════════════════════════════════════

export type UserState = 'trial' | 'watermark' | 'subscribed' | 'trial_expired' | 'churned'
/** Фильтр списка юзеров: стадии + спецразрезы (активные 24ч / делали запросы). */
export type UsersFilter = UserState | 'all' | 'active24' | 'requested'

export interface DashboardStats {
  total_users: number
  made_request: number
  active_24h: number
  requests_today: number
  requests_this_month: number
  users_over_quota: number
  scheduled_posts: { total: number; pending: number; published: number; failed: number }
  states: Record<UserState, number>
  conversion_rate: number
  mrr_estimate: number
  daily_new_users: Record<string, number>
  daily_new_subscribers: Record<string, number>
  members_over_time: { date: string; event_type: 'joined' | 'left'; count: number }[]
  trial_posts: number
  community_price: number
  community_slug: string
  ai_this_month?: number
  generations_total?: number
  daily?: DailyStat[]
}

export interface Expense {
  name: string
  amount: number
}

export interface FinanceSettings {
  ai_price_input: number
  ai_price_output: number
  avg_tokens_in: number
  avg_tokens_out: number
  infra_cost: number
}

export interface DailyStat {
  date: string
  new_users: number
  requests: number
  ai_requests: number
  posts_published: number
  joined: number
  left: number
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
  username: string | null
  avatar_url: string | null
  tokens: number
  created_at: string
  last_active_at: string
  joined_at: string | null
  left_at: string | null
  state: UserState
  status_override: string | null
  posts_used: number
  posts_limit: number
  posts_total: number
  comp?: boolean
  is_banned: boolean
  requests_today: number
  requests_total: number
  quota_used: number
  quota_limit: number
  quota_percent: number
}

export interface MemberInfo {
  name: string | null
  username: string | null
  avatar_url: string | null
  profile_url: string | null
  is_current: boolean
  comp: boolean
  first_seen_at: string | null
  left_at: string | null
}

export interface UserPost {
  id: number
  title: string
  status: string
  scheduled_for: string | null
  published_at: string | null
  published_url: string | null
  error: string
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

export interface DashboardSettings {
  community_slug: string
  source: 'saved' | 'env'
  trial_posts: number
  community_price: number
  finance?: FinanceSettings
  expenses?: Expense[]
}

export interface UserDetail {
  skool_user_id: string
  display_name: string
  username: string | null
  avatar_url: string | null
  profile_url: string | null
  tokens: number
  created_at: string
  last_seen_at: string
  is_banned: boolean
  posts_used: number
  posts_total: number
  lang: string | null
  member: MemberInfo | null
  requests_total: number
  scheduled_posts: UserPost[]
  membership_events: { event_type: 'joined' | 'left' | 'trial_exhausted'; detected_at: string; community_slug: string }[]
  recent_requests: { endpoint: string; status_code: number; success: boolean; created_at: string }[]
  admin_actions: AdminAction[]
}

export interface GroupInfo {
  success?: boolean
  slug?: string
  checked_at?: string
  group?: Record<string, unknown>
  error?: string
}

export interface AdminAction {
  action: string
  details: string | null
  created_at: string
}

export interface ScheduledPostRow {
  id: number
  user_id: string
  author_name?: string | null
  author_username?: string | null
  author_avatar?: string | null
  title: string
  community_slug: string
  language: string
  status: 'pending' | 'published' | 'failed' | string
  scheduled_for: string
  published_at: string | null
  published_url: string | null
  error: string
}

export const STATE_LABELS: Record<UserState, string> = {
  watermark: 'Вотермарк',
  trial: 'Триал',
  subscribed: 'Подписан',
  trial_expired: 'Просрочен',
  churned: 'Отписался',
}

export const STATE_COLORS: Record<UserState, string> = {
  watermark: '#8b5cf6',
  trial: '#3b82f6',
  subscribed: '#22c55e',
  trial_expired: '#f59e0b',
  churned: '#ef4444',
}
