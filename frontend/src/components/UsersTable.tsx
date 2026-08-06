import type { DashboardUser, UserState } from '../types'
import { STATE_COLORS, STATE_LABELS } from '../types'
import { cn } from '../lib/utils'

interface Props {
  users: DashboardUser[] | null
  stateFilter: UserState | 'all'
  onFilterChange: (s: UserState | 'all') => void
  onSelectUser: (u: DashboardUser) => void
}

const FILTERS: (UserState | 'all')[] = ['all', 'trial', 'subscribed', 'trial_expired', 'churned']

export default function UsersTable({ users, stateFilter, onFilterChange, onSelectUser }: Props) {
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
              {f === 'all' ? 'Все' : STATE_LABELS[f]}
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
              <th className="px-3 py-2 font-medium">Запросы</th>
              <th className="px-3 py-2 font-medium">Последняя активность</th>
            </tr>
          </thead>
          <tbody>
            {!users || users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
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
                  <td className="px-3 py-2">{u.display_name || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{u.skool_user_id}</td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                      style={{ background: `${STATE_COLORS[u.state]}22`, color: STATE_COLORS[u.state] }}
                    >
                      {STATE_LABELS[u.state]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {u.requests_total}
                    <span className="text-muted-foreground"> ({u.requests_today} сегодня)</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{u.last_active_at || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
