import type { MembershipEvent } from '../types'

const EVENT_BADGE: Record<string, { label: string; cls: string }> = {
  joined: { label: 'вступил', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  left: { label: 'вышел', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  trial_exhausted: { label: 'триал исчерпан', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
}
export default function EventFeed({
  events,
  onOpenUser,
}: {
  events: MembershipEvent[] | null
  onOpenUser?: (skoolUserId: string) => void
}) {
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
          <li
            key={e.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5 text-sm transition-colors hover:bg-accent"
            title="Открыть пользователя"
            onClick={() => onOpenUser?.(e.skool_user_id)}
          >
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${EVENT_BADGE[e.event_type]?.cls ?? 'bg-muted text-muted-foreground'}`}
            >
              {EVENT_BADGE[e.event_type]?.label ?? e.event_type}
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
