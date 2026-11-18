import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, ToastProvider, WorkspaceProvider, useAuth } from './lib/store'
import { supabase } from './lib/supabase'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { TasksPage } from './pages/TasksPage'
import { CalendarPage } from './pages/Calendar'
import { HistoryPage } from './pages/History'
import { SettingsPage } from './pages/Settings'

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Login />
  return (
    <WorkspaceProvider key={session.user.id} fallback={state => state === 'loading' ? <Spinner /> : (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="font-serif text-3xl text-bordo">Sem acesso a um workspace</div>
        <p className="max-w-md text-mute">Sua conta ainda não foi vinculada a nenhum workspace do BOLD TASKS.</p>
        <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
    )}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pendencias" element={<TasksPage key="all" variant="all" />} />
          <Route path="/minhas" element={<TasksPage key="mine" variant="mine" />} />
          <Route path="/outra" element={<TasksPage key="other" variant="other" />} />
          <Route path="/the-bold" element={<TasksPage key="bold" variant="thebold" />} />
          <Route path="/aguardando" element={<TasksPage key="wait" variant="waiting" />} />
          <Route path="/a-classificar" element={<TasksPage key="triage" variant="triage" />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/historico" element={<HistoryPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </WorkspaceProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
