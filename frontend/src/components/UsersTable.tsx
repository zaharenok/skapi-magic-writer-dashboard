import type { DashboardUser, UserState, UsersFilter } from '../types'
import { STATE_COLORS, STATE_LABELS } from '../types'
import { cn } from '../lib/utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu'

interface Props {
  users: DashboardUser[] | null
  stateFilter: UsersFilter
  onFilterChange: (s: UsersFilter) => void
  onSelectUser: (u: DashboardUser) => void
  onAdjust: (u: DashboardUser, action: 'reset' | 'revoke' | 'bonus') => void
  onToggleBan: (u: DashboardUser) => void
  onToggleComp: (skoolUserId: string, comp: boolean) => void
  busy: string | null
}

const FILTERS: UsersFilter[] = ['all', 'trial', 'subscribed', 'trial_expired', 'churned']

export default function UsersTable({ users, stateFilter, onFilterChange, onSelectUser, onAdjust, onToggleBan, onToggleComp, busy }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <span className="text-sm font-medium">Пользователи</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                stateFilter === f
                  ? 'border-ring bg-accent text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {f === 'all' ? 'Все' : STATE_LABELS[f as UserState]}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Имя</th>
              <th className="px-3 py-2 font-medium">Skool ID</th>
              <th className="px-3 py-2 font-medium">Стадия</th>
              <th className="px-3 py-2 font-medium">Посты</th>
              <th className="px-3 py-2 font-medium">Запросы</th>
              <th className="px-3 py-2 font-medium">Квота / мес</th>
              <th className="px-3 py-2 font-medium">Последняя активность</th>
              <th className="px-3 py-2 font-medium text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {!users || users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Нет данных по фильтру
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => onSelectUser(u)}
                  className="cursor-pointer border-t border-border/50 transition-colors hover:bg-accent/60"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full border border-border" />
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                          {(u.display_name || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{u.display_name || '—'}</span>
                          {u.tokens > 1 && (
                            <span
                              className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400"
                              title="Несколько JWT-токенов (перелогины) — счётчики объединены"
                            >
                              ×{u.tokens}
                            </span>
                          )}
                        </div>
                        {u.username && <div className="truncate text-xs text-muted-foreground">@{u.username}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{u.skool_user_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                      style={{ background: `${STATE_COLORS[u.state]}22`, color: STATE_COLORS[u.state] }}
                    >
                      {STATE_LABELS[u.state]}
                    </span>
                    {u.comp && (
                      <span className="ml-1 inline-flex rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-500" title="Комплимент-подписка от админа">
                        💝
                      </span>
                    )}
                    {u.is_banned && (
                      <span className="ml-1 inline-flex rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-500">
                        бан
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {u.posts_used}/{u.posts_limit}
                    <span className="text-muted-foreground"> · всего {u.posts_total}</span>
                  </td>
                  <td className="px-3 py-2">
                    {u.requests_total}
                    <span className="text-muted-foreground"> ({u.requests_today} сегодня)</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(u.quota_percent, 100)}%`,
                            background: u.quota_percent >= 100 ? '#ef4444' : u.quota_percent >= 80 ? '#f59e0b' : '#22c55e',
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs">{u.quota_used}/{u.quota_limit}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{u.last_active_at || '—'}</td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="rounded-lg border border-border px-2 py-1 text-xs transition-colors hover:bg-accent"
                          title="Действия"
                        >
                          ⋯ Действия
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={busy === u.skool_user_id} onClick={() => onAdjust(u, 'reset')}>
                          🔄 Сбросить триал
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={busy === u.skool_user_id} onClick={() => onAdjust(u, 'bonus')}>
                          🎁 Подарить +5 постов
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={busy === u.skool_user_id} onClick={() => onAdjust(u, 'revoke')}>
                          ⛔ Отобрать триал
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={busy === u.skool_user_id}
                          className="text-purple-500 focus:text-purple-500"
                          onClick={() => onToggleComp(u.skool_user_id, !u.comp)}
                        >
                          {u.comp ? '💔 Отозвать комплимент' : '💝 Комплимент-подписка'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={busy === u.skool_user_id}
                          destructive
                          onClick={() => onToggleBan(u)}
                        >
                          {u.is_banned ? '✅ Разблокировать' : '🚫 Забанить'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
