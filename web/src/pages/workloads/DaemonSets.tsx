import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { daemonSetsApi } from '@/lib/api'
type DS = Record<string, unknown>
export default function DaemonSets() {
  return (
    <GenericResourcePage<DS>
      title="DaemonSets" queryKey="daemonsets" namespaced
      fetchFn={(ns, p) => ns ? daemonSetsApi.list(ns, p) as never : daemonSetsApi.listAll(p) as never}
      columns={[
        nameColumn<DS>(),
        { key: 'desired', header: 'Desired', cell: (r) => <span>{((r.status as Record<string,unknown>)?.desiredNumberScheduled as number) ?? 0}</span> },
        { key: 'ready', header: 'Ready', cell: (r) => <span>{((r.status as Record<string,unknown>)?.numberReady as number) ?? 0}</span> },
        ageColumn<DS>(),
      ]}
    />
  )
}
