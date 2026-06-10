import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { rbacApi } from '@/lib/api'
type Role = Record<string, unknown>
export default function Roles() {
  return (
    <GenericResourcePage<Role>
      title="Roles" queryKey="roles" namespaced
      fetchFn={(ns, p) => ns ? rbacApi.listRoles(ns, p) as never : rbacApi.listAllRoles(p) as never}
      columns={[
        nameColumn<Role>(),
        { key: 'rules', header: 'Rules', cell: (r) => <span>{(r.rules as unknown[])?.length ?? 0} rule(s)</span> },
        ageColumn<Role>(),
      ]}
    />
  )
}
