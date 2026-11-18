import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!url || !key) {
  throw new Error('Configuração ausente: VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
})
