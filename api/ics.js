// Busca um calendário iCal em nome do servidor do BOLD TASKS.
// Existe porque o Google limita (429) requisições vindas da infraestrutura do Supabase.
// Protegido por segredo compartilhado e restrito a provedores de agenda conhecidos.
const ALLOWED = ['calendar.google.com', 'outlook.office365.com', 'outlook.live.com', 'p01-caldav.icloud.com']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  if (!process.env.ICS_PROXY_SECRET || req.headers['x-proxy-secret'] !== process.env.ICS_PROXY_SECRET) return res.status(401).json({ error: 'unauthorized' })
  let url
  try { url = new URL(String((req.body && req.body.url) || '').replace(/^webcal:/, 'https:')) } catch { return res.status(400).json({ error: 'url' }) }
  const host = url.hostname
  if (url.protocol !== 'https:' || !ALLOWED.some(h => host === h || host.endsWith('.icloud.com'))) return res.status(400).json({ error: 'host' })
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BOLD-TASKS/1.0)' } })
  const text = await r.text()
  res.setHeader('Cache-Control', 'no-store')
  return res.status(r.status).send(text)
}
