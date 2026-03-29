import { ReactNode, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { WorkspaceContext } from '../../hooks/useWorkspace'
import { activateWorkspace, createWorkspace, getWorkspaces } from '../../api/client'
import { Spinner } from '../ui/Spinner'
import { Modal } from '../ui/Modal'
import { QuickstartModal, QUICKSTART_STORAGE_KEY } from '../onboarding/QuickstartModal'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/workspaces', label: 'Workspaces' },
  { to: '/modules', label: 'Modules' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/data', label: 'Data' },
  { to: '/snapshots', label: 'Snapshots' },
  { to: '/keys', label: 'API Keys' },
]

export function Shell({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [active, setActiveState] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showQuickstart, setShowQuickstart] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const refresh = async () => {
    const data = await getWorkspaces()
    setWorkspaces(data.workspaces)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => {
    if (!localStorage.getItem(QUICKSTART_STORAGE_KEY)) {
      setShowQuickstart(true)
    }
  }, [])

  const setActive = async (name: string) => {
    await activateWorkspace(name)
    setActiveState(name)
    await refresh()
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    try {
      await createWorkspace(newName.trim())
      await setActive(newName.trim())
      setShowCreate(false)
      setNewName('')
      navigate('/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create workspace')
    } finally {
      setCreating(false)
    }
  }

  return (
    <WorkspaceContext.Provider value={{ active, workspaces, setActive, refresh }}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
          {/* Logo */}
          <div className="px-4 py-4 border-b border-zinc-800">
            <span className="text-brand font-semibold tracking-widest text-sm uppercase">Recon-ng</span>
          </div>

          {/* Workspace switcher */}
          <div className="px-3 py-3 border-b border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Workspace</p>
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <div className="flex flex-col gap-1">
                <select
                  className="input text-xs py-1"
                  value={active}
                  onChange={e => setActive(e.target.value)}
                >
                  {workspaces.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCreate(true)}
                  className="text-xs text-zinc-500 hover:text-brand transition-colors text-left"
                >
                  + New workspace
                </button>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                    isActive
                      ? 'bg-brand/10 text-brand'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
            <p className="text-xs text-zinc-600">v5.1.2</p>
            <button
              onClick={() => setShowQuickstart(true)}
              className="text-xs text-zinc-600 hover:text-brand transition-colors"
              title="Open quick start guide"
            >
              Quick Start
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto bg-zinc-950">
          {children}
        </main>
      </div>

      <QuickstartModal
        open={showQuickstart}
        onClose={() => {
          localStorage.setItem(QUICKSTART_STORAGE_KEY, '1')
          setShowQuickstart(false)
        }}
      />

      {showCreate && (
        <Modal
          title="New Workspace"
          onClose={() => { setShowCreate(false); setNewName(''); setError('') }}
          footer={
            <>
              <button className="btn-ghost" onClick={() => { setShowCreate(false); setNewName('') }}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? <Spinner size="sm" /> : 'Create'}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <label className="text-xs text-zinc-400">Workspace name</label>
            <input
              className="input"
              placeholder="e.g. example-corp"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        </Modal>
      )}
    </WorkspaceContext.Provider>
  )
}
