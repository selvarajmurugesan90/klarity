import { GenericResourcePage, nameColumn, ageColumn } from '@/components/common/GenericResourcePage'
import { cronJobsApi } from '@/lib/api'
type CJ = Record<string, unknown>
export default function CronJobs() {
  return (
    <GenericResourcePage<CJ>
      title="CronJobs" queryKey="cronjobs" namespaced
      fetchFn={(ns, p) => ns ? cronJobsApi.list(ns, p) as never : cronJobsApi.listAll(p) as never}
      columns={[
        nameColumn<CJ>(),
        { key: 'schedule', header: 'Schedule', cell: (r) => <span className="font-mono text-xs">{((r.spec as Record<string,unknown>)?.schedule as string) ?? '-'}</span> },
        { key: 'suspended', header: 'Suspended', cell: (r) => <span>{((r.spec as Record<string,unknown>)?.suspend as boolean) ? 'Yes' : 'No'}</span> },
        { key: 'lastRun', header: 'Last Run', cell: (r) => <span className="text-gray-500 text-xs">{((r.status as Record<string,unknown>)?.lastScheduleTime as string) ?? '-'}</span> },
        ageColumn<CJ>(),
      ]}
    />
  )
}
