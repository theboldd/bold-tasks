# BOLD TASKS

Central compartilhada de pendências da The Bold (Vitória e Rebeca).

- **Produção:** https://bold-tasks-umber.vercel.app
- **Banco/Auth/Realtime:** Supabase, projeto `bold-tasks` (`zzlthiiythednklaioym`, região São Paulo)
- **Hospedagem:** Vercel, projeto `bold-tasks` (time "the bold")
- **Stack:** React 19 + TypeScript + Vite + Tailwind CSS 4 + Supabase (Postgres, Auth, Realtime, Edge Functions, pg_cron)

## Status — v2 (18/11/2026)

### Novidades da v2
| Recurso | Como funciona |
|---|---|
| **Dia para fazer** | Toda pendência tem um dia de execução (padrão: hoje), separado do **prazo final** (que marca atrasada). |
| **Transferência automática** | O que não for concluído no dia passa sozinho para o dia seguinte (agendador a cada 15 min no banco). Fica marcado ↻ N e registrado no histórico como "Sistema". |
| **Até que horas** | Horário exato ou janelas: final da manhã (12h), final da tarde (18h), fim do dia (20h). |
| **Dashboard "Por dia"** | Hoje, amanhã e os próximos 3 dias, ordenados por horário; alterna entre "Minhas" e "Todas". |
| **Pendência das duas** | Responsável "Ambas": cada uma conclui a sua parte; a outra é avisada ("Vitória concluiu a parte dela — falta a sua"); quando as duas concluem, fecha e as duas são avisadas. |
| **Lembretes personalizados** | "Rebeca, “X” precisa ser resolvida até 15h." (1h antes; 1h30 antes nas janelas) · aviso de horário passado · prazo final amanhã/hoje/atrasado · resumo do dia às 8h. Sem duplicidade. |
| **Push no celular e no PC** | Web Push (VAPID) com service worker; funciona com o sistema fechado. iPhone: adicionar à Tela de Início. Ativar em Configurações, em cada aparelho. |
| **Google Agenda** | Link secreto iCal (por pessoa, guardado só para a dona). Compromissos na grade de horários (Dia/Semana) e no mês; a outra vê "Ocupada" (opção de mostrar títulos). Cache de 15 min. Busca via `/api/ics` (Vercel), porque o Google limita a infraestrutura do Supabase. |
| **Grade de horários** | Calendário Dia/Semana de 6h à meia-noite: arrastar uma pendência para um horário define o dia e "até que horas". |
| **PWA** | Instalável (manifest + ícones). |

### Automações (todas no servidor)
- `bold-reminders` (pg_cron, a cada 15 min): `run_reminders()` → transferência automática + lembretes + resumo do dia.
- Trigger `notifications_push` → `pg_net` → Edge Function `send-push` (todas as notificações viram push nos aparelhos ativados).
- Triggers de histórico e notificações em `tasks`, `task_comments`, `task_parts`.

## Status — v1 (17/11/2026)

### Implementado
| Área | O que existe |
|---|---|
| Autenticação | Login por e-mail/senha. Primeiro acesso com **código de convite** (Edge Function `first-access`), conta criada já confirmada. Cadastro direto pela API bloqueado no banco. |
| Workspace | "The Bold" (real) e "QA — Testes automatizados" (isolado, contas de teste). Convites só para e-mails autorizados. |
| Pendências | Criar, ler, editar, exclusão lógica, atribuir, status, prioridade, categoria (The Bold / Pessoal — nome), prazo, descrição. |
| Captura rápida | Texto livre → pendência "A classificar" (sem responsável/categoria) → classificação posterior. |
| Visualizações | Dashboard (7 indicadores + 6 seções), Todas, Minhas, Pendências da outra (nome dinâmico), The Bold, Aguardando, A classificar, Calendário (mês/semana, arrastar muda prazo), Histórico (filtros por pessoa/ação). |
| Lista e Kanban | Mesmos dados e filtros; conclusão direto na lista; edição rápida (status/prazo); arrastar no Kanban muda status. |
| Filtros | Responsável, criado por, categoria, status, prioridade, prazo, atrasadas, sem prazo, a classificar — combináveis, na URL. Ordenação por prazo/prioridade/criação. Busca global. |
| Detalhe | Painel lateral com todos os campos, comentários e histórico em tempo real, conclusão/reabertura, exclusão com confirmação. |
| Notificações internas | Geradas por triggers no banco: atribuição, troca de responsável, comentário, prazo alterado, conclusão (para a criadora), reabertura. Sino com contador, marcar lida / todas, abrir a pendência. |
| Lembretes | `pg_cron` a cada 30 min: prazo amanhã, vence hoje, atrasada — sem duplicidade (`task_reminders`). |
| Histórico | `task_activity` preenchido por trigger (quem, o quê, valor anterior/novo). Nunca apagado. |
| Tempo real | Supabase Realtime em tarefas, notificações, comentários e atividade; ressincroniza ao reconectar/focar. |
| Segurança | RLS em todas as tabelas; permissões validadas no banco; `created_by`/conclusão definidos pelo servidor; notificações só com `is_read` editável; anon sem acesso a tabelas e funções; chave de serviço só na Edge Function. |
| Responsivo | Menu lateral fixo no desktop; menu gaveta + botão "+" permanente no celular. |

