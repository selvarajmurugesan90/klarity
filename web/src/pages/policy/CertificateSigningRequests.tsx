import { GenericResourcePage, nameColumn, ageColumn, statusColumn } from '@/components/common/GenericResourcePage'
import { policyApi } from '@/lib/api'
type CSR = Record<string, unknown>
export default function CertificateSigningRequests() {
  return (
    <GenericResourcePage<CSR>
      title="Certificate Signing Requests" queryKey="csrs" namespaced={false}
      fetchFn={() => policyApi.listCSRs() as never}
      columns={[
        nameColumn<CSR>(),
        statusColumn<CSR>((r) => {
          const conds = ((r.status as Record<string,unknown>)?.conditions as Array<{type:string}>) ?? []
          return conds.find(c => c.type === 'Approved') ? 'Approved' : 'Pending'
        }),
        ageColumn<CSR>(),
      ]}
    />
  )
}
