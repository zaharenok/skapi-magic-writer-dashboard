import { useEffect, useState } from 'react'
import type { DashboardStats, Expense, FinanceSettings } from '../types'
import { saveFinance, useSettings } from '../hooks/useDashboard'
import { Card } from './ui/card'
import { Plus, X } from 'lucide-react'

const FIELDS: { key: keyof FinanceSettings; label: string; hint: string }[] = [
  { key: 'ai_price_input', label: 'Цена входа, $/1М', hint: 'GLM-4.7 input' },
  { key: 'ai_price_output', label: 'Цена выхода, $/1М', hint: 'GLM-4.7 output' },
  { key: 'avg_tokens_in', label: 'Ср. токенов вход', hint: 'промпт генерации' },
  { key: 'avg_tokens_out', label: 'Ср. токенов выход', hint: 'ответ генерации' },
]

const usd = (v: number) =>
  '$' + (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2))

export default function FinanceTab({ stats }: { stats: DashboardStats | null }) {
  const settings = useSettings()
  const [form, setForm] = useState<FinanceSettings | null>(null)
  const [expenses, setExpenses] = useState<Expense[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (settings.data?.finance && !form) setForm({ ...settings.data.finance })
    if (settings.data?.expenses && !expenses) {
      setExpenses(settings.data.expenses.map((e) => ({ ...e })))
    }
  }, [settings.data])

  const fin = form ?? settings.data?.finance
  const rows = expenses ?? settings.data?.expenses ?? []
  const price = stats?.community_price ?? 0
  const subscribed = stats?.states.subscribed ?? 0
  const aiMonth = stats?.ai_this_month ?? 0
  const genTotal = stats?.generations_total ?? 0
  const dailyAi = (stats?.daily ?? []).reduce((s, r) => s + r.ai_requests, 0)

  const costPerGen =
    fin ? ((fin.avg_tokens_in * fin.ai_price_input + fin.avg_tokens_out * fin.ai_price_output) / 1e6) : 0
  const aiCostMonth = aiMonth * costPerGen
  const mrr = subscribed * price
  const expTotal = rows.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const profit = mrr - aiCostMonth - expTotal
  const margin = mrr > 0 ? Math.round((profit / mrr) * 100) : 0

  const setRow = (i: number, patch: Partial<Expense>) =>
    setExpenses((prev) =>
      prev ? prev.map((r, j) => (j === i ? { ...r, ...patch } : r)) : prev
    )

  const addRow = () =>
    setExpenses((prev) => [...(prev ?? []), { name: '', amount: 0 }])

  const delRow = (i: number) =>
    setExpenses((prev) => (prev ? prev.filter((_, j) => j !== i) : prev))

  const save = async () => {
    if (!form || !expenses) return
    setSaving(true)
    setMsg('')
    const clean = expenses
      .filter((e) => e.name.trim())
      .map((e) => ({ name: e.name.trim(), amount: Number(e.amount) || 0 }))
    const res = await saveFinance(form, clean)
    setSaving(false)
    setMsg(res.success ? '✅ Сохранено' : '⚠️ ' + (res.error || 'ошибка'))
    if (res.success) {
      setExpenses(res.expenses ? res.expenses.map((e) => ({ ...e })) : null)
      settings.reload()
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Доход (MRR)</div>
          <div className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">
            {usd(mrr)}
            <span className="text-sm font-normal text-muted-foreground">/мес</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {subscribed} × {usd(price)} · комплименты не платят
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Расход AI (оценка)</div>
          <div className="mt-1 text-2xl font-semibold">{usd(aiCostMonth)}<span className="text-sm font-normal text-muted-foreground">/мес</span></div>
          <div className="mt-1 text-xs text-muted-foreground">
            {aiMonth} ген. × ≈{usd(costPerGen)} · 30дн: {dailyAi}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Расходы (фикс.)</div>
          <div className="mt-1 text-2xl font-semibold">{usd(expTotal)}<span className="text-sm font-normal text-muted-foreground">/мес</span></div>
          <div className="mt-1 text-xs text-muted-foreground">{rows.length} поз. · список ниже</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Прибыль</div>
          <div className={`mt-1 text-2xl font-semibold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
            {usd(profit)}<span className="text-sm font-normal text-muted-foreground">/мес</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">маржа {margin}% при текущем MRR</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-sm font-medium">Регулярные расходы, $/мес</div>
        <div className="mt-1 text-xs text-muted-foreground">
          VPS, домен, подписки на сервисы, реклама — всё, что списывается каждый месяц.
        </div>
        <div className="mt-3 space-y-2">
          {rows.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="w-64 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                placeholder="Название (Z.ai, VPS…)"
                value={e.name}
                onChange={(ev) => setRow(i, { name: ev.target.value })}
              />
              <input
                type="number"
                step="any"
                min="0"
                className="w-28 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                value={String(e.amount)}
                onChange={(ev) => setRow(i, { amount: parseFloat(ev.target.value) || 0 })}
              />
              <button
                onClick={() => delRow(i)}
                className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Удалить"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="text-xs text-muted-foreground">Пока пусто — добавьте первый расход.</div>
          )}
          <button
            onClick={addRow}
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent"
          >
            <Plus size={14} /> Добавить расход
          </button>
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <div className="text-sm font-medium">Константы оценки AI</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Счётчик генераций за всё время: {genTotal}. Расход считается по журналу
            генераций (ведётся с 25.10) × средняя стоимость генерации — это оценка,
            точные токены Z.ai в ответах не логируются.
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs text-muted-foreground">{f.label}</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                  value={form ? String(form[f.key]) : ''}
                  title={f.hint}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, [f.key]: parseFloat(e.target.value) || 0 } : prev
                    )
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || !form || !expenses}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </Card>
    </div>
  )
}
