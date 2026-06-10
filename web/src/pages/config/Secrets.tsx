import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { configApi } from '@/lib/api'
type Secret = Record<string, unknown>
export default function Secrets() {
  return (
    <GenericResourcePage<Secret>
      title="Secrets" queryKey="secrets" namespaced
      fetchFn={(ns, p) => ns ? configApi.listSecrets(ns, p) as never : configApi.listAllSecrets(p) as never}
      columns={[
        nameColumn<Secret>(),
        { key: 'type', header: 'Type', cell: (r) => <span className="text-xs text-gray-500">{r.type as string}</span> },
        { key: 'keys', header: 'Keys', cell: (r) => <span className="text-xs text-gray-500">{(r.keys as string[])?.join(', ') ?? '—'}</span> },
        ageColumn<Secret>(),
      ]}
    />
  )
}
