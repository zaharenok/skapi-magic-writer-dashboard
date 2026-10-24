import { useEffect, useRef, useState } from 'react'
import type { SyncRun } from '../types'
import { saveSettings, triggerSync, useSettings } from '../hooks/useDashboard'
import { cn } from '../lib/utils'

export default function SyncPanel({ sync, onDone }: { sync: SyncRun | null; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const settings = useSettings()
  const [slug, setSlug] = useState('')
  const [slugDirty, setSlugDirty] = useState(false)
  const [slugSaved, setSlugSaved] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const prefilled = useRef(false)

  useEffect(() => {
    if (!prefilled.current && settings.data) {
      setSlug(settings.data.community_slug || '')
      prefilled.current = true
    }
  }, [settings.data])

  const run = async () => {
    setBusy(true)
    setMsg(null)
    const res = await triggerSync()
    if (res.success) {
      setMsg('Синхронизация запущена')
      setTimeout(onDone, 3000)
    } else {
      setMsg(`Ошибка: ${res.error || 'неизвестно'}`)
    }
    setBusy(false)
  }

  const save = async () => {
    const s = slug.trim().replace(/\/+$/, '')
    if (!s) {
      setSlugSaved(false)
      setMsg('Введите slug сообщества')
      return
    }
    setSaving(true)
    setMsg(null)
    const res = await saveSettings(s)
    if (res.success) {
      setSlugSaved(true)
      setSlugDirty(false)
      setMsg('Slug сохранён — синхронизация использует его')
      setTimeout(() => setMsg(null), 4000)
    } else {
      setSlugSaved(false)
      setMsg(`Ошибка сохранения: ${res.error || 'неизвестно'}`)
    }
    setSaving(false)
  }

  const statusColor =
    sync?.status === 'success' ? 'text-green-600 dark:text-green-400' : sync?.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">Синхронизация сообщества</div>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Запуск…' : 'Синхронизировать сейчас'}
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value)
            setSlugDirty(true)
            setSlugSaved(null)
          }}
          placeholder="slug сообщества (напр. my-community)"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus:border-ring"
        />
        <button
          onClick={save}
          disabled={saving}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
      {slugDirty && !slugSaved && (
        <div className="mb-2 -mt-1 text-xs text-amber-600 dark:text-amber-400">
          Изменения не сохранены — нажмите «Сохранить»
        </div>
      )}

      {sync ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Сообщество</dt>
          <dd className="truncate font-mono" title={sync.community_slug}>
            {sync.community_slug || '—'}
          </dd>
          <dt className="text-muted-foreground">Статус</dt>
          <dd className={cn('font-medium', statusColor)}>
            {sync.status === 'success' ? 'успех' : sync.status === 'error' ? 'ошибка' : 'выполняется'}
          </dd>
          <dt className="text-muted-foreground">Членов найдено</dt>
          <dd>{sync.members_found}</dd>
          <dt className="text-muted-foreground">Вступили / вышли</dt>
          <dd>
            +{sync.joined_count} / -{sync.left_count}
          </dd>
          <dt className="text-muted-foreground">Запуск</dt>
          <dd className="font-mono">{sync.started_at}</dd>
          {sync.error && (
            <>
              <dt className="text-muted-foreground">Ошибка</dt>
              <dd className="break-all text-red-600 dark:text-red-400">{sync.error}</dd>
            </>
          )}
        </dl>
      ) : (
        <div className="text-xs text-muted-foreground">Синхронизация ещё не запускалась</div>
      )}
      {msg && <div className="mt-2 text-xs text-muted-foreground">{msg}</div>}
    </div>
  )
}
