import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cronJobsApi } from '@/lib/api'
import { formatAge } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import YamlEditor from '@/components/common/YamlEditor'
import { ArrowLeft, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InfoSection, InfoRow, SecurityContextSection, ContainerResourcesSection, EnvVarsSection, VolumesSection, LabelsAnnotations, ContainerCard, type K8sContainer, type K8sPodSpec } from '@/components/common/ResourceDetailSections'

type Tab = 'overview' | 'containers' | 'resources' | 'security' | 'env' | 'storage' | 'yaml'

export default function CronJobDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')

  const { data } = useQuery({ queryKey: ['cronjob', namespace, name], queryFn: () => cronJobsApi.get(namespace!, name!) })
  const { data: _yamlData } = useQuery({ queryKey: ['cronjob-yaml', namespace, name], queryFn: async () => { const r = await import('@/lib/api'); return r.api.get(`/namespaces/${namespace}/cronjobs/${name}/yaml`).then(rr => rr.data) }, enabled: tab === 'yaml' })

  const cj     = data?.data as Record<string,unknown> | undefined
  const spec   = cj?.spec   as Record<string,unknown> | undefined
  const status = cj?.status as Record<string,unknown> | undefined
  const meta   = cj?.metadata as Record<string,unknown> | undefined
  const jobTmpl = (spec?.jobTemplate as Record<string,unknown>)?.spec as Record<string,unknown> | undefined
  const tmplSpec = ((jobTmpl?.template as Record<string,unknown>)?.spec) as K8sPodSpec | undefined
  const containers: K8sContainer[] = tmplSpec?.containers ?? []

  if (!cj) return <div className="text-gray-400 py-8 text-center">Loading…</div>

  const suspended = (spec?.suspend as boolean) ?? false

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' }, { id: 'containers', label: `Containers (${containers.length})` },
    { id: 'resources', label: 'Resources' }, { id: 'security', label: 'Security' },
    { id: 'env', label: 'Environment' }, { id: 'storage', label: 'Storage' }, { id: 'yaml', label: 'YAML' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/cronjobs')} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18} /></button>
        <Clock size={20} className="text-blue-500" />
        <div><h1 className="text-xl font-bold text-gray-900">{name}</h1><p className="text-sm text-gray-500">{namespace} · {formatAge(meta?.creationTimestamp as string)}</p></div>
        <StatusBadge status={suspended ? 'Suspended' : 'Active'} />
        <span className="font-mono text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1">{spec?.schedule as string}</span>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn('px-3.5 pb-3 pt-1 text-xs font-medium whitespace-nowrap border-b-2 transition-colors', tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>{t.label}</button>)}
        </div>
      </div>

      <div className="space-y-4">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InfoSection title="Schedule & Configuration" defaultOpen>
              <div className="pt-3">
                <InfoRow label="Schedule (cron)"   value={<span className="font-mono text-blue-700">{spec?.schedule as string}</span>} />
                <InfoRow label="Suspended"         value={String(suspended)} />
                <InfoRow label="Concurrency Policy" value={(spec?.concurrencyPolicy as string) ?? 'Allow'} />
                <InfoRow label="Successful Jobs Kept" value={String((spec?.successfulJobsHistoryLimit as number) ?? 3)} />
                <InfoRow label="Failed Jobs Kept"    value={String((spec?.failedJobsHistoryLimit     as number) ?? 1)} />
                <InfoRow label="Starting Deadline"   value={spec?.startingDeadlineSeconds ? `${spec.startingDeadlineSeconds}s` : 'None'} />
                {(status?.lastScheduleTime as string) && <InfoRow label="Last Scheduled" value={new Date(status?.lastScheduleTime as string).toLocaleString()} />}
                {(status?.lastSuccessfulTime as string) && <InfoRow label="Last Successful" value={new Date(status?.lastSuccessfulTime as string).toLocaleString()} />}
                <InfoRow label="Active Jobs" value={String((status?.active as unknown[])?.length ?? 0)} />
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
        {tab === 'yaml'       && <div className="h-[640px]"><YamlEditor yaml={JSON.stringify(cj, null, 2)} filename={`${name}.yaml`} readOnly /></div>}
      </div>
    </div>
  )
}
