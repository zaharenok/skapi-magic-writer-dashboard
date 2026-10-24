import type { GroupInfo } from '../types'

interface Props {
  info: GroupInfo | null
  onReload: () => void
}

function pick(info: GroupInfo | null | undefined): { title?: string; members?: string | number; desc?: string } {
  const g = (info?.group ?? {}) as Record<string, unknown>
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  return {
    title: s(g.group_name) ?? s(g.name) ?? s(g.title),
    members: (typeof g.member_count === 'number' && g.member_count) || s(g.members_count) || s(g.member_count),
    desc: s(g.description) ?? s(g.group_description),
  }
}

export default function GroupInfoCard({ info, onReload }: Props) {
  const g = pick(info)
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Группа (Skapi /check-group)</span>
        <button onClick={onReload} className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent">
          ⟳ проверить
        </button>
      </div>
      {info?.error ? (
        <div className="text-sm text-red-500">{info.error}</div>
      ) : (
        <div className="space-y-1">
          <div className="font-medium">{g.title ?? info?.slug ?? '—'}</div>
          <div className="text-xs text-muted-foreground">
            slug: <span className="font-mono">{info?.slug ?? '—'}</span>
            {g.members !== undefined ? ` · участников: ${g.members}` : ''}
            {info?.checked_at ? ` · проверено: ${info.checked_at}` : ''}
          </div>
          {g.desc && <div className="line-clamp-2 text-xs text-muted-foreground">{g.desc}</div>}
        </div>
      )}
    </div>
  )
}
