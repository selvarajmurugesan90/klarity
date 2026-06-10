import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { rbacApi } from '@/lib/api'
type CR = Record<string, unknown>
export default function ClusterRoles() {
  return (
    <GenericResourcePage<CR>
      title="Cluster Roles" queryKey="clusterroles" namespaced={false}
      fetchFn={(_, p) => rbacApi.listClusterRoles(p) as never}
      columns={[
        nameColumn<CR>(),
        { key: 'rules', header: 'Rules', cell: (r) => <span>{(r.rules as unknown[])?.length ?? 0} rule(s)</span> },
        ageColumn<CR>(),
      ]}
    />
  )
}
