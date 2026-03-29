import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getModules } from '../api/client'
import { Spinner } from '../components/ui/Spinner'
import { HelpButton } from '../components/help/HelpButton'

export function Modules() {
  const [modules, setModules] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const navigate = useNavigate()

  useEffect(() => {
    getModules()
      .then(d => setModules(d.modules))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const cats = new Set(modules.map(m => m.split('/')[0]))
    return ['all', ...Array.from(cats).sort()]
  }, [modules])

  const filtered = useMemo(() => {
    return modules.filter(m => {
      const matchCat = category === 'all' || m.startsWith(category + '/')
      const matchSearch = !search || m.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [modules, category, search])

  // Group by top-level category
  const grouped = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const m of filtered) {
      const cat = m.split('/')[0]
      if (!map[cat]) map[cat] = []
      map[cat].push(m)
    }
    return map
  }, [filtered])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  if (error) return <div className="p-8 text-red-400 text-sm">{error}</div>

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-zinc-100">Modules</h1>
          <HelpButton title="Modules">
            <p>Modules are the core building blocks of Recon-ng. Each one queries a single data source and writes results into the workspace database.</p>
            <p className="text-xs text-zinc-500">Module paths follow the format <span className="font-mono text-zinc-300">category/input-output/name</span>. For example:</p>
            <ul className="space-y-1 text-xs text-zinc-400">
              <li><span className="font-mono text-zinc-300">recon/domains-hosts/resolve</span> — takes domains, outputs hosts</li>
              <li><span className="font-mono text-zinc-300">recon/hosts-ports/shodan_ip</span> — takes hosts, outputs open ports</li>
              <li><span className="font-mono text-zinc-300">recon/domains-contacts/hunter_io</span> — takes domains, outputs contacts</li>
            </ul>
            <p className="text-xs text-zinc-500">Only installed modules appear here. Visit the <strong className="text-zinc-300">Marketplace</strong> to install more.</p>
          </HelpButton>
        </div>
        <p className="text-sm text-zinc-500 mt-1">{modules.length} modules loaded</p>
      </div>

      <div className="flex gap-3 mb-6">
        <input
          className="input max-w-sm"
          placeholder="Search modules..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <select className="input max-w-[180px]" value={category} onChange={e => setCategory(e.target.value)}>
          {categories.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-zinc-600 text-sm">No modules match your search.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).sort().map(([cat, mods]) => (
            <section key={cat}>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{cat}</h2>
              <div className="card overflow-hidden">
                {mods.map((m, i) => {
                  const parts = m.split('/')
                  const name = parts[parts.length - 1]
                  const subpath = parts.slice(1, -1).join('/')
                  return (
                    <div
                      key={m}
                      onClick={() => navigate(`/modules/${m}`)}
                      className={`flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-zinc-800/40 transition-colors ${i > 0 ? 'border-t border-zinc-800/50' : ''}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-zinc-200 font-medium">{name}</span>
                        {subpath && <span className="text-xs text-zinc-600">{subpath}</span>}
                      </div>
                      <span className="text-zinc-600 text-xs ml-4">›</span>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
