import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { configApi } from '@/lib/api'
type CM = Record<string, unknown>
export default function ConfigMaps() {
  return (
    <GenericResourcePage<CM>
      title="ConfigMaps" queryKey="configmaps" namespaced
      fetchFn={(ns, p) => ns ? configApi.listConfigMaps(ns, p) as never : configApi.listAllConfigMaps(p) as never}
      columns={[
        nameColumn<CM>(),
        { key: 'keys', header: 'Keys', cell: (r) => {
          const d = r.data as Record<string,string> | undefined
          return <span className="text-xs text-gray-500">{d ? Object.keys(d).join(', ') : '—'}</span>
        }},
        ageColumn<CM>(),
      ]}
    />
  )
}
