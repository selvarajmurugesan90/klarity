import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { nodesApi, metricsApi, metricsApi as mApi } from '@/lib/api'
import type { PodMetricsSummary } from '@/lib/api'
import { ArrowLeft, Server, Cpu, MemoryStick, RefreshCw, CheckCircle, XCircle, Activity } from 'lucide-react'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatAge } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useState } from 'react'

// ── Large utilisation ring / arc ──────────────────────────────────────────────
function GaugeCard({ label, pct, used, total, color, icon }: {
  label: string; pct: number; used: string; total: string; color: string; icon: React.ReactNode
}) {
  const size  = 120
  const r     = 46
  const circ  = 2 * Math.PI * r
  const dash  = (pct / 100) * circ
  const gap   = circ - dash

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col items-center gap-3">
      {/* SVG gauge */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke="#f1f5f9" strokeWidth="10" />
          {/* Value */}
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={pct >= 85 ? '#ef4444' : pct >= 65 ? '#f59e0b' : color}
            strokeWidth="10"
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold',
            pct >= 85 ? 'text-red-600' : pct >= 65 ? 'text-yellow-600' : 'text-gray-900')}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Labels */}
      <div className="text-center">
        <div className="flex items-center gap-1.5 justify-center text-gray-600 text-sm font-semibold">
          {icon} {label}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          <span className="font-medium text-gray-700">{used}</span>
          {' '}/ {total}
        </p>
      </div>
    </div>
  )
}

function fmtMem(b: number): string {
  if (b >= 1024**3) return `${(b/1024**3).toFixed(1)} GiB`
  if (b >= 1024**2) return `${(b/1024**2).toFixed(0)} MiB`
  return `${(b/1024).toFixed(0)} KiB`
}

type Tab = 'overview' | 'metrics' | 'pods' | 'yaml'

