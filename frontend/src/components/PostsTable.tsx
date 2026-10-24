import type { ScheduledPostRow } from '../types'
import { Card } from './ui/card'
import { BorderBeam } from './ui/border-beam'

interface Props {
  posts: ScheduledPostRow[] | null
  onOpenUser?: (skoolUserId: string) => void
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Ждёт', bg: '#3b82f622', color: '#3b82f6' },
  published: { label: 'Опубликован', bg: '#22c55e22', color: '#22c55e' },
  failed: { label: 'Ошибка', bg: '#ef444422', color: '#ef4444' },
}

export default function PostsTable({ posts, onOpenUser }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="text-sm font-medium">Отложенные посты</div>
        <span className="text-xs text-muted-foreground">клик по строке — автор</span>
      </div>
      <BorderBeam size={120} duration={10} />
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="px-3 py-2 font-medium">Автор</th>
              <th className="px-3 py-2 font-medium">Заголовок</th>
              <th className="px-3 py-2 font-medium">Язык</th>
              <th className="px-3 py-2 font-medium">Время</th>
              <th className="px-3 py-2 font-medium">Ссылка</th>
            </tr>
          </thead>
          <tbody>
            {!posts || posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Нет отложенных постов
                </td>
              </tr>
            ) : (
              posts.map((p) => {
                const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending
                return (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-t border-border/50 transition-colors hover:bg-accent/60"
                    title={`Автор: ${p.author_name || p.user_id} — клик откроет карточку`}
                    onClick={() => onOpenUser?.(p.user_id)}
                  >
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-xs"
                        style={{ background: st.bg, color: st.color }}
                        title={p.error || undefined}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2" title={p.user_id}>
                        {p.author_avatar ? (
                          <img src={p.author_avatar} alt="" className="h-6 w-6 shrink-0 rounded-full border border-border" />
                        ) : (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px]">
                            {(p.author_name || p.user_id || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="max-w-[140px] truncate text-xs">{p.author_name || p.author_username || '—'}</span>
                      </div>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2" title={p.title}>
                      {p.title || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs uppercase">{p.language || '—'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {p.status === 'published' ? p.published_at : p.scheduled_for}
                      {p.error && (
                        <div className="max-w-[240px] truncate text-red-500" title={p.error}>
                          {p.error}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.published_url ? (
                        <a
                          href={p.published_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          открыть ↗
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
