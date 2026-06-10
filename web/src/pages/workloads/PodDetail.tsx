import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { podsApi, metricsApi } from '@/lib/api'
import { formatAge } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import LogViewer from '@/components/common/LogViewer'
import Terminal from '@/components/common/Terminal'
import YamlEditor from '@/components/common/YamlEditor'
import {
  ArrowLeft, Box, Pin, Cpu, MemoryStick, RefreshCw, Activity,
  Container as ContainerIcon, Shield, HardDrive, Network,
  Tag, AlignJustify, Calendar
} from 'lucide-react'
import { useActivityStore } from '@/store/activities'
import { cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  InfoSection, InfoRow, SecurityContextSection, ContainerResourcesSection,
  EnvVarsSection, VolumesSection, NetworkingSection, SchedulingSection,
  LabelsAnnotations, OwnerReferences, ContainerCard,
  type K8sContainer, type K8sPodSpec,
} from '@/components/common/ResourceDetailSections'

type Tab = 'overview' | 'containers' | 'resources' | 'security' | 'storage' | 'env' | 'scheduling' | 'metrics' | 'logs' | 'terminal' | 'yaml' | 'events'

function parseCPUm(s: string): number {
  if (!s) return 0
  if (s.endsWith('n')) return parseInt(s) / 1_000_000
  if (s.endsWith('u')) return parseInt(s) / 1_000
  if (s.endsWith('m')) return parseInt(s)
  return parseFloat(s) * 1000
}
function parseMem(s: string): number {
  if (!s) return 0
  const u: Record<string, number> = { Ki: 1024, Mi: 1024**2, Gi: 1024**3 }
  for (const [k, v] of Object.entries(u)) if (s.endsWith(k)) return parseFloat(s) * v
  return parseInt(s) || 0
}
function fmtMem(b: number): string {
  if (b >= 1024**3) return `${(b/1024**3).toFixed(2)} GiB`
  if (b >= 1024**2) return `${(b/1024**2).toFixed(0)} MiB`
  return `${(b/1024).toFixed(0)} KiB`
}

