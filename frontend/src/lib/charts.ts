import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
)

export const GRID_COLOR = 'rgba(128, 128, 128, 0.15)'
export const FONT_COLOR = 'rgba(128, 128, 128, 0.9)'

/** Последовательная палитра для серий. */
export const SERIES = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7']

export const baseOptions = (dark: boolean) => ({
  responsive: true,
  maintainAspectRatio: false,
  color: FONT_COLOR,
  borderColor: GRID_COLOR,
  plugins: {
    legend: {
      labels: { color: FONT_COLOR, boxWidth: 12, boxHeight: 12 },
    },
    tooltip: {
      backgroundColor: dark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.95)',
      titleColor: dark ? '#eee' : '#111',
      bodyColor: dark ? '#ccc' : '#333',
      borderColor: GRID_COLOR,
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      grid: { color: 'transparent' },
      ticks: { color: FONT_COLOR },
    },
    y: {
      grid: { color: GRID_COLOR },
      ticks: { color: FONT_COLOR, precision: 0 },
    },
  },
} as const)
