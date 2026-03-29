import { createContext, useContext } from 'react'

export interface WorkspaceContextValue {
  active: string
  workspaces: string[]
  setActive: (name: string) => void
  refresh: () => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue>({
  active: '',
  workspaces: [],
  setActive: () => {},
  refresh: () => {},
})

export const useWorkspace = () => useContext(WorkspaceContext)
