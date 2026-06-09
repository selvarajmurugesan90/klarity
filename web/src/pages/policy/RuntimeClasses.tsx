import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { policyApi } from '@/lib/api'
type RC = Record<string, unknown>
export default function RuntimeClasses() {
  return (
    <GenericResourcePage<RC>
      title="Runtime Classes" queryKey="runtimeclasses" namespaced={false}
      fetchFn={() => policyApi.listRuntimeClasses() as never}
      columns={[
        nameColumn<RC>(),
        { key: 'handler', header: 'Handler', cell: (r) => <span className="font-mono text-xs">{r.handler as string}</span> },
        ageColumn<RC>(),
      ]}
    />
  )
}
