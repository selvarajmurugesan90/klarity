import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { policyApi } from '@/lib/api'
type PC = Record<string, unknown>
export default function PriorityClasses() {
  return (
    <GenericResourcePage<PC>
      title="Priority Classes" queryKey="priorityclasses" namespaced={false}
      fetchFn={() => policyApi.listPriorityClasses() as never}
      columns={[
        nameColumn<PC>(),
        { key: 'value', header: 'Value', cell: (r) => <span className="font-mono">{r.value as number}</span> },
        { key: 'global', header: 'Global Default', cell: (r) => <span>{(r.globalDefault as boolean) ? 'Yes' : 'No'}</span> },
        ageColumn<PC>(),
      ]}
    />
  )
}
