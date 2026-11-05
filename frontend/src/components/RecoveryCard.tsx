import type { PaymentRecoveryStats } from '../types'

interface Props {
  data: { success: boolean; result?: PaymentRecoveryStats; error?: string } | null
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

/** «$ recovered» widget (Epic A, task A4) — reads /api/payment-recovery-stats. */
export default function RecoveryCard({ data }: Props) {
  const stats = data?.success ? data.result ?? null : null
  const money = stats ? `${fmt(stats.recovered_amount_usd)} $` : '—'

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">$ recovered</div>
      <div className="mt-1 text-2xl font-semibold">{money}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {stats
          ? `${fmt(stats.recovered_count)} members saved · ${fmt(stats.active_sequences)} sequences running · rate ${stats.recovery_rate}%`
          : data?.error
            ? data.error
            : 'waiting for Skapi backend…'}
      </div>
    </div>
  )
}
