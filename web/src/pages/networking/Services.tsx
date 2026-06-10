import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { servicesApi } from '@/lib/api'
type Svc = Record<string, unknown>
export default function Services() {
  return (
    <GenericResourcePage<Svc>
      title="Services" queryKey="services" namespaced
      fetchFn={(ns, p) => ns ? servicesApi.list(ns, p) as never : servicesApi.listAll(p) as never}
      columns={[
        nameColumn<Svc>(),
        { key: 'type', header: 'Type', cell: (r) => <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{((r.spec as Record<string,unknown>)?.type as string) ?? 'ClusterIP'}</span> },
        { key: 'clusterIP', header: 'Cluster IP', cell: (r) => <span className="font-mono text-xs">{((r.spec as Record<string,unknown>)?.clusterIP as string) ?? '-'}</span> },
        { key: 'ports', header: 'Ports', cell: (r) => {
          const ports = ((r.spec as Record<string,unknown>)?.ports as Array<{port:number;targetPort:unknown;protocol:string}>) ?? []
          return <span className="text-xs text-gray-500">{ports.map(p => `${p.port}/${p.protocol}`).join(', ')}</span>
        }},
        ageColumn<Svc>(),
      ]}
    />
  )
}
