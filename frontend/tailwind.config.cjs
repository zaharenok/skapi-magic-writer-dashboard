/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Маппинг на CSS-переменные Astryx theme-neutral (см. theme.css)
        background: 'var(--color-background-body)',
        foreground: 'var(--color-text-primary)',
        card: 'var(--color-background-card)',
        popover: 'var(--color-background-popover)',
        muted: {
          DEFAULT: 'var(--color-background-muted)',
          foreground: 'var(--color-text-secondary)',
        },
        accent: {
          DEFAULT: 'var(--color-background-muted)',
          foreground: 'var(--color-text-primary)',
        },
        primary: {
          DEFAULT: 'var(--color-text-accent)',
          foreground: 'var(--color-background-body)',
        },
        secondary: {
          DEFAULT: 'var(--color-background-surface)',
          foreground: 'var(--color-text-primary)',
        },
        border: 'var(--color-border)',
        input: 'var(--color-border)',
        ring: 'var(--color-border-emphasized)',
      },
      borderRadius: {
        lg: 'var(--radius, 0.5rem)',
        md: 'calc(var(--radius, 0.5rem) - 2px)',
        sm: 'calc(var(--radius, 0.5rem) - 4px)',
      },
    },
  },
  plugins: [],
}
