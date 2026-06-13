import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clusterApi, metricsApi, nodesApi } from '@/lib/api'
import { FileText, Download, CheckCircle, XCircle, AlertTriangle, Server } from 'lucide-react'
import { formatAge } from '@/lib/utils'

function StatCard({ label, value, sub, color = 'blue' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700', yellow: 'bg-yellow-50 text-yellow-700',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function ClusterHealthReport() {
  const [downloading, setDownloading] = useState(false)

  const { data: overview } = useQuery({
    queryKey: ['overview'],
    queryFn: () => clusterApi.overview(),
  })
  const { data: nodes } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => nodesApi.list({ pageSize: 100 }),
  })
  const { data: metricsAvail } = useQuery({
    queryKey: ['metrics-available'],
    queryFn: () => metricsApi.available(),
  })
  const { data: nodeMetrics } = useQuery({
    queryKey: ['metrics-nodes'],
    queryFn: () => metricsApi.nodes(),
    enabled: metricsAvail?.data?.available === true,
  })

  const ov = overview?.data as Record<string, unknown> | undefined
  const nodeList = (nodes?.data ?? []) as Array<Record<string, unknown>>
  const metrics = (nodeMetrics?.data ?? []) as Array<Record<string, unknown>>

  function getNodeStatus(node: Record<string, unknown>): 'Ready' | 'NotReady' {
    const conds = ((node.status as Record<string, unknown>)?.conditions as Array<{ type: string; status: string }>) ?? []
    return conds.some(c => c.type === 'Ready' && c.status === 'True') ? 'Ready' : 'NotReady'
  }

  async function downloadReport() {
    setDownloading(true)
    try {
      const resp = await fetch('/api/v1/reports/health')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cluster-health-${new Date().toISOString().slice(0, 10)}.html`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  const podsInfo = (ov?.pods as Record<string, number>) ?? {}
  const nodesInfo = (ov?.nodes as Record<string, number>) ?? {}
  const depsInfo = (ov?.deployments as Record<string, number>) ?? {}

  const overallHealthy = (nodesInfo.notReady ?? 0) === 0 &&
    (podsInfo.failed ?? 0) === 0 &&
    (depsInfo.total ?? 0) === (depsInfo.available ?? 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <FileText size={18} className="text-indigo-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cluster Health Report</h1>
            <p className="text-sm text-gray-500">Live cluster snapshot · Download as HTML</p>
          </div>
        </div>
        <button
          onClick={downloadReport}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-60"
        >
          <Download size={16} />
          {downloading ? 'Generating...' : 'Download HTML Report'}
        </button>
      </div>

      {/* Overall health banner */}
      <div className={`rounded-2xl p-5 flex items-center gap-4 ${overallHealthy ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        {overallHealthy
          ? <CheckCircle size={32} className="text-green-500 flex-shrink-0" />
          : <AlertTriangle size={32} className="text-yellow-500 flex-shrink-0" />
        }
        <div>
          <h2 className={`text-lg font-bold ${overallHealthy ? 'text-green-800' : 'text-yellow-800'}`}>
            {overallHealthy ? 'Cluster is Healthy' : 'Cluster Needs Attention'}
          </h2>
          <p className={`text-sm ${overallHealthy ? 'text-green-600' : 'text-yellow-600'}`}>
            Server: {ov?.serverVersion as string ?? '—'} · {ov?.apiResources as number ?? 0} API resources discovered
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard label="Nodes" value={nodesInfo.total ?? 0} sub={`${nodesInfo.ready ?? 0} ready`} color={nodesInfo.notReady ? 'red' : 'green'} />
        <StatCard label="Namespaces" value={ov?.namespaces as number ?? 0} color="blue" />
        <StatCard label="Total Pods" value={podsInfo.total ?? 0} sub={`${podsInfo.running ?? 0} running`} color="blue" />
        <StatCard label="Failed Pods" value={podsInfo.failed ?? 0} color={podsInfo.failed ? 'red' : 'green'} />
        <StatCard label="Deployments" value={depsInfo.total ?? 0} sub={`${depsInfo.available ?? 0} available`} color="blue" />
        <StatCard label="Services" value={ov?.services as number ?? 0} color="blue" />
      </div>

      {/* Node details table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Server size={16} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">Nodes</h2>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{nodeList.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Status', 'Version', 'OS', 'CPU', 'Memory', 'Age'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {nodeList.map((node, i) => {
                const meta = node.metadata as Record<string, unknown>
                const status = node.status as Record<string, unknown>
                const info = status?.nodeInfo as Record<string, string>
                const ready = getNodeStatus(node)
                const m = metrics.find(nm => nm.name === meta.name)
                return (
                  <tr key={i}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{meta.name as string}</td>
                    <td className="px-4 py-3">
                      {ready === 'Ready'
                        ? <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle size={14} /> Ready</span>
                        : <span className="flex items-center gap-1 text-red-600 text-sm"><XCircle size={14} /> NotReady</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">{info?.kubeletVersion ?? '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{info?.osImage?.split(' ').slice(0, 2).join(' ') ?? '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {m ? (
                        <div className="flex items-center gap-2">
                          <span>{m.cpuUsage as string}</span>
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(m.cpuPercent as number, 100)}%` }} />
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {m ? (
                        <div className="flex items-center gap-2">
                          <span>{m.memoryUsage as string}</span>
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(m.memoryPercent as number, 100)}%` }} />
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatAge(meta.creationTimestamp as string)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
