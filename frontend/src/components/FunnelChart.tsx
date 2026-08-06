import { Bar } from 'react-chartjs-2'
import type { Funnel } from '../types'
import { baseOptions, SERIES } from '../lib/charts'

const STAGES: { key: keyof Funnel; label: string }[] = [
  { key: 'total', label: 'Установили / видели' },
  { key: 'made_request', label: 'Сделали запрос' },
  { key: 'trial_active', label: 'Триал активен' },
  { key: 'subscribed', label: 'Подписались (оплата)' },
]

export default function FunnelChart({ funnel, dark }: { funnel: Funnel | null; dark: boolean }) {
  if (!funnel) return null
  const data = {
    labels: STAGES.map((s) => s.label),
    datasets: [
      {
        data: STAGES.map((s) => funnel[s.key]),
        backgroundColor: SERIES.map((c) => `${c}cc`),
        borderColor: SERIES,
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  }
  return (
    <div className="h-64">
      <Bar data={data} options={{ ...baseOptions(dark), indexAxis: 'y', plugins: { legend: { display: false } } }} />
    </div>
  )
}
