import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { crdsApi, dynamicApi } from '@/lib/api'
import { ResourceTable, Column } from '@/components/common/ResourceTable'
import { formatAge } from '@/lib/utils'
import { ChevronRight, Package } from 'lucide-react'
import { useClusterStore } from '@/store/cluster'

type CRD = Record<string, unknown>
type CRInstance = Record<string, unknown>

export default function CustomResources() {
  const { group, version, resource } = useParams<{ group: string; version: string; resource: string }>()
  const navigate = useNavigate()
  const { currentNamespace } = useClusterStore()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: crdsData, isLoading: crdsLoading } = useQuery({
    queryKey: ['crds'],
    queryFn: () => crdsApi.list({ pageSize: 500 }),
    enabled: !resource,
  })

  const { data: instancesData, isLoading: instancesLoading } = useQuery({
    queryKey: ['cr-instances', group, version, resource, currentNamespace, page, search],
    queryFn: () => dynamicApi.list(group ?? '', version ?? '', resource ?? '', currentNamespace || undefined, { page, pageSize: 50, search }),
    enabled: !!resource,
  })

  if (!resource) {
    // Show list of all CRDs
    const crds = (crdsData?.data ?? []) as CRD[]
    const cols: Column<CRD>[] = [
      { key: 'name', header: 'Name', sortable: true, cell: (r) => <span className="font-medium">{(r.metadata as Record<string,unknown>)?.name as string}</span> },
      { key: 'group', header: 'Group', cell: (r) => <span className="text-xs font-mono">{(r.spec as Record<string,unknown>)?.group as string}</span> },
      { key: 'versions', header: 'Versions', cell: (r) => {
        const versions = (r.spec as Record<string,unknown>)?.versions as Array<{name:string;served:boolean}> ?? []
        return <span className="text-xs">{versions.filter(v => v.served).map(v => v.name).join(', ')}</span>
      }},
      { key: 'scope', header: 'Scope', cell: (r) => <span className="text-xs">{(r.spec as Record<string,unknown>)?.scope as string}</span> },
      { key: 'age', header: 'Age', cell: (r) => <span className="text-gray-500 text-sm">{formatAge((r.metadata as Record<string,unknown>)?.creationTimestamp as string)}</span> },
    ]
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Package size={20} className="text-purple-500" />
          <h1 className="text-2xl font-bold">Custom Resources</h1>
        </div>
        <ResourceTable
          columns={cols}
          data={crds}
          loading={crdsLoading}
          total={crds.length}
          onSearch={setSearch}
          searchPlaceholder="Search CRDs..."
          onRowClick={(crd) => {
            const spec = crd.spec as Record<string,unknown>
            const grp = spec?.group as string
            const versions = spec?.versions as Array<{name:string;served:boolean}> ?? []
            const v = versions.find(vv => vv.served)?.name ?? 'v1'
            const plural = (spec?.names as Record<string,string>)?.plural
            navigate(`/customresources/${grp}/${v}/${plural}`)
          }}
        />
      </div>
    )
  }

  // Show instances of a specific CRD
  const instances = (instancesData?.data ?? []) as CRInstance[]
  const total = (instancesData as { total?: number })?.total ?? instances.length

  const cols: Column<CRInstance>[] = [
    { key: 'name', header: 'Name', sortable: true, cell: (r) => <span className="font-medium">{(r.metadata as Record<string,unknown>)?.name as string}</span> },
    { key: 'namespace', header: 'Namespace', cell: (r) => <span className="text-xs text-gray-500">{(r.metadata as Record<string,unknown>)?.namespace as string ?? '—'}</span> },
    { key: 'age', header: 'Age', cell: (r) => <span className="text-gray-500">{formatAge((r.metadata as Record<string,unknown>)?.creationTimestamp as string)}</span> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => navigate('/customresources')} className="hover:text-blue-600">Custom Resources</button>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-medium">{resource}</span>
      </div>
      <h1 className="text-2xl font-bold">{resource}</h1>
      <p className="text-sm text-gray-500">{group}/{version}</p>
      <ResourceTable
        columns={cols}
        data={instances}
        loading={instancesLoading}
        total={total}
        page={page}
        pageSize={50}
        onPageChange={setPage}
        onSearch={setSearch}
      />
    </div>
  )
}
