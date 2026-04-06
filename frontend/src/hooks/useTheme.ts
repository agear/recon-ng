import { useEffect, useState } from 'react'

export function useTheme() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const h = document.documentElement
    h.classList.toggle('dark', dark)
    h.style.colorScheme = dark ? 'dark' : 'light'
    localStorage.setItem('recon_ng_theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark(d => !d) }
}
