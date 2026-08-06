import { Bar } from 'react-chartjs-2'
import type { DashboardStats } from '../types'
import { baseOptions } from '../lib/charts'

/** Дневные бары: новые юзеры (старты триала) + новые подписчики. */
export default function DailyChart({ stats, dark }: { stats: DashboardStats | null; dark: boolean }) {
  if (!stats) return null
  const dates = Object.keys(stats.daily_new_users).sort()
  const subs = Object.keys(stats.daily_new_subscribers).sort()
  const all = Array.from(new Set([...dates, ...subs])).sort().slice(-30)

  const data = {
    labels: all.map((d) => d.slice(5)),
    datasets: [
      {
        label: 'Новые юзеры (триалы)',
        data: all.map((d) => stats.daily_new_users[d] || 0),
        backgroundColor: '#6366f1aa',
        borderColor: '#6366f1',
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        label: 'Новые подписчики',
        data: all.map((d) => stats.daily_new_subscribers[d] || 0),
        backgroundColor: '#22c55eaa',
        borderColor: '#22c55e',
        borderWidth: 1,
        borderRadius: 3,
      },
    ],
  }
  return (
    <div className="h-64">
      <Bar data={data} options={{ ...baseOptions(dark), scales: { ...baseOptions(dark).scales, x: { stacked: true, grid: { color: 'transparent' }, ticks: { color: 'rgba(128,128,128,0.9)' } }, y: { stacked: true, grid: { color: 'rgba(128,128,128,0.15)' }, ticks: { color: 'rgba(128,128,128,0.9)', precision: 0 } } } }} />
    </div>
  )
}
