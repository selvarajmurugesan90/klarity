import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { deploymentsApi, deploymentHistoryApi } from '@/lib/api'
import { formatAge } from '@/lib/utils'
import { StatusBadge } from '@/components/common/StatusBadge'
import YamlEditor from '@/components/common/YamlEditor'
import { ArrowLeft, Layers, RotateCcw, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  InfoSection, InfoRow, SecurityContextSection, ContainerResourcesSection,
  EnvVarsSection, VolumesSection, SchedulingSection, LabelsAnnotations,
  ContainerCard, type K8sContainer, type K8sPodSpec,
} from '@/components/common/ResourceDetailSections'
import { useMutation, useQueryClient } from '@tanstack/react-query'

type Tab = 'overview' | 'containers' | 'resources' | 'security' | 'env' | 'storage' | 'scheduling' | 'history' | 'yaml' | 'events'

export default function DeploymentDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>()
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')

  const { data } = useQuery({ queryKey: ['deployment', namespace, name], queryFn: () => deploymentsApi.get(namespace!, name!) })
  const { data: yamlData, isLoading: yamlLoading, error: yamlError } = useQuery({ queryKey: ['deployment-yaml', namespace, name], queryFn: () => deploymentsApi.yaml(namespace!, name!), enabled: tab === 'yaml' })
  const { data: eventsData } = useQuery({ queryKey: ['deployment-events', namespace, name], queryFn: () => deploymentsApi.events(namespace!, name!), enabled: tab === 'events' })
  const { data: historyData } = useQuery({ queryKey: ['deployment-history', namespace, name], queryFn: () => deploymentHistoryApi.history(namespace!, name!), enabled: tab === 'history' })

  const rollbackMutation = useMutation({
    mutationFn: ({ revision, rsName }: { revision: string; rsName: string }) =>
      deploymentHistoryApi.rollback(namespace!, name!, revision, rsName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployment', namespace, name] }),
  })

  const dep    = data?.data as Record<string, unknown> | undefined
  const spec   = dep?.spec  as Record<string, unknown> | undefined
  const status = dep?.status as Record<string, unknown> | undefined
  const meta   = dep?.metadata as Record<string, unknown> | undefined
  const tmplSpec = ((spec?.template as Record<string,unknown>)?.spec) as K8sPodSpec | undefined
  const containers: K8sContainer[] = tmplSpec?.containers ?? []

  if (!dep) return <div className="text-gray-400 py-8 text-center">Loading…</div>

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',   label: 'Overview'    },
    { id: 'containers', label: `Containers (${containers.length})` },
    { id: 'resources',  label: 'Resources'   },
    { id: 'security',   label: 'Security'    },
    { id: 'env',        label: 'Environment' },
    { id: 'storage',    label: 'Storage'     },
    { id: 'scheduling', label: 'Scheduling'  },
    { id: 'history',    label: 'History'     },
    { id: 'yaml',       label: 'YAML'        },
    { id: 'events',     label: 'Events'      },
  ]

  const ready   = (status?.readyReplicas   as number) ?? 0
  const desired = (spec?.replicas          as number) ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/deployments')} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18} /></button>
        <Layers size={20} className="text-blue-500" />
        <div><h1 className="text-xl font-bold text-gray-900">{name}</h1><p className="text-sm text-gray-500">{namespace} · {formatAge(meta?.creationTimestamp as string)}</p></div>
        <StatusBadge status={ready === desired ? 'Available' : 'Pending'} />
        <span className="text-sm font-semibold text-gray-600">{ready}/{desired}</span>
      </div>

      <div className="border-b border-gray-200">
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

      <div className="space-y-4">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InfoSection title="Status" defaultOpen>
              <div className="pt-3">
                <InfoRow label="Desired Replicas"   value={String(desired)} />
                <InfoRow label="Ready Replicas"     value={String(ready)} />
                <InfoRow label="Available Replicas" value={String((status?.availableReplicas as number) ?? 0)} />
                <InfoRow label="Updated Replicas"   value={String((status?.updatedReplicas as number) ?? 0)} />
                <InfoRow label="Strategy"           value={(spec?.strategy as Record<string,string>)?.type ?? 'RollingUpdate'} />
                {(spec?.strategy as Record<string,unknown>)?.rollingUpdate && (
                  <>
                    <InfoRow label="Max Unavailable" value={String(((spec?.strategy as Record<string,Record<string,string>>)?.rollingUpdate)?.maxUnavailable ?? 1)} />
                    <InfoRow label="Max Surge"       value={String(((spec?.strategy as Record<string,Record<string,string>>)?.rollingUpdate)?.maxSurge ?? 1)} />
                  </>
                )}
                <InfoRow label="Min Ready Seconds"  value={String((spec?.minReadySeconds as number) ?? 0)} />
                <InfoRow label="Progress Deadline"  value={`${(spec?.progressDeadlineSeconds as number) ?? 600}s`} />
                <InfoRow label="Revision History Limit" value={String((spec?.revisionHistoryLimit as number) ?? 10)} />
              </div>
            </InfoSection>
            <InfoSection title="Labels & Annotations" defaultOpen={false}>
              <LabelsAnnotations labels={meta?.labels as Record<string,string>} annotations={meta?.annotations as Record<string,string>} />
            </InfoSection>
          </div>
        )}

        {tab === 'containers' && (
          <InfoSection title={`Containers (${containers.length})`} defaultOpen>
            <div className="pt-3 space-y-3">{containers.map(c => <ContainerCard key={c.name} container={c} />)}</div>
          </InfoSection>
        )}

        {tab === 'resources' && (
          <InfoSection title="Resource Requests & Limits" defaultOpen>
            <ContainerResourcesSection containers={containers} />
          </InfoSection>
        )}

        {tab === 'security' && (
          <div className="space-y-4">
            {containers.map(c => (
              <InfoSection key={c.name} title={`Security — ${c.name}`} defaultOpen>
                <SecurityContextSection podSpec={tmplSpec} container={c} />
              </InfoSection>
            ))}
          </div>
        )}

        {tab === 'env' && (
          <InfoSection title="Environment Variables" defaultOpen>
            <EnvVarsSection containers={containers} />
          </InfoSection>
        )}

        {tab === 'storage' && (
          <InfoSection title="Volumes & Mounts" defaultOpen>
            <VolumesSection podSpec={tmplSpec} />
          </InfoSection>
        )}

        {tab === 'scheduling' && (
          <InfoSection title="Scheduling & Placement" defaultOpen>
            <SchedulingSection podSpec={tmplSpec} />
          </InfoSection>
        )}

        {tab === 'history' && (() => {
          const history = (historyData?.data as { history: Array<Record<string,unknown>>; current: string } | undefined)
          const revisions = [...(history?.history ?? [])].sort((a, b) => parseInt(b.revision as string) - parseInt(a.revision as string))
          return (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Current revision: <strong>#{history?.current}</strong> · {revisions.length} revision(s)</p>
              {revisions.map((rev, i) => (
                <div key={i} className={cn('bg-white rounded-xl border p-4 flex items-start justify-between',
                  rev.isCurrent ? 'border-blue-300 bg-blue-50' : 'border-gray-200')}>
                  <div className="flex items-start gap-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0',
                      rev.isCurrent ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600')}>
                      {rev.revision as string}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900">Revision #{rev.revision as string}</span>
                        {rev.isCurrent && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle size={10} />Current</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{rev.rsName as string}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(rev.images as string[] ?? []).map((img, j) => <span key={j} className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{img}</span>)}
                      </div>
                    </div>
                  </div>
                  {!rev.isCurrent && (
                    <button
                      onClick={() => { if (confirm(`Rollback to revision #${rev.revision}?`)) rollbackMutation.mutate({ revision: rev.revision as string, rsName: rev.rsName as string }) }}
                      disabled={rollbackMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 flex-shrink-0">
                      <RotateCcw size={12} /> Rollback
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        })()}

        {tab === 'yaml' && <div className="h-[640px]"><YamlEditor yaml={yamlData ?? ''} filename={`${name}.yaml`} readOnly loading={yamlLoading} error={yamlError ? 'Failed to load YAML' : undefined} /></div>}

        {tab === 'events' && (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {!(eventsData?.data as unknown[])?.length
              ? <div className="py-10 text-center text-gray-400 text-sm">No events</div>
              : (eventsData?.data as Array<Record<string,unknown>> ?? []).map((ev, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-4">
                    <StatusBadge status={ev.type as string ?? 'Normal'} />
                    <div className="flex-1"><p className="text-sm font-medium text-gray-900">{ev.reason as string}</p><p className="text-xs text-gray-500">{ev.message as string}</p></div>
                    <span className="text-xs text-gray-400">{formatAge(ev.lastTimestamp as string)} ago</span>
                  </div>
                ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
