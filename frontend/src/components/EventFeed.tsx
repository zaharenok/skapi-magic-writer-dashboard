import type { MembershipEvent } from '../types'

export default function EventFeed({ events }: { events: MembershipEvent[] | null }) {
  if (!events) return null
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 text-sm font-medium">События членства (join / leave)</div>
      <ul className="space-y-2">
        {events.length === 0 && (
          <li className="text-xs text-muted-foreground">
            Событий нет — запустите синхронизацию
          </li>
        )}
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-2 text-sm">
            <span
              className={
                e.event_type === 'joined'
                  ? 'rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-600 dark:text-green-400'
                  : 'rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-600 dark:text-red-400'
              }
            >
              {e.event_type === 'joined' ? 'вступил' : 'вышел'}
            </span>
            <span className="truncate">{e.name || e.username || e.skool_user_id}</span>
            <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
              {e.detected_at}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
