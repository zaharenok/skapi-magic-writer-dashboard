import type { DashboardStats, UserState } from '../types'
import { STATE_COLORS, STATE_LABELS } from '../types'
import { cn } from '../lib/utils'

interface Props {
  stats: DashboardStats | null
  activeState: UserState | 'all'
  onSelectState: (s: UserState | 'all') => void
}

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n)
}

const STATE_ORDER: UserState[] = ['trial', 'subscribed', 'trial_expired', 'churned']

export default function KpiCards({ stats, activeState, onSelectState }: Props) {
  if (!stats) return null
  const money = stats.mrr_estimate > 0 ? `${fmt(stats.mrr_estimate)} $` : '—'

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Всего юзеров</div>
        <div className="mt-1 text-2xl font-semibold">{fmt(stats.total_users)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          сделали запрос: {fmt(stats.made_request)}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Активных (24ч)</div>
        <div className="mt-1 text-2xl font-semibold">{fmt(stats.active_24h)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          запросов сегодня: {fmt(stats.requests_today)}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Конверсия trial → подписка</div>
        <div className="mt-1 text-2xl font-semibold">{stats.conversion_rate}%</div>
        <div className="mt-1 text-xs text-muted-foreground">
          триал {stats.trial_days} дней
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">MRR (оценка)</div>
        <div className="mt-1 text-2xl font-semibold">{money}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          цена подписки: {stats.community_price > 0 ? `${stats.community_price} $` : '—'}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Сообщество</div>
        <div className="mt-1 truncate text-sm font-semibold" title={stats.community_slug}>
          {stats.community_slug || 'не задано'}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">платный gate</div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Запросы за месяц</div>
        <div className="mt-1 text-2xl font-semibold">{fmt(stats.requests_this_month)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          сверх квоты: <span className={stats.users_over_quota > 0 ? 'text-red-500' : ''}>{fmt(stats.users_over_quota)}</span>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Отложенные посты</div>
        <div className="mt-1 text-2xl font-semibold">{fmt(stats.scheduled_posts.total)}</div>
        <div className="mt-1 flex gap-2 text-xs">
          <span className="text-blue-500">{fmt(stats.scheduled_posts.pending)} готовятся</span>
          <span className="text-green-600 dark:text-green-400">{fmt(stats.scheduled_posts.sent)} опубликовано</span>
          <span className={stats.scheduled_posts.failed > 0 ? 'text-red-500' : ''}>{fmt(stats.scheduled_posts.failed)} ошибок</span>
        </div>
      </div>

      {STATE_ORDER.map((s) => (
        <button
          key={s}
          onClick={() => onSelectState(activeState === s ? 'all' : s)}
          className={cn(
            'rounded-xl border p-4 text-left transition-colors',
            activeState === s ? 'border-ring ring-1 ring-ring' : 'border-border bg-card hover:bg-accent',
          )}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATE_COLORS[s] }} />
            {STATE_LABELS[s]}
          </div>
          <div className="mt-1 text-2xl font-semibold">{fmt(stats.states[s])}</div>
          <div className="mt-1 text-xs text-muted-foreground">клик — список юзеров</div>
        </button>
      ))}
    </div>
  )
}
