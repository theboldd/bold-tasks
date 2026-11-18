import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

declare const __BUILD_ID__: string

/** Avisa quando uma versão nova foi publicada e a aba ainda está com a antiga. */
export function UpdateBanner() {
  const [stale, setStale] = useState(false)
  useEffect(() => {
    if (import.meta.env.DEV) return
    let alive = true
    const check = async () => {
      try {
        const r = await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const { build } = await r.json()
        if (alive && build && build !== __BUILD_ID__) setStale(true)
      } catch { /* offline */ }
    }
    check()
    const i = setInterval(check, 5 * 60 * 1000)
    const onVis = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', check)
    return () => { alive = false; clearInterval(i); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', check) }
  }, [])
  if (!stale) return null
  return (
    <div role="status" data-testid="update-banner" className="rise-in fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[90] flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2 text-[13px] text-off shadow-[0_14px_40px_-18px_rgba(21,19,19,.6)]">
      Há uma versão nova do BOLD TASKS.
      <button className="inline-flex items-center gap-1.5 rounded-full bg-off/15 px-3 py-1 font-medium transition hover:bg-off/25" onClick={() => window.location.reload()}><RefreshCw size={13} />Atualizar</button>
    </div>
  )
}
