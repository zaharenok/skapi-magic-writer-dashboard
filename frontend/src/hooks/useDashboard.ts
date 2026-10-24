import { useCallback, useEffect, useState } from 'react'
import type {
  DashboardSettings,
  DashboardStats,
  DashboardUser,
  SyncRun,
  MembershipEvent,
  Funnel,
  ScheduledPostRow,
  UserDetail,
  UserState,
} from '../types'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

function usePolling<T>(path: string, intervalMs = 30000): { data: T | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      get<T>(path)
        .then((d) => {
          if (!cancelled) {
            setData(d)
            setError(null)
          }
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e)
          if (!cancelled) setError(msg)
        })
    load()
    const id = setInterval(load, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [path, intervalMs, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, reload }
}

export function useDashboardData() {
  const stats = usePolling<DashboardStats>('/api/dashboard-stats')
  const funnel = usePolling<Funnel>('/api/funnel')
  const events = usePolling<{ events: MembershipEvent[] }>('/api/membership-events?limit=30', 60000)
  const sync = usePolling<{ sync: SyncRun | null }>('/api/sync-status', 15000)

  return { stats, funnel, events, sync }
}

export function useUsers(stateFilter: UserState | 'all') {
  const path = `/api/dashboard-users?state=${stateFilter === 'all' ? '' : stateFilter}&limit=200`
  const hook = usePolling<{ users: DashboardUser[] }>(path, 30000)
  return hook
}

export function useUserDetail(skoolUserId: string | null) {
  const path = skoolUserId ? `/api/users/${encodeURIComponent(skoolUserId)}` : ''
  const [data, setData] = useState<UserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!path) {
      setData(null)
      return
    }
    let cancelled = false
    get<UserDetail>(path)
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      })
      .catch((e) => !cancelled && setError(String(e?.message || e)))
    return () => {
      cancelled = true
    }
  }, [path])

  return { data, error }
}

export async function triggerSync(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/sync-trigger', { method: 'POST' })
    const json = await res.json()
    return json
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: msg }
  }
}

export function useSettings() {
  return usePolling<DashboardSettings>('/api/settings', 30000)
}

export async function saveSettings(
  communitySlug: string
): Promise<{ success: boolean; error?: string; community_slug?: string }> {
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ community_slug: communitySlug }),
    })
    return await res.json()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: msg }
  }
}

export function usePosts() {
  return usePolling<{ posts: ScheduledPostRow[] }>('/api/posts?limit=50', 20000)
}

export async function adjustPosts(
  skoolUserId: string,
  action: 'reset' | 'revoke' | 'bonus',
  posts = 0,
): Promise<{ success: boolean; error?: string; posts_used?: number; posts_limit?: number }> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(skoolUserId)}/posts-adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, posts }),
    })
    return await res.json()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: msg }
  }
}

export async function setBanned(
  skoolUserId: string,
  banned: boolean,
): Promise<{ success: boolean; error?: string; is_banned?: boolean }> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(skoolUserId)}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned }),
    })
    return await res.json()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: msg }
  }
}
