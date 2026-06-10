import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { configApi } from '@/lib/api'
type SA = Record<string, unknown>
export default function ServiceAccounts() {
  return (
    <GenericResourcePage<SA>
      title="Service Accounts" queryKey="serviceaccounts" namespaced
      fetchFn={(ns, p) => ns ? configApi.listServiceAccounts(ns, p) as never : configApi.listAllServiceAccounts(p) as never}
    />
  )
}
