import { useEffect, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'bt_theme'
const mq = () => window.matchMedia('(prefers-color-scheme: dark)')

export function readTheme(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system' } catch { return 'system' }
}
export function applyTheme(pref: ThemePref = readTheme()) {
  const dark = pref === 'dark' || (pref === 'system' && mq().matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141212' : '#F5F2ED')
}
/** Preferência de tema (Sistema / Claro / Escuro), sincronizada entre abas e com o sistema. */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readTheme)
  useEffect(() => {
    applyTheme(pref)
    const m = mq(); const on = () => readTheme() === 'system' && applyTheme('system')
    m.addEventListener('change', on)
    const st = (e: StorageEvent) => { if (e.key === KEY) { setPref(readTheme()) } }
    window.addEventListener('storage', st)
    return () => { m.removeEventListener('change', on); window.removeEventListener('storage', st) }
  }, [pref])
  const set = (p: ThemePref) => { try { p === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, p) } catch { /* sem storage */ } setPref(p) }
  return [pref, set] as const
}
