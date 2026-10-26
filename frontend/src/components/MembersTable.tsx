import type { CommunityMember } from '../types'
import { MEMBER_STATE_COLORS, MEMBER_STATE_LABELS } from '../types'
import { cn } from '../lib/utils'

interface Props {
  members: CommunityMember[] | null
  total: number
  onSelectUser: (skoolUserId: string) => void
}

export default function MembersTable({ members, total, onSelectUser }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <span className="text-sm font-medium">Члены группы</span>
        <span className="text-xs text-muted-foreground">
          {total === 1 ? '1 участник' : `${total} участников`} · снимок Skool (sync каждые ~5 мин)
        </span>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Участник</th>
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="px-3 py-2 font-medium">В группе с</th>
              <th className="px-3 py-2 font-medium">Расширение</th>
              <th className="px-3 py-2 font-medium">Последняя активность</th>
              <th className="px-3 py-2 font-medium text-right">Профиль</th>
            </tr>
          </thead>
          <tbody>
            {!members || members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Снимок пуст — запустите sync во вкладке «Настройки»
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr
                  key={m.skool_user_id}
                  onClick={() => m.has_extension && onSelectUser(m.skool_user_id)}
                  className={cn(
                    'border-t border-border/50 transition-colors hover:bg-accent/60',
                    m.has_extension && 'cursor-pointer',
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full border border-border" />
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                          {(m.display_name || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate">{m.display_name || '—'}</div>
                        {m.username && <div className="truncate text-xs text-muted-foreground">@{m.username}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                      style={{ background: `${MEMBER_STATE_COLORS[m.state]}22`, color: MEMBER_STATE_COLORS[m.state] }}
                    >
                      {MEMBER_STATE_LABELS[m.state]}
                    </span>
                    {m.comp && (
                      <span
                        className="ml-1 inline-flex rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-500"
                        title="Комплимент-подписка от админа"
                      >
                        💝
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{m.joined_at || '—'}</td>
                  <td className="px-3 py-2">
                    {m.has_extension ? (
                      <span className="font-mono text-xs">
                        {m.posts_used}/{m.posts_total} постов
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground" title="Расширением ещё не пользовался">
                        нет
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{m.last_active_at || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {m.profile_url && (
                      <a
                        href={m.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        Skool ↗
                      </a>
                    )}
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
