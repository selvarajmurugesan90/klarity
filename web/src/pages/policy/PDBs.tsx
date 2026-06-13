import { GenericResourcePage } from '@/components/common/GenericResourcePage'
import { policyApi } from '@/lib/api'
type PDB = Record<string, unknown>
export default function PDBs() {
  return (
    <GenericResourcePage<PDB>
      title="Pod Disruption Budgets" queryKey="pdbs" namespaced
      fetchFn={(ns, p) => ns ? policyApi.listPDBs(ns, p) as never : policyApi.listAllPDBs(p) as never}
    />
  )
}
