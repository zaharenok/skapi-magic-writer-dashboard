// ═══════════════════════════════════════════════
// API CONTRACT — frontend types
// Эти интерфейсы ДОЛЖНЫ совпадать с backend response.
// При изменении backend — обновить здесь.
// ═══════════════════════════════════════════════

export interface DashboardStats {
  campaign_start: string
  since_date: string
  total_users: number
  new_since: number
  active_since: number
  msgs_since: number
  // Добавь свои метрики:
  // paywall_hits: number
  // revenue_eur: number
  // spend: number
  // clicks: number
  // conversions: number
  lang_distribution: Record<string, number>
  daily_new_users: Record<string, number>
  daily_active_users: Record<string, number>
  kpi_bars?: Record<string, number>
}

export interface User {
  id: number
  name: string
  language: string
  created_at: string
  last_active_at: string
  messages_sent_total: number
  subscription_active: boolean
  // Добавь свои поля:
  // source: string         // 'fb' | 'organic' | 'referral'
  // campaign: string       // Название рекламной кампании
  // paywall_shown: boolean
  // next_nudge?: NudgeInfo | null
}

export interface UsersResponse {
  users: User[]
  total: number
}

// ═══════════════════════════════════════════════
// Опциональные типы (для drill-down)
// ═══════════════════════════════════════════════

export interface UserMessage {
  id: number
  user_message: string
  bot_response: string
  created_at: string
}

export interface MessagesResponse {
  messages: UserMessage[]
}

export interface TimelineItem {
  type: string
  label: string
  status: string  // 'sent' | 'planned' | 'completed' | 'in_progress'
  at: string | null
  detail: string
  countdown?: string
  message_text?: string
}

export interface TimelineResponse {
  timeline: TimelineItem[]
}
