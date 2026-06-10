import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { rbacApi } from '@/lib/api'
type CRB = Record<string, unknown>
export default function ClusterRoleBindings() {
  return (
    <GenericResourcePage<CRB>
      title="Cluster Role Bindings" queryKey="clusterrolebindings" namespaced={false}
      fetchFn={(_, p) => rbacApi.listClusterRoleBindings(p) as never}
      columns={[
        nameColumn<CRB>(),
        { key: 'role', header: 'Role', cell: (r) => <span className="text-xs">{((r.roleRef as Record<string,string>)?.name) ?? '-'}</span> },
        { key: 'subjects', header: 'Subjects', cell: (r) => <span className="text-xs">{(r.subjects as unknown[])?.length ?? 0}</span> },
        ageColumn<CRB>(),
      ]}
    />
  )
}
