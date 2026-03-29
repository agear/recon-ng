import { useEffect, useState } from 'react'
import { getKeys, addKey, deleteKey, KeyRecord } from '../api/client'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'

export function Keys() {
  const [keys, setKeys] = useState<KeyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    getKeys()
      .then(d => setKeys(d.keys))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleAdd = async () => {
    if (!newName.trim() || !newValue.trim()) return
    setAdding(true)
    setAddError('')
    try {
      await addKey(newName.trim(), newValue.trim())
      setShowAdd(false)
      setNewName('')
      setNewValue('')
      load()
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add key')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteKey(toDelete)
      setToDelete(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  const mask = (val: string) => val.length <= 8 ? '••••••••' : val.slice(0, 4) + '••••' + val.slice(-4)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">API Keys</h1>
          <p className="text-sm text-zinc-500 mt-1">Keys are stored in the global recon-ng keystore and shared across workspaces.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Key</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : keys.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-zinc-500 text-sm">No API keys stored.</p>
          <p className="text-zinc-600 text-xs mt-1">Add keys to enable modules that require external APIs.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium uppercase tracking-wider">Value</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.name} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-4 py-3 text-zinc-200 font-medium">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {k.value
                      ? (revealed[k.name] ? k.value : mask(k.value))
                      : <span className="text-zinc-600">not set</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {k.value && (
                        <button
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                          onClick={() => setRevealed(r => ({ ...r, [k.name]: !r[k.name] }))}
                        >
                          {revealed[k.name] ? 'Hide' : 'Show'}
                        </button>
                      )}
                      <button
                        className="btn-danger py-0.5 px-2 text-xs"
                        onClick={() => setToDelete(k.name)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal
          title="Add API Key"
          onClose={() => { setShowAdd(false); setNewName(''); setNewValue(''); setAddError('') }}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAdd} disabled={adding || !newName.trim() || !newValue.trim()}>
                {adding ? <Spinner size="sm" /> : 'Save Key'}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Key name</label>
              <input className="input" placeholder="e.g. shodan_api" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Key value</label>
              <input className="input" type="password" placeholder="Paste your API key" value={newValue} onChange={e => setNewValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            </div>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
          </div>
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="Remove Key"
          onClose={() => setToDelete(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setToDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Spinner size="sm" /> : 'Remove'}
              </button>
            </>
          }
        >
          <p className="text-sm text-zinc-300">
            Remove key <span className="text-brand font-semibold">{toDelete}</span>?
          </p>
        </Modal>
      )}
    </div>
  )
}
