import { useState } from 'react'

type SortDir = 'asc' | 'desc'

interface SortableTableProps {
  columns: string[]
  rows: Record<string, unknown>[]
  emptyMessage?: string
}

function cellValue(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

function compareValues(a: unknown, b: unknown): number {
  const sa = cellValue(a)
  const sb = cellValue(b)
  const na = Number(sa)
  const nb = Number(sb)
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return sa.localeCompare(sb)
}

export function SortableTable({ columns, rows, emptyMessage = 'No records.' }: SortableTableProps) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filter, setFilter] = useState('')

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const filtered = filter
    ? rows.filter(row => Object.values(row).some(v => cellValue(v).toLowerCase().includes(filter.toLowerCase())))
    : rows

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const cmp = compareValues(a[sortCol], b[sortCol])
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filtered

  return (
    <div className="flex flex-col gap-3">
      <input
        className="input max-w-xs"
        placeholder="Filter rows..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              {columns.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-3 py-2 text-left text-zinc-400 font-medium cursor-pointer select-none hover:text-zinc-100 whitespace-nowrap"
                >
                  {col}
                  {sortCol === col && (
                    <span className="ml-1 text-brand">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-zinc-500">{emptyMessage}</td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  {columns.map(col => (
                    <td key={col} className="px-3 py-2 text-zinc-300 max-w-xs truncate">
                      {cellValue(row[col]) || <span className="text-zinc-600">—</span>}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-600">{sorted.length} of {rows.length} rows</p>
    </div>
  )
}