### Testado
- **Banco (SQL simulando cada usuária com JWT):** 28 cenários de RLS e regras — isolamento entre workspaces, `created_by` forjado substituído, exclusão física impossível, notificações corretas, conclusão/reabertura, histórico, lembretes sem duplicidade.
- **Primeiro acesso (API real):** cadastro direto bloqueado, nonce forjado bloqueado, código errado, e-mail não convidado, código correto, conta repetida.
- **E2E em produção (Playwright, 2 navegadores, 2 contas reais):** `tests/e2e.mjs` — **28/28 passaram**. Inclui criação e atribuição, recebimento em tempo real sem recarregar, notificação, comentários em tempo real, edição simultânea, histórico, conclusão na lista, reabertura, atraso automático, captura rápida, lista = Kanban, arrastar no Kanban, filtros combinados, busca, calendário, exclusão lógica e celular 390 px sem rolagem lateral.

Rodar o E2E: `BASE_URL=https://bold-tasks-umber.vercel.app QA_PW=<senha QA> node tests/e2e.mjs` e `node tests/e2e-v2.mjs`

### Pendente / limitações conhecidas
- **Recuperação de senha por e-mail:** não ativada. O SMTP padrão do Supabase só envia para membros da organização; configurar um SMTP próprio (ex.: Resend) e a Site URL do Auth para habilitar. Enquanto isso, a senha pode ser trocada em Configurações (logada) ou um novo código de convite pode ser gerado.
- **Proteção contra senhas vazadas** (HaveIBeenPwned): ativar no painel do Supabase → Auth.
- **GitHub:** código em `theboldd/bold-tasks`. Falta ligar o deploy automático na Vercel (Settings → Git → Connect) e tornar o repositório privado.
- **Domínio próprio** (ex.: tasks.thebold.com.br): não configurado.
- "Pendências da outra usuária" assume workspace de duas pessoas (como na especificação).
- Segunda/terceira etapas da especificação (resumo diário, preferências de notificação, push, IA, WhatsApp, Google Calendar) não fazem parte desta versão.

## Banco de dados (migrações aplicadas no Supabase)
`core_schema` → `security_and_rules` → `cron_and_seed_workspaces` → `invite_codes` → `invite_claim_nonce` → `harden_grants_and_indexes` → `v2_day_time_shared` → `v2_reminders_engine` → `v2_greeting_by_hour` → `v2_push` → `v2_calendar_feeds`

Tabelas: `profiles`, `workspaces`, `workspace_members`, `workspace_invites`, `tasks`, `task_parts`, `task_comments`, `task_activity`, `notifications`, `quick_captures`, `task_reminders`, `daily_digests`, `push_subscriptions`, `calendar_feeds`, `calendar_cache`, `app_secrets` (só servidor).

## Gerar novo código de convite
No SQL Editor do Supabase: `select public.set_invite_code(id) from workspace_invites where email = '<email>';`
(o código só funciona enquanto a conta ainda não foi criada)

## Desenvolvimento
```
npm install
# .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```
