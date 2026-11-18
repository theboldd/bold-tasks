import { createContext, useContext } from 'react'
import type { NewTaskDefaults } from '../components/TaskFormModal'

interface UICtx { openTask: (id: string) => void; openNew: (d?: NewTaskDefaults) => void }
export const UIContext = createContext<UICtx>({ openTask: () => {}, openNew: () => {} })
export const useUI = () => useContext(UIContext)
