import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { storageApi } from '@/lib/api'
type SC = Record<string, unknown>
export default function StorageClasses() {
  return (
    <GenericResourcePage<SC>
      title="Storage Classes" queryKey="storageclasses" namespaced={false}
      fetchFn={(_, p) => storageApi.listStorageClasses(p) as never}
      columns={[
        nameColumn<SC>(),
        { key: 'provisioner', header: 'Provisioner', cell: (r) => <span className="text-xs font-mono">{r.provisioner as string}</span> },
        { key: 'reclaimPolicy', header: 'Reclaim Policy', cell: (r) => <span className="text-xs">{r.reclaimPolicy as string ?? 'Delete'}</span> },
        { key: 'default', header: 'Default', cell: (r) => {
          const ann = (r.metadata as Record<string,unknown>)?.annotations as Record<string,string> | undefined
          return <span>{ann?.['storageclass.kubernetes.io/is-default-class'] === 'true' ? '✓' : '-'}</span>
        }},
        ageColumn<SC>(),
      ]}
    />
  )
}
