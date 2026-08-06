import { useState } from 'react'
import type { SyncRun } from '../types'
import { triggerSync } from '../hooks/useDashboard'
import { cn } from '../lib/utils'

export default function SyncPanel({ sync, onDone }: { sync: SyncRun | null; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

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
      {sync ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
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
