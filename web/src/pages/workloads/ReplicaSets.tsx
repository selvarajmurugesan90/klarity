import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { replicaSetsApi } from '@/lib/api'
type RS = Record<string, unknown>
export default function ReplicaSets() {
  return (
    <GenericResourcePage<RS>
      title="ReplicaSets" queryKey="replicasets" namespaced
      fetchFn={(ns, p) => ns ? replicaSetsApi.list(ns, p) as never : replicaSetsApi.listAll(p) as never}
      columns={[
        nameColumn<RS>(),
        { key: 'desired', header: 'Desired', cell: (r) => <span>{((r.spec as Record<string,unknown>)?.replicas as number) ?? 0}</span> },
        { key: 'ready', header: 'Ready', cell: (r) => <span>{((r.status as Record<string,unknown>)?.readyReplicas as number) ?? 0}</span> },
        ageColumn<RS>(),
      ]}
    />
  )
}
