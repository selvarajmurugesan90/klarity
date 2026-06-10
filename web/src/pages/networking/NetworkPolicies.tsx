import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { networkPoliciesApi } from '@/lib/api'
type NP = Record<string, unknown>
export default function NetworkPolicies() {
  return (
    <GenericResourcePage<NP>
      title="Network Policies" queryKey="networkpolicies" namespaced
      fetchFn={(ns, p) => ns ? networkPoliciesApi.list(ns, p) as never : networkPoliciesApi.listAll(p) as never}
    />
  )
}
