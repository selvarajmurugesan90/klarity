import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { jobsApi } from '@/lib/api'
import { formatAge } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import YamlEditor from '@/components/common/YamlEditor'
import { ArrowLeft, Cpu, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InfoSection, InfoRow, SecurityContextSection, ContainerResourcesSection, EnvVarsSection, VolumesSection, SchedulingSection, LabelsAnnotations, ContainerCard, type K8sContainer, type K8sPodSpec } from '@/components/common/ResourceDetailSections'

type Tab = 'overview' | 'containers' | 'resources' | 'security' | 'env' | 'storage' | 'yaml'

export default function JobDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')

  const { data } = useQuery({ queryKey: ['job', namespace, name], queryFn: () => jobsApi.get(namespace!, name!) })
  const { data: yamlData, isLoading: yamlLoading, error: yamlError } = useQuery({ queryKey: ['job-yaml', namespace, name], queryFn: () => jobsApi.yaml(namespace!, name!), enabled: tab === 'yaml' })

  const job    = data?.data as Record<string,unknown> | undefined
  const spec   = job?.spec   as Record<string,unknown> | undefined
  const status = job?.status as Record<string,unknown> | undefined
  const meta   = job?.metadata as Record<string,unknown> | undefined
  const tmplSpec = ((spec?.template as Record<string,unknown>)?.spec) as K8sPodSpec | undefined
  const containers: K8sContainer[] = tmplSpec?.containers ?? []

  if (!job) return <div className="text-gray-400 py-8 text-center">Loading…</div>

  const succeeded = (status?.succeeded as number) ?? 0
  const failed    = (status?.failed    as number) ?? 0
  const active    = (status?.active    as number) ?? 0
  const jobStatus = succeeded > 0 ? 'Succeeded' : failed > 0 ? 'Failed' : active > 0 ? 'Running' : 'Unknown'

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',   label: 'Overview' },
    { id: 'containers', label: `Containers (${containers.length})` },
    { id: 'resources',  label: 'Resources' },
    { id: 'security',   label: 'Security' },
    { id: 'env',        label: 'Environment' },
    { id: 'storage',    label: 'Storage' },
    { id: 'yaml',       label: 'YAML' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/jobs')} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18} /></button>
        <Cpu size={20} className="text-blue-500" />
        <div><h1 className="text-xl font-bold text-gray-900">{name}</h1><p className="text-sm text-gray-500">{namespace} · {formatAge(meta?.creationTimestamp as string)}</p></div>
        <StatusBadge status={jobStatus} />
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn('px-3.5 pb-3 pt-1 text-xs font-medium whitespace-nowrap border-b-2 transition-colors', tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>{t.label}</button>)}
        </div>
      </div>

      <div className="space-y-4">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Status cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Succeeded', value: succeeded, icon: <CheckCircle size={16} />, color: 'text-green-600 bg-green-50 border-green-200' },
                { label: 'Failed',    value: failed,    icon: <XCircle size={16} />,     color: 'text-red-600 bg-red-50 border-red-200' },
                { label: 'Active',    value: active,    icon: <Clock size={16} />,        color: 'text-blue-600 bg-blue-50 border-blue-200' },
              ].map(s => (
                <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.color)}>
                  <div className="flex justify-center mb-1">{s.icon}</div>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            <InfoSection title="Job Configuration" defaultOpen>
              <div className="pt-3">
                <InfoRow label="Completions"    value={String((spec?.completions   as number) ?? 1)} />
                <InfoRow label="Parallelism"    value={String((spec?.parallelism   as number) ?? 1)} />
                <InfoRow label="Backoff Limit"  value={String((spec?.backoffLimit  as number) ?? 6)} />
                <InfoRow label="Active Deadline" value={spec?.activeDeadlineSeconds ? `${spec.activeDeadlineSeconds}s` : 'None'} />
                <InfoRow label="TTL After Finish" value={spec?.ttlSecondsAfterFinished ? `${spec.ttlSecondsAfterFinished}s` : 'None'} />
                <InfoRow label="Completion Mode" value={(spec?.completionMode as string) ?? 'NonIndexed'} />
                {(status?.startTime as string) && <InfoRow label="Start Time" value={new Date(status?.startTime as string).toLocaleString()} />}
                {(status?.completionTime as string) && <InfoRow label="Completion Time" value={new Date(status?.completionTime as string).toLocaleString()} />}
              </div>
            </InfoSection>
            <InfoSection title="Labels & Annotations" defaultOpen={false}>
              <LabelsAnnotations labels={meta?.labels as Record<string,string>} annotations={meta?.annotations as Record<string,string>} />
            </InfoSection>
          </div>
        )}
        {tab === 'containers' && <InfoSection title="Containers" defaultOpen><div className="pt-3 space-y-3">{containers.map(c => <ContainerCard key={c.name} container={c} />)}</div></InfoSection>}
        {tab === 'resources'  && <InfoSection title="Resource Requests & Limits" defaultOpen><ContainerResourcesSection containers={containers} /></InfoSection>}
        {tab === 'security'   && <div className="space-y-4">{containers.map(c => <InfoSection key={c.name} title={`Security — ${c.name}`} defaultOpen><SecurityContextSection podSpec={tmplSpec} container={c} /></InfoSection>)}</div>}
        {tab === 'env'        && <InfoSection title="Environment Variables" defaultOpen><EnvVarsSection containers={containers} /></InfoSection>}
        {tab === 'storage'    && <InfoSection title="Volumes & Mounts" defaultOpen><VolumesSection podSpec={tmplSpec} /></InfoSection>}
        {tab === 'yaml'       && <div className="h-[640px]"><YamlEditor yaml={yamlData ?? ''} filename={`${name}.yaml`} readOnly loading={yamlLoading} error={yamlError ? 'Failed to load YAML' : undefined} /></div>}
      </div>
    </div>
  )
}
