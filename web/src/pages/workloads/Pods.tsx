import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { podsApi, metricsApi } from '@/lib/api'
import type { PodMetricsSummary } from '@/lib/api'
import { useClusterStore } from '@/store/cluster'
import { useActivityStore } from '@/store/activities'
import { ResourceTable, Column } from '@/components/common/ResourceTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatAge } from '@/lib/utils'
import { FileText, Terminal as TermIcon, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Pod {
  metadata: { name: string; namespace: string; creationTimestamp: string; labels: Record<string,string> }
  spec: { nodeName: string; containers: Array<{ name: string; image: string }> }
  status: { phase: string; containerStatuses?: Array<{ restartCount: number; ready: boolean; name: string }> }
}

function MicroBar({ value, pct, color }: { value: string; pct: number; color: string }) {
  return (
    <div className="min-w-[68px]">
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-gray-400">{value}</span>
        <span className={cn('font-medium', pct >= 80 ? 'text-red-500' : pct >= 50 ? 'text-yellow-500' : 'text-gray-400')}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

export default function Pods() {
  const navigate = useNavigate()
  const { currentNamespace } = useClusterStore()
  const { addLog, addTerminal } = useActivityStore()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const ns = currentNamespace || ''

  const { data, isLoading, error } = useQuery({
    queryKey: ['pods', ns, page, search],
    queryFn: () => ns ? podsApi.list(ns, { page, pageSize: 50, search }) : podsApi.listAll({ page, pageSize: 50, search }),
  })

  const { data: metricsAvailData } = useQuery({
    queryKey: ['metrics-available'],
    queryFn: () => metricsApi.available(),
    staleTime: 60_000,
  })
  const metricsAvailable = metricsAvailData?.data?.available === true

  const { data: allMetricsRaw } = useQuery({
    queryKey: ['all-pod-metrics'],
    queryFn: () => metricsApi.allPods(),
    enabled: metricsAvailable,
    refetchInterval: 30_000,
  })

  const metricsMap = new Map<string, PodMetricsSummary>()
  const rawItems = (allMetricsRaw as { data?: { data?: PodMetricsSummary[] } } | undefined)?.data?.data ?? []
  for (const m of rawItems) metricsMap.set(`${m.namespace}/${m.name}`, m)

  const pods  = (data?.data ?? []) as Pod[]
  const total = data?.total ?? 0

  const columns: Column<Pod>[] = [
    {
      key: 'name', header: 'Name', sortable: true,
      cell: (r) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{r.metadata.name}</p>
          <p className="text-xs text-gray-400">{r.metadata.namespace}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status?.phase ?? 'Unknown'} /> },
    {
      key: 'restarts', header: 'Restarts',
      cell: (r) => {
        const n = r.status?.containerStatuses?.reduce((s, c) => s + c.restartCount, 0) ?? 0
        return <span className={n > 0 ? 'text-yellow-600 font-semibold text-sm' : 'text-gray-400 text-sm'}>{n}</span>
      },
    },
    {
      key: 'cpu', header: 'CPU',
      cell: (r) => {
        const m = metricsMap.get(`${r.metadata.namespace}/${r.metadata.name}`)
        if (!m) return <span className="text-gray-300 text-xs">—</span>
        const pct = Math.min((m.cpuMillis / 1000) * 100, 100)
        return <MicroBar value={m.cpuMillis >= 1000 ? `${(m.cpuMillis/1000).toFixed(2)}` : `${m.cpuMillis}m`} pct={pct} color="bg-blue-500" />
      },
    },
    {
      key: 'memory', header: 'Memory',
      cell: (r) => {
        const m = metricsMap.get(`${r.metadata.namespace}/${r.metadata.name}`)
        if (!m) return <span className="text-gray-300 text-xs">—</span>
        const pct = Math.min((m.memoryBytes / (512 * 1024 * 1024)) * 100, 100)
        return <MicroBar value={m.memDisplay} pct={pct} color="bg-purple-500" />
      },
    },
    { key: 'ctrs', header: 'Ctrs', cell: (r) => <span className="text-gray-500 text-sm">{r.spec?.containers?.length ?? 0}</span> },
    { key: 'node', header: 'Node', cell: (r) => <span className="text-gray-400 text-xs truncate max-w-[90px] block">{r.spec?.nodeName ?? '—'}</span> },
    { key: 'age', header: 'Age', cell: (r) => <span className="text-gray-400 text-xs">{formatAge(r.metadata.creationTimestamp)}</span> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pods</h1>
        {!metricsAvailable && (
          <span className="text-xs text-gray-400 italic">Install metrics-server to see CPU/Memory</span>
        )}
      </div>
      <ResourceTable
        columns={columns} data={pods} loading={isLoading} error={error ? String(error) : null}
        total={total} page={page} pageSize={50} onPageChange={setPage}
        onSearch={setSearch} searchPlaceholder="Search pods…"
        onRowClick={(p) => navigate(`/pods/${p.metadata.namespace}/${p.metadata.name}`)}
        getRowKey={(p) => `${p.metadata.namespace}/${p.metadata.name}`}
        csvFilename="pods.csv"
        actions={(pod) => (
          <div className="flex items-center gap-1 justify-end">
            <button onClick={() => addLog({ namespace: pod.metadata.namespace, pod: pod.metadata.name, container: pod.spec?.containers?.[0]?.name })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Stream logs"><FileText size={14} /></button>
            <button onClick={() => addTerminal({ namespace: pod.metadata.namespace, pod: pod.metadata.name, container: pod.spec?.containers?.[0]?.name ?? '' })} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title="Terminal"><TermIcon size={14} /></button>
            <button onClick={() => navigate(`/pods/${pod.metadata.namespace}/${pod.metadata.name}`)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded" title="Details"><ExternalLink size={14} /></button>
          </div>
        )}
      />
    </div>
  )
}
