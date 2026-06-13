import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { clusterApi, metricsApi, nodesApi, eventsApi } from '@/lib/api'
import { formatAge } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import {
  Server, Box, Globe, HardDrive, Layers, AlertTriangle,
  CheckCircle, XCircle, Activity, Cpu, ChevronRight,
  RefreshCw, Database, Zap, Clock,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'

// ── Palette ───────────────────────────────────────────────────────────────────
const POD_COLORS   = ['#22c55e', '#eab308', '#3b82f6', '#ef4444', '#94a3b8']

// ── Reusable stat card ────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, color = 'blue', onClick,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  sub?: string
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'cyan'
  onClick?: () => void
}) {
  const palette = {
    blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   num: 'text-blue-900'   },
    green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-600',  num: 'text-green-900'  },
    red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-600',      num: 'text-red-900'    },
    yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600',num: 'text-yellow-900' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600',num: 'text-purple-900' },
    cyan:   { bg: 'bg-cyan-50',   icon: 'bg-cyan-100 text-cyan-600',    num: 'text-cyan-900'   },
  }
  const p = palette[color]
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4',
        onClick && 'cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all'
      )}
    >
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', p.icon)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className={cn('text-2xl font-bold leading-none mt-0.5', p.num)}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {onClick && <ChevronRight size={14} className="text-gray-300 ml-auto" />}
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function UtilBar({ label, pct, used, total }: { label: string; pct: number; used: string; total: string }) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-500">{used} / {total}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className={cn('text-xs text-right font-semibold', pct >= 90 ? 'text-red-600' : 'text-gray-500')}>
        {pct.toFixed(1)}%
      </p>
    </div>
  )
}

