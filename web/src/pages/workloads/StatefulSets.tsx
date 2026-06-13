import { GenericResourcePage, nameColumn, ageColumn, statusColumn } from '@/components/common/GenericResourcePage'
import { statefulSetsApi } from '@/lib/api'

type SS = Record<string, unknown>

export default function StatefulSets() {
  return (
    <GenericResourcePage<SS>
      title="StatefulSets"
      queryKey="statefulsets"
      namespaced
      fetchFn={(ns, p) => ns ? statefulSetsApi.list(ns, p) as never : statefulSetsApi.listAll(p) as never}
      columns={[
        nameColumn<SS>(),
        {
          key: 'ready', header: 'Ready',
          cell: (row) => {
            const s = row.status as Record<string, unknown>
            const spec = row.spec as Record<string, unknown>
            return <span className="font-medium">{(s?.readyReplicas as number) ?? 0}/{(spec?.replicas as number) ?? 0}</span>
          },
        },
        statusColumn<SS>((row) => {
          const s = row.status as Record<string, unknown>
          const spec = row.spec as Record<string, unknown>
          return (s?.readyReplicas as number) === (spec?.replicas as number) ? 'Available' : 'Pending'
        }),
        ageColumn<SS>(),
      ]}
    />
  )
}
