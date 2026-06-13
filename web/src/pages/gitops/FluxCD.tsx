import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ResourceTable, Column } from '@/components/common/ResourceTable'
import { formatAge } from '@/lib/utils'
import { GitBranch, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type FluxResource = Record<string, unknown>

type FluxTab = 'kustomizations' | 'helmreleases' | 'gitrepositories' | 'helmrepositories'

const TABS: { id: FluxTab; label: string; endpoint: string }[] = [
  { id: 'kustomizations',    label: 'Kustomizations',     endpoint: '/gitops/flux/kustomizations'    },
  { id: 'helmreleases',      label: 'Helm Releases',      endpoint: '/gitops/flux/helmreleases'      },
  { id: 'gitrepositories',   label: 'Git Repositories',   endpoint: '/gitops/flux/gitrepositories'   },
  { id: 'helmrepositories',  label: 'Helm Repositories',  endpoint: '/gitops/flux/helmrepositories'  },
]

function ReadyBadge({ conditions }: { conditions: Array<{ type: string; status: string; message?: string }> }) {
  const ready = conditions?.find(c => c.type === 'Ready')
  if (!ready) return <span className="text-xs text-gray-400">Unknown</span>
  if (ready.status === 'True')
    return <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={10}/> Ready</span>
  if (ready.status === 'False')
    return (
      <span className="flex items-center gap-1 text-xs text-red-600" title={ready.message}>
        <XCircle size={10}/> Not Ready
      </span>
    )
  return <span className="flex items-center gap-1 text-xs text-blue-600"><RefreshCw size={10} className="animate-spin"/> Reconciling</span>
}

function FluxTable({ tab }: { tab: FluxTab }) {
  const tabCfg = TABS.find(t => t.id === tab)!
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['flux', tab, page, search],
    queryFn:  () => api.get(`${tabCfg.endpoint}?page=${page}&pageSize=50&search=${search}`).then(r => r.data),
    refetchInterval: 30_000,
  })

  const items = (data?.data ?? []) as FluxResource[]
  const total = data?.total ?? items.length

  const cols: Column<FluxResource>[] = [
    {
      key: 'name', header: 'Name', sortable: true,
      cell: (r) => {
        const m = r.metadata as Record<string, unknown>
        return (
          <div>
            <p className="font-medium text-sm text-gray-900">{m?.name as string}</p>
            <p className="text-xs text-gray-400">{m?.namespace as string}</p>
          </div>
        )
      },
    },
    {
      key: 'ready', header: 'Status',
      cell: (r) => {
        const conds = ((r.status as Record<string, unknown>)?.conditions as Array<{ type: string; status: string; message?: string }>) ?? []
        return <ReadyBadge conditions={conds} />
      },
    },
    {
      key: 'source', header: 'Source / URL',
      cell: (r) => {
        const spec = r.spec as Record<string, unknown>
        if (tab === 'kustomizations') {
          const src = spec?.sourceRef as Record<string, string>
          return <span className="text-xs text-gray-600 font-mono">{src?.name} ({spec?.path as string})</span>
        }
        if (tab === 'helmreleases') {
          const chart = (spec?.chart as Record<string, unknown>)?.spec as Record<string, unknown>
          const srcRef = chart?.sourceRef as Record<string, string>
          return <span className="text-xs text-gray-600 font-mono">{srcRef?.name} / {chart?.chart as string} @ {chart?.version as string}</span>
        }
        if (tab === 'gitrepositories' || tab === 'helmrepositories') {
          return <span className="text-xs text-gray-600 font-mono truncate max-w-xs block">{spec?.url as string}</span>
        }
        return <span className="text-gray-400 text-xs">—</span>
      },
    },
    {
      key: 'interval', header: 'Interval',
      cell: (r) => {
        const spec = r.spec as Record<string, unknown>
        return <span className="text-xs text-gray-500">{spec?.interval as string ?? '—'}</span>
      },
    },
    {
      key: 'lastApplied', header: 'Last Reconciled',
      cell: (r) => {
        const stat = r.status as Record<string, unknown>
        const _ts  = stat?.lastHandledReconcileAt as string
              ?? stat?.observedGeneration as string
        const conds = (stat?.conditions as Array<{ type: string; lastTransitionTime: string }>) ?? []
        const ready = conds.find(c => c.type === 'Ready')
        return <span className="text-xs text-gray-500">{ready?.lastTransitionTime ? formatAge(ready.lastTransitionTime) + ' ago' : '—'}</span>
      },
    },
    {
      key: 'age', header: 'Age',
      cell: (r) => <span className="text-xs text-gray-400">{formatAge((r.metadata as Record<string, unknown>)?.creationTimestamp as string)}</span>,
    },
  ]

  return (
    <>
      {error && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 mb-4">
          Flux resources not available in this cluster or namespace.
        </div>
      )}
      <ResourceTable
        columns={cols}
        data={items}
        loading={isLoading}
        total={total}
        page={page}
        pageSize={50}
        onPageChange={setPage}
        onSearch={s => { setSearch(s); setPage(1) }}
        searchPlaceholder={`Search ${tabCfg.label.toLowerCase()}…`}
        emptyMessage={`No ${tabCfg.label} found`}
        csvFilename={`flux-${tab}.csv`}
      />
    </>
  )
}

export default function FluxCD() {
  const [activeTab, setActiveTab] = useState<FluxTab>('kustomizations')

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
          <GitBranch size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Flux CD</h1>
          <p className="text-sm text-gray-500">GitOps toolkit — continuous delivery from Git</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <FluxTable tab={activeTab} />
    </div>
  )
}
