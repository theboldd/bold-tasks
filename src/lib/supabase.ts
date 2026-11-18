import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!url || !key) {
  throw new Error('Configuração ausente: VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY')
}

/** "Manter conectada" (padrão: sim). Quando desligado, a sessão fica só nesta aba. */
const REMEMBER = 'bt_remember'
export const getRemember = () => { try { return localStorage.getItem(REMEMBER) !== '0' } catch { return true } }
export function setRemember(v: boolean) {
  try { v ? localStorage.removeItem(REMEMBER) : localStorage.setItem(REMEMBER, '0') } catch { /* sem storage */ }
}
const store = () => (getRemember() ? localStorage : sessionStorage)
const authStorage = {
  getItem: (k: string) => { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k) } catch { return null } },
  setItem: (k: string, v: string) => { try { store().setItem(k, v); (getRemember() ? sessionStorage : localStorage).removeItem(k) } catch { /* cheio */ } },
  removeItem: (k: string) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k) } catch { /* nada */ } },
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: authStorage },
  realtime: { params: { eventsPerSecond: 10 } },
})

// Pede ao navegador para não apagar os dados do app (evita deslogar por limpeza automática).
try { navigator.storage?.persist?.() } catch { /* sem suporte */ }
