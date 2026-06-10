import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ResourceTable, Column } from './ResourceTable'
import { StatusBadge } from './StatusBadge'
import { formatAge } from '@/lib/utils'
import { useClusterStore } from '@/store/cluster'
import { FileCode } from 'lucide-react'
import YamlEditor from './YamlEditor'

export interface ResourcePageConfig<T = Record<string, unknown>> {
  title: string
  queryKey: string
  namespaced?: boolean
  fetchFn: (ns: string, params: { page: number; pageSize: number; search: string }) => Promise<{ data: T[]; total?: number }>
  columns?: Column<T>[]
  defaultColumns?: boolean
  // deleteFn removed — mutations go through GitOps
}

function defaultCols<T extends Record<string, unknown>>(): Column<T>[] {
  return [
    {
      key: 'name', header: 'Name', sortable: true,
      cell: (row) => {
        const meta = row.metadata as Record<string, unknown>
        return (
          <div>
            <p className="font-medium text-sm text-gray-900">{meta?.name as string}</p>
            {(meta?.namespace as string | undefined) ? <p className="text-xs text-gray-400">{meta.namespace as string}</p> : null}
          </div>
        )
      },
    },
    {
      key: 'labels', header: 'Labels',
      cell: (row) => {
        const labels = (row.metadata as Record<string, unknown>)?.labels as Record<string, string> | undefined
        if (!labels) return <span className="text-gray-400">—</span>
        const entries = Object.entries(labels).slice(0, 2)
        return (
          <div className="flex flex-wrap gap-1">
            {entries.map(([k, v]) => (
              <span key={k} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">
                {k}={v}
              </span>
            ))}
            {Object.keys(labels).length > 2 && (
              <span className="text-xs text-gray-400">+{Object.keys(labels).length - 2}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'age', header: 'Age',
      cell: (row) => {
        const ts = (row.metadata as Record<string, unknown>)?.creationTimestamp as string
        return <span className="text-gray-500 text-sm">{formatAge(ts)}</span>
      },
    },
  ]
}

export function GenericResourcePage<T extends Record<string, unknown>>({
  title, queryKey, namespaced = true, fetchFn, columns, defaultColumns = true,
}: ResourcePageConfig<T>) {
  const { currentNamespace } = useClusterStore()
  const ns = namespaced ? (currentNamespace || '') : ''
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [yamlItem, setYamlItem] = useState<T | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: [queryKey, ns, page, search],
    queryFn: () => fetchFn(ns, { page, pageSize: 50, search }),
  })

  const items = (data?.data ?? []) as T[]
  const total = (data as { total?: number })?.total ?? items.length

  const cols = columns ?? (defaultColumns ? defaultCols<T>() : [])

  const getMeta = (row: T) => row.metadata as Record<string, unknown>

  return (
    <div className="space-y-4">
      {/* YAML viewer (read-only — changes go through GitOps) */}
      {yamlItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold">{String(getMeta(yamlItem)?.name)}.yaml</h2>
              <button onClick={() => setYamlItem(null)} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
            </div>
            <div className="flex-1 p-4">
              <YamlEditor yaml={JSON.stringify(yamlItem, null, 2)} filename={`${getMeta(yamlItem)?.name}.yaml`} readOnly />
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <ResourceTable
        columns={cols}
        data={items}
        loading={isLoading}
        error={error ? String(error) : null}
        total={total}
        page={page}
        pageSize={50}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder={`Search ${title.toLowerCase()}...`}
        getRowKey={(row) => `${getMeta(row)?.namespace}/${getMeta(row)?.name}`}
        actions={(row) => (
          <button
            onClick={() => setYamlItem(row)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="View YAML"
          >
            <FileCode size={14} />
          </button>
        )}
      />
    </div>
  )
}

// Reusable status column for common resources
export function statusColumn<T extends Record<string, unknown>>(getStatus: (row: T) => string): Column<T> {
  return {
    key: 'status', header: 'Status',
    cell: (row) => <StatusBadge status={getStatus(row)} />,
  }
}

// Age column
export function ageColumn<T extends Record<string, unknown>>(): Column<T> {
  return {
    key: 'age', header: 'Age',
    cell: (row) => {
      const ts = (row.metadata as Record<string, unknown>)?.creationTimestamp as string
      return <span className="text-gray-500">{formatAge(ts)}</span>
    },
  }
}

// Name + namespace column
export function nameColumn<T extends Record<string, unknown>>(): Column<T> {
  return {
    key: 'name', header: 'Name', sortable: true,
    cell: (row) => {
      const m = row.metadata as Record<string, unknown>
      return (
        <div>
          <p className="font-medium text-sm text-gray-900">{m?.name as string}</p>
          {m?.namespace && <p className="text-xs text-gray-400">{m.namespace as string}</p>}
        </div>
      )
    },
  }
}
