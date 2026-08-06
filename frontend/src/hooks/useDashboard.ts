import { useState, useEffect, useCallback } from 'react'
import type { DashboardStats, User, UsersResponse } from '@/types'

const API_BASE = ''

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ═══════════════════════════════════════════════
// useStats — агрегированные метрики
// Обновляется автоматически каждые 30 секунд
// ═══════════════════════════════════════════════
export function useStats(fromDate: string, toDate: string = '', allTime: boolean = false) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (allTime) {
        params.set('all_time', 'true')
      } else {
        if (fromDate) params.set('from_date', fromDate)
        if (toDate) params.set('to_date', toDate)
      }
      const d = await fetchJson<DashboardStats>(`${API_BASE}/api/dashboard-stats?${params}`)
      setStats(d)
    } catch (e) {
      console.error('Failed to load stats', e)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, allTime])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  return { stats, loading, refetch: load }
}

// ═══════════════════════════════════════════════
// useUsers — список пользователей по фильтру
// ═══════════════════════════════════════════════
export function useUsers(filter: string, fromDate: string, toDate: string = '', activeOnly: boolean = false, allTime: boolean = false) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('filter', filter)
      if (allTime) {
        params.set('all_time', 'true')
      } else {
        if (fromDate) params.set('from_date', fromDate)
        if (toDate) params.set('to_date', toDate)
      }
      if (activeOnly) params.set('active_only', 'true')
      const d = await fetchJson<UsersResponse>(`${API_BASE}/api/dashboard-users?${params}`)
      setUsers(d.users)
    } catch (e) {
      console.error('Failed to load users', e)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [filter, fromDate, toDate, activeOnly, allTime])

  return { users, loading, load }
}
