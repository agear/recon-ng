import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMarketplace, installModule, removeModule, refreshMarketplace, installAllModules, MarketplaceModule } from '../api/client'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { HelpButton } from '../components/help/HelpButton'

type Status = MarketplaceModule['status']

const STATUS_BADGE: Record<Status, string> = {
  installed: 'badge-green',
  outdated: 'badge-amber',
  disabled: 'badge-zinc',
  'not installed': 'badge-zinc',
}

function MarketplaceRow({ module, onUpdate }: { module: MarketplaceModule; onUpdate: (m: MarketplaceModule | null) => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showDeps, setShowDeps] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const isInstalled = module.status === 'installed' || module.status === 'outdated' || module.status === 'disabled'
  const hasDeps = module.dependencies?.length > 0
  const hasKeys = module.required_keys?.length > 0

  const handleInstall = async () => {
    setBusy(true)
    setError('')
    try {
      const updated = await installModule(module.path)
      onUpdate(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Install failed')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    setError('')
    try {
      await removeModule(module.path)
      onUpdate({ ...module, status: 'not installed' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="border-b border-zinc-800/50 last:border-0 px-4 py-3 hover:bg-zinc-800/20 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isInstalled ? (
                <button onClick={() => navigate(`/modules/${module.path}`)} className="text-sm font-medium text-brand hover:underline font-mono text-left">
                  {module.path}
                </button>
              ) : (
                <span className="text-sm font-medium text-zinc-200 font-mono">{module.path}</span>
              )}
              <span className={STATUS_BADGE[module.status]}>{module.status}</span>
              {module.status === 'outdated' && <span className="badge-amber">update available</span>}
              {hasDeps && (
                <button onClick={() => setShowDeps(true)} className="badge-zinc hover:bg-zinc-600 transition-colors cursor-pointer" title="Has dependencies — click for details">
                  dependencies
                </button>
              )}
              {hasKeys && (
                <button onClick={() => setShowKeys(true)} className="badge-zinc hover:bg-zinc-600 transition-colors cursor-pointer" title="Requires API key — click for details">
                  🔑 key required
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">{module.description}</p>
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-zinc-600">v{module.version}</span>
            {module.last_updated && <span className="text-xs text-zinc-600">{module.last_updated}</span>}
            {busy ? (
              <Spinner size="sm" />
            ) : isInstalled ? (
              <div className="flex gap-2">
                {module.status === 'outdated' && (
                  <button className="btn-primary text-xs py-1" onClick={handleInstall}>Update</button>
                )}
                <button className="btn-danger text-xs py-1" onClick={handleRemove}>Remove</button>
              </div>
            ) : (
              <button className="btn-ghost text-xs py-1" onClick={handleInstall}>Install</button>
            )}
          </div>
        </div>
      </div>

      {showDeps && (
        <Modal title={`Dependencies — ${module.path}`} onClose={() => setShowDeps(false)}>
          <div className="flex flex-col gap-3 text-sm text-zinc-300">
            <p className="text-xs text-zinc-500">This module requires the following Python packages to be installed in your environment:</p>
            <div className="flex flex-col gap-1">
              {module.dependencies.map(dep => (
                <div key={dep} className="flex items-center gap-2 bg-zinc-950 rounded px-3 py-2">
                  <span className="font-mono text-xs text-brand">{dep}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-600">Install missing packages with: <span className="font-mono text-zinc-400">pip install {module.dependencies.join(' ')}</span></p>
          </div>
        </Modal>
      )}

      {showKeys && (
        <Modal title={`Required API Keys — ${module.path}`} onClose={() => setShowKeys(false)}>
          <div className="flex flex-col gap-3 text-sm text-zinc-300">
            <p className="text-xs text-zinc-500">This module will not run until the following keys are present in the keystore:</p>
            <div className="flex flex-col gap-1">
              {module.required_keys.map(key => (
                <div key={key} className="flex items-center gap-2 bg-zinc-950 rounded px-3 py-2">
                  <span className="font-mono text-xs text-brand">{key}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-600">Add keys on the <strong className="text-zinc-400">API Keys</strong> page.</p>
          </div>
        </Modal>
      )}
    </>
  )
}

export function Marketplace() {
  const [modules, setModules] = useState<MarketplaceModule[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showInstallAll, setShowInstallAll] = useState(false)
  const [installingAll, setInstallingAll] = useState(false)
  const [installAllResult, setInstallAllResult] = useState<{ installed: number; errors: { path: string; error: string }[] } | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [category, setCategory] = useState('all')

  const load = (q?: string) => {
    setLoading(true)
    getMarketplace(q)
      .then(d => setModules(d.modules))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleInstallAll = async () => {
    setInstallingAll(true)
    try {
      const result = await installAllModules()
      setInstallAllResult(result)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Install all failed')
      setShowInstallAll(false)
    } finally {
      setInstallingAll(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshMarketplace()
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const handleUpdate = (updated: MarketplaceModule | null) => {
    if (!updated) return
    setModules(prev => prev.map(m => m.path === updated.path ? updated : m))
  }

  const categories = useMemo(() => {
    const cats = new Set(modules.map(m => m.path.split('/')[0]))
    return ['all', ...Array.from(cats).sort()]
  }, [modules])

  const filtered = useMemo(() => {
    return modules.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (category !== 'all' && !m.path.startsWith(category + '/')) return false
      if (search && !m.path.toLowerCase().includes(search.toLowerCase()) &&
          !m.description.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [modules, search, statusFilter, category])

  const counts = useMemo(() => ({
    installed: modules.filter(m => m.status === 'installed').length,
    outdated: modules.filter(m => m.status === 'outdated').length,
    total: modules.length,
  }), [modules])

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-100">Marketplace</h1>
            <HelpButton title="Marketplace">
              <p>The Marketplace is a remote catalog of all available Recon-ng modules hosted on GitHub. Install only the modules you need — they're stored in <span className="font-mono text-zinc-300">~/.recon-ng/modules/</span>.</p>
              <p className="text-xs text-zinc-500">Module statuses:</p>
              <ul className="space-y-1 text-xs text-zinc-400">
                <li><span className="badge-green inline mr-1">installed</span> installed and up to date</li>
                <li><span className="badge-amber inline mr-1">outdated</span> a newer version is available — click Update</li>
                <li><span className="badge-zinc inline mr-1">disabled</span> installed but missing a required dependency</li>
                <li><span className="badge-zinc inline mr-1">not installed</span> available but not yet installed</li>
              </ul>
              <p className="text-xs text-zinc-600 pt-1">Click <strong className="text-zinc-400">↻ Refresh Index</strong> to fetch the latest module list from the remote repository if the catalog appears empty or stale.</p>
            </HelpButton>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            {counts.installed} installed · {counts.outdated > 0 && <span className="text-amber-400">{counts.outdated} outdated · </span>}{counts.total} total
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Spinner size="sm" /> : '↻ Refresh Index'}
          </button>
          <button className="btn-primary" onClick={() => setShowInstallAll(true)} disabled={installingAll || counts.total === 0}>
            {installingAll ? <Spinner size="sm" /> : '⬇ Install All'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Search modules..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input max-w-[160px]" value={category} onChange={e => setCategory(e.target.value)}>
          {categories.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
          ))}
        </select>
        <select className="input max-w-[160px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status | 'all')}>
          <option value="all">All statuses</option>
          <option value="installed">Installed</option>
          <option value="not installed">Not installed</option>
          <option value="outdated">Outdated</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-zinc-500 text-sm">No modules match your filters.</p>
          {modules.length === 0 && (
            <p className="text-zinc-600 text-xs mt-2">Click <strong className="text-zinc-400">↻ Refresh Index</strong> to fetch the module list from the remote repository.</p>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {filtered.map(m => (
            <MarketplaceRow key={m.path} module={m} onUpdate={handleUpdate} />
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-600 mt-3">{filtered.length} of {modules.length} modules</p>

      {showInstallAll && !installAllResult && (
        <Modal
          title="Install All Modules"
          onClose={() => setShowInstallAll(false)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setShowInstallAll(false)} disabled={installingAll}>Cancel</button>
              <button className="btn-primary" onClick={handleInstallAll} disabled={installingAll}>
                {installingAll ? <><Spinner size="sm" /><span className="ml-2">Installing…</span></> : 'Install All'}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm text-zinc-300">
            <p>This will install all <strong className="text-zinc-100">{counts.total - counts.installed}</strong> not-yet-installed modules from the marketplace.</p>
            <p className="text-xs text-zinc-500">This may take a minute. Modules that are already installed will be skipped.</p>
          </div>
        </Modal>
      )}

      {installAllResult && (
        <Modal
          title="Install All Complete"
          onClose={() => { setInstallAllResult(null); setShowInstallAll(false) }}
          footer={
            <button className="btn-primary" onClick={() => { setInstallAllResult(null); setShowInstallAll(false) }}>Done</button>
          }
        >
          <div className="flex flex-col gap-3 text-sm text-zinc-300">
            <p><strong className="text-emerald-400">{installAllResult.installed}</strong> module{installAllResult.installed !== 1 ? 's' : ''} installed successfully.</p>
            {installAllResult.errors.length > 0 && (
              <div>
                <p className="text-xs text-amber-400 mb-2">{installAllResult.errors.length} module{installAllResult.errors.length !== 1 ? 's' : ''} failed:</p>
                <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                  {installAllResult.errors.map(e => (
                    <div key={e.path} className="bg-zinc-950 rounded px-3 py-2">
                      <p className="font-mono text-xs text-zinc-300">{e.path}</p>
                      <p className="text-xs text-red-400 mt-0.5">{e.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
