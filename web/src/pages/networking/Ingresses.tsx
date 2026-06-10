import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { ingressesApi } from '@/lib/api'
type Ingress = Record<string, unknown>
export default function Ingresses() {
  return (
    <GenericResourcePage<Ingress>
      title="Ingresses" queryKey="ingresses" namespaced
      fetchFn={(ns, p) => ns ? ingressesApi.list(ns, p) as never : ingressesApi.listAll(p) as never}
      columns={[
        nameColumn<Ingress>(),
        { key: 'class', header: 'Class', cell: (r) => <span className="text-xs">{((r.spec as Record<string,unknown>)?.ingressClassName as string) ?? '-'}</span> },
        { key: 'hosts', header: 'Hosts', cell: (r) => {
          const rules = ((r.spec as Record<string,unknown>)?.rules as Array<{host:string}>) ?? []
          return <span className="text-xs text-gray-500">{rules.map(ru => ru.host).join(', ') || '-'}</span>
        }},
        ageColumn<Ingress>(),
      ]}
    />
  )
}
