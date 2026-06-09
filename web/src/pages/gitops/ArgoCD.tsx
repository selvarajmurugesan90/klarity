import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ResourceTable, Column } from '@/components/common/ResourceTable'
import { formatAge } from '@/lib/utils'
import { GitBranch, CheckCircle, XCircle, AlertTriangle, RefreshCw, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type App = Record<string, unknown>

function SyncStatus({ status }: { status: string }) {
  const s = status?.toLowerCase()
  if (s === 'synced')    return <span className="flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle size={11}/> Synced</span>
  if (s === 'outofsync') return <span className="flex items-center gap-1 text-xs font-medium text-red-600"><XCircle size={11}/> OutOfSync</span>
  return <span className="flex items-center gap-1 text-xs font-medium text-gray-500"><Clock size={11}/> {status}</span>
}

function HealthStatus({ health }: { health: string }) {
  const h = health?.toLowerCase()
  if (h === 'healthy')     return <span className="text-xs font-medium text-green-600">● Healthy</span>
  if (h === 'degraded')    return <span className="text-xs font-medium text-red-600">▼ Degraded</span>
  if (h === 'progressing') return <span className="text-xs font-medium text-blue-600 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/>Progressing</span>
  if (h === 'suspended')   return <span className="text-xs font-medium text-yellow-600">◎ Suspended</span>
  if (h === 'missing')     return <span className="text-xs font-medium text-gray-500">? Missing</span>
  return <span className="text-xs text-gray-400">{health}</span>
}

export default function ArgoCD() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['argocd-apps', page, search],
    queryFn: () => api.get(`/api/v1/gitops/argocd/apps?page=${page}&pageSize=50&search=${search}`)
      .then(r => r.data),
    refetchInterval: 30_000,
  })

  const apps  = (data?.data ?? []) as App[]
  const total = data?.total ?? apps.length

  // Stats
  const synced    = apps.filter(a => (a.status as Record<string, unknown>)?.sync?.['status'] === 'Synced').length
  const outOfSync = apps.filter(a => (a.status as Record<string, unknown>)?.sync?.['status'] === 'OutOfSync').length
  const healthy   = apps.filter(a => (a.status as Record<string, unknown>)?.health?.['status'] === 'Healthy').length
  const degraded  = apps.filter(a => (a.status as Record<string, unknown>)?.health?.['status'] === 'Degraded').length

  const cols: Column<App>[] = [
    {
      key: 'name', header: 'Application', sortable: true,
      cell: (r) => {
        const meta = r.metadata as Record<string, unknown>
        const spec = r.spec    as Record<string, unknown>
        const dest = spec?.destination as Record<string, unknown>
        return (
          <div>
            <p className="font-semibold text-sm text-gray-900">{meta?.name as string}</p>
            <p className="text-xs text-gray-400">{dest?.namespace as string} · {spec?.project as string}</p>
          </div>
        )
      },
    },
    {
      key: 'sync', header: 'Sync',
      cell: (r) => {
        const sync = (r.status as Record<string, unknown>)?.sync as Record<string, string>
        return <SyncStatus status={sync?.status ?? ''} />
      },
    },
    {
      key: 'health', header: 'Health',
      cell: (r) => {
        const health = (r.status as Record<string, unknown>)?.health as Record<string, string>
        return <HealthStatus health={health?.status ?? ''} />
      },
    },
    {
      key: 'source', header: 'Source',
      cell: (r) => {
        const spec = r.spec as Record<string, unknown>
        const src  = spec?.source as Record<string, string>
        if (!src) return <span className="text-gray-400 text-xs">—</span>
        const repo = src.repoURL?.split('/').slice(-2).join('/')
        return (
          <div>
            <p className="text-xs text-gray-700 font-mono">{repo}</p>
            <p className="text-xs text-gray-400">{src.path || src.chart} {src.targetRevision ? `@ ${src.targetRevision}` : ''}</p>
          </div>
        )
      },
    },
    {
      key: 'revision', header: 'Revision',
      cell: (r) => {
        const sync = (r.status as Record<string, unknown>)?.sync as Record<string, string>
        const rev  = sync?.revision ?? ''
        return <span className="text-xs font-mono text-gray-600">{rev ? rev.slice(0, 8) : '—'}</span>
      },
    },
    {
      key: 'age', header: 'Last Synced',
      cell: (r) => {
        const op = (r.status as Record<string, unknown>)?.operationState as Record<string, unknown>
        const ts = op?.finishedAt as string
        return <span className="text-xs text-gray-500">{ts ? formatAge(ts) + ' ago' : '—'}</span>
      },
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
            <GitBranch size={18} className="text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ArgoCD Applications</h1>
            <p className="text-sm text-gray-500">Continuous delivery — synced from Git</p>
          </div>
        </div>
        <button onClick={() => refetch()}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl">
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Synced',      value: synced,    color: 'text-green-600 bg-green-50' },
          { label: 'Out of Sync', value: outOfSync, color: 'text-red-600 bg-red-50'     },
          { label: 'Healthy',     value: healthy,   color: 'text-green-600 bg-green-50' },
          { label: 'Degraded',    value: degraded,  color: 'text-red-600 bg-red-50'     },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl p-4 text-center', s.color)}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-0.5 opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          ArgoCD not detected or not accessible in this cluster.
        </div>
      )}

      <ResourceTable
        columns={cols}
        data={apps}
        loading={isLoading}
        total={total}
        page={page}
        pageSize={50}
        onPageChange={setPage}
        onSearch={s => { setSearch(s); setPage(1) }}
        searchPlaceholder="Search applications…"
        emptyMessage="No ArgoCD applications found"
        csvFilename="argocd-apps.csv"
      />
    </div>
  )
}
