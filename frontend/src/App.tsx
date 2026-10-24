import { useState, useEffect } from 'react'
import { Theme } from '@astryxdesign/core'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'
import Dashboard from '@/components/Dashboard'

export default function App() {
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem('theme') === 'dark'
  )

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const toggleTheme = () => setIsDark(!isDark)

  return (
    <Theme theme={neutralTheme} mode={isDark ? 'dark' : 'light'}>
      <Dashboard isDark={isDark} onToggleTheme={toggleTheme} />
    </Theme>
  )
}
