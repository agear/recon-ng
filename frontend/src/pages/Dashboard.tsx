import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboard, DashboardResponse } from '../api/client'
import { Spinner } from '../components/ui/Spinner'

function StatCard({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`card px-4 py-3 flex items-center justify-between ${onClick ? 'cursor-pointer hover:border-zinc-600 transition-colors' : ''}`}
    >
      <span className="text-xs text-zinc-400 truncate">{label}</span>
      <span className="text-lg font-semibold text-brand ml-3">{value.toLocaleString()}</span>
    </div>
  )
}

export function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )

  if (error) return (
    <div className="p-8 text-red-400 text-sm">{error}</div>
  )

  if (!data) return null

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Workspace: <span className="text-brand">{data.workspace}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Records */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Harvested Data</h2>
          {data.records.length === 0 ? (
            <p className="text-sm text-zinc-600">No records yet. Run a module to start collecting data.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.records.map(r => (
                <StatCard
                  key={r.name}
                  label={r.name}
                  value={r.count}
                  onClick={() => navigate(`/data/${r.name}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Activity */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Module Activity</h2>
          {data.activity.length === 0 ? (
            <p className="text-sm text-zinc-600">No modules run yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.activity.map(a => (
                <div
                  key={a.module}
                  onClick={() => navigate(`/modules/${a.module}`)}
                  className="card px-4 py-3 flex items-center justify-between cursor-pointer hover:border-zinc-600 transition-colors"
                >
                  <span className="text-xs text-zinc-400 truncate font-mono">{a.module}</span>
                  <span className="text-sm font-semibold text-zinc-300 ml-3 whitespace-nowrap">
                    {a.runs} {a.runs === 1 ? 'run' : 'runs'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
