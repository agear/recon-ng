import { useEffect, useState } from 'react'
import { getSnapshots, takeSnapshot, loadSnapshot, deleteSnapshot } from '../api/client'
import { useWorkspace } from '../hooks/useWorkspace'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'

function snapshotDate(name: string): string {
  // snapshot_YYYYMMDDHHMMSS.db
  const m = name.match(/snapshot_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.db/)
  if (!m) return name
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`
}

export function Snapshots() {
  const [snapshots, setSnapshots] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [taking, setTaking] = useState(false)
  const [error, setError] = useState('')
  const [toLoad, setToLoad] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { active } = useWorkspace()

  const refresh = () => {
    setLoading(true)
    getSnapshots()
      .then(d => setSnapshots(d.snapshots))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [active])

  const handleTake = async () => {
    setTaking(true)
    setError('')
    try {
      await takeSnapshot()
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to take snapshot')
    } finally {
      setTaking(false)
    }
  }

  const handleLoad = async () => {
    if (!toLoad) return
    setBusy(true)
    try {
      await loadSnapshot(toLoad)
      setToLoad(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load snapshot')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setBusy(true)
    try {
      await deleteSnapshot(toDelete)
      setToDelete(null)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete snapshot')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Snapshots</h1>
          <p className="text-sm text-zinc-500 mt-1">Point-in-time copies of the active workspace database.</p>
        </div>
        <button className="btn-primary" onClick={handleTake} disabled={taking}>
          {taking ? <Spinner size="sm" /> : '+ Take Snapshot'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : snapshots.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-zinc-500 text-sm">No snapshots yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Click <strong className="text-zinc-400">+ Take Snapshot</strong> to save the current state of your workspace database.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {snapshots.map((s, i) => (
            <div key={s} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-zinc-800' : ''}`}>
              <div>
                <p className="text-sm text-zinc-200 font-mono">{snapshotDate(s)}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{s}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost text-xs" onClick={() => setToLoad(s)}>Restore</button>
                <button className="btn-danger text-xs" onClick={() => setToDelete(s)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toLoad && (
        <Modal
          title="Restore Snapshot"
          onClose={() => setToLoad(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setToLoad(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleLoad} disabled={busy}>
                {busy ? <Spinner size="sm" /> : 'Restore'}
              </button>
            </>
          }
        >
          <p className="text-sm text-zinc-300">
            Restore <span className="text-brand font-mono">{snapshotDate(toLoad)}</span>?
          </p>
          <p className="text-xs text-zinc-500 mt-2">This will overwrite the current workspace database. All data added since this snapshot will be lost.</p>
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="Delete Snapshot"
          onClose={() => setToDelete(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setToDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={busy}>
                {busy ? <Spinner size="sm" /> : 'Delete'}
              </button>
            </>
          }
        >
          <p className="text-sm text-zinc-300">Delete snapshot <span className="text-brand font-mono">{snapshotDate(toDelete)}</span>?</p>
        </Modal>
      )}
    </div>
  )
}
