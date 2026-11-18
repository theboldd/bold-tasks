/** Ações do processo da The Bold (mapa "PROCESSO THE BOLD 2026" no MindMeister),
 *  ligadas às fases do Google Agenda da agência. Devolve uma dica curta para quem está logada. */
import type { Phase } from './calendar'

const month = (t: string) => (t.match(/\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b/i)?.[1] ?? '').toUpperCase()

export function processTip(who: 'rebeca' | 'vitoria' | 'outra', phases: Phase[], marksToday: string[]): string | null {
  // marcos do dia valem para as duas
  for (const m of marksToday) {
    const M = month(m)
    if (/[uú]ltimo dia de entrega da produ/i.test(m)) return `Hoje é o último dia de entrega da produção ${M}.`
    if (/dia que tudo/i.test(m)) return `Hoje tudo de ${M} precisa estar pronto: produção, ajustes e análise.`
    if (/entrega de cronograma/i.test(m)) return `Hoje é dia de entrega do cronograma de ${M}.`
    if (/envio de formul/i.test(m) && who === 'vitoria') return `Dia de enviar aos clientes o formulário do crono ${M}.`
  }
  for (const p of phases) {
    const M = month(p.raw)
    const t = p.raw
    if (who === 'vitoria') {
      if (/clientes aprovam crono/i.test(t)) {
        if (p.dayIndex === 0) return `Dia de mandar nos grupos a mensagem do cronograma de ${M} com os prazos de aprovação e envio de materiais.`
        if (p.dayIndex === 1) return `Hoje é dia de perguntar aos clientes se conseguiram checar o cronograma de ${M}.`
        if (p.daysLeft === 1) return `Véspera do prazo de aprovação de ${M}: hora do lembrete nos grupos.`
        if (p.daysLeft === 0) return `Último dia de aprovação de ${M}: mensagem de encerramento do prazo nos grupos.`
        if (p.dayIndex === 2) return `Metade do prazo de aprovação de ${M}: vale um "está tudo certo por aí?" nos grupos.`
      }
      if (/clientes entram para aprovar|revis[aã]o e libera/i.test(t)) {
        if (p.dayIndex === 0) return `Conteúdos de ${M} liberados: avise os clientes no Notion com o prazo de conferência.`
        if (p.dayIndex === 1) return `Confirme nos grupos se os clientes viram a mensagem de conferência de ${M}.`
      }
    }
    if (who === 'rebeca') {
      if (/revisar cronograma/i.test(t)) return `Você e a Raisa analisam os cronogramas de ${M}${p.daysLeft === 0 ? ' até hoje' : ''}.`
      if (/revis[aã]o produ[cç][aã]o/i.test(t)) return `Você e a Raisa checam a produção de ${M}${p.daysLeft === 0 ? ' até hoje' : ''}.`
    }
  }
  return null
}

export const whoFromName = (name: string): 'rebeca' | 'vitoria' | 'outra' => (/^rebeca/i.test(name) ? 'rebeca' : /^vit[oó]ria/i.test(name) ? 'vitoria' : 'outra')
