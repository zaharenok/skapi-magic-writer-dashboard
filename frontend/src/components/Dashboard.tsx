import { useState } from 'react'
import type { DashboardUser, UserState } from '../types'
import { useDashboardData, useUsers, useUserDetail, usePosts, adjustPosts, setBanned } from '../hooks/useDashboard'
import KpiCards from './KpiCards'
import FunnelChart from './FunnelChart'
import DailyChart from './DailyChart'
import MembershipChart from './MembershipChart'
import UsersTable from './UsersTable'
import EventFeed from './EventFeed'
import SyncPanel from './SyncPanel'
import PostsTable from './PostsTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Moon, Sun } from 'lucide-react'

interface Props {
  isDark: boolean
  onToggleTheme: () => void
}

function UserDetailDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data, error } = useUserDetail(userId)
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-auto border-l border-border bg-background p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Детали пользователя</h2>
          <button onClick={onClose} className="rounded-lg border border-border px-2 py-1 text-sm hover:bg-accent">
            ✕
          </button>
        </div>
        {error && <div className="text-sm text-red-500">{error}</div>}
        {data && (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="font-medium">{data.display_name || '—'}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">skool_id: {data.skool_user_id}</div>
              <div className="text-xs text-muted-foreground">client_id: {data.client_id}</div>
              <div className="text-xs text-muted-foreground">создан: {data.created_at}</div>
              <div className="text-xs text-muted-foreground">последняя активность: {data.last_seen_at}</div>
              <div className="text-xs text-muted-foreground">
                постов израсходовано: {data.posts_used} · всего успешно: {data.posts_total}
                {data.lang ? ` · язык: ${data.lang}` : ''}
              </div>
              <div className="text-xs">
                {data.is_banned ? <span className="text-red-500">забанен</span> : <span className="text-green-600 dark:text-green-400">не забанен</span>}
              </div>
            </div>
            <div>
              <div className="mb-2 font-medium">История членства</div>
              {data.membership_events.length === 0 ? (
                <div className="text-xs text-muted-foreground">нет событий</div>
              ) : (
                <ul className="space-y-1">
                  {data.membership_events.map((e, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className={e.event_type === 'joined' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {e.event_type === 'joined' ? 'вступил' : 'вышел'}
                      </span>
                      <span className="text-muted-foreground">{e.detected_at}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-2 font-medium">Последние запросы</div>
              {data.recent_requests.length === 0 ? (
                <div className="text-xs text-muted-foreground">запросов нет</div>
              ) : (
                <ul className="space-y-1">
                  {data.recent_requests.map((r, i) => (
                    <li key={i} className="flex items-center gap-2 font-mono text-xs">
                      <span className={r.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {r.status_code}
                      </span>
                      <span className="truncate">{r.endpoint}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground">{r.created_at}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-2 font-medium">Ручные действия</div>
              {data.admin_actions.length === 0 ? (
                <div className="text-xs text-muted-foreground">не было</div>
              ) : (
                <ul className="space-y-1">
                  {data.admin_actions.map((a, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground">{a.created_at}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{a.action}</span>
                      <span className="text-muted-foreground">{a.details}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard({ isDark, onToggleTheme }: Props) {
  const { stats, funnel, events, sync } = useDashboardData()
  const posts = usePosts()
  const [stateFilter, setStateFilter] = useState<UserState | 'all'>('all')
  const users = useUsers(stateFilter)
  const [selected, setSelected] = useState<DashboardUser | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const handleAdjust = async (u: DashboardUser, action: 'reset' | 'revoke' | 'bonus') => {
    const labels: Record<string, string> = {
      reset: `сбросить триал ${u.display_name || u.skool_user_id} (снова ${u.posts_limit} постов)?`,
      bonus: `подарить +5 постов ${u.display_name || u.skool_user_id}?`,
      revoke: `отобрать триал у ${u.display_name || u.skool_user_id} (счётчик = ${u.posts_limit})?`,
    }
    if (!confirm(labels[action])) return
    setBusy(u.skool_user_id)
    try {
      const r = await adjustPosts(u.skool_user_id, action, 5)
      if (!r.success) alert(`Ошибка: ${r.error}`)
    } finally {
      setBusy(null)
      users.reload()
    }
  }

  const handleToggleBan = async (u: DashboardUser) => {
    const verb = u.is_banned ? 'разблокировать' : 'ЗАБАНИТЬ'
    if (!confirm(`${verb} ${u.display_name || u.skool_user_id}?`)) return
    setBusy(u.skool_user_id)
    try {
      const r = await setBanned(u.skool_user_id, !u.is_banned)
      if (!r.success) alert(`Ошибка: ${r.error}`)
    } finally {
      setBusy(null)
      users.reload()
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">Magic Writer · Monetization Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              Триал → подписка через сообщество · воронка и конверсия
            </p>
          </div>
          <button
            onClick={onToggleTheme}
            className="ml-auto rounded-lg border border-border p-2 hover:bg-accent"
            title="Переключить тему"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="users">Пользователи</TabsTrigger>
            <TabsTrigger value="posts">Посты</TabsTrigger>
            <TabsTrigger value="settings">Настройки</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <KpiCards stats={stats.data} activeState={stateFilter} onSelectState={setStateFilter} />
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4 lg:col-span-1">
                <div className="mb-2 text-sm font-medium">Воронка</div>
                <FunnelChart funnel={funnel.data} dark={isDark} />
              </div>
              <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
                <div className="mb-2 text-sm font-medium">Новые юзеры и подписчики (30 дней)</div>
                <DailyChart stats={stats.data} dark={isDark} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 text-sm font-medium">Членство сообщества во времени</div>
              <MembershipChart stats={stats.data} dark={isDark} />
            </div>
            <EventFeed events={events.data?.events ?? null} />
            {stats.error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                Ошибка загрузки данных: {stats.error}. Проверьте DATABASE_URL и что таблицы созданы (init_db / schema_membership).
              </div>
            )}
          </TabsContent>

          <TabsContent value="users">
            <UsersTable
              users={users.data?.users ?? null}
              stateFilter={stateFilter}
              onFilterChange={setStateFilter}
              onSelectUser={setSelected}
              onAdjust={handleAdjust}
              onToggleBan={handleToggleBan}
              busy={busy}
            />
          </TabsContent>

          <TabsContent value="posts">
            <PostsTable posts={posts.data?.posts ?? null} />
          </TabsContent>

          <TabsContent value="settings">
            <SyncPanel sync={sync.data?.sync ?? null} onDone={sync.reload} />
          </TabsContent>
        </Tabs>
      </main>

      {selected && <UserDetailDrawer userId={selected.skool_user_id} onClose={() => setSelected(null)} />}
    </div>
  )
}
