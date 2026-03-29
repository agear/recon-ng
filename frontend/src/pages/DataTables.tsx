import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getTables, getTable, getExports, exportTableUrl,
  getTableSchema, insertRow, deleteRow, updateNotes, runQuery,
  TableResponse, ColumnSchema,
} from '../api/client'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'

// ─── Sortable / filterable table with row actions ───────────────────────────

type SortDir = 'asc' | 'desc'

function cellStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function DataTable({
  columns, rows, onDelete, onNotesEdit,
}: {
  columns: string[]
  rows: Record<string, unknown>[]
  onDelete: (rowid: number) => void
  onNotesEdit: (rowid: number, current: string) => void
}) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filter, setFilter] = useState('')

  const visibleCols = columns.filter(c => c !== 'rowid')

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const filtered = filter
    ? rows.filter(r => Object.values(r).some(v => cellStr(v).toLowerCase().includes(filter.toLowerCase())))
    : rows

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const sa = cellStr(a[sortCol]), sb = cellStr(b[sortCol])
        const na = Number(sa), nb = Number(sb)
        const cmp = !isNaN(na) && !isNaN(nb) ? na - nb : sa.localeCompare(sb)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filtered

  return (
    <div className="flex flex-col gap-3">
      <input className="input max-w-xs" placeholder="Filter rows..." value={filter} onChange={e => setFilter(e.target.value)} />
      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              {visibleCols.map(col => (
                <th key={col} onClick={() => handleSort(col)}
                  className="px-3 py-2 text-left text-zinc-400 font-medium cursor-pointer select-none hover:text-zinc-100 whitespace-nowrap">
                  {col}{sortCol === col && <span className="ml-1 text-brand">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              ))}
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={visibleCols.length + 1} className="px-3 py-6 text-center text-zinc-500">No records.</td></tr>
            ) : sorted.map((row, i) => (
              <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 group transition-colors">
                {visibleCols.map(col => (
                  <td key={col} className="px-3 py-2 text-zinc-300 max-w-xs truncate">
                    {col === 'notes' ? (
                      <button
                        className="text-left w-full hover:text-brand transition-colors"
                        onClick={() => onNotesEdit(row.rowid as number, cellStr(row[col]))}
                        title="Edit notes"
                      >
                        {cellStr(row[col]) || <span className="text-zinc-700 italic">add note…</span>}
                      </button>
                    ) : (
                      cellStr(row[col]) || <span className="text-zinc-700">—</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => onDelete(row.rowid as number)}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-all text-xs"
                    title="Delete row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-600">{sorted.length} of {rows.length} rows</p>
    </div>
  )
}

// ─── Insert modal ─────────────────────────────────────────────────────────────

function InsertModal({ table, schema, onClose, onInserted }: {
  table: string
  schema: ColumnSchema[]
  onClose: () => void
  onInserted: () => void
}) {
  const editable = schema.filter(c => c.name !== 'module' && c.name !== 'rowid')
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(editable.map(c => [c.name, '']))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await insertRow(table, values)
      onInserted()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Insert failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Add row to ${table}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : 'Insert'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
        {editable.map(col => (
          <div key={col.name}>
            <label className="text-xs text-zinc-400 block mb-1">{col.name}</label>
            <input
              className="input"
              value={values[col.name]}
              onChange={e => setValues(v => ({ ...v, [col.name]: e.target.value }))}
              placeholder={col.name}
            />
          </div>
        ))}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </Modal>
  )
}

// ─── Notes modal ─────────────────────────────────────────────────────────────

function NotesModal({ table, rowid, initial, onClose, onSaved }: {
  table: string; rowid: number; initial: string
  onClose: () => void; onSaved: (rowid: number, notes: string) => void
}) {
  const [notes, setNotes] = useState(initial)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateNotes(table, rowid, notes)
      onSaved(rowid, notes)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Edit Notes"
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : 'Save'}
          </button>
        </>
      }
    >
      <textarea
        className="input h-32 resize-none"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Add notes…"
        autoFocus
      />
    </Modal>
  )
}

// ─── SQL Query panel ──────────────────────────────────────────────────────────

function QueryPanel() {
  const [sql, setSql] = useState('SELECT * FROM domains LIMIT 10')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const data = await runQuery(sql)
      if (data.error) setError(data.error)
      else setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-start">
        <textarea
          className="input flex-1 h-20 resize-none font-mono text-xs"
          value={sql}
          onChange={e => setSql(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run() }}
          spellCheck={false}
        />
        <button className="btn-primary" onClick={run} disabled={running}>
          {running ? <Spinner size="sm" /> : 'Run'}
        </button>
      </div>
      <p className="text-xs text-zinc-600">Only SELECT queries are allowed. ⌘+Enter to run.</p>
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
      {result && (
        result.rows.length === 0 ? (
          <p className="text-xs text-zinc-500">No results.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  {result.columns.map(c => <th key={c} className="px-3 py-2 text-left text-zinc-400 font-medium">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                    {result.columns.map(c => (
                      <td key={c} className="px-3 py-2 text-zinc-300 max-w-xs truncate">
                        {cellStr(row[c]) || <span className="text-zinc-700">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-zinc-600">{result.rows.length} rows</p>
          </div>
        )
      )}
    </div>
  )
}

// ─── Schema panel ─────────────────────────────────────────────────────────────

function SchemaPanel({ tables }: { tables: string[] }) {
  const [schemas, setSchemas] = useState<Record<string, ColumnSchema[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all(tables.map(t => getTableSchema(t).then(s => [t, s.columns] as const)))
      .then(results => setSchemas(Object.fromEntries(results)))
      .finally(() => setLoading(false))
  }, [tables])

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div className="grid grid-cols-2 gap-4">
      {tables.map(t => (
        <div key={t} className="card overflow-hidden">
          <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800">
            <span className="text-xs font-semibold text-zinc-300">{t}</span>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {(schemas[t] ?? []).map(col => (
                <tr key={col.name} className="border-b border-zinc-800/40 last:border-0">
                  <td className="px-3 py-1.5 text-zinc-300 font-mono">{col.name}</td>
                  <td className="px-3 py-1.5 text-zinc-600">{col.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'data' | 'query' | 'schema'

export function DataTables() {
  const { table: tableParam } = useParams<{ table: string }>()
  const navigate = useNavigate()

  const [tables, setTables] = useState<string[]>([])
  const [exports, setExports] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(tableParam ?? null)
  const [tableData, setTableData] = useState<TableResponse | null>(null)
  const [schema, setSchema] = useState<ColumnSchema[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingTable, setLoadingTable] = useState(false)
  const [activeColumns, setActiveColumns] = useState<string[]>([])
  const [showColumnFilter, setShowColumnFilter] = useState(false)
  const [showInsert, setShowInsert] = useState(false)
  const [notesTarget, setNotesTarget] = useState<{ rowid: number; notes: string } | null>(null)
  const [tab, setTab] = useState<Tab>('data')

  useEffect(() => {
    Promise.all([getTables(), getExports()])
      .then(([t, e]) => { setTables(t.tables); setExports(e.exports) })
      .finally(() => setLoadingList(false))
  }, [])

  const loadTable = useCallback((t: string) => {
    setLoadingTable(true)
    setTableData(null)
    Promise.all([getTable(t), getTableSchema(t)])
      .then(([data, s]) => {
        setTableData(data)
        setSchema(s.columns)
        setActiveColumns(data.columns.filter(c => c !== 'rowid'))
      })
      .finally(() => setLoadingTable(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    loadTable(selected)
  }, [selected, loadTable])

  const handleSelect = (t: string) => {
    setSelected(t)
    setTab('data')
    navigate(`/data/${t}`, { replace: true })
  }

  const handleDelete = async (rowid: number) => {
    if (!selected) return
    await deleteRow(selected, rowid)
    setTableData(prev => prev ? {
      ...prev,
      rows: prev.rows.filter(r => (r.rowid as number) !== rowid),
    } : prev)
  }

  const handleNotesSaved = (rowid: number, notes: string) => {
    setTableData(prev => prev ? {
      ...prev,
      rows: prev.rows.map(r => (r.rowid as number) === rowid ? { ...r, notes } : r),
    } : prev)
  }

  const visibleCols = activeColumns.filter(c => c !== 'rowid')

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-44 flex-shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="px-3 py-3 border-b border-zinc-800">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tables</p>
        </div>
        {loadingList ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <nav className="flex-1 overflow-y-auto py-2">
            <button
              onClick={() => { setSelected(null); setTab('schema'); navigate('/data', { replace: true }) }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors mb-1 ${!selected && tab === 'schema' ? 'bg-brand/10 text-brand' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100'}`}
            >
              Schema
            </button>
            <button
              onClick={() => { setSelected(null); setTab('query'); navigate('/data', { replace: true }) }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors mb-2 ${!selected && tab === 'query' ? 'bg-brand/10 text-brand' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100'}`}
            >
              SQL Query
            </button>
            <div className="border-t border-zinc-800/50 pt-2">
              {tables.map(t => (
                <button key={t} onClick={() => handleSelect(t)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${selected === t ? 'bg-brand/10 text-brand' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}>
                  {t}
                </button>
              ))}
            </div>
          </nav>
        )}
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Schema view */}
        {!selected && tab === 'schema' && <SchemaPanel tables={tables} />}

        {/* Query view */}
        {!selected && tab === 'query' && (
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">SQL Query</h2>
            <QueryPanel />
          </div>
        )}

        {/* No selection */}
        {!selected && tab === 'data' && (
          <div className="flex items-center justify-center h-64">
            <p className="text-zinc-600 text-sm">Select a table from the sidebar</p>
          </div>
        )}

        {/* Table view */}
        {selected && (
          loadingTable ? (
            <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
          ) : tableData ? (
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold text-zinc-100">{tableData.table}</h1>
                  <p className="text-xs text-zinc-500 mt-0.5">{tableData.rows.length} records</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button className="btn-primary text-xs" onClick={() => setShowInsert(true)}>+ Add Row</button>
                  <button className="btn-ghost text-xs" onClick={() => setShowColumnFilter(v => !v)}>Columns</button>
                  {exports.filter(f => f !== 'list' && f !== 'proxy').map(fmt => (
                    <a key={fmt} href={exportTableUrl(tableData.table, fmt, visibleCols)} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
                      {fmt.toUpperCase()}
                    </a>
                  ))}
                </div>
              </div>

              {/* Column filter */}
              {showColumnFilter && tableData.columns && (
                <div className="card p-4 flex flex-wrap gap-3 items-end">
                  {tableData.columns.filter(c => c !== 'rowid').map(col => (
                    <label key={col} className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                      <input type="checkbox" checked={activeColumns.includes(col)}
                        onChange={() => setActiveColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])}
                        className="accent-brand" />
                      {col}
                    </label>
                  ))}
                </div>
              )}

              {/* Table */}
              <DataTable
                columns={['rowid', ...visibleCols]}
                rows={tableData.rows}
                onDelete={handleDelete}
                onNotesEdit={(rowid, notes) => setNotesTarget({ rowid, notes })}
              />
            </div>
          ) : null
        )}
      </div>

      {/* Modals */}
      {showInsert && selected && (
        <InsertModal
          table={selected}
          schema={schema}
          onClose={() => setShowInsert(false)}
          onInserted={() => loadTable(selected)}
        />
      )}
      {notesTarget && selected && (
        <NotesModal
          table={selected}
          rowid={notesTarget.rowid}
          initial={notesTarget.notes}
          onClose={() => setNotesTarget(null)}
          onSaved={handleNotesSaved}
        />
      )}
    </div>
  )
}
