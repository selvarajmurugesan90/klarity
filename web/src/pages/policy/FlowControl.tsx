import { useQuery } from '@tanstack/react-query'
import { policyApi } from '@/lib/api'
import { ResourceTable, Column } from '@/components/common/ResourceTable'
import { formatAge } from '@/lib/utils'
type FS = Record<string, unknown>
export default function FlowControl() {
  const { data: fsData, isLoading: fsL } = useQuery({ queryKey: ['flowschemas'], queryFn: () => policyApi.listFlowSchemas() })
  const { data: plcData, isLoading: plcL } = useQuery({ queryKey: ['prioritylevelconfigurations'], queryFn: () => policyApi.listPriorityLevelConfigurations() })
  const cols: Column<FS>[] = [
    { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{(r.metadata as Record<string,string>)?.name}</span> },
    { key: 'age', header: 'Age', cell: (r) => <span className="text-gray-500">{formatAge((r.metadata as Record<string,string>)?.creationTimestamp)}</span> },
  ]
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Flow Control</h1>
      <ResourceTable title="Flow Schemas" columns={cols} data={(fsData?.data ?? []) as FS[]} loading={fsL} />
      <ResourceTable title="Priority Level Configurations" columns={cols} data={(plcData?.data ?? []) as FS[]} loading={plcL} />
    </div>
  )
}
