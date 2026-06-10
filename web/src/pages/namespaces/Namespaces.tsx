import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { namespacesApi, quotaApi } from '@/lib/api'
import { ResourceTable, Column } from '@/components/common/ResourceTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatAge } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface KubeNamespace {
  metadata: { name: string; creationTimestamp: string; labels?: Record<string, string> }
  status: { phase: string }
}

interface QuotaEntry { resource: string; hard: string; used: string; usedPercent: number }
interface QuotaSummary { name: string; entries: QuotaEntry[] }

function QuotaBar({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-gray-600 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={cn('w-10 text-right font-mono', pct >= 90 ? 'text-red-500' : 'text-gray-500')}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function NamespaceQuota({ ns }: { ns: string }) {
  const [expanded, setExpanded] = useState(false)
  const { data } = useQuery({
    queryKey: ['quota-summary', ns],
    queryFn: () => quotaApi.summary(ns),
    enabled: expanded,
  })
  const summaries = (data?.data as QuotaSummary[] | undefined) ?? []
  return (
    <div>
      <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Quotas
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5 pr-4">
          {summaries.length === 0
            ? <span className="text-xs text-gray-400">No quotas defined</span>
            : summaries.flatMap((s, si) => s.entries.map((e, i) => (
                <QuotaBar key={`${si}-${i}`} pct={e.usedPercent} label={e.resource} />
              )))
          }
        </div>
      )}
    </div>
  )
}

export default function Namespaces() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['namespaces', page, search],
    queryFn: () => namespacesApi.list({ page, pageSize: 50, search }),
  })
  const namespaces = (data?.data ?? []) as KubeNamespace[]
  const total = data?.total ?? 0

  const columns: Column<KubeNamespace>[] = [
    { key: 'name', header: 'Name', sortable: true, cell: (n) => <p className="font-medium text-gray-900">{n.metadata.name}</p> },
    { key: 'status', header: 'Status', cell: (n) => <StatusBadge status={n.status?.phase ?? 'Active'} /> },
    {
      key: 'labels', header: 'Labels',
      cell: (n) => {
        const entries = Object.entries(n.metadata.labels ?? {}).filter(([k]) => !k.startsWith('kubernetes.io')).slice(0, 3)
        return entries.length === 0 ? <span className="text-gray-400 text-xs">—</span> : (
          <div className="flex flex-wrap gap-1">
            {entries.map(([k, v]) => <span key={k} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">{k}={v}</span>)}
          </div>
        )
      },
    },
    { key: 'quotas', header: 'Resource Quotas', cell: (n) => <NamespaceQuota ns={n.metadata.name} /> },
    { key: 'age', header: 'Age', cell: (n) => <span className="text-gray-500 text-sm">{formatAge(n.metadata.creationTimestamp)}</span> },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Namespaces</h1>
      <ResourceTable columns={columns} data={namespaces} loading={isLoading} total={total} page={page} pageSize={50}
        onPageChange={setPage} onSearch={setSearch} searchPlaceholder="Search namespaces..."
        getRowKey={(n) => n.metadata.name} csvFilename="namespaces.csv" />
    </div>
  )
}
