import { useEffect, useMemo, useState } from 'react'
import { getKeys, addKey, deleteKey, getMarketplace, KeyRecord } from '../api/client'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { HelpButton } from '../components/help/HelpButton'

interface KeyInfo {
  label: string
  description: string
  url: string
  urlLabel?: string
}

const KEY_INFO: Record<string, KeyInfo> = {
  bing_api: {
    label: 'Bing API Key',
    description: 'Sign up for the Bing Search API via Microsoft Cognitive Services. After subscribing, the key will be available on the "My Account" tab under the "Bing Search" heading.',
    url: 'https://www.microsoft.com/cognitive-services/en-us/bing-web-search-api',
    urlLabel: 'Sign up for Bing Search API',
  },
  builtwith_api: {
    label: 'BuiltWith API Key',
    description: 'Sign up for a free account. After signing in the API key will be displayed in the upper right of the screen.',
    url: 'https://api.builtwith.com/',
    urlLabel: 'api.builtwith.com',
  },
  censysio_id: {
    label: 'Censys API ID',
    description: 'Register for a free (rate-limited) account. After registering, view your API credentials on the account API page.',
    url: 'https://censys.io/register',
    urlLabel: 'censys.io/register',
  },
  censysio_secret: {
    label: 'Censys API Secret',
    description: 'Obtained together with the Censys API ID. View your credentials on the Censys account API page.',
    url: 'https://censys.io/account/api',
    urlLabel: 'censys.io/account/api',
  },
  flickr_api: {
    label: 'Flickr API Key',
    description: 'Create a Flickr account, then apply for a non-commercial API key. After approval you will receive a 32-character Key — recon-ng uses the Key only (not the Secret).',
    url: 'https://www.flickr.com/services/apps/create/apply/',
    urlLabel: 'Apply for Flickr API key',
  },
  fullcontact_api: {
    label: 'FullContact API Key',
    description: 'Create a FullContact account. The API key will be available in your dashboard after registration.',
    url: 'https://dashboard.fullcontact.com/consents',
    urlLabel: 'dashboard.fullcontact.com',
  },
  google_api: {
    label: 'Google API Key',
    description: 'Create an API project in Google Cloud Console. The key will be in the Credentials section. Be sure to enable the APIs your modules need: Custom Search, YouTube Data, and/or Maps JavaScript.',
    url: 'https://console.developers.google.com/apis/dashboard',
    urlLabel: 'Google Cloud Console',
  },
  google_cse: {
    label: 'Google Custom Search Engine ID',
    description: 'Create a Custom Search Engine (CSE). The CSE ID appears in the management console. Configure it to search the entire web for best results — otherwise results are limited to specified domains.',
    url: 'https://programmablesearchengine.google.com/cse/all',
    urlLabel: 'Create a Custom Search Engine',
  },
  github_api: {
    label: 'GitHub API Key',
    description: 'Generate a personal access token. No special permissions are required — just generate the token and copy it.',
    url: 'https://github.com/settings/tokens/new',
    urlLabel: 'github.com/settings/tokens/new',
  },
  hashes_api: {
    label: 'Hashes.org API Key',
    description: 'Register an account and confirm via email. After logging in, visit your settings page — the API key will be listed there.',
    url: 'https://hashes.org/register.php',
    urlLabel: 'hashes.org/register.php',
  },
  ipinfodb_api: {
    label: 'IPInfoDB API Key',
    description: 'Create a free account and log in. The API key will be available on the "Account" tab.',
    url: 'http://ipinfodb.com/register.php',
    urlLabel: 'ipinfodb.com/register.php',
  },
  shodan_api: {
    label: 'Shodan API Key',
    description: 'Create a Shodan account or sign in. The API key will appear on the right side of your account page. An upgraded account is required for advanced search features.',
    url: 'https://www.shodan.io/',
    urlLabel: 'shodan.io',
  },
  twitter_api: {
    label: 'Twitter Consumer Key',
    description: 'Create a Twitter developer application. The Consumer Key will be available on the application management page.',
    url: 'https://developer.twitter.com/en/apps',
    urlLabel: 'developer.twitter.com/en/apps',
  },
  twitter_secret: {
    label: 'Twitter Consumer Secret',
    description: 'Obtained alongside the Twitter Consumer Key. See the application management page for the app you created.',
    url: 'https://developer.twitter.com/en/apps',
    urlLabel: 'developer.twitter.com/en/apps',
  },
  virustotal_api: {
    label: 'VirusTotal API Key',
    description: 'Register for a free account and activate via email. After logging in, go to your profile → "My API Key". A free public API key is sufficient for most modules.',
    url: 'https://www.virustotal.com/gui/join-us',
    urlLabel: 'virustotal.com/gui/join-us',
  },
  hunter_io: {
    label: 'Hunter.io API Key',
    description: 'Sign up for a Hunter.io account. The API key is available on the API Keys page in your dashboard.',
    url: 'https://hunter.io/api-keys',
    urlLabel: 'hunter.io/api-keys',
  },
}

