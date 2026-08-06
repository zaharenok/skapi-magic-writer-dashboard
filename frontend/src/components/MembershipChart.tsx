import { Chart } from 'react-chartjs-2'
import type { ChartData } from 'chart.js'
import type { DashboardStats } from '../types'
import { baseOptions, SERIES } from '../lib/charts'

/** Членство во времени: бары joined/left + линия cumulative members. */
export default function MembershipChart({ stats, dark }: { stats: DashboardStats | null; dark: boolean }) {
  if (!stats) return null
  const byDate = new Map<string, { joined: number; left: number }>()
  for (const e of stats.members_over_time) {
    const cur = byDate.get(e.date) || { joined: 0, left: 0 }
    cur[e.event_type === 'joined' ? 'joined' : 'left'] += e.count
    byDate.set(e.date, cur)
  }
  const dates = Array.from(byDate.keys()).sort()
  let cum = 0
  const cumulative = dates.map((d) => {
    cum += (byDate.get(d)?.joined || 0) - (byDate.get(d)?.left || 0)
    return cum
  })

  const data: ChartData<'bar' | 'line', number[], string> = {
    labels: dates.map((d) => d.slice(5)),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Вступили',
        data: dates.map((d) => byDate.get(d)?.joined || 0),
        backgroundColor: '#22c55e88',
        borderColor: '#22c55e',
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        type: 'bar' as const,
        label: 'Вышли',
        data: dates.map((d) => byDate.get(d)?.left || 0),
        backgroundColor: '#ef444488',
        borderColor: '#ef4444',
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        type: 'line' as const,
        label: 'Всего членов (net)',
        data: cumulative,
        borderColor: SERIES[0],
        backgroundColor: `${SERIES[0]}22`,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      },
    ],
  }
  return (
    <div className="h-64">
      <Chart type="bar" data={data} options={baseOptions(dark)} />
    </div>
  )
}
