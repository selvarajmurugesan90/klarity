import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '@/lib/api'
import { ResourceTable, Column } from '@/components/common/ResourceTable'
import { Shield, Trash2, Edit, Plus, RefreshCw, Terminal, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuditEvent {
  id: number
  timestamp: string
  user: string
  action: string
  resource: string
  namespace: string
  name: string
  path: string
  status: number
  message?: string
  cluster: string
}

const ACTION_STYLES: Record<string, string> = {
  create: 'bg-green-500/10 text-green-400 border border-green-500/20',
  update: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  patch:  'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  delete: 'bg-red-500/10 text-red-400 border border-red-500/20',
  scale:  'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  restart:'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  trigger:'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  cordon: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  exec:   'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <Plus size={11} />,
  update: <Edit size={11} />,
  patch:  <Edit size={11} />,
  delete: <Trash2 size={11} />,
  scale:  <ChevronDown size={11} />,
  restart:<RefreshCw size={11} />,
  exec:   <Terminal size={11} />,
}

function ActionBadge({ action }: { action: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize',
      ACTION_STYLES[action] ?? 'bg-gray-100 text-gray-600 border border-gray-200'
    )}>
      {ACTION_ICONS[action]}
      {action}
    </span>
  )
}

function StatusBadge({ status }: { status: number }) {
  const ok = status >= 200 && status < 300
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium',
      ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
    )}>
      {status}
    </span>
  )
}

export default function AuditLog() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, search, actionFilter, resourceFilter],
    queryFn: () => auditApi.list({ page, pageSize: 100, search, action: actionFilter, resource: resourceFilter }),
    refetchInterval: 15_000,
  })

  const { data: statsData } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: () => auditApi.stats(),
    refetchInterval: 30_000,
  })

  const events = (data?.data ?? []) as AuditEvent[]
  const total = data?.total ?? 0
  const stats = statsData?.data as Record<string, number> | undefined

  const columns: Column<AuditEvent>[] = [
    {
      key: 'time', header: 'Time',
      cell: (e) => (
        <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
          {new Date(e.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'user', header: 'User',
      cell: (e) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs text-blue-400 font-bold">{e.user?.[0]?.toUpperCase() ?? '?'}</span>
          </div>
          <span className="text-sm text-slate-200">{e.user || 'anonymous'}</span>
        </div>
      ),
    },
    {
      key: 'action', header: 'Action',
      cell: (e) => <ActionBadge action={e.action} />,
    },
    {
      key: 'resource', header: 'Resource',
      cell: (e) => <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">{e.resource}</span>,
    },
    {
      key: 'target', header: 'Target',
      cell: (e) => (
        <div>
          <p className="text-sm text-slate-200 font-medium">{e.name || '-'}</p>
          {e.namespace && <p className="text-xs text-slate-500">{e.namespace}</p>}
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      cell: (e) => <StatusBadge status={e.status} />,
    },
    {
      key: 'cluster', header: 'Cluster',
      cell: (e) => <span className="text-xs text-slate-500">{e.cluster}</span>,
    },
  ]

  const actions = ['create', 'update', 'patch', 'delete', 'scale', 'restart', 'trigger', 'exec']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <Shield size={18} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
            <p className="text-sm text-gray-500">All cluster mutating operations · Last {total} events in memory</p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {actions.filter(a => (stats[a] ?? 0) > 0).map(action => (
            <button
              key={action}
              onClick={() => setActionFilter(actionFilter === action ? '' : action)}
              className={cn(
                'bg-white rounded-xl border p-3 text-center transition-colors',
                actionFilter === action ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="text-lg font-bold text-gray-900">{stats[action] ?? 0}</div>
              <ActionBadge action={action} />
            </button>
          ))}
        </div>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          value={resourceFilter}
          onChange={e => setResourceFilter(e.target.value)}
          placeholder="Filter by resource kind..."
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {(actionFilter || resourceFilter) && (
          <button
            onClick={() => { setActionFilter(''); setResourceFilter('') }}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Clear filters
          </button>
        )}
      </div>

      <ResourceTable
        columns={columns}
        data={events}
        loading={isLoading}
        total={total}
        page={page}
        pageSize={100}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search by resource name or namespace..."
        getRowKey={(e) => String(e.id)}
        emptyMessage="No audit events yet. Make a change in the cluster to start logging."
      />
    </div>
  )
}