export function Keys() {
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null)
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
  const [inlineValues, setInlineValues] = useState<Record<string, string>>({})
  const [inlineSaving, setInlineSaving] = useState<Record<string, boolean>>({})
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({})
  const [requiredByInstalled, setRequiredByInstalled] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([getKeys(), getMarketplace()])
      .then(([keysData, mkt]) => {
        setKeys(keysData.keys)
        const installedKeys = new Set(
          mkt.modules
            .filter(m => m.status === 'installed' || m.status === 'outdated' || m.status === 'disabled')
            .flatMap(m => m.required_keys ?? [])
        )
        setRequiredByInstalled(installedKeys)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const visibleKeys = useMemo(() => {
    if (showAll) return keys
    // Show stored keys + keys required by installed modules (as "not set" placeholder rows)
    const storedNames = new Set(keys.map(k => k.name))
    const extraRows: KeyRecord[] = [...requiredByInstalled]
      .filter(name => !storedNames.has(name))
      .map(name => ({ name, value: '' }))
    const filtered = keys.filter(k => k.value || requiredByInstalled.has(k.name))
    return [...filtered, ...extraRows].sort((a, b) => a.name.localeCompare(b.name))
  }, [keys, requiredByInstalled, showAll])

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

  const handleInlineSave = async (name: string) => {
    const value = inlineValues[name]?.trim()
    if (!value) return
    setInlineSaving(prev => ({ ...prev, [name]: true }))
    setInlineErrors(prev => ({ ...prev, [name]: '' }))
    try {
      await addKey(name, value)
      setInlineValues(prev => ({ ...prev, [name]: '' }))
      load()
    } catch (e) {
      setInlineErrors(prev => ({ ...prev, [name]: e instanceof Error ? e.message : 'Failed' }))
    } finally {
      setInlineSaving(prev => ({ ...prev, [name]: false }))
    }
  }

  const mask = (val: string) => val.length <= 8 ? '••••••••' : val.slice(0, 4) + '••••' + val.slice(-4)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-100">API Keys</h1>
            <HelpButton title="API Keys">
              <p>API keys are stored in a global keystore and shared across all workspaces. Modules that require a key will not run until it's present.</p>
              <p className="text-xs text-zinc-500">Where to get common keys:</p>
              <ul className="space-y-1.5 text-xs text-zinc-400">
                <li><span className="font-mono text-zinc-300">shodan_api</span> — <span className="text-zinc-500">account.shodan.io/register</span></li>
                <li><span className="font-mono text-zinc-300">hunter_io</span> — <span className="text-zinc-500">hunter.io/api-keys</span></li>
                <li><span className="font-mono text-zinc-300">virustotal_api</span> — <span className="text-zinc-500">virustotal.com/gui/my-apikey</span></li>
                <li><span className="font-mono text-zinc-300">google_api</span> — <span className="text-zinc-500">console.developers.google.com</span></li>
                <li><span className="font-mono text-zinc-300">google_cse</span> — <span className="text-zinc-500">cse.google.com (Custom Search Engine ID)</span></li>
                <li><span className="font-mono text-zinc-300">github_api</span> — <span className="text-zinc-500">github.com/settings/tokens</span></li>
              </ul>
              <p className="text-xs text-zinc-600 pt-1">Key values are masked by default. Click Show to reveal a stored key.</p>
            </HelpButton>
          </div>
          <p className="text-sm text-zinc-500 mt-1">Keys are stored in the global recon-ng keystore and shared across workspaces.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Key</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : visibleKeys.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-zinc-500 text-sm">No API keys stored.</p>
          <p className="text-zinc-600 text-xs mt-1">Add keys to enable modules that require external APIs.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-600">
              {showAll ? `Showing all ${keys.length} keys` : `Showing ${visibleKeys.length} keys required by installed modules`}
            </p>
            <button className="text-xs text-brand hover:underline" onClick={() => setShowAll(v => !v)}>
              {showAll ? 'Show relevant only' : `Show all (${keys.length})`}
            </button>
          </div>
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
              {visibleKeys.map(k => (
                <tr key={k.name} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-4 py-3">
                    {KEY_INFO[k.name] ? (
                      <button
                        className="text-zinc-200 font-medium hover:text-brand transition-colors text-left"
                        onClick={() => setKeyInfo(KEY_INFO[k.name])}
                        title="View setup instructions"
                      >
                        {k.name}
                      </button>
                    ) : (
                      <span className="text-zinc-200 font-medium">{k.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {k.value
                      ? (revealed[k.name] ? k.value : mask(k.value))
                      : (
                        <div className="flex items-center gap-2">
                          <input
                            className="input text-xs py-0.5 w-48"
                            type="password"
                            placeholder="Paste key value…"
                            value={inlineValues[k.name] ?? ''}
                            onChange={e => setInlineValues(prev => ({ ...prev, [k.name]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleInlineSave(k.name)}
                          />
                          <button
                            className="btn-primary py-0.5 px-2 text-xs"
                            disabled={!inlineValues[k.name]?.trim() || inlineSaving[k.name]}
                            onClick={() => handleInlineSave(k.name)}
                          >
                            {inlineSaving[k.name] ? <Spinner size="sm" /> : 'Save'}
                          </button>
                          {inlineErrors[k.name] && <span className="text-red-400 text-xs">{inlineErrors[k.name]}</span>}
                        </div>
                      )
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
        </>
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

      {keyInfo && (
        <Modal title={keyInfo.label} onClose={() => setKeyInfo(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-300">{keyInfo.description}</p>
            <a
              href={keyInfo.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
            >
              {keyInfo.urlLabel ?? keyInfo.url}
              <span className="text-xs">↗</span>
            </a>
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
