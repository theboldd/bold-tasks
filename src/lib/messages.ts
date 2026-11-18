/** Banco de mensagens do dashboard: motivacionais, informais e algumas engraçadas.
 *  {nome} = primeiro nome · {qtd} = "3 pendências" · {n} = número. Sem travessões. */

const TODAY = [
  '{nome}, hoje você tem {qtd}. Vamos ao trabalho? 💪',
  'Hoje tem {qtd} na sua lista. Café na mão e bora riscar uma por uma. ☕✅',
  '{nome}, são {qtd} para hoje. Nada que você não resolva com estilo. 💅',
  '{qtd} te esperando hoje. Começa pela mais chata que o resto vira passeio. 🚶‍♀️',
  '{qtd} para hoje. Uma de cada vez e ninguém se machuca. 😅',
  '{nome}, a lista de hoje tem {qtd}. Bora transformar tudo em check verde? ✅',
  'Hoje são {qtd}. Respira, organiza e manda ver. 🧘‍♀️🚀',
  '{qtd} no radar de hoje. Você já fez coisa muito mais difícil antes do almoço. 😎',
  '{nome}, {qtd} hoje. Se cada uma fosse um café, você já estaria elétrica. Bora! ☕⚡',
  'Missão do dia: {qtd}. Recompensa: aquela sensação deliciosa de lista zerada. 🎯',
  '{nome}, hoje tem {qtd}. Coloca uma playlist boa e vamos nessa. 🎧',
  '{qtd} para hoje. A Bold não para e você também não. 🔥',
  'Bora, {nome}! São {qtd} hoje e a primeira já está olhando para você. 👀',
  'Hoje a meta é {qtd}. Pequenos checks, grandes resultados. ✨',
  '{nome}, {qtd} hoje. Lembra: feito é melhor que perfeito. 😉',
  '{qtd} na fila de hoje. Prometo que o check verde vale a pena. 💚',
  'Hoje tem {qtd}. Dá tempo de fazer tudo e ainda tomar um café com calma. ☕',
  '{nome}, são {qtd}. Modo foco ativado em 3, 2, 1... 🎯🚀',
  '{qtd} hoje. Você não é multitarefa, você é multitalentosa. Vai! 🌟',
  'Olha só: {qtd} hoje. Nada que uma mulher com uma lista não resolva. 📝💪',
  '{nome}, hoje são {qtd}. Uma pausa para água entre elas também conta como produtividade. 💧',
  '{qtd} para hoje. Se der preguiça, faz só a primeira. Depois a segunda vem sozinha. 🦥',
  'Hoje tem {qtd}, {nome}. O sucesso adora uma lista riscada. 🏆',
  '{qtd} no seu dia. Começa agora e às 18h você agradece. 🙏',
  '{nome}, {qtd} hoje. Bora fazer o dia render como post que viraliza. 📈🔥',
  'São {qtd} hoje. Uma de cada vez, sem drama (o drama fica para os reels). 🎬😂',
  '{nome}, hoje tem {qtd}. Ninguém segura uma Bold com prazo. ⏰💥',
  '{qtd} para hoje. Você organiza a marca dos outros, imagina o próprio dia! 😏',
  'Dia de {qtd}, {nome}. Bora mostrar quem manda nesse calendário. 👑📅',
  '{qtd} hoje. Cada check é um aplauso silencioso. Bora colecionar aplausos? 👏',
  '{nome}, são {qtd}. Se precisar, chora um pouquinho e depois arrasa. 😭💅',
  'Hoje: {qtd}. Amanhã: você olhando para trás orgulhosa. Bora? 🥹',
]

const LATE = [
  '{nome}, algumas já passaram do horário, mas tudo bem. Bora recuperar o ritmo? 🏃‍♀️',
  'O relógio correu um pouco mais rápido que você hoje. Sem estresse, dá tempo de virar o jogo. ⏰😉',
  '{nome}, tem coisa atrasadinha por aí. Resolve a mais rápida primeiro e o resto anda. 🐢🐇',
  'Atrasou? Acontece até com quem tem agenda impecável. Bora botar em dia. 💪',
]

const FREE = [
  '{nome}, nada para hoje! Bom momento para adiantar o que vem por aí. 🌤️',
  'Dia livre na lista, {nome}. Que tal adiantar uma de amanhã e ganhar tempo? ⏳',
  'Zero pendências para hoje. Aproveita para respirar ou para adiantar a semana. 🍃',
  'Hoje está tranquilo, {nome}. Use esse superpoder com sabedoria. 🦸‍♀️',
  'Lista do dia limpinha. Você merece um café sem pressa. ☕✨',
  'Nada para hoje, {nome}. Até parece feriado, mas não é. Bora adiantar? 😜',
]

const EMPTY = [
  '{nome}, nenhuma pendência em aberto. Isso é raro, tira um print! 📸',
  'Tudo em dia, {nome}. Pode se sentir a pessoa mais organizada do mundo hoje. 🏅',
  'Lista zerada. Se alguém perguntar, você está "estrategicamente disponível". 😌',
  '{nome}, nada pendente. Aproveita, porque a próxima ideia genial já vem aí. 💡',
]

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

/** Escolhe uma mensagem estável por pessoa, dia e período (manhã, tarde, noite). */
export function dailyMessage(opts: { name: string; userId: string; today: number; late: boolean; open: number; seedExtra?: number }) {
  const { name, userId, today, late, open, seedExtra = 0 } = opts
  const bank = today > 0 ? (late ? [...LATE, ...TODAY.slice(0, 6)] : TODAY) : open > 0 ? FREE : EMPTY
  const now = new Date()
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now)
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }).format(now))
  const period = hour < 12 ? 0 : hour < 18 ? 1 : 2
  const tpl = bank[(hash(`${userId}|${day}|${period}`) + seedExtra) % bank.length]
  const qtd = `${today} ${today === 1 ? 'pendência' : 'pendências'}`
  return tpl.replaceAll('{nome}', name).replaceAll('{qtd}', qtd).replaceAll('{n}', String(today))
}

export const MESSAGE_COUNT = TODAY.length + LATE.length + FREE.length + EMPTY.length
