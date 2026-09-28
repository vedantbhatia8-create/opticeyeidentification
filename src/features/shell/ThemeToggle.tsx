import { Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { useStore } from '../../state/store'

export function useApplyTheme() {
  const theme = useStore((s) => s.settings.theme)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

export function ThemeToggle() {
  const theme = useStore((s) => s.settings.theme)
  const setSettings = useStore((s) => s.setSettings)
  const dark = theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'))
  return (
    <button
      onClick={() => setSettings({ theme: dark ? 'light' : 'dark' })}
      className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink"
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
