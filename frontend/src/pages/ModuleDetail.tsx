import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getModule, patchModule, runModule, ModuleMeta, ModuleOption } from '../api/client'
import { useTaskPoller } from '../hooks/useTaskPoller'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { HelpButton } from '../components/help/HelpButton'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'

function OptionDescription({ description, onInfoClick }: { description: string; onInfoClick: () => void }) {
  // Render "info" inside "(see 'info' for details)" as a clickable button
  const parts = description.split(/(see 'info' for details)/i)
  if (parts.length === 1) return <p className="text-xs text-zinc-600 mt-0.5">{description}</p>
  return (
    <p className="text-xs text-zinc-600 mt-0.5">
      {parts.map((part, i) =>
        /see 'info' for details/i.test(part) ? (
          <span key={i}>
            see{' '}
            <button
              onClick={onInfoClick}
              className="text-brand hover:underline focus:outline-none"
            >
              info
            </button>
            {' '}for details
          </span>
        ) : part
      )}
    </p>
  )
}

function InfoModal({ meta, onClose }: { meta: ModuleMeta; onClose: () => void }) {
  return (
    <Modal title="Module Info" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        {meta.query && (
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Source Query</p>
            <pre className="bg-zinc-950 border border-zinc-800 rounded p-3 text-xs text-brand font-mono overflow-x-auto whitespace-pre-wrap">{meta.query}</pre>
            <p className="text-xs text-zinc-600 mt-1">This query defines what data the module reads as input. Set SOURCE to a value from this column, or leave as <code className="text-zinc-400">default</code> to use all rows.</p>
          </div>
        )}
        {meta.description && (
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Description</p>
            <p className="text-xs text-zinc-300">{meta.description}</p>
          </div>
        )}
        {meta.required_keys && meta.required_keys.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Required Keys</p>
            <div className="flex flex-wrap gap-1.5">
              {meta.required_keys.map(k => <span key={k} className="badge-amber">{k}</span>)}
            </div>
          </div>
        )}
        {meta.dependencies && meta.dependencies.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Dependencies</p>
            <div className="flex flex-wrap gap-1.5">
              {meta.dependencies.map(d => <span key={d} className="badge-zinc">{d}</span>)}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function OptionRow({ opt, value, onChange, meta }: { opt: ModuleOption; value: string; onChange: (v: string) => void; meta: ModuleMeta }) {
  const [showInfo, setShowInfo] = useState(false)
  return (
    <div className="grid grid-cols-3 gap-4 items-start py-3 border-b border-zinc-800/50 last:border-0">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-200 font-medium">{opt.name}</span>
          {opt.required && <span className="badge-red">required</span>}
        </div>
        <OptionDescription description={opt.description} onInfoClick={() => setShowInfo(true)} />
      </div>
      <input
        className="input col-span-2"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Not set"
      />
      {showInfo && <InfoModal meta={meta} onClose={() => setShowInfo(false)} />}
    </div>
  )
}

function TaskPanel({ taskId }: { taskId: string }) {
  const { task, elapsed } = useTaskPoller(taskId)

  const statusColor: Record<string, string> = {
    queued: 'text-zinc-400',
    started: 'text-brand',
    finished: 'text-emerald-400',
    failed: 'text-red-400',
    unknown: 'text-zinc-600',
  }

  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-sm font-semibold text-zinc-300">Task Output</h3>
        {task && (
          <span className={`text-xs font-medium ${statusColor[task.status] ?? 'text-zinc-500'}`}>
            {task.status}
          </span>
        )}
        {(task?.status === 'queued' || task?.status === 'started') && (
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <span className="text-xs text-zinc-500">{elapsed}s</span>
          </div>
        )}
      </div>

      {!task && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Spinner size="sm" />
          <span>Waiting for task...</span>
        </div>
      )}

      {task?.status === 'queued' && (
        <p className="text-sm text-zinc-500">Module queued, waiting for worker...</p>
      )}

      {task?.status === 'started' && (
        <p className="text-sm text-zinc-400">Module running... ({elapsed}s elapsed)</p>
      )}

      {task?.status === 'finished' && task.result && (
        <div className="flex flex-col gap-3">
          {task.result.error ? (
            <div className="bg-red-950/30 border border-red-900 rounded p-4">
              <p className="text-xs font-semibold text-red-400 mb-1">{task.result.error.type}</p>
              <p className="text-xs text-red-300">{task.result.error.message}</p>
              {task.result.error.traceback && (
                <pre className="text-xs text-red-400/70 mt-2 overflow-x-auto whitespace-pre-wrap">{task.result.error.traceback}</pre>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="bg-emerald-950/20 border border-emerald-900/50 rounded p-4">
                <p className="text-xs font-semibold text-emerald-400 mb-2">Completed in {elapsed}s</p>
                {task.result.summary && Object.keys(task.result.summary).length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {Object.entries(task.result.summary).map(([table, counts]) => (
                      <div key={table} className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">{table}</span>
                        <span className="text-xs font-semibold text-zinc-200">
                          {counts.count} total
                          {counts.new > 0 && <span className="text-emerald-400 ml-1">({counts.new} new)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">No new records found.</p>
                )}
              </div>
              {task.result.output && task.result.output.trim() && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Output</p>
                  <pre className="bg-zinc-950 border border-zinc-800 rounded p-3 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {task.result.output}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {task?.status === 'failed' && (
        <div className="bg-red-950/30 border border-red-900 rounded p-4">
          <p className="text-xs text-red-400">Task failed. Check that the Redis worker is running.</p>
        </div>
      )}
    </div>
  )
}

export function ModuleDetail() {
  const params = useParams()
  const modulePath = params['*'] ?? ''
  const navigate = useNavigate()

  const [meta, setMeta] = useState<ModuleMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [running, setRunning] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [runError, setRunError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    setTaskId(null)
    getModule(modulePath)
      .then(data => {
        setMeta(data)
        setValues(Object.fromEntries((data.options ?? []).map(o => [o.name, o.value ?? ''])))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [modulePath])

  const handleSave = async () => {
    if (!meta?.options) return
    setSaving(true)
    const changed = (meta.options ?? [])
      .filter(o => values[o.name] !== (o.value ?? ''))
      .map(o => ({ name: o.name, value: values[o.name] }))
    if (changed.length > 0) {
      const updated = await patchModule(modulePath, changed)
      setMeta(updated)
      setValues(Object.fromEntries((updated.options ?? []).map(o => [o.name, o.value ?? ''])))
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  const handleRun = async () => {
    setRunning(true)
    setRunError('')
    setTaskId(null)
    try {
      const res = await runModule(modulePath)
      setTaskId(res.task)
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Failed to run module')
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  if (error) return <div className="p-8 text-red-400 text-sm">{error}</div>
  if (!meta) return null

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
        <button onClick={() => navigate('/modules')} className="hover:text-zinc-300 transition-colors">Modules</button>
        <span>/</span>
        <span className="text-zinc-300">{modulePath}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{meta.name}</h1>
          <p className="text-sm text-zinc-500 mt-1">{meta.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-zinc-600">by {meta.author}</span>
            {meta.version && <span className="badge-zinc">v{meta.version}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button className="btn-primary" onClick={handleRun} disabled={running}>
            {running ? <Spinner size="sm" /> : '▶ Run Module'}
          </button>
          {runError && <p className="text-xs text-red-400">{runError}</p>}
        </div>
      </div>

      {/* Metadata cards */}
      {(meta.required_keys?.length || meta.dependencies?.length) ? (
        <div className="flex gap-3 mb-6">
          {meta.required_keys?.length ? (
            <div className="card px-4 py-3 flex-1">
              <p className="text-xs text-zinc-500 mb-1.5">Required Keys</p>
              <div className="flex flex-wrap gap-1.5">
                {meta.required_keys.map(k => <span key={k} className="badge-amber">{k}</span>)}
              </div>
            </div>
          ) : null}
          {meta.dependencies?.length ? (
            <div className="card px-4 py-3 flex-1">
              <p className="text-xs text-zinc-500 mb-1.5">Dependencies</p>
              <div className="flex flex-wrap gap-1.5">
                {meta.dependencies.map(d => <span key={d} className="badge-zinc">{d}</span>)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Options */}
      {meta.options && meta.options.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Options</h2>
            <HelpButton title="Module Options">
              <p><strong className="text-zinc-100">SOURCE</strong> is the most important option. It controls what data the module uses as input:</p>
              <ul className="space-y-1.5 text-xs text-zinc-400">
                <li><span className="font-mono text-zinc-300">default</span> — reads all matching rows from the workspace database using the module's built-in query</li>
                <li><span className="font-mono text-zinc-300">example.com</span> — a literal value used as the single input (e.g. a domain, IP, or email)</li>
              </ul>
              <p className="text-xs text-zinc-500 pt-1">Options marked <span className="badge-red inline">required</span> must be set before you can run the module. Save options first, then click Run Module.</p>
            </HelpButton>
          </div>
          <div>
            {meta.options.map(opt => (
              <OptionRow
                key={opt.name}
                opt={opt}
                value={values[opt.name] ?? ''}
                onChange={v => setValues(prev => ({ ...prev, [opt.name]: v }))}
                meta={meta}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Save Options'}
            </button>
            {saved && <span className="text-xs text-emerald-400">Options saved</span>}
          </div>
        </div>
      )}

      {/* Task output */}
      {taskId && <ErrorBoundary><TaskPanel taskId={taskId} /></ErrorBoundary>}
    </div>
  )
}