function MetricsTab({ namespace, name, containers }: {
  namespace: string; name: string; containers: K8sContainer[]
}) {
  const { data: availData } = useQuery({ queryKey: ['metrics-available'], queryFn: () => metricsApi.available(), staleTime: 60_000 })
  const available = availData?.data?.available === true

  const { data: pmRaw, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['pod-metrics-detail', namespace, name],
    queryFn: () => metricsApi.singlePod(namespace, name),
    enabled: available,
    refetchInterval: 15_000,
  })

  const cMetrics = ((pmRaw?.data as Record<string,unknown>)?.containers as Array<{ name: string; usage: { cpu: string; memory: string } }>) ?? []
  const cmMap = new Map(cMetrics.map(c => [c.name, c.usage]))

  if (!available) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Activity size={40} className="text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium">metrics-server not available</p>
      <p className="text-sm text-gray-400 mt-1">Install metrics-server to see live CPU and Memory metrics</p>
    </div>
  )

  const chartData = containers.map(c => {
    const u = cmMap.get(c.name)
    const cpuUsed = u ? parseCPUm(u.cpu) : 0
    const memUsed = u ? parseMem(u.memory) : 0
    const cpuLim  = parseCPUm(c.resources?.limits?.cpu  ?? '0')
    const memLim  = parseMem(c.resources?.limits?.memory ?? '0')
    return {
      name: c.name,
      cpuUsed, memUsed,
      cpuPct: cpuLim > 0 ? (cpuUsed / cpuLim) * 100 : Math.min((cpuUsed / 1000) * 100, 100),
      memPct: memLim > 0 ? (memUsed / memLim) * 100 : Math.min((memUsed / (512*1024*1024)) * 100, 100),
      cpuDisplay: u?.cpu ?? '—',
      memDisplay: u ? fmtMem(memUsed) : '—',
      cpuLimit: cpuLim, memLimit: memLim,
    }
  })

  const totalCPU = chartData.reduce((s, c) => s + c.cpuUsed, 0)
  const totalMem = chartData.reduce((s, c) => s + c.memUsed, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 flex items-center gap-1.5"><Activity size={13} className="text-blue-500" />Live · 15s refresh</span>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && <span className="text-xs text-gray-400">Updated {new Date(dataUpdatedAt).toLocaleTimeString()}</span>}
          <button onClick={() => refetch()} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1"><Cpu size={15} className="text-blue-600" /><span className="text-sm font-semibold text-blue-800">Total CPU</span></div>
          <p className="text-3xl font-bold text-blue-900">{totalCPU >= 1000 ? `${(totalCPU/1000).toFixed(3)}` : `${totalCPU.toFixed(0)}m`}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1"><MemoryStick size={15} className="text-purple-600" /><span className="text-sm font-semibold text-purple-800">Total Memory</span></div>
          <p className="text-3xl font-bold text-purple-900">{fmtMem(totalMem)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <span className="w-5 h-5 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin mr-2" />Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {chartData.map(c => (
            <div key={c.name} className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="font-semibold text-gray-900 mb-4">{c.name}</p>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-gray-600">CPU</span><span className="font-mono font-bold">{c.cpuDisplay}</span></div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', c.cpuPct >= 85 ? 'bg-red-500' : c.cpuPct >= 60 ? 'bg-yellow-500' : 'bg-blue-500')} style={{ width: `${Math.min(c.cpuPct, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{c.cpuLimit > 0 ? `limit: ${c.cpuLimit >= 1000 ? (c.cpuLimit/1000).toFixed(2) : c.cpuLimit + 'm'}` : 'no limit'}</span>
                    <span className={cn('font-semibold', c.cpuPct >= 85 ? 'text-red-600' : 'text-gray-500')}>{c.cpuPct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Memory</span><span className="font-mono font-bold">{c.memDisplay}</span></div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', c.memPct >= 85 ? 'bg-red-500' : c.memPct >= 60 ? 'bg-yellow-500' : 'bg-purple-500')} style={{ width: `${Math.min(c.memPct, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{c.memLimit > 0 ? `limit: ${fmtMem(c.memLimit)}` : 'no limit'}</span>
                    <span className={cn('font-semibold', c.memPct >= 85 ? 'text-red-600' : 'text-gray-500')}>{c.memPct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {chartData.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="font-semibold text-gray-900 mb-4">Container Comparison</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-500 mb-2">CPU (milli-cores)</p>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(0)}m`, 'CPU']} />
                      <Bar dataKey="cpuUsed" radius={[4,4,0,0]}>{chartData.map((_,i)=><Cell key={i} fill="#3b82f6"/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Memory</p>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1024/1024).toFixed(0)}M`} />
                      <Tooltip formatter={(v: number) => [fmtMem(v as number), 'Memory']} />
                      <Bar dataKey="memUsed" radius={[4,4,0,0]}>{chartData.map((_,i)=><Cell key={i} fill="#8b5cf6"/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PodDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'overview')
  const [selContainer, setSelContainer] = useState<string>('')
  const { addLog, addTerminal } = useActivityStore()

  const { data, isLoading } = useQuery({ queryKey: ['pod', namespace, name], queryFn: () => podsApi.get(namespace!, name!) })
  const { data: eventsData } = useQuery({ queryKey: ['pod-events', namespace, name], queryFn: () => podsApi.events(namespace!, name!), enabled: tab === 'events' })
  const { data: yamlData, isLoading: yamlLoading, error: yamlError } = useQuery({ queryKey: ['pod-yaml', namespace, name], queryFn: () => podsApi.yaml(namespace!, name!), enabled: tab === 'yaml' })

  const pod    = data?.data as Record<string, unknown> | undefined
  const spec   = pod?.spec   as K8sPodSpec | undefined
  const status = pod?.status as Record<string, unknown> | undefined
  const meta   = pod?.metadata as Record<string, unknown> | undefined
  const containers: K8sContainer[] = spec?.containers ?? []
  const initContainers: K8sContainer[] = spec?.initContainers ?? []
  const containerStatuses = (status?.containerStatuses as Array<{ name: string; ready: boolean; restartCount: number; state: Record<string,unknown> }>) ?? []
  const containerName = selContainer || containers[0]?.name

  if (isLoading) return <div className="text-gray-400 py-8 text-center">Loading…</div>
  if (!pod)      return <div className="text-red-500 py-8 text-center">Pod not found</div>

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',   label: 'Overview' },
    { id: 'containers', label: `Containers (${containers.length + initContainers.length})` },
    { id: 'resources',  label: 'Resources' },
    { id: 'security',   label: 'Security' },
    { id: 'env',        label: 'Environment' },
    { id: 'storage',    label: 'Storage' },
    { id: 'scheduling', label: 'Scheduling' },
    { id: 'metrics',    label: '📊 Metrics' },
    { id: 'logs',       label: 'Logs' },
    { id: 'terminal',   label: 'Terminal' },
    { id: 'yaml',       label: 'YAML' },
    { id: 'events',     label: 'Events' },
  ]

  return (
    <div className="space-y-4 flex flex-col" style={{ minHeight: '80vh' }}>
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button onClick={() => navigate('/pods')} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18} /></button>
        <Box size={20} className="text-blue-500 flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{name}</h1>
          <p className="text-sm text-gray-500">{namespace} · {formatAge(meta?.creationTimestamp as string)} old</p>
        </div>
        <StatusBadge status={(status?.phase as string) ?? 'Unknown'} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex-shrink-0">
        <div className="flex gap-0.5 overflow-x-auto scrollbar-thin pb-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('px-3.5 pb-3 pt-1 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4">

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InfoSection title="Pod Info" defaultOpen>
              <div className="pt-3">
                <InfoRow label="Phase"          value={<StatusBadge status={(status?.phase as string) ?? 'Unknown'} />} />
                <InfoRow label="Node"           value={(spec?.nodeName as string) ?? '—'} mono copy />
                <InfoRow label="Pod IP"         value={(status?.podIP as string) ?? '—'} mono />
                <InfoRow label="Host IP"        value={(status?.hostIP as string) ?? '—'} mono />
                <InfoRow label="QoS Class"      value={(status?.qosClass as string) ?? '—'} />
                <InfoRow label="Restart Policy" value={spec?.restartPolicy ?? '—'} />
                <InfoRow label="Service Account" value={spec?.serviceAccountName ?? '—'} mono />
                <InfoRow label="Age"            value={formatAge(meta?.creationTimestamp as string)} />
                {(status?.startTime as string) && <InfoRow label="Start Time" value={new Date(status?.startTime as string).toLocaleString()} />}
              </div>
            </InfoSection>

            <InfoSection title="Conditions" defaultOpen>
              <div className="pt-3 space-y-2">
                {(status?.conditions as Array<{ type: string; status: string; reason?: string; message?: string }> ?? []).map(cond => (
                  <div key={cond.type} className="flex items-start justify-between p-2.5 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-800">{cond.type}</p>
                      {cond.reason && <p className="text-xs text-gray-500">{cond.reason}</p>}
                    </div>
                    <span className={cn('text-xs font-semibold', cond.status === 'True' ? 'text-green-600' : 'text-red-500')}>{cond.status}</span>
                  </div>
                ))}
              </div>
            </InfoSection>

            <InfoSection title="Labels & Annotations" defaultOpen={false}>
              <LabelsAnnotations labels={meta?.labels as Record<string,string>} annotations={meta?.annotations as Record<string,string>} />
            </InfoSection>

            <InfoSection title="Owner References" defaultOpen={false}>
              <OwnerReferences owners={meta?.ownerReferences as Array<{ apiVersion: string; kind: string; name: string; uid: string; controller?: boolean }>} />
            </InfoSection>
          </div>
        )}

        {/* ── Containers ───────────────────────────────────────────────────── */}
        {tab === 'containers' && (
          <div className="space-y-4">
            {initContainers.length > 0 && (
              <InfoSection title={`Init Containers (${initContainers.length})`} defaultOpen icon={<ContainerIcon size={14} />}>
                <div className="pt-3 space-y-3">
                  {initContainers.map(c => <ContainerCard key={c.name} container={c} isInit />)}
                </div>
              </InfoSection>
            )}
            <InfoSection title={`Containers (${containers.length})`} defaultOpen icon={<ContainerIcon size={14} />}>
              <div className="pt-3 space-y-3">
                {containers.map(c => {
                  const cs = containerStatuses.find(s => s.name === c.name)
                  return <ContainerCard key={c.name} container={c} status={cs ? { ready: cs.ready, restartCount: cs.restartCount } : undefined} />
                })}
              </div>
            </InfoSection>
          </div>
        )}

        {/* ── Resources ────────────────────────────────────────────────────── */}
        {tab === 'resources' && (
          <InfoSection title="Resource Requests & Limits" defaultOpen icon={<Cpu size={14} />}>
            <ContainerResourcesSection containers={[...initContainers, ...containers]} />
          </InfoSection>
        )}

        {/* ── Security ─────────────────────────────────────────────────────── */}
        {tab === 'security' && (
          <div className="space-y-4">
            {containers.map(c => (
              <InfoSection key={c.name} title={`Security — ${c.name}`} defaultOpen icon={<Shield size={14} />}>
                <SecurityContextSection podSpec={spec} container={c} />
              </InfoSection>
            ))}
          </div>
        )}

        {/* ── Environment ──────────────────────────────────────────────────── */}
        {tab === 'env' && (
          <InfoSection title="Environment Variables" defaultOpen icon={<AlignJustify size={14} />}>
            <EnvVarsSection containers={[...initContainers, ...containers]} />
          </InfoSection>
        )}

        {/* ── Storage ──────────────────────────────────────────────────────── */}
        {tab === 'storage' && (
          <InfoSection title="Volumes & Mounts" defaultOpen icon={<HardDrive size={14} />}>
            <VolumesSection podSpec={spec} />
          </InfoSection>
        )}

        {/* ── Scheduling ───────────────────────────────────────────────────── */}
        {tab === 'scheduling' && (
          <InfoSection title="Scheduling & Placement" defaultOpen icon={<Calendar size={14} />}>
            <SchedulingSection podSpec={spec} />
          </InfoSection>
        )}

        {/* ── Metrics ──────────────────────────────────────────────────────── */}
        {tab === 'metrics' && <MetricsTab namespace={namespace!} name={name!} containers={containers} />}

        {/* ── Logs ─────────────────────────────────────────────────────────── */}
        {tab === 'logs' && (
          <div className="h-[640px] flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm text-gray-600">Container:</label>
              <select value={containerName} onChange={e => setSelContainer(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                {containers.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <button onClick={() => addLog({ namespace: namespace!, pod: name!, container: containerName })}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
                <Pin size={12} /> Pin to Activities
              </button>
            </div>
            <div className="flex-1 min-h-0"><LogViewer namespace={namespace!} pod={name!} container={containerName} /></div>
          </div>
        )}

        {/* ── Terminal ─────────────────────────────────────────────────────── */}
        {tab === 'terminal' && (
          <div className="h-[640px] flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm text-gray-600">Container:</label>
              <select value={containerName} onChange={e => setSelContainer(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                {containers.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <button onClick={() => addTerminal({ namespace: namespace!, pod: name!, container: containerName })}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">
                <Pin size={12} /> Pin to Activities
              </button>
            </div>
            <div className="flex-1 min-h-0"><Terminal namespace={namespace!} pod={name!} container={containerName} /></div>
          </div>
        )}

        {/* ── YAML ─────────────────────────────────────────────────────────── */}
        {tab === 'yaml' && <div className="h-[640px]"><YamlEditor yaml={yamlData ?? ''} filename={`${name}.yaml`} readOnly loading={yamlLoading} error={yamlError ? 'Failed to load YAML' : undefined} /></div>}

        {/* ── Events ───────────────────────────────────────────────────────── */}
        {tab === 'events' && (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {!(eventsData?.data as unknown[])?.length
              ? <div className="py-10 text-center text-gray-400 text-sm">No events found for this pod</div>
              : (eventsData?.data as Array<Record<string, unknown>> ?? []).map((ev, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-4">
                    <StatusBadge status={(ev.type as string) ?? 'Normal'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{ev.reason as string}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{ev.message as string}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatAge(ev.lastTimestamp as string)} ago</span>
                  </div>
                ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
