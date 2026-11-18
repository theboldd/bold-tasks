// E2E do BOLD TASKS: duas usuárias reais (contas QA) em navegadores separados, contra a produção.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL
const PW = process.env.QA_PW
const V = 'qa.vitoria@thebold-tasks.dev'
const R = 'qa.rebeca@thebold-tasks.dev'
const stamp = Date.now().toString(36).slice(-5)
const results = []
const ok = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`) }
const step = async (name, fn) => { try { await fn() } catch (e) { ok(name, false, String(e.message).split('\n')[0].slice(0, 220)) } }

const iso = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
const tomorrow = iso(new Date(Date.now() + 86400000))
const yesterday = iso(new Date(Date.now() - 86400000))

const browser = await chromium.launch()
async function login(email, viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  const page = await ctx.newPage()
  page.on('pageerror', e => console.log(`[pageerror ${email}]`, e.message))
  await page.goto(BASE)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(PW)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('heading', { level: 1 }).filter({ hasText: /Bom dia|Boa tarde|Boa noite/ }).waitFor({ timeout: 20000 })
  return { ctx, page }
}

let v, r
await step('login das duas usuárias', async () => {
  v = await login(V, { width: 1440, height: 900 })
  r = await login(R, { width: 1440, height: 900 })
  ok('login das duas usuárias', true)
})

// login inválido
await step('login inválido mostra erro', async () => {
  const ctx = await browser.newContext(); const p = await ctx.newPage()
  await p.goto(BASE)
  await p.getByLabel('E-mail').fill(V); await p.getByLabel('Senha', { exact: true }).fill('senha-errada-123')
  await p.getByRole('button', { name: 'Entrar', exact: true }).click()
  await p.getByRole('alert').filter({ hasText: 'incorretos' }).waitFor({ timeout: 10000 })
  ok('login inválido mostra erro', true); await ctx.close()
})

await v.page.screenshot({ path: '/vercel/e2e/01-dashboard-desktop.png', fullPage: true })

const T1 = `E2E ${stamp} aprovar proposta do cliente`
await step('V cria pendência e atribui à R', async () => {
  await r.page.goto(BASE + '/pendencias')
  await v.page.goto(BASE + '/pendencias')
  await v.page.getByTestId('new-task').click()
  await v.page.getByLabel('Título *').fill(T1)
  await v.page.getByRole('radio', { name: /Rebeca/ }).click()
  await v.page.getByRole('dialog').getByLabel('Prazo').fill(tomorrow)
  await v.page.getByRole('dialog').getByLabel('Prioridade').selectOption('alta')
  await v.page.getByLabel('Descrição').fill('A proposta já está pronta, falta revisar os valores.')
  await v.page.getByRole('button', { name: 'Criar pendência' }).click()
  await v.page.getByTestId('task-row').filter({ hasText: T1 }).waitFor({ timeout: 10000 })
  ok('V cria pendência e atribui à R', true)
})

await step('R recebe a tarefa sem atualizar a página (realtime)', async () => {
  const t0 = Date.now()
  await r.page.getByTestId('task-row').filter({ hasText: T1 }).waitFor({ timeout: 15000 })
  ok('R recebe a tarefa sem atualizar a página (realtime)', true, `${Date.now() - t0} ms`)
})

await step('R recebe notificação da atribuição', async () => {
  await r.page.getByTestId('bell-count').waitFor({ timeout: 10000 })
  await r.page.getByTestId('bell').click()
  await r.page.getByTestId('notif-item').filter({ hasText: T1 }).first().waitFor({ timeout: 8000 })
  const txt = await r.page.getByTestId('notif-item').filter({ hasText: T1 }).first().innerText()
  ok('R recebe notificação da atribuição', /nova pendência/.test(txt), txt.replace(/\n/g, ' | '))
  await r.page.getByTestId('notif-item').filter({ hasText: T1 }).first().click()
  await r.page.getByLabel('Detalhes da pendência').waitFor()
  ok('notificação abre a pendência', true)
})

await step('detalhe mostra criadora e responsável corretas', async () => {
  const drawer = r.page.getByLabel('Detalhes da pendência')
  const text = await drawer.innerText()
  const assignee = await drawer.getByLabel('Responsável', { exact: true }).evaluate(el => el.options[el.selectedIndex].text)
  ok('detalhe mostra criadora e responsável corretas', /Criado por[\s\S]{0,20}Vitória/.test(text) && /Rebeca/.test(assignee), `responsável=${assignee}`)
})

await step('comentário chega em tempo real para a outra usuária', async () => {
  await v.page.getByTestId('task-row').filter({ hasText: T1 }).click()
  await v.page.getByLabel('Detalhes da pendência').waitFor()
  const drawerR = r.page.getByLabel('Detalhes da pendência')
  await drawerR.getByLabel('Novo comentário').fill('Vou conferir amanhã pela manhã.')
  await drawerR.getByRole('button', { name: 'Enviar comentário' }).click()
  await v.page.getByLabel('Detalhes da pendência').getByText('Vou conferir amanhã pela manhã.').waitFor({ timeout: 12000 })
  ok('comentário chega em tempo real para a outra usuária', true)
})

const T1b = T1 + ' (valores revisados)'
await step('ambas editam a mesma tarefa', async () => {
  const dv = v.page.getByLabel('Detalhes da pendência')
  const title = dv.getByLabel('Título')
  await title.fill(T1b); await title.press('Enter')
  await r.page.getByLabel('Detalhes da pendência').getByLabel('Status').selectOption('em_andamento')
  await r.page.waitForFunction((t) => [...document.querySelectorAll('textarea[aria-label="Título"]')].some(e => e.value === t), T1b, { timeout: 12000 })
  await v.page.waitForFunction(() => [...document.querySelectorAll('select[aria-label="Status"]')].some(e => e.value === 'em_andamento'), null, { timeout: 12000 })
  ok('ambas editam a mesma tarefa', true, 'título por V, status por R, refletidos nas duas telas')
})

await step('histórico da tarefa registra as alterações', async () => {
  const dv = v.page.getByLabel('Detalhes da pendência')
  await dv.getByRole('button', { name: 'Histórico' }).click()
  await dv.getByText('alterou o status').first().waitFor({ timeout: 8000 })
  const h = await dv.locator('ol').innerText()
  const need = ['criou a pendência', 'comentou', 'renomeou', 'alterou o status']
  ok('histórico da tarefa registra as alterações', need.every(n => h.includes(n)), need.filter(n => !h.includes(n)).join(',') || 'completo')
  await v.page.getByLabel('Fechar detalhes').click()
  await r.page.getByLabel('Fechar detalhes').click()
})

await step('R conclui direto na lista e V é notificada', async () => {
  await r.page.getByRole('button', { name: `Concluir “${T1b}”` }).click()
  // lista padrão mostra abertas: some das abertas para ambas
  await v.page.getByTestId('task-row').filter({ hasText: T1b }).waitFor({ state: 'detached', timeout: 12000 })
  await v.page.getByTestId('bell-count').waitFor({ timeout: 10000 })
  await v.page.getByTestId('bell').click()
  const item = v.page.getByTestId('notif-item').filter({ hasText: 'concluiu uma pendência' }).filter({ hasText: T1b }).first()
  await item.waitFor({ timeout: 8000 })
  ok('R conclui direto na lista e V é notificada', true)
  await item.click()
  const d = v.page.getByLabel('Detalhes da pendência')
  await d.getByText(/por .*Rebeca/).waitFor({ timeout: 8000 })
  ok('conclusão registra quem concluiu', true)
  await d.getByRole('button', { name: 'Reabrir' }).click()
  await d.getByRole('button', { name: 'Concluir' }).waitFor()
  await v.page.getByLabel('Fechar detalhes').click()
  await r.page.getByTestId('task-row').filter({ hasText: T1b }).waitFor({ timeout: 12000 })
  ok('reabertura volta a tarefa para as abertas (nas duas telas)', true)
})

const T2 = `E2E ${stamp} atualizar o site`
await step('tarefa atrasada identificada automaticamente', async () => {
  await v.page.getByTestId('new-task').click()
  await v.page.getByLabel('Título *').fill(T2)
  await v.page.getByRole('radio', { name: /Vitória/ }).click()
  await v.page.getByRole('dialog').getByLabel('Prazo').fill(yesterday)
  await v.page.getByRole('button', { name: 'Criar pendência' }).click()
  const row = v.page.getByTestId('task-row').filter({ hasText: T2 })
  await row.waitFor()
  ok('tarefa atrasada identificada automaticamente', /atrasada/i.test(await row.innerText()))
})

await step('responsável obrigatório no cadastro', async () => {
  await v.page.getByTestId('new-task').click()
  await v.page.getByLabel('Título *').fill('sem responsável')
  await v.page.getByRole('button', { name: 'Criar pendência' }).click()
  await v.page.getByText('Selecione quem vai executar.').waitFor({ timeout: 4000 })
  ok('responsável obrigatório no cadastro', true)
  await v.page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
})

const Q = `E2E ${stamp} Rebeca precisa revisar o planejamento de dezembro até quarta`
await step('captura rápida sem preencher campos', async () => {
  await v.page.keyboard.press('q')
  await v.page.getByLabel('Texto da captura').fill(Q)
  await v.page.getByRole('button', { name: 'Registrar captura' }).click()
  await v.page.getByTestId('task-row').filter({ hasText: Q }).waitFor({ timeout: 10000 })
  const rowTxt = await v.page.getByTestId('task-row').filter({ hasText: Q }).innerText()
  ok('captura rápida sem preencher campos', /A classificar/i.test(rowTxt))
  await r.page.goto(BASE + '/a-classificar')
  await r.page.getByTestId('task-row').filter({ hasText: Q }).waitFor({ timeout: 10000 })
  ok('captura visível para a outra usuária em “A classificar”', true)
  await r.page.getByTestId('task-row').filter({ hasText: Q }).click()
  const d = r.page.getByLabel('Detalhes da pendência')
  await d.getByLabel('Responsável da captura').selectOption({ label: 'Rebeca (QA)' })
  await d.getByRole('button', { name: 'Confirmar classificação' }).click()
  await d.getByLabel('Responsável', { exact: true }).waitFor({ timeout: 8000 })
  ok('classificação da captura', true)
  await r.page.getByLabel('Fechar detalhes').click()
})

await step('lista e Kanban apresentam os mesmos dados', async () => {
  await v.page.goto(BASE + '/pendencias?view=list')
  await v.page.getByTestId('task-row').first().waitFor()
  const listIds = await v.page.getByTestId('task-row').evaluateAll(els => els.map(e => e.dataset.taskId).sort())
  await v.page.goto(BASE + '/pendencias?view=kanban')
  await v.page.getByTestId('kanban-card').first().waitFor()
  const kbIds = await v.page.getByTestId('kanban-card').evaluateAll(els => els.map(e => e.dataset.taskId).sort())
  ok('lista e Kanban apresentam os mesmos dados', JSON.stringify(listIds) === JSON.stringify(kbIds), `${listIds.length} vs ${kbIds.length}`)
  await v.page.screenshot({ path: '/vercel/e2e/03-kanban.png', fullPage: true })
})

await step('Kanban: arrastar muda status', async () => {
  const card = v.page.getByTestId('kanban-card').filter({ hasText: T2 })
  const bb = await card.boundingBox(); const tb = await v.page.getByTestId('kanban-aguardando').boundingBox()
  await v.page.mouse.move(bb.x + bb.width / 2, bb.y + 10); await v.page.mouse.down()
  await v.page.mouse.move(bb.x + bb.width / 2 + 20, bb.y + 20, { steps: 5 })
  await v.page.mouse.move(tb.x + tb.width / 2, tb.y + 80, { steps: 15 }); await v.page.mouse.up()
  await v.page.getByTestId('kanban-aguardando').getByTestId('kanban-card').filter({ hasText: T2 }).waitFor({ timeout: 8000 })
  await r.page.goto(BASE + '/aguardando')
  await r.page.getByTestId('task-row').filter({ hasText: T2 }).waitFor({ timeout: 10000 })
  ok('Kanban: arrastar muda status (e aparece em Aguardando para a outra)', true)
})

await step('filtros combinados', async () => {
  await v.page.goto(BASE + '/pendencias')
  await v.page.getByTestId('toggle-filters').click()
  await v.page.getByLabel('Filtro Responsável').selectOption({ label: 'Rebeca (QA)' })
  await v.page.getByLabel('Filtro Prioridade').selectOption('alta')
  await v.page.getByLabel('Filtro Categoria').selectOption('the_bold')
  await v.page.waitForTimeout(400)
  const rows = await v.page.getByTestId('task-row').allInnerTexts()
  const hasT1 = rows.some(t => t.includes(T1b))
  const hasT2 = rows.some(t => t.includes(T2))
  await v.page.getByLabel('Filtro Prioridade').selectOption('baixa')
  await v.page.waitForTimeout(300)
  const rows2 = await v.page.getByTestId('task-row').allInnerTexts()
  ok('filtros combinados', hasT1 && !hasT2 && !rows2.some(t => t.includes(T1b)), `R+alta+TheBold=${rows.length}, trocando p/ baixa=${rows2.length}`)
})

await step('busca global', async () => {
  await v.page.getByLabel('Busca global').fill(stamp)
  await v.page.getByLabel('Busca global').press('Enter')
  await v.page.waitForURL(/pendencias\?q=/)
  await v.page.getByTestId('task-row').first().waitFor()
  const n = await v.page.getByTestId('task-row').count()
  ok('busca global', n >= 3, `${n} resultados para "${stamp}"`)
})

await step('minhas pendências e da outra (nomes dinâmicos)', async () => {
  await r.page.goto(BASE + '/minhas')
  await r.page.getByTestId('group-today').or(r.page.getByTestId('group-next')).or(r.page.getByTestId('group-doing')).first().waitFor({ timeout: 8000 })
  await r.page.getByRole('link', { name: /Pendências da Vitória/ }).waitFor({ timeout: 2000 })
  await v.page.getByRole('link', { name: /Pendências da Rebeca/ }).waitFor({ timeout: 2000 })
  const navR = await r.page.getByRole('navigation', { name: 'Menu principal' }).innerText()
  const navV = await v.page.getByRole('navigation', { name: 'Menu principal' }).innerText()
  ok('minhas pendências e da outra (nomes dinâmicos)', navR.includes('Pendências da Vitória') && navV.includes('Pendências da Rebeca'))
})

await step('calendário mostra prazos', async () => {
  await v.page.goto(BASE + '/calendario')
  await v.page.getByRole('button', { name: 'Mês' }).click()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  await v.page.getByTestId(`cal-day-${today}`).getByTestId('cal-chip').filter({ hasText: T1b }).waitFor({ timeout: 8000 })
  ok('calendário mostra prazos', true)
  await v.page.screenshot({ path: '/vercel/e2e/04-calendario.png', fullPage: true })
})

await step('histórico geral', async () => {
  await v.page.goto(BASE + '/historico')
  await v.page.getByTestId('history-item').first().waitFor()
  const t = await v.page.locator('main').innerText()
  ok('histórico geral', t.includes('concluiu a pendência') && t.includes('reabriu a pendência'))
})

await step('dashboard reflete indicadores', async () => {
  await v.page.goto(BASE + '/')
  const late = await v.page.getByTestId('kpi-Atrasadas').innerText()
  ok('dashboard reflete indicadores', Number(late.split('\n')[0]) >= 1, late.replace('\n', ' '))
})

await step('exclusão lógica', async () => {
  await v.page.goto(BASE + '/pendencias')
  await v.page.getByTestId('task-row').filter({ hasText: T2 }).click()
  const d = v.page.getByLabel('Detalhes da pendência')
  await d.getByRole('button', { name: 'Excluir pendência' }).click()
  await d.getByRole('button', { name: 'Confirmar exclusão' }).click()
  await v.page.getByTestId('task-row').filter({ hasText: T2 }).waitFor({ state: 'detached' })
  ok('exclusão lógica', true)
})

await step('responsividade (celular 390px)', async () => {
  const m = await login(R, { width: 390, height: 844 })
  await m.page.screenshot({ path: '/vercel/e2e/05-dashboard-mobile.png', fullPage: true })
  const overflow = await m.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  const fab = await m.page.getByTestId('fab-new').isVisible()
  await m.page.goto(BASE + '/pendencias')
  await m.page.getByTestId('task-row').first().waitFor()
  const overflow2 = await m.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  await m.page.screenshot({ path: '/vercel/e2e/06-lista-mobile.png', fullPage: true })
  await m.page.getByTestId('fab-new').click()
  await m.page.getByRole('dialog').waitFor()
  await m.page.screenshot({ path: '/vercel/e2e/07-cadastro-mobile.png' })
  ok('responsividade (celular 390px)', overflow <= 0 && overflow2 <= 0 && fab, `overflow=${overflow}/${overflow2}px, botão + visível=${fab}`)
  await m.ctx.close()
})

await step('screenshot detalhe', async () => {
  await v.page.goto(BASE + '/pendencias')
  await v.page.getByTestId('task-row').filter({ hasText: T1b }).click()
  await v.page.getByLabel('Detalhes da pendência').waitFor()
  await v.page.waitForTimeout(500)
  await v.page.screenshot({ path: '/vercel/e2e/02-detalhe.png' })
})

await browser.close()
const failed = results.filter(r => !r.pass)
console.log(`\nRESULTADO: ${results.length - failed.length}/${results.length} passaram`)
process.exit(failed.length ? 1 : 0)
