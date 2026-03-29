import { ReactNode, useEffect, useState } from 'react'

export const QUICKSTART_STORAGE_KEY = 'recon_ng_quickstart_v1'

interface Step {
  icon: string
  title: string
  body: ReactNode
}

const STEPS: Step[] = [
  {
    icon: '🔍',
    title: 'Welcome to Recon-ng',
    body: (
      <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
        <p>
          Recon-ng is an open-source <strong className="text-zinc-100">OSINT (Open Source Intelligence)</strong> framework
          that automates the collection of publicly available information about domains, companies, people, and IP addresses.
        </p>
        <p>
          It works by running small, focused scripts called <strong className="text-zinc-100">modules</strong>.
          Each module queries one data source — DNS resolvers, search engines, social networks, threat feeds — and
          saves the results to a structured local database.
        </p>
        <p className="text-xs text-zinc-500 pt-1">
          This guide takes about 2 minutes. You can skip it at any time or reopen it from the sidebar.
        </p>
      </div>
    ),
  },
  {
    icon: '📁',
    title: 'Start with a Workspace',
    body: (
      <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
        <p>
          Every investigation lives in a <strong className="text-zinc-100">workspace</strong> — an isolated database
          that keeps findings from different targets completely separate.
        </p>
        <p>Create one workspace per target or engagement:</p>
        <ul className="space-y-1.5 text-xs text-zinc-400 ml-1">
          <li className="flex items-start gap-2"><span className="text-brand mt-0.5">›</span><span>Use the dropdown in the sidebar to switch between workspaces</span></li>
          <li className="flex items-start gap-2"><span className="text-brand mt-0.5">›</span><span>Click <strong className="text-zinc-200">+ New workspace</strong> to create one for your current target</span></li>
          <li className="flex items-start gap-2"><span className="text-brand mt-0.5">›</span><span>Each workspace gets its own tables: domains, hosts, contacts, credentials, and more</span></li>
        </ul>
      </div>
    ),
  },
  {
    icon: '📦',
    title: 'Install Modules from the Marketplace',
    body: (
      <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
        <p>
          Recon-ng ships with no modules pre-installed. Head to the <strong className="text-zinc-100">Marketplace</strong> to
          browse the full catalog and install what you need.
        </p>
        <p className="text-xs text-zinc-500">Modules are organized by category:</p>
        <div className="space-y-2 text-xs">
          <div className="flex gap-3 items-start">
            <span className="font-mono text-brand w-28 flex-shrink-0">recon/</span>
            <span className="text-zinc-400">Pivot existing data into new data — the primary category for chaining discoveries</span>
          </div>
          <div className="flex gap-3 items-start">
            <span className="font-mono text-brand w-28 flex-shrink-0">discovery/</span>
            <span className="text-zinc-400">Actively probe hosts, ports, and networks</span>
          </div>
          <div className="flex gap-3 items-start">
            <span className="font-mono text-brand w-28 flex-shrink-0">harvest/</span>
            <span className="text-zinc-400">Collect emails, credentials, and social profiles</span>
          </div>
          <div className="flex gap-3 items-start">
            <span className="font-mono text-brand w-28 flex-shrink-0">reporting/</span>
            <span className="text-zinc-400">Generate formatted output files and reports</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: '🔑',
    title: 'Add API Keys',
    body: (
      <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
        <p>
          Many modules query external services that require an API key. Add yours on the{' '}
          <strong className="text-zinc-100">API Keys</strong> page — keys are stored globally and shared across all workspaces.
        </p>
        <p className="text-xs text-zinc-500">Common keys to get started:</p>
        <div className="space-y-2 text-xs">
          <div className="flex gap-3 items-start">
            <span className="font-mono text-brand w-28 flex-shrink-0">shodan_api</span>
            <span className="text-zinc-400">Internet-wide port and service scanning (shodan.io)</span>
          </div>
          <div className="flex gap-3 items-start">
            <span className="font-mono text-brand w-28 flex-shrink-0">hunter_io</span>
            <span className="text-zinc-400">Email address discovery (hunter.io)</span>
          </div>
          <div className="flex gap-3 items-start">
            <span className="font-mono text-brand w-28 flex-shrink-0">virustotal_api</span>
            <span className="text-zinc-400">Domain and IP threat intelligence (virustotal.com)</span>
          </div>
          <div className="flex gap-3 items-start">
            <span className="font-mono text-brand w-28 flex-shrink-0">google_api</span>
            <span className="text-zinc-400">Google Custom Search results (console.developers.google.com)</span>
          </div>
        </div>
        <p className="text-xs text-zinc-600">
          Each module's detail page shows which keys it requires. Missing keys are flagged in amber.
        </p>
      </div>
    ),
  },
  {
    icon: '▶',
    title: 'Configure and Run a Module',
    body: (
      <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
        <p>
          Click any module from the <strong className="text-zinc-100">Modules</strong> page to open its detail view.
        </p>
        <ol className="space-y-2 text-xs text-zinc-400 ml-1">
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <span>Set <strong className="text-zinc-200">SOURCE</strong> to your target — a domain, IP address, email, or company name</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <span>Fill in any other required options (shown in red)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <span>Click <strong className="text-zinc-200">Save Options</strong> then <strong className="text-zinc-200">Run Module</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
            <span>Results stream back in real time and are automatically saved to the workspace database</span>
          </li>
        </ol>
        <p className="text-xs text-zinc-600">
          Tip: start with a <span className="font-mono text-zinc-400">recon/domains-hosts/</span> module to enumerate subdomains from a root domain.
        </p>
      </div>
    ),
  },
  {
    icon: '📊',
    title: 'Explore Your Collected Data',
    body: (
      <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
        <p>
          All gathered data is stored in standardized tables. Visit the <strong className="text-zinc-100">Data</strong> page
          to browse, filter, annotate, and export your findings.
        </p>
        <div className="space-y-1.5 text-xs">
          <div className="flex gap-3"><span className="font-mono text-brand w-24 flex-shrink-0">domains</span><span className="text-zinc-400">Root domain names under investigation</span></div>
          <div className="flex gap-3"><span className="font-mono text-brand w-24 flex-shrink-0">hosts</span><span className="text-zinc-400">Subdomains with resolved IP addresses</span></div>
          <div className="flex gap-3"><span className="font-mono text-brand w-24 flex-shrink-0">contacts</span><span className="text-zinc-400">People, email addresses, and phone numbers</span></div>
          <div className="flex gap-3"><span className="font-mono text-brand w-24 flex-shrink-0">credentials</span><span className="text-zinc-400">Username and password pairs</span></div>
          <div className="flex gap-3"><span className="font-mono text-brand w-24 flex-shrink-0">companies</span><span className="text-zinc-400">Organization and company names</span></div>
        </div>
        <p className="text-xs text-zinc-500">
          You can also run raw SQL queries, add investigation notes to rows, and export to CSV or JSON.
          Use <strong className="text-zinc-400">Snapshots</strong> to checkpoint the database before large runs.
        </p>
      </div>
    ),
  },
  {
    icon: '✓',
    title: "You're Ready to Start",
    body: (
      <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
        <p>Here's your quickstart checklist:</p>
        <div className="space-y-2.5">
          {[
            ['Create a workspace', 'Sidebar → + New workspace'],
            ['Install modules', 'Marketplace → browse &amp; install'],
            ['Add API keys', 'API Keys → + Add Key'],
            ['Run a module', 'Modules → pick one → set SOURCE → Run'],
            ['Review findings', 'Data → browse tables, export results'],
          ].map(([label, hint], i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full bg-brand/20 text-brand text-xs flex items-center justify-center flex-shrink-0 font-semibold">
                {i + 1}
              </span>
              <div>
                <span className="text-zinc-200">{label}</span>
                <span className="text-zinc-600 text-xs ml-2" dangerouslySetInnerHTML={{ __html: hint }} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-800/50">
          You can reopen this guide at any time via the <strong className="text-zinc-400">Quick Start</strong> link at the bottom of the sidebar.
        </p>
      </div>
    ),
  },
]

interface QuickstartModalProps {
  open: boolean
  onClose: () => void
}

export function QuickstartModal({ open, onClose }: QuickstartModalProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Reset to first step when reopened
  useEffect(() => { if (open) setStep(0) }, [open])

  if (!open) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-2xl flex overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Step sidebar */}
        <div className="w-48 flex-shrink-0 bg-zinc-950/60 border-r border-zinc-800 py-5 flex flex-col gap-0.5 overflow-y-auto">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex items-center gap-2.5 px-3 py-2 text-left transition-colors text-xs ${
                i === step
                  ? 'text-brand bg-brand/10'
                  : i < step
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 font-semibold ${
                i < step
                  ? 'bg-brand/20 text-brand'
                  : i === step
                  ? 'bg-brand text-zinc-900'
                  : 'bg-zinc-800 text-zinc-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </span>
              <span className="truncate leading-snug">{s.title}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-2xl leading-none">{current.icon}</span>
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Step {step + 1} of {STEPS.length}</p>
                <h2 className="text-base font-semibold text-zinc-100">{current.title}</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-200 transition-colors text-xl leading-none ml-4"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 px-6 py-5 overflow-y-auto">
            {current.body}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between flex-shrink-0">
            <button
              onClick={onClose}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Skip guide
            </button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button onClick={() => setStep(s => s - 1)} className="btn-ghost text-xs py-1.5 px-3">
                  Back
                </button>
              )}
              {isLast ? (
                <button onClick={onClose} className="btn-primary text-xs py-1.5 px-3">
                  Get Started
                </button>
              ) : (
                <button onClick={() => setStep(s => s + 1)} className="btn-primary text-xs py-1.5 px-3">
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
