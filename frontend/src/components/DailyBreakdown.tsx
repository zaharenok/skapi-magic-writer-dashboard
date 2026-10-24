import type { DailyStat, FinanceSettings } from '../types'
import { Card } from './ui/card'

const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function weekday(dateStr: string): string {
  return WD[new Date(dateStr + 'T00:00:00Z').getUTCDay()]
}

export default function DailyBreakdown({
  daily,
  finance,
  price,
}: {
  daily?: DailyStat[]
  finance?: FinanceSettings
  price: number
}) {
  const rows = daily ?? []
  const costPerGen = finance
    ? (finance.avg_tokens_in * finance.ai_price_input +
        finance.avg_tokens_out * finance.ai_price_output) /
      1e6
    : 0
  const usd = (v: number) => '$' + v.toFixed(2)
  const total = {
    ai_requests: rows.reduce((s, r) => s + r.ai_requests, 0),
    posts_published: rows.reduce((s, r) => s + r.posts_published, 0),
    joined: rows.reduce((s, r) => s + r.joined, 0),
    left: rows.reduce((s, r) => s + r.left, 0),
  }
  return (
    <Card>
      <details>
        <summary className="cursor-pointer select-none p-3 text-sm font-medium">
          По дням — расход и подписки{' '}
          <span className="text-muted-foreground">({rows.length})</span>
        </summary>
        <div className="max-h-96 overflow-auto border-t border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Дата</th>
                <th className="px-3 py-2 font-medium">День</th>
                <th className="px-3 py-2 text-right font-medium">Новые</th>
                <th className="px-3 py-2 text-right font-medium">Запросы</th>
                <th className="px-3 py-2 text-right font-medium">AI</th>
                <th className="px-3 py-2 text-right font-medium">Расход, $</th>
                <th className="px-3 py-2 text-right font-medium">Посты</th>
                <th className="px-3 py-2 text-right font-medium">Подписки, $</th>
                <th className="px-3 py-2 text-right font-medium">Вышли</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    Нет данных
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.date} className="border-t border-border/50">
                    <td className="px-3 py-1.5 font-mono text-xs">{r.date.slice(5)}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{weekday(r.date)}</td>
                    <td className="px-3 py-1.5 text-right">{r.new_users || ''}</td>
                    <td className="px-3 py-1.5 text-right">{r.requests || ''}</td>
                    <td className="px-3 py-1.5 text-right">{r.ai_requests || ''}</td>
                    <td className="px-3 py-1.5 text-right text-red-500">
                      {r.ai_requests ? usd(r.ai_requests * costPerGen) : ''}
                    </td>
                    <td className="px-3 py-1.5 text-right">{r.posts_published || ''}</td>
                    <td className="px-3 py-1.5 text-right text-green-600 dark:text-green-400">
                      {r.joined ? usd(r.joined * price) : ''}
                    </td>
                    <td className="px-3 py-1.5 text-right text-red-500">{r.left || ''}</td>
                  </tr>
                ))
              )}
              {rows.length > 0 && (
                <tr className="border-t border-border bg-muted/40 font-medium">
                  <td className="px-3 py-1.5" colSpan={5}>
                    Итого
                  </td>
                  <td className="px-3 py-1.5 text-right text-red-500">
                    {usd(total.ai_requests * costPerGen)}
                  </td>
                  <td className="px-3 py-1.5 text-right">{total.posts_published}</td>
                  <td className="px-3 py-1.5 text-right text-green-600 dark:text-green-400">
                    {usd(total.joined * price)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-red-500">{total.left}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  )
}
