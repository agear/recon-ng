import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { getModule, patchModule, runModule, getKeys, addKey, deleteKey, checkDeps, installDeps, installModule, ModuleMeta, ModuleOption } from '../api/client'
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

const DB_TABLES = ['domains', 'hosts', 'contacts', 'credentials', 'leaks', 'ports',
  'vulnerabilities', 'companies', 'netblocks', 'locations', 'pushpins', 'profiles', 'repositories']
const TABLE_RE = new RegExp(`\\b(${DB_TABLES.join('|')})\\b`, 'gi')

function DescriptionWithTableLinks({ text, className }: { text: string; className?: string }) {
  const parts: (string | JSX.Element)[] = []
  let last = 0
  let match: RegExpExecArray | null
  TABLE_RE.lastIndex = 0
  while ((match = TABLE_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const name = match[1].toLowerCase()
    parts.push(
      <Link key={match.index} to={`/data/${name}`} className="text-brand hover:underline">
        {match[1]}
      </Link>
    )
    last = match.index + match[1].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <p className={className}>{parts}</p>
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
            <DescriptionWithTableLinks text={meta.description} className="text-xs text-zinc-300" />
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

function OptionRow({ opt, value, onChange, meta, id, highlighted }: { opt: ModuleOption; value: string; onChange: (v: string) => void; meta: ModuleMeta; id?: string; highlighted?: boolean }) {
  const [showInfo, setShowInfo] = useState(false)
  return (
    <div
      id={id}
      className={`grid grid-cols-3 gap-4 items-start py-3 border-b border-zinc-800/50 last:border-0 rounded transition-colors duration-300 ${highlighted ? 'bg-amber-950/30' : ''}`}
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-200 font-medium">{opt.name}</span>
          {opt.required && <span className="badge-red">required</span>}
        </div>
        <OptionDescription description={opt.description} onInfoClick={() => setShowInfo(true)} />
      </div>
      <input
        className={`input col-span-2 ${highlighted ? 'ring-2 ring-amber-500' : ''}`}
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
  const [notFound, setNotFound] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [running, setRunning] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [runError, setRunError] = useState('')
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState('')

  // Keys
  const [storedKeys, setStoredKeys] = useState<Set<string>>(new Set())
  const [keyValues, setKeyValues] = useState<Record<string, string>>({})
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [rotatingKeys, setRotatingKeys] = useState<Set<string>>(new Set())
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({})
  const [keyAdding, setKeyAdding] = useState<Record<string, boolean>>({})
  const [keyErrors, setKeyErrors] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)


  // Highlight state for missing fields
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())

  // Deps
  const [depsSatisfied, setDepsSatisfied] = useState<Record<string, boolean> | null>(null)
  const [installingDeps, setInstallingDeps] = useState(false)
  const [depsResult, setDepsResult] = useState<{ success: boolean; output: string; error: string } | null>(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    setNotFound(false)
    setTaskId(null)
    setDepsSatisfied(null)
    setDepsResult(null)
    getModule(modulePath)
      .then(async data => {
        setMeta(data)
        setValues(Object.fromEntries((data.options ?? []).map(o => [o.name, o.value ?? ''])))
        await Promise.all([
          getKeys()
            .then(r => {
              const setKeys = r.keys.filter(k => k.value)
              setStoredKeys(new Set(setKeys.map(k => k.name)))
              setKeyValues(Object.fromEntries(setKeys.map(k => [k.name, k.value])))
            })
            .catch(() => {}),
          data.dependencies?.length
            ? checkDeps(data.dependencies).then(setDepsSatisfied).catch(() => {})
            : Promise.resolve(),
        ])
      })
      .catch(e => {
        if (e.message.startsWith('404')) setNotFound(true)
        else setError(e.message)
      })
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

  const handleRunOrHighlight = () => {
    if (!meta) return
    const missingIds: string[] = []
    for (const opt of (meta.options ?? [])) {
      if (opt.required && !String(values[opt.name] ?? '').trim()) missingIds.push(`option-${opt.name}`)
    }
    for (const key of (meta.required_keys ?? [])) {
      if (!storedKeys.has(key) && !savedKeys.has(key)) missingIds.push(`key-${key}`)
    }
    if ((meta.dependencies ?? []).some(d => depsSatisfied != null && depsSatisfied[d] === false)) {
      missingIds.push('deps-card')
    }
    if (missingIds.length > 0) {
      document.getElementById(missingIds[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlighted(new Set(missingIds))
      setTimeout(() => setHighlighted(new Set()), 2000)
      return
    }
    handleRun()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  if (notFound) return (
    <div className="p-8 max-w-lg">
      <div className="card p-6 flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-300">Module not installed</p>
          <p className="text-xs text-zinc-500 font-mono mt-1">{modulePath}</p>
        </div>
        <p className="text-sm text-zinc-400">This module is not currently installed.</p>
        <a
          href={`https://github.com/lanmaster53/recon-ng-modules/blob/master/modules/${modulePath}.py`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 hover:text-brand transition-colors"
        >
          View source on GitHub ↗
        </a>
        <div className="flex items-center gap-3">
          <button
            className="btn-primary text-sm"
            disabled={installing}
            onClick={async () => {
              setInstalling(true)
              setInstallError('')
              try {
                await installModule(modulePath)
                // Re-fetch the module — it should now be loaded
                const data = await getModule(modulePath)
                setMeta(data)
                setValues(Object.fromEntries((data.options ?? []).map(o => [o.name, o.value ?? ''])))
                setNotFound(false)
                await Promise.all([
                  getKeys().then(r => {
                    const setKeys = r.keys.filter(k => k.value)
                    setStoredKeys(new Set(setKeys.map(k => k.name)))
                    setKeyValues(Object.fromEntries(setKeys.map(k => [k.name, k.value])))
                  }).catch(() => {}),
                  data.dependencies?.length ? checkDeps(data.dependencies).then(setDepsSatisfied).catch(() => {}) : Promise.resolve(),
                ])
              } catch (e) {
                setInstallError(e instanceof Error ? e.message : 'Install failed')
              } finally {
                setInstalling(false)
              }
            }}
          >
            {installing ? <Spinner size="sm" /> : '⬇ Install Module'}
          </button>
          <button
            onClick={() => navigate(`/marketplace?q=${encodeURIComponent(modulePath)}`)}
            className="text-sm text-brand hover:underline"
          >
            Go to Marketplace →
          </button>
        </div>
        {installError && <p className="text-xs text-red-400">{installError}</p>}
      </div>
    </div>
  )
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
          <DescriptionWithTableLinks text={meta.description ?? ''} className="text-sm text-zinc-500 mt-1" />
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-zinc-600">by {meta.author}</span>
            {meta.version && <span className="badge-zinc">v{meta.version}</span>}
            <a
              href={`https://github.com/lanmaster53/recon-ng-modules/blob/master/modules/${modulePath}.py`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-brand transition-colors"
            >
              View source ↗
            </a>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {(() => {
            const missingOpts = (meta.options ?? []).filter(o => o.required && !String(values[o.name] ?? '').trim())
            const missingKeys = (meta.required_keys ?? []).filter(k => !storedKeys.has(k) && !savedKeys.has(k))
            const missingDeps = (meta.dependencies ?? []).filter(d => depsSatisfied != null && depsSatisfied[d] === false)
            const blocked = missingOpts.length > 0 || missingKeys.length > 0 || missingDeps.length > 0
            return (
              <>
                <button
                  className={blocked ? 'btn-primary opacity-50' : 'btn-primary'}
                  onClick={handleRunOrHighlight}
                  disabled={running}
                  title={blocked ? 'Required fields are missing — click to see what needs to be filled in' : undefined}
                >
                  {running ? <Spinner size="sm" /> : '▶ Run Module'}
                </button>
                {blocked && !running && (
                  <p className="text-xs text-amber-500 text-right max-w-[180px]">
                    {[
                      missingOpts.length > 0 && `${missingOpts.length} required option${missingOpts.length > 1 ? 's' : ''}`,
                      missingKeys.length > 0 && `${missingKeys.length} missing key${missingKeys.length > 1 ? 's' : ''}`,
                      missingDeps.length > 0 && `${missingDeps.length} unmet dep${missingDeps.length > 1 ? 's' : ''}`,
                    ].filter(Boolean).join(', ')}
                  </p>
                )}
              </>
            )
          })()}
          {runError && <p className="text-xs text-red-400">{runError}</p>}
        </div>
      </div>

      {/* Metadata cards */}
      {(meta.required_keys?.length || meta.dependencies?.length) ? (() => {
        const allKeysSatisfied = !!(meta.required_keys?.length && meta.required_keys.every(k => storedKeys.has(k) || savedKeys.has(k)))
        const allDepsSatisfied = !!(meta.dependencies?.length && depsSatisfied != null && meta.dependencies.every(d => depsSatisfied[d]))
        return (
          <div className="flex gap-3 mb-6 flex-wrap">
            {meta.required_keys?.length ? (
              <div className="card px-4 py-4 flex-1 min-w-[220px]">
                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${allKeysSatisfied ? 'text-emerald-400' : 'text-amber-400'}`}>
                  Required Keys
                </p>
                <div className="flex flex-col gap-2">
                  {meta.required_keys.map(key => {
                    const isStored = (storedKeys.has(key) || savedKeys.has(key)) && !rotatingKeys.has(key)
                    const saveKey = async () => {
                      if (!keyInputs[key]?.trim()) return
                      setKeyAdding(prev => ({ ...prev, [key]: true }))
                      setKeyErrors(prev => ({ ...prev, [key]: '' }))
                      try {
                        const newVal = keyInputs[key].trim()
                        await addKey(key, newVal)
                        setSavedKeys(prev => new Set([...prev, key]))
                        setStoredKeys(prev => new Set([...prev, key]))
                        setKeyValues(prev => ({ ...prev, [key]: newVal }))
                        setRotatingKeys(prev => { const s = new Set(prev); s.delete(key); return s })
                        setKeyInputs(prev => ({ ...prev, [key]: '' }))
                      } catch (err) {
                        setKeyErrors(prev => ({ ...prev, [key]: err instanceof Error ? err.message : 'Failed' }))
                      } finally {
                        setKeyAdding(prev => ({ ...prev, [key]: false }))
                      }
                    }
                    return (
                      <div key={key} id={`key-${key}`} className={`flex flex-col gap-1.5 bg-zinc-950 rounded px-3 py-2.5 transition-colors duration-300 ${highlighted.has(`key-${key}`) ? 'ring-2 ring-amber-500' : ''}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-brand flex-1">{key}</span>
                          {isStored && <span className="badge-green">stored</span>}
                          {isStored && revealed[key] && (
                            <span className="text-xs font-mono text-zinc-400 break-all">{keyValues[key]}</span>
                          )}
                          {confirmRemove === key ? (
                            <>
                              <span className="text-xs text-zinc-500">Remove?</span>
                              <button
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                onClick={async () => {
                                  try {
                                    await deleteKey(key)
                                    setStoredKeys(prev => { const s = new Set(prev); s.delete(key); return s })
                                    setSavedKeys(prev => { const s = new Set(prev); s.delete(key); return s })
                                    setKeyValues(prev => { const v = { ...prev }; delete v[key]; return v })
                                  } catch {}
                                  setConfirmRemove(null)
                                }}
                              >Yes</button>
                              <button
                                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                                onClick={() => setConfirmRemove(null)}
                              >Cancel</button>
                            </>
                          ) : (
                            <>
                              {isStored && (
                                <>
                                  <button
                                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                                    onClick={() => setRevealed(r => ({ ...r, [key]: !r[key] }))}
                                  >
                                    {revealed[key] ? 'Hide' : 'Show'}
                                  </button>
                                  <button
                                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                                    onClick={() => setRotatingKeys(prev => new Set([...prev, key]))}
                                  >
                                    Rotate
                                  </button>
                                  <button
                                    className="text-xs text-red-500 hover:text-red-400 transition-colors"
                                    onClick={() => setConfirmRemove(key)}
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                              {rotatingKeys.has(key) && (
                                <button
                                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                                  onClick={() => {
                                    setRotatingKeys(prev => { const s = new Set(prev); s.delete(key); return s })
                                    setKeyInputs(prev => ({ ...prev, [key]: '' }))
                                  }}
                                >
                                  Cancel
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {!isStored && (
                          <div className="flex gap-2">
                            <input
                              className="input text-xs py-1 flex-1"
                              type="password"
                              placeholder={rotatingKeys.has(key) ? 'New key value…' : 'Paste key value…'}
                              value={keyInputs[key] ?? ''}
                              onChange={e => setKeyInputs(prev => ({ ...prev, [key]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') saveKey() }}
                              autoFocus={rotatingKeys.has(key)}
                            />
                            <button
                              className="btn-primary text-xs py-1 px-3"
                              disabled={!keyInputs[key]?.trim() || keyAdding[key]}
                              onClick={saveKey}
                            >
                              {keyAdding[key] ? <Spinner size="sm" /> : 'Save'}
                            </button>
                          </div>
                        )}
                        {keyErrors[key] && <p className="text-xs text-red-400">{keyErrors[key]}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
            {meta.dependencies?.length ? (
              <div id="deps-card" className={`card px-4 py-4 flex-1 min-w-[220px] transition-colors duration-300 ${highlighted.has('deps-card') ? 'ring-2 ring-amber-500' : ''}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${allDepsSatisfied ? 'text-emerald-400' : 'text-amber-400'}`}>
                  Dependencies
                </p>
                <div className="flex flex-col gap-1 mb-3">
                  {meta.dependencies.map(dep => {
                    const satisfied = depsSatisfied?.[dep]
                    return (
                      <div key={dep} className="flex items-center gap-2 bg-zinc-950 rounded px-3 py-2">
                        <span className="font-mono text-xs text-brand flex-1">{dep}</span>
                        {satisfied != null && (
                          <span className={satisfied ? 'badge-green' : 'badge-amber'}>{satisfied ? 'satisfied' : 'missing'}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {allDepsSatisfied && !depsResult && (
                  <p className="text-xs text-emerald-400 mb-3">All dependencies are satisfied.</p>
                )}
                {depsResult && (
                  <div className={`rounded p-3 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto mb-3 ${depsResult.success ? 'bg-emerald-950/30 border border-emerald-900/50 text-emerald-300' : 'bg-red-950/30 border border-red-900 text-red-300'}`}>
                    {depsResult.success ? depsResult.output : depsResult.error || depsResult.output}
                  </div>
                )}
                <button
                  className="btn-primary text-xs"
                  disabled={installingDeps || depsResult?.success === true || allDepsSatisfied}
                  onClick={async () => {
                    setInstallingDeps(true)
                    setDepsResult(null)
                    try {
                      const r = await installDeps(meta.dependencies!)
                      setDepsResult(r)
                      if (r.success) checkDeps(meta.dependencies!).then(setDepsSatisfied).catch(() => {})
                    } catch (e) {
                      setDepsResult({ success: false, output: '', error: e instanceof Error ? e.message : 'Failed' })
                    } finally {
                      setInstallingDeps(false)
                    }
                  }}
                >
                  {installingDeps ? <Spinner size="sm" /> : '⬇ Install Packages'}
                </button>
              </div>
            ) : null}
          </div>
        )
      })() : null}

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
                id={`option-${opt.name}`}
                highlighted={highlighted.has(`option-${opt.name}`)}
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
