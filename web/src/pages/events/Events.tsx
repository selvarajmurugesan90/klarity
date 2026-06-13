import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { eventsApi } from '@/lib/api'
import { ResourceTable, Column } from '@/components/common/ResourceTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatAge } from '@/lib/utils'
import { Bell, AlertTriangle, Info, RefreshCw, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type KEvent = {
  type: string; reason: string; message: string; namespace: string; count: number
  lastTimestamp: string
  involvedObject: { kind: string; name: string }
  metadata: { name: string; creationTimestamp: string }
}

// Time range options — in minutes (0 = All)
const TIME_RANGES = [
  { label: 'All',     minutes: 0 },
  { label: 'Last 1h', minutes: 60 },
  { label: 'Last 6h', minutes: 360 },
  { label: 'Last 8h', minutes: 480 },
  { label: 'Last 24h',minutes: 1440 },
]

function TypeIcon({ type }: { type: string }) {
  return type === 'Warning'
    ? <AlertTriangle size={13} className="text-yellow-500" />
    : <Info size={13} className="text-blue-400" />
}

export default function Events() {
  const qc = useQueryClient()
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [timeRange, setTimeRange]   = useState(0)   // 0 = All
  const [isFetching, setIsFetching] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['events', page, search, typeFilter],
    queryFn: () => eventsApi.list({
      namespace: '',
      page,
      pageSize: 500,         // fetch more so we can time-filter client-side
      search:   search || undefined,
      type:     typeFilter || undefined,
    } as never),
    refetchInterval: 15_000,
    staleTime: 5_000,
  })

  // Client-side time range filter on lastTimestamp
  const allEvents = useMemo(() => (data?.data ?? []) as KEvent[], [data])
  const events = useMemo(() => {
    if (timeRange === 0) return allEvents
    const cutoff = new Date(Date.now() - timeRange * 60 * 1000)
    return allEvents.filter(e => {
      const ts = e.lastTimestamp
      if (!ts) return false
      return new Date(ts) >= cutoff
    })
  }, [allEvents, timeRange])

  const total    = events.length
  const warnings = events.filter(e => e.type === 'Warning').length
  const normal   = events.filter(e => e.type !== 'Warning').length

  async function refresh() {
    setIsFetching(true)
    await qc.invalidateQueries({ queryKey: ['events'] })
    setIsFetching(false)
  }

  const columns: Column<KEvent>[] = [
    {
      key: 'type', header: 'Type', width: '90px',
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <TypeIcon type={r.type} />
          <StatusBadge status={r.type ?? 'Normal'} />
        </div>
      ),
    },
    {
      key: 'reason', header: 'Reason', width: '140px',
      cell: (r) => <span className="font-medium text-sm text-gray-900">{r.reason}</span>,
    },
    {
      key: 'object', header: 'Object',
      cell: (r) => (
        <div>
          <p className="text-xs font-mono text-gray-700">{r.involvedObject?.kind}/{r.involvedObject?.name}</p>
          <p className="text-xs text-gray-400">{r.namespace}</p>
        </div>
      ),
    },
    {
      key: 'message', header: 'Message',
      cell: (r) => <span className="text-xs text-gray-600 block max-w-xs truncate" title={r.message}>{r.message}</span>,
    },
    {
      key: 'count', header: 'Count', width: '70px',
      cell: (r) => (
        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded',
          (r.count ?? 1) > 5 ? 'bg-orange-100 text-orange-700' : 'text-gray-500')}>
          {r.count ?? 1}
        </span>
      ),
    },
    {
      key: 'age', header: 'Last Seen', width: '110px',
      cell: (r) => <span className="text-xs text-gray-400 whitespace-nowrap">{r.lastTimestamp ? formatAge(r.lastTimestamp) + ' ago' : '—'}</span>,
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <Bell size={18} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Events</h1>
            <p className="text-sm text-gray-500">
              All namespaces · {total} events
              {warnings > 0 && <span className="ml-2 text-yellow-600 font-medium">⚠ {warnings} warning{warnings !== 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>
        <button onClick={refresh} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl" title="Refresh">
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* ── Time range filter ────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1">
          <Clock size={13} className="text-gray-400 ml-1.5" />
          {TIME_RANGES.map(opt => (
            <button
              key={opt.minutes}
              onClick={() => { setTimeRange(opt.minutes); setPage(1) }}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                timeRange === opt.minutes
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Type filter ─────────────────────────────────────────────────── */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs ml-auto">
          {[
            { value: '',        label: 'All types' },
            { value: 'Warning', label: '⚠ Warning'  },
            { value: 'Normal',  label: '● Normal'   },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => { setTypeFilter(opt.value); setPage(1) }}
              className={cn('px-3 py-2 font-medium transition-colors',
                typeFilter === opt.value ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl text-sm">
          <AlertTriangle size={14} className="text-yellow-500" />
          <span className="font-semibold text-yellow-700">{warnings}</span>
          <span className="text-yellow-600">warning{warnings !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm">
          <Info size={14} className="text-blue-500" />
          <span className="font-semibold text-blue-700">{normal}</span>
          <span className="text-blue-600">normal</span>
        </div>
        {timeRange > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
            <Clock size={12} />
            Filtered to last {timeRange >= 60 ? `${timeRange / 60}h` : `${timeRange}m`}
          </div>
        )}
        <span className="text-xs text-gray-400 ml-auto">Auto-refreshes every 15s</span>
      </div>

      {/* Note about event TTL */}
      {events.length === 0 && !isLoading && (
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            {timeRange > 0
              ? `No events found in the last ${timeRange >= 60 ? `${timeRange / 60} hours` : `${timeRange} minutes`}. The cluster may have been idle.`
              : 'No events found. Kubernetes events expire after ~1 hour when the cluster is idle. Trigger activity (deploy, restart) to generate events.'
            }
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <AlertTriangle size={14} /> Failed to load events: {String(error)}
        </div>
      )}

      <ResourceTable
        columns={columns}
        data={events}
        loading={isLoading}
        total={total}
        page={page}
        pageSize={100}
        onPageChange={setPage}
        onSearch={(s) => { setSearch(s); setPage(1) }}
        searchPlaceholder="Search by reason, object name, or namespace…"
        emptyMessage={typeFilter === 'Warning' ? 'No warning events — cluster looks healthy!' : 'No events found'}
        csvFilename="events.csv"
      />
    </div>
  )
}
