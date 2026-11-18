import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast, useWs } from '../lib/store'
import { PageHeader } from '../components/ui'

export function SettingsPage() {
  const { me, members, workspace, realtimeStatus } = useWs()
  const toast = useToast()
  const [name, setName] = useState(me.name)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Conta" title="Configurações" />
      <section className="card p-6 mb-6">
        <h2 className="font-serif text-xl mb-4">Perfil</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={async e => {
          e.preventDefault(); if (!name.trim()) return
          setBusy(true)
          const { error } = await supabase.from('profiles').update({ name: name.trim() }).eq('id', me.id)
          setBusy(false)
          if (error) toast(error.message, 'error'); else { toast('Nome atualizado'); setTimeout(() => location.reload(), 600) }
        }}>
          <label className="flex-1 min-w-52"><span className="eyebrow mb-1.5 block">Nome</span><input className="field" value={name} onChange={e => setName(e.target.value)} /></label>
          <button className="btn btn-primary" disabled={busy || name.trim() === me.name}>Salvar</button>
        </form>
        <p className="mt-3 text-sm text-mute">E-mail de acesso: {me.email}</p>
      </section>
      <section className="card p-6 mb-6">
        <h2 className="font-serif text-xl mb-4">Alterar senha</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={async e => {
          e.preventDefault(); if (pw.length < 8) return toast('Mínimo de 8 caracteres', 'error')
          setBusy(true)
          const { error } = await supabase.auth.updateUser({ password: pw })
          setBusy(false)
          if (error) toast(error.message, 'error'); else { toast('Senha alterada'); setPw('') }
        }}>
          <label className="flex-1 min-w-52"><span className="eyebrow mb-1.5 block">Nova senha</span><input type="password" autoComplete="new-password" className="field" value={pw} onChange={e => setPw(e.target.value)} /></label>
          <button className="btn btn-primary" disabled={busy || !pw}>Alterar</button>
        </form>
      </section>
      <section className="card p-6">
        <h2 className="font-serif text-xl mb-1">Workspace</h2>
        <p className="text-sm text-mute mb-4">{workspace.name} · sincronização {realtimeStatus === 'SUBSCRIBED' ? <span className="text-ok">ativa</span> : <span className="text-late">{realtimeStatus.toLowerCase()}</span>}</p>
        <ul className="divide-y divide-line text-sm">
          {members.map(m => <li key={m.user_id} className="flex justify-between py-2"><span>{m.profile.name}</span><span className="text-mute">{m.profile.email}</span></li>)}
        </ul>
        <p className="mt-4 text-xs text-mute">Ambas têm acesso integral ao workspace. Permissões garantidas no banco de dados (RLS).</p>
      </section>
    </div>
  )
}
