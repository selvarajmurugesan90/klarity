import { GenericResourcePage, nameColumn, ageColumn, statusColumn } from '@/components/common/GenericResourcePage'
import { storageApi } from '@/lib/api'
type PVC = Record<string, unknown>
export default function PersistentVolumeClaims() {
  return (
    <GenericResourcePage<PVC>
      title="Persistent Volume Claims" queryKey="pvcs" namespaced
      fetchFn={(ns, p) => ns ? storageApi.listPVCs(ns, p) as never : storageApi.listAllPVCs(p) as never}
      columns={[
        nameColumn<PVC>(),
        statusColumn<PVC>((r) => ((r.status as Record<string,unknown>)?.phase as string) ?? 'Unknown'),
        { key: 'capacity', header: 'Capacity', cell: (r) => <span className="font-mono text-xs">{((r.status as Record<string,unknown>)?.capacity as Record<string,string>)?.storage ?? '-'}</span> },
        { key: 'storageClass', header: 'Storage Class', cell: (r) => <span className="text-xs">{((r.spec as Record<string,unknown>)?.storageClassName as string) ?? '-'}</span> },
        ageColumn<PVC>(),
      ]}
    />
  )
}
