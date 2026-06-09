import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { rbacApi } from '@/lib/api'
type RB = Record<string, unknown>
export default function RoleBindings() {
  return (
    <GenericResourcePage<RB>
      title="Role Bindings" queryKey="rolebindings" namespaced
      fetchFn={(ns, p) => ns ? rbacApi.listRoleBindings(ns, p) as never : rbacApi.listAllRoleBindings(p) as never}
      columns={[
        nameColumn<RB>(),
        { key: 'role', header: 'Role', cell: (r) => <span className="text-xs">{((r.roleRef as Record<string,string>)?.name) ?? '-'}</span> },
        { key: 'subjects', header: 'Subjects', cell: (r) => <span className="text-xs">{(r.subjects as unknown[])?.length ?? 0}</span> },
        ageColumn<RB>(),
      ]}
    />
  )
}
