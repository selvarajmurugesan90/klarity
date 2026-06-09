import { GenericResourcePage, nameColumn, ageColumn, statusColumn } from '@/components/common/GenericResourcePage'
import { storageApi } from '@/lib/api'
type PV = Record<string, unknown>
export default function PersistentVolumes() {
  return (
    <GenericResourcePage<PV>
      title="Persistent Volumes" queryKey="pvs" namespaced={false}
      fetchFn={(_, p) => storageApi.listPVs(p) as never}
      columns={[
        nameColumn<PV>(),
        { key: 'capacity', header: 'Capacity', cell: (r) => <span className="font-mono text-xs">{((r.spec as Record<string,unknown>)?.capacity as Record<string,string>)?.storage ?? '-'}</span> },
        { key: 'accessMode', header: 'Access Modes', cell: (r) => <span className="text-xs">{((r.spec as Record<string,unknown>)?.accessModes as string[])?.join(', ') ?? '-'}</span> },
        { key: 'reclaimPolicy', header: 'Reclaim Policy', cell: (r) => <span className="text-xs">{((r.spec as Record<string,unknown>)?.persistentVolumeReclaimPolicy as string) ?? '-'}</span> },
        statusColumn<PV>((r) => ((r.status as Record<string,unknown>)?.phase as string) ?? 'Unknown'),
        ageColumn<PV>(),
      ]}
    />
  )
}