export default function NodeDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate  = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')

  const { data: nodeData } = useQuery({
    queryKey: ['node', name],
    queryFn: () => nodesApi.get(name!),
  })

  const { data: metricsAvailData } = useQuery({
    queryKey: ['metrics-available'],
    queryFn: () => metricsApi.available(),
    staleTime: 60_000,
  })
  const metricsAvailable = metricsAvailData?.data?.available === true

  const { data: nodeMetricsRaw, refetch: refetchMetrics, isFetching: mFetching, dataUpdatedAt } = useQuery({
    queryKey: ['node-metrics-detail', name],
    queryFn:  () => metricsApi.singleNode(name!),
    enabled:  metricsAvailable,
    refetchInterval: 15_000,
  })

  // Pods running on this node
  const { data: nodePods } = useQuery({
    queryKey: ['node-pods', name],
    queryFn:  () => nodesApi.pods(name!),
    enabled:  tab === 'pods' || tab === 'metrics',
  })

  // All pod metrics for pod-level bars
  const { data: allPodMetricsRaw } = useQuery({
    queryKey: ['all-pod-metrics'],
    queryFn:  () => mApi.allPods(),
    enabled:  metricsAvailable && (tab === 'metrics' || tab === 'pods'),
    refetchInterval: 30_000,
  })

  const node       = nodeData?.data as Record<string, unknown> | undefined
  const nmRaw      = nodeMetricsRaw?.data as Record<string, unknown> | undefined

  if (!node) return <div className="text-gray-400 py-8 text-center">Loading…</div>

  const meta   = node.metadata  as Record<string, unknown>
  const status = node.status    as Record<string, unknown>
  const info   = (status?.nodeInfo as Record<string, string>) ?? {}
  const conds  = (status?.conditions as Array<{ type: string; status: string; message?: string }>) ?? []
  const ready  = conds.some(c => c.type === 'Ready' && c.status === 'True')

  // Capacity & allocatable
  const capacity     = (status?.capacity     as Record<string, string>) ?? {}
  const allocatable  = (status?.allocatable  as Record<string, string>) ?? {}

  const capCPUm  = Math.round((parseFloat(capacity.cpu     || '0')) * 1000)
  const capMemB  = parseInt(capacity.memory    || '0') * 1024
  const alcCPUm  = Math.round((parseFloat(allocatable.cpu  || '0')) * 1000)
  const alcMemB  = parseInt(allocatable.memory || '0') * 1024

  // Metrics
  const usedCPUm  = nmRaw ? (nmRaw.cpuMillis as number) ?? 0   : 0
  const usedMemB  = nmRaw ? (nmRaw.memBytes  as number) ?? 0   : 0
  const cpuPct    = nmRaw ? (nmRaw.cpuPercent    as number) ?? 0 : 0
  const memPct    = nmRaw ? (nmRaw.memoryPercent as number) ?? 0 : 0

  // Pods on this node
  const nodePodList = (nodePods?.data ?? []) as Array<Record<string, unknown>>

  // Pod metrics map
  const pmList = (allPodMetricsRaw as { data?: { data?: PodMetricsSummary[] } } | undefined)?.data?.data ?? []
  const pmMap  = new Map(pmList.map(m => [`${m.namespace}/${m.name}`, m]))

  // Pods sorted by CPU
  const podRows = nodePodList
    .map(p => {
      const pm  = pmMap.get(`${(p.metadata as Record<string,unknown>)?.namespace}/${(p.metadata as Record<string,unknown>)?.name}`)
      return { pod: p, metrics: pm }
    })
    .sort((a, b) => (b.metrics?.cpuMillis ?? 0) - (a.metrics?.cpuMillis ?? 0))

  const maxCPU  = Math.max(...podRows.map(r => r.metrics?.cpuMillis ?? 0), 1)
  const maxMem  = Math.max(...podRows.map(r => r.metrics?.memoryBytes ?? 0), 1)

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'metrics',  label: '📊 Metrics' },
    { id: 'pods',     label: `Pods (${nodePodList.length || '…'})` },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/nodes')} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} />
        </button>
        <Server size={20} className="text-blue-500 flex-shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">{name}</h1>
          <p className="text-sm text-gray-500">{formatAge(meta.creationTimestamp as string)} old · {info.kubeletVersion}</p>
        </div>
        <StatusBadge status={ready ? 'Ready' : 'NotReady'} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('px-4 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors',
                tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">System Info</h3>
            <dl className="space-y-2.5">
              {[
                ['OS',          info.osImage],
                ['Kernel',      info.kernelVersion],
                ['Container RT',info.containerRuntimeVersion],
                ['Kubelet',     info.kubeletVersion],
                ['Architecture',info.architecture],
                ['CPU Capacity',`${capCPUm}m (${capacity.cpu} cores)`],
                ['Memory Cap',  capacity.memory],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="text-xs text-gray-500 w-36 flex-shrink-0">{k}</dt>
                  <dd className="text-xs text-gray-800 font-mono">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Conditions</h3>
            <div className="space-y-2">
              {conds.map(cond => (
                <div key={cond.type} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    {cond.status === 'True'
                      ? <CheckCircle size={14} className={cond.type === 'Ready' ? 'text-green-500' : 'text-red-500'} />
                      : <XCircle    size={14} className="text-gray-300" />
                    }
                    <span className="text-sm text-gray-700">{cond.type}</span>
                  </div>
                  <span className={cn('text-xs font-medium',
                    cond.status === 'True' ? (cond.type === 'Ready' ? 'text-green-600' : 'text-red-500') : 'text-gray-400')}>
                    {cond.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Metrics ──────────────────────────────────────────────────────── */}
      {tab === 'metrics' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Activity size={14} className="text-blue-500" />
              Live metrics · refreshes every 15s
            </div>
            <div className="flex items-center gap-2">
              {dataUpdatedAt > 0 && (
                <span className="text-xs text-gray-400">Updated {new Date(dataUpdatedAt).toLocaleTimeString()}</span>
              )}
              <button onClick={() => refetchMetrics()}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <RefreshCw size={13} className={mFetching ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {!metricsAvailable ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Activity size={40} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">metrics-server not available</p>
              <p className="text-sm text-gray-400 mt-1">Install metrics-server to see live node metrics</p>
            </div>
          ) : (
            <>
              {/* Gauge cards */}
              <div className="grid grid-cols-2 gap-5">
                <GaugeCard
                  label="CPU Usage"
                  pct={cpuPct}
                  used={`${usedCPUm}m`}
                  total={`${capCPUm}m capacity`}
                  color="#3b82f6"
                  icon={<Cpu size={14} />}
                />
                <GaugeCard
                  label="Memory Usage"
                  pct={memPct}
                  used={fmtMem(usedMemB)}
                  total={fmtMem(capMemB)}
                  color="#8b5cf6"
                  icon={<MemoryStick size={14} />}
                />
              </div>

              {/* Capacity detail */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h4 className="font-semibold text-gray-900 mb-4">Capacity vs Allocatable</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    {[
                      { label: 'CPU — Capacity',    val: `${capCPUm}m` },
                      { label: 'CPU — Allocatable', val: `${alcCPUm}m` },
                      { label: 'CPU — In Use',      val: `${usedCPUm}m`, bold: true },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between text-sm">
                        <span className="text-gray-500">{r.label}</span>
                        <span className={cn('font-mono', r.bold ? 'font-bold text-blue-600' : 'text-gray-700')}>{r.val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'Memory — Capacity',    val: fmtMem(capMemB) },
                      { label: 'Memory — Allocatable', val: fmtMem(alcMemB) },
                      { label: 'Memory — In Use',      val: fmtMem(usedMemB), bold: true },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between text-sm">
                        <span className="text-gray-500">{r.label}</span>
                        <span className={cn('font-mono', r.bold ? 'font-bold text-purple-600' : 'text-gray-700')}>{r.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top pods on this node */}
              {podRows.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h4 className="font-semibold text-gray-900">Top Pods on This Node</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Sorted by CPU usage · {podRows.length} pods running</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {podRows.slice(0, 15).map(({ pod, metrics }, i) => {
                      const pm  = pod.metadata as Record<string, unknown>
                      const ps  = pod.status   as Record<string, unknown>
                      return (
                        <div key={i} className="flex items-center px-5 py-3 hover:bg-gray-50 gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{pm?.name as string}</p>
                            <p className="text-xs text-gray-400">{pm?.namespace as string}</p>
                          </div>
                          {/* CPU bar */}
                          <div className="w-24">
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span className="text-gray-400">{metrics ? (metrics.cpuMillis >= 1000 ? `${(metrics.cpuMillis/1000).toFixed(2)}` : `${metrics.cpuMillis}m`) : '—'}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${metrics ? (metrics.cpuMillis / maxCPU) * 100 : 0}%` }} />
                            </div>
                          </div>
                          {/* Mem bar */}
                          <div className="w-24">
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span className="text-gray-400">{metrics ? fmtMem(metrics.memoryBytes) : '—'}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${metrics ? (metrics.memoryBytes / maxMem) * 100 : 0}%` }} />
                            </div>
                          </div>
                          <StatusBadge status={(ps?.phase as string) ?? 'Unknown'} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Pods ─────────────────────────────────────────────────────────── */}
      {tab === 'pods' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h4 className="font-semibold text-gray-900">Pods on {name}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{nodePodList.length} pods scheduled</p>
          </div>
          <div className="divide-y divide-gray-50">
            {nodePodList.map((pod, i) => {
              const pm  = pod.metadata as Record<string, unknown>
              const ps  = pod.status   as Record<string, unknown>
              const spec = pod.spec   as Record<string, unknown>
              const m   = pmMap.get(`${pm?.namespace}/${pm?.name}`)
              return (
                <div key={i} className="flex items-center px-5 py-3 hover:bg-gray-50 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{pm?.name as string}</p>
                    <p className="text-xs text-gray-400">{pm?.namespace as string}</p>
                  </div>
                  <StatusBadge status={(ps?.phase as string) ?? 'Unknown'} />
                  {m && (
                    <div className="flex gap-2 flex-shrink-0">
                      <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5">
                        CPU {m.cpuMillis >= 1000 ? `${(m.cpuMillis/1000).toFixed(2)}` : `${m.cpuMillis}m`}
                      </span>
                      <span className="text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-100 rounded px-1.5 py-0.5">
                        Mem {m.memDisplay}
                      </span>
                    </div>
                  )}
                  <span className="text-xs text-gray-400 flex-shrink-0">{(spec?.containers as unknown[])?.length ?? 0} ctrs</span>
                </div>
              )
            })}
            {nodePodList.length === 0 && (
              <div className="py-10 text-center text-gray-400 text-sm">No pods found on this node</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