// ── Main overview ─────────────────────────────────────────────────────────────
export default function Overview() {
  const navigate = useNavigate()

  const { data: ovData, isLoading: ovLoading, refetch } = useQuery({
    queryKey: ['overview'],
    queryFn: () => clusterApi.overview(),
    refetchInterval: 30_000,
  })

  const { data: metricsAvailData } = useQuery({
    queryKey: ['metrics-available'],
    queryFn: () => metricsApi.available(),
    refetchInterval: 60_000,
  })

  const metricsAvailable = metricsAvailData?.data?.available === true

  const { data: nodeMetricsData } = useQuery({
    queryKey: ['metrics-nodes'],
    queryFn: () => metricsApi.nodes(),
    enabled: metricsAvailable,
    refetchInterval: 30_000,
  })

  const { data: nodesData } = useQuery({
    queryKey: ['nodes', '', 1, ''],
    queryFn: () => nodesApi.list({ pageSize: 20 }),
  })

  const { data: warnEventsData } = useQuery({
    queryKey: ['events', '', 1, '', 'Warning'],
    queryFn: () => eventsApi.list({ type: 'Warning', pageSize: 8 } as never),
    refetchInterval: 30_000,
  })

  const ov         = ovData?.data as Record<string, unknown> | undefined
  const pods       = (ov?.pods as Record<string, number>) ?? {}
  const nodesInfo  = (ov?.nodes as Record<string, number>) ?? {}
  const deps       = (ov?.deployments as Record<string, number>) ?? {}
  const sts        = (ov?.statefulSets as Record<string, number>) ?? {}
  const ds         = (ov?.daemonSets as Record<string, number>) ?? {}
  const nodeList   = (nodesData?.data ?? []) as Array<Record<string, unknown>>
  const nMetrics   = (nodeMetricsData?.data ?? []) as Array<Record<string, unknown>>
  const warnEvents = (warnEventsData?.data ?? []) as Array<Record<string, unknown>>

  // Pod distribution for pie chart
  const podPie = [
    { name: 'Running',   value: pods.running   ?? 0 },
    { name: 'Pending',   value: pods.pending   ?? 0 },
    { name: 'Succeeded', value: pods.succeeded ?? 0 },
    { name: 'Failed',    value: pods.failed    ?? 0 },
  ].filter(d => d.value > 0)

  // Node metrics bar chart
  const nodeChart = nMetrics.map(n => ({
    name:  (n.name as string).split('-')[0],  // shorten hostname
    cpu:   parseFloat((n.cpuPercent as number ?? 0).toFixed(1)),
    mem:   parseFloat((n.memoryPercent as number ?? 0).toFixed(1)),
  }))

  // Workload summary bars
  const workloads = [
    { label: 'Deployments',  total: deps.total ?? 0, healthy: deps.available ?? 0,  path: '/deployments' },
    { label: 'StatefulSets', total: sts.total  ?? 0, healthy: sts.available  ?? 0,  path: '/statefulsets' },
    { label: 'DaemonSets',   total: ds.total   ?? 0, healthy: ds.available   ?? 0,  path: '/daemonsets'   },
  ]

  if (ovLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="w-5 h-5 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />
          Loading cluster overview…
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Page title ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cluster Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {ov?.serverVersion as string ?? '—'} ·{' '}
            {ov?.apiResources as number ?? 0} API resources discovered ·{' '}
            {ov?.namespaces as number ?? 0} namespaces
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl px-3 py-2 transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Top stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={<Server size={20} />}  label="Nodes"       value={nodesInfo.total ?? 0}
          sub={`${nodesInfo.ready ?? 0} ready`}
          color={nodesInfo.notReady ? 'red' : 'green'}
          onClick={() => navigate('/nodes')} />

        <StatCard icon={<Layers size={20} />}  label="Namespaces"  value={ov?.namespaces as number ?? 0}
          color="blue" onClick={() => navigate('/namespaces')} />

        <StatCard icon={<Box size={20} />}     label="Pods"        value={pods.total ?? 0}
          sub={`${pods.running ?? 0} running`}
          color={(pods.failed ?? 0) > 0 ? 'red' : 'green'}
          onClick={() => navigate('/pods')} />

        <StatCard icon={<Activity size={20} />} label="Deployments" value={deps.total ?? 0}
          sub={`${deps.available ?? 0} available`}
          color={(deps.total ?? 0) > (deps.available ?? 0) ? 'yellow' : 'blue'}
          onClick={() => navigate('/deployments')} />

        <StatCard icon={<Globe size={20} />}   label="Services"    value={ov?.services as number ?? 0}
          color="purple" onClick={() => navigate('/services')} />

        <StatCard icon={<HardDrive size={20} />} label="Volumes"   value={ov?.persistentVolumes as number ?? 0}
          color="cyan" onClick={() => navigate('/persistentvolumes')} />
      </div>

      {/* ── Middle row: pods pie + workloads + node metrics ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Pod distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Box size={16} className="text-blue-500" /> Pod Distribution
          </h2>
          {podPie.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={podPie} dataKey="value" cx="50%" cy="50%"
                    innerRadius={32} outerRadius={52} strokeWidth={2}>
                    {podPie.map((_, i) => (
                      <Cell key={i} fill={POD_COLORS[i % POD_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {podPie.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: POD_COLORS[i] }} />
                      <span className="text-gray-600 text-xs">{d.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900 text-sm">{d.value}</span>
                  </div>
                ))}
                <div className="pt-1 border-t border-gray-100 flex justify-between text-xs">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold text-gray-900">{pods.total ?? 0}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
              No pods found
            </div>
          )}
        </div>

        {/* Workload health */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Layers size={16} className="text-purple-500" /> Workload Health
          </h2>
          <div className="space-y-4">
            {workloads.map(w => {
              const pct    = w.total > 0 ? (w.healthy / w.total) * 100 : 100
              const unhealthy = w.total - w.healthy
              return (
                <div key={w.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <button onClick={() => navigate(w.path)}
                      className="text-gray-700 font-medium hover:text-blue-600 transition-colors">
                      {w.label}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{w.healthy}/{w.total}</span>
                      {unhealthy > 0 && (
                        <span className="text-red-500 font-semibold">
                          {unhealthy} degraded
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all',
                        pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}

            {/* Condition summary */}
            <div className="pt-3 border-t border-gray-100 space-y-1.5">
              {[
                { icon: <CheckCircle size={13} className="text-green-500" />, label: 'Nodes ready',     val: nodesInfo.ready    ?? 0, ok: true  },
                { icon: <XCircle    size={13} className="text-red-500" />,   label: 'Nodes not ready', val: nodesInfo.notReady ?? 0, ok: false },
                { icon: <AlertTriangle size={13} className="text-yellow-500" />, label: 'Failed pods',  val: pods.failed        ?? 0, ok: false },
                { icon: <Clock      size={13} className="text-blue-500" />,  label: 'Pending pods',    val: pods.pending       ?? 0, ok: true  },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-600">
                    {row.icon} {row.label}
                  </div>
                  <span className={cn('font-semibold',
                    !row.ok && row.val > 0 ? 'text-red-600' : 'text-gray-800')}>
                    {row.val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Node metrics */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Cpu size={16} className="text-orange-500" /> Node Resource Usage
          </h2>

          {!metricsAvailable ? (
            <div className="flex flex-col items-center justify-center h-32 text-center text-gray-400">
              <Database size={28} className="mb-2 opacity-30" />
              <p className="text-sm">metrics-server not available</p>
              <p className="text-xs mt-1 opacity-60">Install metrics-server to see CPU/Memory</p>
            </div>
          ) : nodeChart.length > 0 ? (
            <div className="space-y-4">
              {nodeChart.map(n => (
                <div key={n.name} className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">{n.name}</p>
                  <UtilBar label="CPU"    pct={n.cpu} used={`${n.cpu}%`}    total="100%" />
                  <UtilBar label="Memory" pct={n.mem} used={`${n.mem}%`}    total="100%" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              Loading metrics…
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row: node list + recent warnings ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Node list */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Server size={16} className="text-gray-500" /> Nodes
            </h2>
            <button onClick={() => navigate('/nodes')}
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {nodeList.slice(0, 6).map((node, i) => {
              const meta  = node.metadata as Record<string, unknown>
              const conds = ((node.status as Record<string, unknown>)?.conditions as Array<{ type: string; status: string }>) ?? []
              const ready = conds.some(c => c.type === 'Ready' && c.status === 'True')
              const info  = ((node.status as Record<string, unknown>)?.nodeInfo as Record<string, string>) ?? {}
              const m     = nMetrics.find(nm => nm.name === meta.name)
              const roles = Object.keys((meta.labels as Record<string, string> ?? {}))
                .filter(k => k.startsWith('node-role.kubernetes.io/')).map(k => k.split('/')[1])
              return (
                <div key={i} className="flex items-center px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className={cn(
                    'w-2 h-2 rounded-full mr-3 flex-shrink-0',
                    ready ? 'bg-green-500' : 'bg-red-500'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{meta.name as string}</p>
                    <p className="text-xs text-gray-400">
                      {roles.length > 0 ? roles.join(', ') : 'worker'} · {info.kubeletVersion ?? '—'}
                    </p>
                  </div>
                  {m && (
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-xs text-gray-500">
                        CPU {(m.cpuPercent as number).toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        Mem {(m.memoryPercent as number).toFixed(0)}%
                      </p>
                    </div>
                  )}
                  <StatusBadge status={ready ? 'Ready' : 'NotReady'} className="ml-3 flex-shrink-0" />
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent warning events */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-500" /> Warning Events
            </h2>
            <button onClick={() => navigate('/events')}
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
              View all <ChevronRight size={12} />
            </button>
          </div>

          {warnEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <CheckCircle size={32} className="text-green-400 mb-2" />
              <p className="text-sm font-medium text-green-600">No recent warnings</p>
              <p className="text-xs mt-0.5">Cluster looks healthy</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {warnEvents.slice(0, 6).map((ev, i) => {
                const obj = (ev.involvedObject as Record<string, string>) ?? {}
                return (
                  <div key={i} className="px-5 py-3 flex items-start gap-3">
                    <AlertTriangle size={13} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{ev.reason as string}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {obj.kind}/{obj.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{ev.message as string}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatAge(ev.lastTimestamp as string)} ago
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Node metrics bar chart (full width, shown only with metrics-server) ── */}
      {metricsAvailable && nodeChart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap size={16} className="text-blue-500" /> Node CPU &amp; Memory (%)
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={nodeChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v: number, n: string) => [`${v}%`, n === 'cpu' ? 'CPU' : 'Memory']} />
              <Bar dataKey="cpu" name="cpu" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="mem" name="mem" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 justify-center mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-blue-500 inline-block" /> CPU</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-purple-500 inline-block" /> Memory</span>
          </div>
        </div>
      )}
    </div>
  )
}
