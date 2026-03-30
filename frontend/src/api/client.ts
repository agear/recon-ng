// All API types

export interface DashboardRecord {
  name: string
  count: number
}

export interface DashboardActivity {
  module: string
  runs: number
}

export interface DashboardResponse {
  workspace: string
  records: DashboardRecord[]
  activity: DashboardActivity[]
}

export interface WorkspaceOption {
  name: string
  value: string | null
  required: boolean
  description: string
}

export interface WorkspaceResponse {
  name: string
  status: 'active' | 'inactive'
  options: WorkspaceOption[]
}

export interface ModuleOption {
  name: string
  value: string | null
  required: boolean
  description: string
}

export interface ModuleMeta {
  name: string
  author: string
  version: string
  description: string
  required_keys?: string[]
  dependencies?: string[]
  options?: ModuleOption[]
  query?: string
}

export interface TaskResponse {
  id: string
  status: 'queued' | 'started' | 'finished' | 'failed' | 'unknown'
  result: TaskResult | null
}

export interface TaskSummaryEntry {
  count: number
  new: number
}

export interface TaskResult {
  summary?: Record<string, TaskSummaryEntry>
  error?: { type: string; message: string; traceback: string } | null
  output?: string
}

export interface TableResponse {
  workspace: string
  table: string
  columns: string[]
  rows: Record<string, unknown>[]
}

export interface KeyRecord {
  name: string
  value: string
}

// Base fetch helper

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status} ${text}`)
  }
  // 204 No Content
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// Dashboard

export const getDashboard = () =>
  apiFetch<DashboardResponse>('/dashboard')

// Workspaces

export interface WorkspaceSummary {
  name: string
  modified: string | null
}

export const getWorkspaces = () =>
  apiFetch<{ workspaces: WorkspaceSummary[] }>('/workspaces/')

export const getWorkspace = (name: string) =>
  apiFetch<WorkspaceResponse>(`/workspaces/${name}`)

export const createWorkspace = (name: string) =>
  apiFetch<WorkspaceResponse>('/workspaces/', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })

export const activateWorkspace = (name: string) =>
  apiFetch<WorkspaceResponse>(`/workspaces/${name}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'active' }),
  })

export const deleteWorkspace = (name: string) =>
  apiFetch<void>(`/workspaces/${name}`, { method: 'DELETE' })

export const updateWorkspaceOptions = (name: string, options: { name: string; value: string }[]) =>
  apiFetch<WorkspaceResponse>(`/workspaces/${name}`, {
    method: 'PATCH',
    body: JSON.stringify({ options }),
  })

// Modules

export const getModules = () =>
  apiFetch<{ modules: string[] }>('/modules/')

export const getModule = (path: string) =>
  apiFetch<ModuleMeta>(`/modules/${path}`)

export const patchModule = (path: string, options: { name: string; value: string }[]) =>
  apiFetch<ModuleMeta>(`/modules/${path}`, {
    method: 'PATCH',
    body: JSON.stringify({ options }),
  })

// Tasks

export const getTasks = () =>
  apiFetch<{ tasks: TaskResponse[] }>('/tasks/')

export const runModule = (path: string) =>
  apiFetch<{ task: string }>('/tasks/', {
    method: 'POST',
    body: JSON.stringify({ path }),
  })

export const getTask = (tid: string, live = false) =>
  apiFetch<TaskResponse>(`/tasks/${tid}${live ? '?live=1' : ''}`)

// Tables

export const getTables = () =>
  apiFetch<{ workspace: string; tables: string[] }>('/tables/')

export const getTable = (table: string, columns?: string[]) => {
  const params = columns?.length ? `?columns=${columns.join(',')}` : ''
  return apiFetch<TableResponse>(`/tables/${table}${params}`)
}

export const getExports = () =>
  apiFetch<{ exports: string[] }>('/exports')

export const exportTableUrl = (table: string, format: string, columns?: string[]) => {
  const cols = columns?.length ? `&columns=${columns.join(',')}` : ''
  return `/api/tables/${table}?format=${format}${cols}`
}

// Table rows (insert / delete / notes / schema / query)

export interface ColumnSchema { name: string; type: string }

export const getTableSchema = (table: string) =>
  apiFetch<{ table: string; columns: ColumnSchema[] }>(`/tables/${table}/schema`)

export const insertRow = (table: string, record: Record<string, string>) =>
  apiFetch<{ inserted: number }>(`/tables/${table}/rows`, {
    method: 'POST',
    body: JSON.stringify(record),
  })

export const deleteRow = (table: string, rowid: number) =>
  apiFetch<void>(`/tables/${table}/rows/${rowid}`, { method: 'DELETE' })

export const updateNotes = (table: string, rowid: number, notes: string) =>
  apiFetch<Record<string, unknown>>(`/tables/${table}/rows/${rowid}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  })

export const runQuery = (sql: string) =>
  apiFetch<{ columns: string[]; rows: Record<string, unknown>[]; error?: string }>('/query', {
    method: 'POST',
    body: JSON.stringify({ sql }),
  })

// Snapshots

export const getSnapshots = () =>
  apiFetch<{ snapshots: string[] }>('/snapshots/')

export const takeSnapshot = () =>
  apiFetch<{ name: string }>('/snapshots/', { method: 'POST' })

export const loadSnapshot = (name: string) =>
  apiFetch<{ name: string }>(`/snapshots/${name}`, { method: 'POST' })

export const deleteSnapshot = (name: string) =>
  apiFetch<void>(`/snapshots/${name}`, { method: 'DELETE' })

// Marketplace

export interface MarketplaceModule {
  path: string
  name: string
  author: string
  version: string
  last_updated: string
  description: string
  status: 'installed' | 'not installed' | 'outdated' | 'disabled'
  required_keys: string[]
  dependencies: string[]
  files: string[]
}

export const getMarketplace = (q?: string) => {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return apiFetch<{ modules: MarketplaceModule[] }>(`/marketplace/${params}`)
}

export const installModule = (path: string) =>
  apiFetch<MarketplaceModule>(`/marketplace/${path}`, { method: 'POST' })

export const removeModule = (path: string) =>
  apiFetch<void>(`/marketplace/${path}`, { method: 'DELETE' })

export const refreshMarketplace = () =>
  apiFetch<{ count: number }>('/marketplace/refresh', { method: 'POST' })

export const installAllModules = () =>
  apiFetch<{ installed: number; errors: { path: string; error: string }[] }>('/marketplace/install-all', { method: 'POST' })

export const removeAllModules = () =>
  apiFetch<{ removed: number; errors: { path: string; error: string }[] }>('/marketplace/remove-all', { method: 'DELETE' })

export const installDeps = (packages: string[]) =>
  apiFetch<{ success: boolean; output: string; error: string }>('/marketplace/install-deps', {
    method: 'POST',
    body: JSON.stringify({ packages }),
  })

export const checkDeps = (packages: string[]) =>
  apiFetch<Record<string, boolean>>('/marketplace/check-deps', {
    method: 'POST',
    body: JSON.stringify({ packages }),
  })

// Keys

export const getKeys = () =>
  apiFetch<{ keys: KeyRecord[] }>('/keys/')

export const addKey = (name: string, value: string) =>
  apiFetch<{ name: string }>('/keys/', {
    method: 'POST',
    body: JSON.stringify({ name, value }),
  })

export const deleteKey = (name: string) =>
  apiFetch<void>(`/keys/${name}`, { method: 'DELETE' })
