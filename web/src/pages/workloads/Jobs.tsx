import { GenericResourcePage, nameColumn, ageColumn, statusColumn } from '@/components/common/GenericResourcePage'
import { jobsApi } from '@/lib/api'
type Job = Record<string, unknown>
export default function Jobs() {
  return (
    <GenericResourcePage<Job>
      title="Jobs" queryKey="jobs" namespaced
      fetchFn={(ns, p) => ns ? jobsApi.list(ns, p) as never : jobsApi.listAll(p) as never}
      columns={[
        nameColumn<Job>(),
        { key: 'completions', header: 'Completions', cell: (r) => {
          const s = r.status as Record<string,unknown>
          const spec = r.spec as Record<string,unknown>
          return <span>{(s?.succeeded as number) ?? 0}/{(spec?.completions as number) ?? 1}</span>
        }},
        statusColumn<Job>((r) => {
          const s = r.status as Record<string,unknown>
          if (s?.succeeded) return 'Succeeded'
          if (s?.failed) return 'Failed'
          return 'Running'
        }),
        ageColumn<Job>(),
      ]}
    />
  )
}
