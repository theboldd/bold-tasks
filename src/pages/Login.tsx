import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [mode, setMode] = useState<'login' | 'first'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setInfo('')
    if (mode === 'first') {
      if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.')
      if (password !== password2) return setError('As senhas não coincidem.')
    }
    setBusy(true)
    try {
      if (mode === 'first') {
        const { data, error } = await supabase.functions.invoke('first-access', { body: { email: email.trim(), password, code: code.trim() } })
        if (error) {
          let msg = 'Não foi possível criar a conta.'
          try { msg = (await (error as { context: Response }).context.json()).error ?? msg } catch { /* noop */ }
          throw new Error(msg)
        }
        if (!data?.ok) throw new Error(data?.error ?? 'Não foi possível criar a conta.')
        const { error: e2 } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (e2) throw new Error('Conta criada. Entre com seu e-mail e senha.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error(/Invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : /not confirmed/i.test(error.message) ? 'E-mail ainda não confirmado.' : error.message)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-full grid lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden lg:flex flex-col justify-between bg-bordo p-14 text-off overflow-hidden">
        <div>
          <div className="display text-5xl font-semibold">BOLD</div>
          <div className="meta mt-2 text-[11px] font-semibold uppercase tracking-[.45em] text-off/60">Tasks</div>
        </div>
        <div className="max-w-md">
          <div className="mb-6 h-px w-12 bg-off/40" />
          <p className="display text-[3.6rem]">Conversas viram <em className="font-normal italic">responsabilidades</em> claras.</p>
          <p className="mt-6 text-off/60 text-sm leading-relaxed">A central compartilhada de execução da The Bold. Cada pendência com um responsável, um prazo e um histórico.</p>
        </div>
        <div className="eyebrow text-off/40">The Bold · Uso interno</div>
      </section>
      <section className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={submit} className="w-full max-w-sm" aria-label={mode === 'login' ? 'Entrar' : 'Primeiro acesso'}>
          <div className="lg:hidden mb-12">
            <div className="display text-4xl font-semibold text-bordo">BOLD</div>
            <div className="meta mt-1 text-[10px] font-semibold uppercase tracking-[.45em] text-mute">Tasks</div>
          </div>
          <div className="eyebrow mb-2">{mode === 'login' ? 'Bem-vinda de volta' : 'Primeiro acesso'}</div>
          <h1 className="display mb-8 border-b border-ink pb-4 text-[2.8rem]">{mode === 'login' ? 'Entrar' : 'Criar sua senha'}</h1>
          <label className="eyebrow mb-1.5 block" htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" required className="field mb-4" value={email} onChange={e => setEmail(e.target.value)} />
          <label className="eyebrow mb-1.5 block" htmlFor="password">Senha</label>
          <input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required className="field mb-4" value={password} onChange={e => setPassword(e.target.value)} />
          {mode === 'first' && <>
            <label className="eyebrow mb-1.5 block" htmlFor="code">Código de convite</label>
            <input id="code" required autoComplete="one-time-code" className="field mb-4 uppercase tracking-[.3em]" maxLength={12} value={code} onChange={e => setCode(e.target.value)} />
            <label className="eyebrow mb-1.5 block" htmlFor="password2">Repita a senha</label>
            <input id="password2" type="password" autoComplete="new-password" required className="field mb-4" value={password2} onChange={e => setPassword2(e.target.value)} />
          </>}
          {error && <p role="alert" className="mb-4 border-l-2 border-late pl-3 text-sm text-late">{error}</p>}
          {info && <p role="status" className="mb-4 border-l-2 border-ok pl-3 text-sm text-ok">{info}</p>}
          <button className="btn btn-primary w-full justify-center py-3" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta e entrar'}</button>
          <p className="mt-6 text-center text-sm text-mute">
            {mode === 'login'
              ? <>Primeira vez aqui? <button type="button" className="text-bordo underline-offset-2 hover:underline" onClick={() => { setMode('first'); setError('') }}>Criar minha senha</button></>
              : <>Já tem conta? <button type="button" className="text-bordo underline-offset-2 hover:underline" onClick={() => { setMode('login'); setError('') }}>Entrar</button></>}
          </p>
          {mode === 'first' && <p className="mt-3 text-center text-xs text-mute">Use o código de convite que você recebeu. Apenas e-mails autorizados conseguem criar conta.</p>}
        </form>
      </section>
    </div>
  )
}
