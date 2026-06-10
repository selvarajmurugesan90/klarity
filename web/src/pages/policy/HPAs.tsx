import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { policyApi } from '@/lib/api'
type HPA = Record<string, unknown>
export default function HPAs() {
  return (
    <GenericResourcePage<HPA>
      title="Horizontal Pod Autoscalers" queryKey="hpas" namespaced
      fetchFn={(ns, p) => ns ? policyApi.listHPAs(ns, p) as never : policyApi.listAllHPAs(p) as never}
      columns={[
        nameColumn<HPA>(),
        { key: 'ref', header: 'Scale Target', cell: (r) => {
          const ref = (r.spec as Record<string,unknown>)?.scaleTargetRef as Record<string,string>
          return <span className="text-xs">{ref?.kind}/{ref?.name}</span>
        }},
        { key: 'minMax', header: 'Min/Max', cell: (r) => {
          const spec = r.spec as Record<string,unknown>
          return <span className="text-xs">{spec?.minReplicas as number ?? 1}/{spec?.maxReplicas as number}</span>
        }},
        { key: 'current', header: 'Current', cell: (r) => <span>{((r.status as Record<string,unknown>)?.currentReplicas as number) ?? 0}</span> },
        ageColumn<HPA>(),
      ]}
    />
  )
}
