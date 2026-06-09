import { useQuery } from '@tanstack/react-query'
import { policyApi } from '@/lib/api'
import { ResourceTable, Column } from '@/components/common/ResourceTable'
import { formatAge } from '@/lib/utils'
import { Trash2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
type WH = Record<string, unknown>
export default function Webhooks() {
  const qc = useQueryClient()
  const { data: mut, isLoading: mutL } = useQuery({ queryKey: ['mutating-webhooks'], queryFn: () => policyApi.listMutatingWebhooks() })
  const { data: val, isLoading: valL } = useQuery({ queryKey: ['validating-webhooks'], queryFn: () => policyApi.listValidatingWebhooks() })
  const delMut = useMutation({ mutationFn: (name: string) => policyApi.deleteMutatingWebhook(name), onSuccess: () => qc.invalidateQueries({queryKey: ['mutating-webhooks']}) })
  const delVal = useMutation({ mutationFn: (name: string) => policyApi.deleteValidatingWebhook(name), onSuccess: () => qc.invalidateQueries({queryKey: ['validating-webhooks']}) })
  const cols: Column<WH>[] = [
    { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{(r.metadata as Record<string,string>)?.name}</span> },
    { key: 'age', header: 'Age', cell: (r) => <span className="text-gray-500">{formatAge((r.metadata as Record<string,string>)?.creationTimestamp)}</span> },
  ]
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Webhooks</h1>
      <ResourceTable title="Mutating Webhooks" columns={cols} data={(mut?.data ?? []) as WH[]} loading={mutL}
        actions={(r) => <button onClick={() => delMut.mutate((r.metadata as Record<string,string>).name)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={14}/></button>} />
      <ResourceTable title="Validating Webhooks" columns={cols} data={(val?.data ?? []) as WH[]} loading={valL}
        actions={(r) => <button onClick={() => delVal.mutate((r.metadata as Record<string,string>).name)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={14}/></button>} />
    </div>
  )
}
