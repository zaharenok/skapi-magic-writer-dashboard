import { useState } from 'react'
import type { CommunityMember, DashboardUser, UserState, UsersFilter } from '../types'
import { useDashboardData, useSettings, useUsers, useMembers, useUserDetail, usePosts, useGroupInfo, adjustPosts, setBanned, setComp, setUserStatus } from '../hooks/useDashboard'
import KpiCards from './KpiCards'
import FunnelChart from './FunnelChart'
import DailyChart from './DailyChart'
import MembershipChart from './MembershipChart'
import UsersTable from './UsersTable'
import MembersTable from './MembersTable'
import EventFeed from './EventFeed'
import SyncPanel from './SyncPanel'
import PostsTable from './PostsTable'
import DailyBreakdown from './DailyBreakdown'
import FinanceTab from './FinanceTab'
import GroupInfoCard from './GroupInfoCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Moon, Sun } from 'lucide-react'

interface Props {
  isDark: boolean
  onToggleTheme: () => void
}

function UserDetailDrawer({
  userId,
  onClose,
  onComp,
}: {
  userId: string
  onClose: () => void
  onComp: (userId: string, comp: boolean) => void
}) {
  const { data, error, reload } = useUserDetail(userId)
  const [compBusy, setCompBusy] = useState(false)
  const comp = async (next: boolean) => {
    setCompBusy(true)
    try {
      onComp(userId, next)
      reload()
    } finally {
      setCompBusy(false)
    }
  }
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
              <div className="flex items-center gap-3">
                {data.avatar_url ? (
                  <img src={data.avatar_url} alt="" className="h-12 w-12 rounded-full border border-border" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg">
                    {(data.display_name || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium">{data.display_name || '—'}</div>
                  {data.username && <div className="truncate text-xs text-muted-foreground">@{data.username}</div>}
                  {data.profile_url && (
                    <a href={data.profile_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                      профиль в Skool ↗
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <div className="font-mono">skool_id: {data.skool_user_id}</div>
                <div>
                  JWT-токенов: {data.tokens} · создан: {data.created_at} · активность: {data.last_seen_at}
                </div>
                <div>
                  запросов всего: {data.requests_total} · постов израсходовано: {data.posts_used} / успешных генераций: {data.posts_total}
                  {data.lang ? ` · язык: ${data.lang}` : ''}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {data.is_banned ? (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-500">забанен</span>
                  ) : (
                    <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-green-600 dark:text-green-400">активен</span>
                  )}
                  {data.member?.comp && (
                    <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-purple-500">комплимент</span>
                  )}
                  {data.member?.is_current && !data.member?.comp && (
                    <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-green-600 dark:text-green-400">член группы (Skool)</span>
                  )}
                  {data.member?.left_at && <span className="text-muted-foreground">вышел: {data.member.left_at}</span>}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {data.member?.comp ? (
                <button
                  disabled={compBusy}
                  onClick={() => comp(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                >
                  Отозвать комплимент
                </button>
              ) : (
                <button
                  disabled={compBusy}
                  onClick={() => comp(true)}
                  className="rounded-lg border border-purple-500/50 px-3 py-1.5 text-xs text-purple-500 hover:bg-purple-500/10 disabled:opacity-50"
                >
                  💝 Дать комплимент-подписку
                </button>
              )}
            </div>

            {data.scheduled_posts.length > 0 && (
              <div>
                <div className="mb-2 font-medium">Отложенные посты ({data.scheduled_posts.length})</div>
                <ul className="space-y-1">
                  {data.scheduled_posts.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-xs">
                      <span
                        className={
                          p.status === 'published'
                            ? 'rounded-full bg-green-500/15 px-2 py-0.5 text-green-600 dark:text-green-400'
                            : p.status === 'failed'
                              ? 'rounded-full bg-red-500/15 px-2 py-0.5 text-red-500'
                              : 'rounded-full bg-blue-500/15 px-2 py-0.5 text-blue-500'
                        }
                      >
                        {p.status === 'published' ? 'опубликован' : p.status === 'failed' ? 'ошибка' : 'ждёт'}
                      </span>
                      <span className="truncate">{p.title}</span>
                      {p.published_url && (
                        <a href={p.published_url} target="_blank" rel="noreferrer" className="ml-auto shrink-0 text-blue-500 hover:underline">
                          ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-2 font-medium">История членства</div>
              {data.membership_events.length === 0 ? (
                <div className="text-xs text-muted-foreground">нет событий</div>
              ) : (
                <ul className="space-y-1">
                  {data.membership_events.map((e, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className={e.event_type === 'joined' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {e.event_type === 'joined' ? 'вступил' : e.event_type === 'left' ? 'вышел' : 'триал исчерпан'}
                      </span>
                      <span className="text-muted-foreground">{e.detected_at}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <details>
              <summary className="mb-2 cursor-pointer select-none font-medium">
                Последние запросы{' '}
                <span className="text-xs text-muted-foreground">({data.recent_requests.length})</span>
              </summary>
              {data.recent_requests.length === 0 ? (
                <div className="text-xs text-muted-foreground">запросов нет</div>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-y-auto">
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
            </details>
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
  const settingsData = useSettings().data
  const groupInfo = useGroupInfo()
  const posts = usePosts()
  const members = useMembers()
  const [tab, setTab] = useState('overview')
  const [stateFilter, setStateFilter] = useState<UsersFilter>('all')
  const users = useUsers(stateFilter)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const selectState = (s: UsersFilter) => {
    setStateFilter(s)
    setTab('users')
  }
  const openPosts = () => setTab('posts')
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

  const handleSetStatus = async (u: DashboardUser, status: 'auto' | UserState) => {
    const names: Record<string, string> = {
      auto: 'авто (убрать ручной статус)',
      trial: 'чистый триал',
      watermark: 'вотермарк',
      subscribed: 'подписан',
      trial_expired: 'просрочен',
      churned: 'отписался',
    }
    if (!confirm(`Выставить статус «${names[status]}» для ${u.display_name}?`)) return
    setBusy(u.skool_user_id)
    try {
      const r = await setUserStatus(u.skool_user_id, status)
      if (!r.success) alert(`Ошибка: ${r.error}`)
    } finally {
      setBusy(null)
      users.reload()
    }
  }

  const handleComp = async (userId: string, compNext: boolean) => {
    if (!confirm(compNext ? 'выдать комплимент-подписку (доступ без оплаты)?' : 'отозвать комплимент-подписку?')) return
    setBusy(userId)
    try {
      const r = await setComp(userId, compNext)
      if (!r.success) alert(`Ошибка: ${r.error}`)
    } finally {
      setBusy(null)
      users.reload()
    }
  }

  const handleFunnelClick = (stage: string) => {
    const map: Record<string, UsersFilter> = {
      trial_active: 'trial',
      subscribed: 'subscribed',
      trial_expired: 'trial_expired',
      churned: 'churned',
    }
    const f = map[stage]
    if (f) selectState(f)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">Magic Writer · Monetization Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              Триал → подписка через сообщество · воронка и конверсия ·{' '}
              <span title="версия сборки">build {__BUILD_ID__}</span>
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

      <main className="mx-auto w-full max-w-screen-2xl px-6 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="users">Пользователи</TabsTrigger>
            <TabsTrigger value="members">Члены группы</TabsTrigger>
            <TabsTrigger value="posts">Посты</TabsTrigger>
            <TabsTrigger value="finance">Финансы</TabsTrigger>
            <TabsTrigger value="settings">Настройки</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <KpiCards stats={stats.data} activeState={stateFilter} onSelectState={selectState} onOpenPosts={openPosts} />
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4 lg:col-span-1">
                <div className="mb-2 text-sm font-medium">Воронка (клик — список)</div>
                <FunnelChart funnel={funnel.data} dark={isDark} onStageClick={handleFunnelClick} />
              </div>
              <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
                <div className="mb-2 text-sm font-medium">Новые юзеры и подписчики (30 дней)</div>
                <DailyChart stats={stats.data} dark={isDark} />
              </div>
            </div>
            <DailyBreakdown daily={stats.data?.daily} finance={settingsData?.finance} price={stats.data?.community_price ?? 0} />
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 text-sm font-medium">Членство сообщества во времени</div>
              <MembershipChart stats={stats.data} dark={isDark} />
            </div>
            <EventFeed events={events.data?.events ?? null} onOpenUser={setDetailId} />
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
              onSelectUser={(u) => setDetailId(u.skool_user_id)}
              onAdjust={handleAdjust}
              onToggleBan={handleToggleBan}
              onToggleComp={handleComp}
              onSetStatus={handleSetStatus}
              busy={busy}
            />
          </TabsContent>

          <TabsContent value="members">
            <MembersTable
              members={members.data?.members ?? null}
              total={members.data?.total ?? 0}
              onSelectUser={(skoolUserId) => setDetailId(skoolUserId)}
            />
          </TabsContent>

          <TabsContent value="posts">
            <PostsTable posts={posts.data?.posts ?? null} onOpenUser={setDetailId} />
          </TabsContent>

          <TabsContent value="finance">
            <FinanceTab stats={stats.data} />
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
              <SyncPanel sync={sync.data?.sync ?? null} onDone={sync.reload} />
              <GroupInfoCard info={groupInfo.data} onReload={groupInfo.reload} />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {detailId && (
        <UserDetailDrawer userId={detailId} onClose={() => setDetailId(null)} onComp={handleComp} />
      )}
    </div>
  )
}
