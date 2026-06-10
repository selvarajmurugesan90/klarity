import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { metricsApi } from '@/lib/api'
import type { PodMetricsSummary, NamespaceMetricsSummary } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { Cpu, MemoryStick, RefreshCw, AlertCircle, TrendingUp, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Horizontal bar ────────────────────────────────────────────────────────────
function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-300', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={cn('text-xs font-semibold w-10 text-right flex-shrink-0',
        pct >= 80 ? 'text-red-600' : pct >= 50 ? 'text-yellow-600' : 'text-gray-500')}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

type SortBy = 'cpu' | 'memory'
type ViewMode = 'pods' | 'namespaces'

export default function TopConsumers() {
  const qc = useQueryClient()
  const [sortBy, setSortBy] = useState<SortBy>('cpu')
  const [view, setView] = useState<ViewMode>('pods')
  const [isFetching, setIsFetching] = useState(false)

  const { data: availData } = useQuery({
    queryKey: ['metrics-available'],
    queryFn: () => metricsApi.available(),
    staleTime: 60_000,
  })
  const available = availData?.data?.available === true

  const { data: podData, isLoading: podLoading } = useQuery({
    queryKey: ['all-pod-metrics'],
    queryFn: () => metricsApi.allPods(),
    enabled: available,
    refetchInterval: 30_000,
  })

  const { data: nsData, isLoading: nsLoading } = useQuery({
    queryKey: ['namespace-metrics'],
    queryFn: () => metricsApi.namespaceSummary(),
    enabled: available,
    refetchInterval: 30_000,
  })

  async function refresh() {
    setIsFetching(true)
    await qc.invalidateQueries({ queryKey: ['all-pod-metrics'] })
    await qc.invalidateQueries({ queryKey: ['namespace-metrics'] })
    setIsFetching(false)
  }

  const rawPods = (podData as { data?: { data?: PodMetricsSummary[] } } | undefined)?.data?.data ?? []
  const rawNs   = (nsData  as { data?: { data?: NamespaceMetricsSummary[] } } | undefined)?.data?.data ?? []

  // Sort by selected metric
  const sortedPods = [...rawPods].sort((a, b) =>
    sortBy === 'cpu' ? b.cpuMillis - a.cpuMillis : b.memoryBytes - a.memoryBytes
  )
  const sortedNs = [...rawNs].sort((a, b) =>
    sortBy === 'cpu' ? b.cpuMillis - a.cpuMillis : b.memoryBytes - a.memoryBytes
  )

  // Compute max for % bars
  const maxCPU  = Math.max(...sortedPods.map(p => p.cpuMillis), 1)
  const maxMem  = Math.max(...sortedPods.map(p => p.memoryBytes), 1)
  const maxNsCPU = Math.max(...sortedNs.map(n => n.cpuMillis), 1)
  const maxNsMem = Math.max(...sortedNs.map(n => n.memoryBytes), 1)

  // Cluster totals
  const totalCPU = rawPods.reduce((s, p) => s + p.cpuMillis, 0)
  const totalMem = rawPods.reduce((s, p) => s + p.memoryBytes, 0)

  const fmtCPU = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} cores` : `${m}m`
  const fmtMem = (b: number) => {
    const Mi = 1024 * 1024; const Gi = 1024 * Mi
    if (b >= Gi) return `${(b/Gi).toFixed(2)} GiB`
    if (b >= Mi) return `${(b/Mi).toFixed(0)} MiB`
    return `${(b/1024).toFixed(0)} KiB`
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <TrendingUp size={18} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Top Resource Consumers</h1>
            <p className="text-sm text-gray-500">Live CPU and Memory usage from metrics-server</p>
          </div>
        </div>
        <button onClick={refresh}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          title="Refresh metrics">
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* metrics-server not available */}
      {!available && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 text-sm">metrics-server not available</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Install metrics-server to see live CPU and Memory usage.
            </p>
            <code className="block mt-2 text-xs text-amber-700 bg-amber-100 rounded px-2 py-1">
              kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
            </code>
          </div>
        </div>
      )}

      {available && (
        <>
          {/* Cluster totals */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Cpu size={18} className="text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Cluster Total CPU</p>
                <p className="text-2xl font-bold text-gray-900">{fmtCPU(totalCPU)}</p>
                <p className="text-xs text-gray-400 mt-0.5">across {rawPods.length} pods</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <MemoryStick size={18} className="text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Cluster Total Memory</p>
                <p className="text-2xl font-bold text-gray-900">{fmtMem(totalMem)}</p>
                <p className="text-xs text-gray-400 mt-0.5">across {rawPods.length} pods</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            {/* View toggle */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
              {(['pods', 'namespaces'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={cn('px-4 py-2 capitalize font-medium transition-colors',
                    view === v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50')}>
                  {v === 'pods' ? '🔵 Pods' : '📦 Namespaces'}
                </button>
              ))}
            </div>

            {/* Sort toggle */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
              <button onClick={() => setSortBy('cpu')}
                className={cn('flex items-center gap-1.5 px-4 py-2 font-medium transition-colors',
                  sortBy === 'cpu' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50')}>
                <Cpu size={13} /> Sort by CPU
              </button>
              <button onClick={() => setSortBy('memory')}
                className={cn('flex items-center gap-1.5 px-4 py-2 font-medium transition-colors',
                  sortBy === 'memory' ? 'bg-purple-500 text-white' : 'text-gray-500 hover:bg-gray-50')}>
                <MemoryStick size={13} /> Sort by Memory
              </button>
            </div>
          </div>

          {/* Pod consumers table */}
          {view === 'pods' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <div className="grid grid-cols-[1fr_1fr_120px_120px_60px] gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <span>Pod</span>
                  <span>Namespace</span>
                  <span>CPU</span>
                  <span>Memory</span>
                  <span>Ctrs</span>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {(podLoading ? Array(8).fill(null) : sortedPods.slice(0, 50)).map((pod, i) => (
                  <div key={i} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                    {pod === null ? (
                      <div className="grid grid-cols-[1fr_1fr_120px_120px_60px] gap-4 animate-pulse">
                        {[...Array(5)].map((_, j) => <div key={j} className="h-4 bg-gray-100 rounded" />)}
                      </div>
                    ) : (
                      <div className="grid grid-cols-[1fr_1fr_120px_120px_60px] gap-4 items-center">
                        <span className="text-sm font-medium text-gray-900 truncate" title={pod.name}>{pod.name}</span>
                        <span className="text-xs text-gray-500 truncate">{pod.namespace}</span>
                        <Bar pct={(pod.cpuMillis / maxCPU) * 100} color="bg-blue-500" />
                        <Bar pct={(pod.memoryBytes / maxMem) * 100} color="bg-purple-500" />
                        <span className="text-xs text-gray-400 text-center">{pod.containers}</span>
                      </div>
                    )}
                  </div>
                ))}
                {!podLoading && sortedPods.length === 0 && (
                  <div className="py-12 text-center text-gray-400 text-sm">No pod metrics available</div>
                )}
              </div>
              {sortedPods.length > 0 && (
                <div className="px-5 py-2 border-t border-gray-100 text-xs text-gray-400 text-right">
                  Showing top {Math.min(sortedPods.length, 50)} of {sortedPods.length} pods
                </div>
              )}
            </div>
          )}

          {/* Namespace consumers table */}
          {view === 'namespaces' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <div className="grid grid-cols-[1fr_120px_120px_80px] gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <span>Namespace</span>
                  <span>CPU</span>
                  <span>Memory</span>
                  <span>Pods</span>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {(nsLoading ? Array(6).fill(null) : sortedNs).map((ns, i) => (
                  <div key={i} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                    {ns === null ? (
                      <div className="grid grid-cols-[1fr_120px_120px_80px] gap-4 animate-pulse">
                        {[...Array(4)].map((_, j) => <div key={j} className="h-4 bg-gray-100 rounded" />)}
                      </div>
                    ) : (
                      <div className="grid grid-cols-[1fr_120px_120px_80px] gap-4 items-center">
                        <div className="flex items-center gap-2">
                          <Layers size={13} className="text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900">{ns.namespace}</span>
                        </div>
                        <Bar pct={(ns.cpuMillis / maxNsCPU) * 100} color="bg-blue-500" />
                        <Bar pct={(ns.memoryBytes / maxNsMem) * 100} color="bg-purple-500" />
                        <span className="text-xs text-center text-gray-500">{ns.podCount}</span>
                      </div>
                    )}
                  </div>
                ))}
                {!nsLoading && sortedNs.length === 0 && (
                  <div className="py-12 text-center text-gray-400 text-sm">No namespace metrics available</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
