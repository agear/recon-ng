import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMarketplace, installModule, removeModule, refreshMarketplace, MarketplaceModule } from '../api/client'
import { Spinner } from '../components/ui/Spinner'

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
  const isInstalled = module.status === 'installed' || module.status === 'outdated' || module.status === 'disabled'

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
            {module.required_keys?.length > 0 && (
              <span className="badge-zinc">🔑 key required</span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{module.description}</p>
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-zinc-600">v{module.version}</span>
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
  )
}

export function Marketplace() {
  const [modules, setModules] = useState<MarketplaceModule[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
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
          <h1 className="text-xl font-semibold text-zinc-100">Marketplace</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {counts.installed} installed · {counts.outdated > 0 && <span className="text-amber-400">{counts.outdated} outdated · </span>}{counts.total} total
          </p>
        </div>
        <button className="btn-ghost" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? <Spinner size="sm" /> : '↻ Refresh Index'}
        </button>
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
    </div>
  )
}
