import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { nodesApi, metricsApi } from '@/lib/api'
import type { NodeMetrics } from '@/lib/api'
import { ResourceTable, Column } from '@/components/common/ResourceTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatAge } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useState } from 'react'

type KNode = Record<string, unknown>

function NodeUtilBar({ pct, label, color }: { pct: number; label: string; color: string }) {
  return (
    <div className="min-w-[80px]">
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-gray-400">{label}</span>
        <span className={cn('font-semibold',
          pct >= 85 ? 'text-red-600' : pct >= 65 ? 'text-yellow-600' : 'text-gray-500')}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

export default function Nodes() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['nodes', '', page, search],
    queryFn: () => nodesApi.list({ page, pageSize: 50, search }),
  })

  const { data: metricsAvailData } = useQuery({
    queryKey: ['metrics-available'],
    queryFn: () => metricsApi.available(),
    staleTime: 60_000,
  })
  const metricsAvailable = metricsAvailData?.data?.available === true

  const { data: nodeMetricsData } = useQuery({
    queryKey: ['metrics-nodes'],
    queryFn: () => metricsApi.nodes(),
    enabled: metricsAvailable,
    refetchInterval: 30_000,
  })

  const metricsMap = new Map<string, NodeMetrics>()
  for (const nm of (nodeMetricsData?.data as NodeMetrics[] ?? [])) {
    metricsMap.set(nm.name, nm)
  }

  const nodes = (data?.data ?? []) as KNode[]
  const total = data?.total ?? 0

  const columns: Column<KNode>[] = [
    {
      key: 'name', header: 'Name', sortable: true,
      cell: (n) => {
        const m = n.metadata as Record<string, unknown>
        const labels = m?.labels as Record<string, string> | undefined
        const roles = Object.keys(labels ?? {})
          .filter(k => k.startsWith('node-role.kubernetes.io/'))
          .map(k => k.split('/')[1])
        return (
          <div>
            <p className="font-semibold text-sm text-gray-900">{m?.name as string}</p>
            <p className="text-xs text-gray-400">{roles.join(', ') || 'worker'}</p>
          </div>
        )
      },
    },
    {
      key: 'status', header: 'Status',
      cell: (n) => {
        const conds = ((n.status as Record<string, unknown>)?.conditions as Array<{ type: string; status: string }>) ?? []
        const ready = conds.some(c => c.type === 'Ready' && c.status === 'True')
        return <StatusBadge status={ready ? 'Ready' : 'NotReady'} />
      },
    },
    {
      key: 'cpu', header: 'CPU',
      cell: (n) => {
        const name = (n.metadata as Record<string, unknown>)?.name as string
        const m = metricsMap.get(name)
        if (!m) return <span className="text-gray-300 text-xs">—</span>
        return <NodeUtilBar pct={m.cpuPercent} label={m.cpuUsage} color="bg-blue-500" />
      },
    },
    {
      key: 'memory', header: 'Memory',
      cell: (n) => {
        const name = (n.metadata as Record<string, unknown>)?.name as string
        const m = metricsMap.get(name)
        if (!m) return <span className="text-gray-300 text-xs">—</span>
        return <NodeUtilBar pct={m.memoryPercent} label={m.memoryUsage} color="bg-purple-500" />
      },
    },
    {
      key: 'version', header: 'K8s Version',
      cell: (n) => <span className="text-xs font-mono text-gray-600">{((n.status as Record<string, unknown>)?.nodeInfo as Record<string, string>)?.kubeletVersion ?? '—'}</span>,
    },
    {
      key: 'os', header: 'OS',
      cell: (n) => {
        const info = ((n.status as Record<string, unknown>)?.nodeInfo as Record<string, string>) ?? {}
        return <span className="text-xs text-gray-500">{info.osImage?.split(' ').slice(0, 2).join(' ') ?? '—'}</span>
      },
    },
    {
      key: 'age', header: 'Age',
      cell: (n) => <span className="text-xs text-gray-400">{formatAge((n.metadata as Record<string, unknown>)?.creationTimestamp as string)}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Nodes</h1>
      <ResourceTable
        columns={columns} data={nodes} loading={isLoading}
        total={total} page={page} pageSize={50} onPageChange={setPage}
        onSearch={setSearch} searchPlaceholder="Search nodes…"
        onRowClick={(n) => navigate(`/nodes/${(n.metadata as Record<string, unknown>)?.name}`)}
        getRowKey={(n) => (n.metadata as Record<string, unknown>)?.name as string}
        csvFilename="nodes.csv"
      />
    </div>
  )
}
