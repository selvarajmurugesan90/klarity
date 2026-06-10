import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deploymentsApi } from '@/lib/api'
import { useClusterStore } from '@/store/cluster'
import { ResourceTable, Column } from '@/components/common/ResourceTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatAge } from '@/lib/utils'
import { RefreshCw, ExternalLink, FileCode } from 'lucide-react'
import YamlEditor from '@/components/common/YamlEditor'

interface Deployment {
  metadata: { name: string; namespace: string; creationTimestamp: string }
  spec: { replicas: number; template: { spec: { containers: Array<{ image: string }> } } }
  status: { availableReplicas: number; readyReplicas: number; updatedReplicas: number }
}

export default function Deployments() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { currentNamespace } = useClusterStore()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [yamlItem, setYamlItem] = useState<string | null>(null)
  const [yamlName, setYamlName] = useState('')
  const ns = currentNamespace || ''

  const { data, isLoading, error } = useQuery({
    queryKey: ['deployments', ns, page, search],
    queryFn: () => ns
      ? deploymentsApi.list(ns, { page, pageSize: 50, search })
      : deploymentsApi.listAll({ page, pageSize: 50, search }),
  })

  // Restart is kept — it's operational (no spec change)
  const restartMutation = useMutation({
    mutationFn: ({ ns, name }: { ns: string; name: string }) => deploymentsApi.restart(ns, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployments'] }),
  })

  const deps  = (data?.data ?? []) as Deployment[]
  const total = data?.total ?? 0

  const columns: Column<Deployment>[] = [
    {
      key: 'name', header: 'Name', sortable: true,
      cell: (row) => (
        <div>
          <p className="font-medium text-sm text-gray-900">{row.metadata.name}</p>
          <p className="text-xs text-gray-400">{row.metadata.namespace}</p>
        </div>
      ),
    },
    {
      key: 'ready', header: 'Ready',
      cell: (row) => {
        const ready   = row.status?.readyReplicas ?? 0
        const desired = row.spec?.replicas ?? 0
        return (
          <span className={ready === desired ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
            {ready}/{desired}
          </span>
        )
      },
    },
    {
      key: 'status', header: 'Status',
      cell: (row) => {
        const ready   = row.status?.readyReplicas ?? 0
        const desired = row.spec?.replicas ?? 0
        return <StatusBadge status={ready === desired ? 'Available' : 'Pending'} />
      },
    },
    {
      key: 'images', header: 'Image',
      cell: (row) => {
        const image = row.spec?.template?.spec?.containers?.[0]?.image ?? '-'
        const [repo, tag] = image.split(':')
        return (
          <span className="text-xs text-gray-500 font-mono" title={image}>
            {repo.split('/').pop()}:{tag ?? 'latest'}
          </span>
        )
      },
    },
    {
      key: 'age', header: 'Age',
      cell: (row) => <span className="text-gray-500">{formatAge(row.metadata.creationTimestamp)}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      {/* YAML modal — view only */}
      {yamlItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold">{yamlName}.yaml</h2>
              <button onClick={() => setYamlItem(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="flex-1 p-4">
              <YamlEditor yaml={yamlItem} filename={`${yamlName}.yaml`} readOnly />
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900">Deployments</h1>
      <ResourceTable
        columns={columns}
        data={deps}
        loading={isLoading}
        error={error ? String(error) : null}
        total={total}
        page={page}
        pageSize={50}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search deployments…"
        onRowClick={(dep) => navigate(`/deployments/${dep.metadata.namespace}/${dep.metadata.name}`)}
        getRowKey={(d) => `${d.metadata.namespace}/${d.metadata.name}`}
        csvFilename="deployments.csv"
        actions={(dep) => (
          <div className="flex items-center gap-1 justify-end">
            {/* Restart is kept — operational, no spec change */}
            <button
              onClick={() => restartMutation.mutate({ ns: dep.metadata.namespace, name: dep.metadata.name })}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
              title="Restart (rolling restart — no spec change)"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={async () => {
                const yaml = await deploymentsApi.yaml(dep.metadata.namespace, dep.metadata.name)
                setYamlName(dep.metadata.name)
                setYamlItem(yaml)
              }}
              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
              title="View YAML"
            >
              <FileCode size={14} />
            </button>
            <button
              onClick={() => navigate(`/deployments/${dep.metadata.namespace}/${dep.metadata.name}`)}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="View details"
            >
              <ExternalLink size={14} />
            </button>
          </div>
        )}
      />
    </div>
  )
}
