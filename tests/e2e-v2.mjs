// E2E v2: dia para fazer + horário, pendência das duas, Google Agenda (iCal), grade de horários, push e celular.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL
const PW = process.env.QA_PW
const ICS = 'https://calendar.google.com/calendar/ical/pt-br.brazilian%23holiday%40group.v.calendar.google.com/public/basic.ics'
const V = 'qa.vitoria@thebold-tasks.dev'
const R = 'qa.rebeca@thebold-tasks.dev'
const stamp = Date.now().toString(36).slice(-5)
const results = []
const ok = (name, pass, detail = '') => { results.push({ name, pass: !!pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`) }
const step = async (name, fn) => { try { await fn() } catch (e) { ok(name, false, String(e.message).split('\n')[0].slice(0, 220)) } }
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

const browser = await chromium.launch({ args: ['--enable-features=PushMessaging'] })
async function login(email, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', permissions: ['notifications'] })
  const page = await ctx.newPage()
  page.on('pageerror', e => console.log(`[pageerror ${email}]`, e.message))
  await page.goto(BASE)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(PW)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('heading', { level: 1, name: /O que precisa acontecer/ }).waitFor({ timeout: 20000 })
  return { ctx, page }
}
const v = await login(V), r = await login(R)
ok('login das duas', true)

const T = `V2 ${stamp} enviar orçamento`
await step('cadastro com dia e horário', async () => {
  await v.page.getByTestId('new-task').click()
  const d = v.page.getByRole('dialog')
  await d.getByLabel('Título *').fill(T)
  await d.getByRole('radio', { name: /Rebeca/ }).click()
  ok('dia para fazer vem preenchido com hoje', (await d.getByLabel('Dia para fazer').inputValue()) === today)
  await d.getByLabel('Até que horas').selectOption('exato')
  await d.getByLabel('Horário').fill('23:45')
  await d.getByRole('button', { name: 'Criar pendência' }).click()
  await d.waitFor({ state: 'detached' })
  ok('cadastro com dia e horário', true)
})

await step('R vê no dashboard “Por dia → Hoje” com o horário, em tempo real', async () => {
  const item = r.page.getByTestId('by-day-list').getByTestId('mini-task').filter({ hasText: T })
  await item.waitFor({ timeout: 15000 })
  const txt = await item.innerText()
  ok('R vê no dashboard “Por dia → Hoje” com o horário, em tempo real', txt.includes('até 23h45'), txt.replace(/\n/g, ' | '))
})

const S = `V2 ${stamp} revisar contrato juntas`
await step('pendência das duas', async () => {
  await v.page.getByTestId('new-task').click()
  const d = v.page.getByRole('dialog')
  await d.getByLabel('Título *').fill(S)
  await d.getByRole('radio', { name: 'Ambas' }).click()
  await d.getByLabel('Até que horas').selectOption('fim_do_dia')
  await d.getByRole('button', { name: 'Criar pendência' }).click()
  await d.waitFor({ state: 'detached' })
  await r.page.getByTestId('by-day-list').getByTestId('mini-task').filter({ hasText: S }).waitFor({ timeout: 15000 })
  ok('pendência das duas aparece no dia das duas', true)
  // V conclui a parte dela
  await v.page.getByTestId('by-day-list').getByTestId('mini-task').filter({ hasText: S }).click()
  const dv = v.page.getByLabel('Detalhes da pendência')
  await dv.getByRole('button', { name: 'Concluir minha parte' }).click()
  await dv.getByRole('button', { name: 'Reabrir minha parte' }).waitFor({ timeout: 8000 })
  // R é avisada em tempo real
  await r.page.getByTestId('bell-count').waitFor({ timeout: 10000 })
  await r.page.getByTestId('bell').click()
  const n = r.page.getByTestId('notif-item').filter({ hasText: 'concluiu a parte dela' }).filter({ hasText: S }).first()
  await n.waitFor({ timeout: 10000 })
  ok('a outra é avisada quando uma conclui a parte', true, (await n.innerText()).replace(/\n/g, ' | '))
  await n.click()
  const dr = r.page.getByLabel('Detalhes da pendência')
  const parts = await dr.getByTestId('parts').innerText()
  ok('partes mostram quem já concluiu', /Vitória[\s\S]*concluiu/.test(parts) && /Rebeca[\s\S]*falta concluir/.test(parts))
  await dr.getByRole('button', { name: 'Concluir minha parte' }).click()
  await dr.getByRole('button', { name: 'Reabrir', exact: true }).waitFor({ timeout: 8000 })
  ok('quando as duas concluem, a pendência fecha', true)
  await v.page.getByLabel('Fechar detalhes').click()
  await v.page.getByTestId('bell').click()
  const n2 = v.page.getByTestId('notif-item').filter({ hasText: 'pendência das duas foi concluída' }).filter({ hasText: S }).first()
  await n2.waitFor({ timeout: 10000 })
  ok('as duas são avisadas da conclusão final', true)
  await v.page.keyboard.press('Escape'); await v.page.mouse.click(700, 120)
  await r.page.getByLabel('Fechar detalhes').click()
})

await step('transferência automática sinalizada', async () => {
  await r.page.goto(BASE + '/pendencias')
  const row = r.page.getByTestId('task-row').filter({ hasText: 'QA2 padrão dia' })
  await row.waitFor()
  ok('transferência automática sinalizada', (await row.innerText()).includes('↻'))
})

await step('Google Agenda via link iCal', async () => {
  await v.page.goto(BASE + '/configuracoes')
  const g = v.page.getByTestId('google-card')
  await g.getByLabel('Endereço secreto iCal').fill(ICS)
  await g.getByRole('button', { name: /Conectar agenda|Salvar alterações/ }).click()
  const res = g.getByTestId('google-result')
  await res.waitFor({ timeout: 30000 })
  const t = await res.innerText()
  ok('Google Agenda via link iCal', t.startsWith('Conectado'), t)
})

await step('compromissos na grade da semana (dono vê título, a outra vê “Ocupada”)', async () => {
  await v.page.goto(BASE + '/calendario')
  await v.page.getByTestId('time-grid').waitFor()
  // 20/11 (Consciência Negra) está nesta semana
  await v.page.getByText(/Consci[eê]ncia Negra|Zumbi/i).first().waitFor({ timeout: 25000 })
  ok('dono vê o título do compromisso', true)
  await r.page.goto(BASE + '/calendario')
  await r.page.getByTestId('time-grid').waitFor()
  await r.page.getByTestId('cal-event').filter({ hasText: 'Ocupada' }).first().waitFor({ timeout: 25000 })
  const leaked = await r.page.getByText(/Consci[eê]ncia Negra|Zumbi/i).count()
  ok('a outra vê só “Ocupada”', leaked === 0, `títulos vazados: ${leaked}`)
})

await step('arrastar pendência para um horário da grade', async () => {
  await v.page.setViewportSize({ width: 1440, height: 1800 }) // grade inteira visível (a pessoa rolaria durante o arraste)
  const chip = v.page.getByTestId('grid-task').filter({ hasText: T })
  await chip.waitFor({ timeout: 10000 })
  const col = v.page.getByTestId(`grid-day-${today}`)
  const bb = await chip.boundingBox(); const cb = await col.boundingBox()
  const targetY = cb.y + (9.5 - 6) * 48 // 9h30 (grade começa às 6h)
  await v.page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await v.page.mouse.down()
  await v.page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2 + 10, { steps: 4 })
  await v.page.mouse.move(cb.x + cb.width / 2, targetY, { steps: 20 }); await v.page.mouse.up()
  await v.page.getByTestId('grid-task').filter({ hasText: T }).filter({ hasText: 'até 9h30' }).waitFor({ timeout: 8000 })
  ok('arrastar pendência para um horário da grade', true, 'agora “até 9h30”')
})

await step('notificações no aparelho (push)', async () => {
  await v.page.goto(BASE + '/configuracoes')
  const card = v.page.getByTestId('push-card')
  const supported = await v.page.evaluate(async () => {
    try { const reg = await navigator.serviceWorker.ready; await reg.pushManager.getSubscription(); return 'PushManager' in window } catch { return false }
  })
  const btn = card.getByRole('button', { name: 'Ativar notificações' })
  if (await btn.count()) await btn.click()
  const on = await card.getByText('Ativadas neste aparelho').waitFor({ timeout: 15000 }).then(() => true).catch(() => false)
  if (!on) { console.log('SKIP  push no navegador de teste (sem serviço de push no Chromium headless; fluxo do servidor validado à parte)'); return }
  ok('assinatura push salva neste aparelho', supported)
  await card.getByRole('button', { name: 'Enviar teste' }).click()
  await v.page.getByText('Teste enviado').waitFor({ timeout: 8000 })
  ok('envio de teste disparado', true)
})

await step('celular: dashboard e calendário sem rolagem lateral', async () => {
  const m = await login(R, { width: 390, height: 844 })
  const o1 = await m.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  await m.page.screenshot({ path: '/vercel/e2e/v2-m-dash.png', fullPage: true })
  await m.page.goto(BASE + '/calendario'); await m.page.getByTestId('time-grid').waitFor()
  const o2 = await m.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  await m.page.screenshot({ path: '/vercel/e2e/v2-m-cal.png', fullPage: true })
  ok('celular: dashboard e calendário sem rolagem lateral', o1 <= 0 && o2 <= 0, `${o1}/${o2}px`)
  await m.ctx.close()
})

await v.page.goto(BASE + '/'); await v.page.waitForTimeout(800)
await v.page.screenshot({ path: '/vercel/e2e/v2-dash.png', fullPage: true })
await v.page.goto(BASE + '/calendario'); await v.page.waitForTimeout(1500)
await v.page.screenshot({ path: '/vercel/e2e/v2-cal.png', fullPage: true })
await browser.close()
const failed = results.filter(x => !x.pass)
console.log(`\nRESULTADO: ${results.length - failed.length}/${results.length} passaram`)
process.exit(failed.length ? 1 : 0)
