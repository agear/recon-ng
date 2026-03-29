import { useState } from 'react'
import { getWorkspace, deleteWorkspace, updateWorkspaceOptions, WorkspaceResponse, WorkspaceOption } from '../api/client'
import { useWorkspace } from '../hooks/useWorkspace'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { HelpButton } from '../components/help/HelpButton'

function OptionsForm({ workspace, options, onSave }: { workspace: string; options: WorkspaceOption[]; onSave: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(options.map(o => [o.name, o.value ?? '']))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const changed = options
      .filter(o => values[o.name] !== (o.value ?? ''))
      .map(o => ({ name: o.name, value: values[o.name] }))
    if (changed.length > 0) {
      await updateWorkspaceOptions(workspace, changed)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
    onSave()
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Global Options</h3>
      {options.map(opt => (
        <div key={opt.name} className="grid grid-cols-3 gap-3 items-start">
          <div>
            <p className="text-xs font-medium text-zinc-300">{opt.name}</p>
            <p className="text-xs text-zinc-600">{opt.description}</p>
          </div>
          <input
            className="input col-span-2"
            value={values[opt.name]}
            onChange={e => setValues(v => ({ ...v, [opt.name]: e.target.value }))}
            placeholder="Not set"
          />
        </div>
      ))}
      <div className="flex items-center gap-3 mt-1">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size="sm" /> : 'Save'}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>
    </div>
  )
}

function WorkspaceRow({ name }: { name: string }) {
  const { active, setActive, refresh } = useWorkspace()
  const isActive = name === active
  const [detail, setDetail] = useState<WorkspaceResponse | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const expand = async () => {
    if (!expanded && !detail) {
      setLoading(true)
      const data = await getWorkspace(name)
      setDetail(data)
      setLoading(false)
    }
    setExpanded(e => !e)
  }

  const handleActivate = async () => {
    await setActive(name)
    setDetail(null)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await deleteWorkspace(name)
    setDeleting(false)
    setShowDelete(false)
    refresh()
  }

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/30 transition-colors"
        onClick={expand}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-200 font-medium">{name}</span>
          {isActive && <span className="badge-green">active</span>}
        </div>
        <div className="flex items-center gap-2">
          {!isActive && (
            <button
              className="btn-ghost text-xs"
              onClick={e => { e.stopPropagation(); handleActivate() }}
            >
              Activate
            </button>
          )}
          {!isActive && (
            <button
              className="btn-danger text-xs"
              onClick={e => { e.stopPropagation(); setShowDelete(true) }}
            >
              Delete
            </button>
          )}
          <span className="text-zinc-600 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-800">
          {loading ? (
            <div className="py-4 flex justify-center"><Spinner /></div>
          ) : detail && isActive ? (
            <OptionsForm workspace={name} options={detail.options} onSave={() => {}} />
          ) : (
            <p className="text-xs text-zinc-600 mt-3">Activate this workspace to view and edit its options.</p>
          )}
        </div>
      )}

      {showDelete && (
        <Modal
          title="Delete Workspace"
          onClose={() => setShowDelete(false)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setShowDelete(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Spinner size="sm" /> : 'Delete'}
              </button>
            </>
          }
        >
          <p className="text-sm text-zinc-300">
            Delete workspace <span className="text-brand font-semibold">{name}</span>?
            This will permanently remove all data.
          </p>
        </Modal>
      )}
    </div>
  )
}

export function Workspaces() {
  const { workspaces } = useWorkspace()

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-zinc-100">Workspaces</h1>
          <HelpButton title="Workspaces">
            <p>Each workspace is a separate SQLite database. Create one per target or engagement to keep all findings isolated.</p>
            <p>Expanding a workspace row (when it's active) reveals <strong className="text-zinc-100">Global Options</strong> — settings that apply to every module run in that workspace:</p>
            <ul className="space-y-1 text-xs text-zinc-400">
              <li><span className="font-mono text-zinc-300">nameserver</span> — DNS resolver to use (default: 8.8.8.8)</li>
              <li><span className="font-mono text-zinc-300">proxy</span> — HTTP proxy for all module requests (host:port)</li>
              <li><span className="font-mono text-zinc-300">threads</span> — number of concurrent threads (default: 10)</li>
              <li><span className="font-mono text-zinc-300">timeout</span> — socket timeout in seconds (default: 10)</li>
              <li><span className="font-mono text-zinc-300">user-agent</span> — custom User-Agent header for HTTP requests</li>
              <li><span className="font-mono text-zinc-300">verbosity</span> — output level: 0 = quiet, 1 = verbose, 2 = debug</li>
            </ul>
          </HelpButton>
        </div>
        <p className="text-sm text-zinc-500 mt-1">Each workspace has an isolated database. Use the sidebar to create new ones.</p>
      </div>

      <div className="flex flex-col gap-3">
        {workspaces.length === 0 ? (
          <p className="text-sm text-zinc-600">No workspaces found.</p>
        ) : (
          workspaces.map(w => <WorkspaceRow key={w} name={w} />)
        )}
      </div>
    </div>
  )
}
