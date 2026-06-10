import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { identityApi } from '@/lib/api'
import { ResourceTable, Column } from '@/components/common/ResourceTable'
import { Users, Shield, UserCheck, Database, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BoundRole {
  roleKind: string
  roleName: string
  bindingNamespace?: string
}

interface IdentitySubject {
  kind: string
  name: string
  namespace?: string
  roles: BoundRole[]
  isSystem: boolean
}

function KindBadge({ kind }: { kind: string }) {
  const styles: Record<string, string> = {
    User: 'bg-blue-100 text-blue-700 border-blue-200',
    Group: 'bg-purple-100 text-purple-700 border-purple-200',
    ServiceAccount: 'bg-green-100 text-green-700 border-green-200',
  }
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', styles[kind] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
      {kind}
    </span>
  )
}

function ExpandableRoles({ roles }: { roles: BoundRole[] }) {
  const [expanded, setExpanded] = useState(false)
  if (roles.length === 0) return <span className="text-xs text-gray-400">No bindings</span>

  return (
    <div>
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {roles.length} role{roles.length !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {roles.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={cn(
                'px-1.5 py-0.5 rounded text-xs font-mono',
                r.roleKind === 'ClusterRole' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
              )}>
                {r.roleKind}
              </span>
              <span className="text-gray-700 font-medium">{r.roleName}</span>
              {r.bindingNamespace && (
                <span className="text-gray-400">in {r.bindingNamespace}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function IdentityManagement() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showSystem, setShowSystem] = useState(false)
  const [kindFilter, setKindFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['identity', page, search, showSystem, kindFilter],
    queryFn: () => identityApi.listSubjects({ page, pageSize: 50, search, showSystem }),
  })

  const subjects = (data?.data ?? []) as IdentitySubject[]
  const filtered = kindFilter ? subjects.filter(s => s.kind === kindFilter) : subjects
  const total = data?.total ?? 0

  // Summary stats
  const kinds = { User: 0, Group: 0, ServiceAccount: 0 }
  subjects.forEach(s => { if (kinds[s.kind as keyof typeof kinds] !== undefined) kinds[s.kind as keyof typeof kinds]++ })

  const columns: Column<IdentitySubject>[] = [
    {
      key: 'kind', header: 'Kind',
      cell: (s) => <KindBadge kind={s.kind} />,
    },
    {
      key: 'name', header: 'Name / Namespace',
      cell: (s) => (
        <div>
          <p className="font-medium text-sm text-gray-900">{s.name}</p>
          {s.namespace && <p className="text-xs text-gray-400">{s.namespace}</p>}
        </div>
      ),
    },
    {
      key: 'roles', header: 'Bound Roles',
      cell: (s) => <ExpandableRoles roles={s.roles} />,
    },
    {
      key: 'scope', header: 'Scope',
      cell: (s) => (
        <span className="text-xs text-gray-500">
          {s.roles.some(r => !r.bindingNamespace) ? '🌐 Cluster-wide' : '📦 Namespace'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Users size={18} className="text-blue-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Identity Management</h1>
          <p className="text-sm text-gray-500">All users, groups, and service accounts with cluster access</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Users', count: kinds.User, icon: <UserCheck size={18} />, color: 'text-blue-500', bg: 'bg-blue-50', kind: 'User' },
          { label: 'Groups', count: kinds.Group, icon: <Users size={18} />, color: 'text-purple-500', bg: 'bg-purple-50', kind: 'Group' },
          { label: 'Service Accounts', count: kinds.ServiceAccount, icon: <Database size={18} />, color: 'text-green-500', bg: 'bg-green-50', kind: 'ServiceAccount' },
        ].map(item => (
          <button
            key={item.kind}
            onClick={() => setKindFilter(kindFilter === item.kind ? '' : item.kind)}
            className={cn(
              'bg-white rounded-xl border p-4 text-left hover:border-blue-300 transition-colors',
              kindFilter === item.kind ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'
            )}
          >
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', item.bg)}>
              <span className={item.color}>{item.icon}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{item.count}</div>
            <div className="text-sm text-gray-500 mt-0.5">{item.label}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showSystem}
            onChange={e => setShowSystem(e.target.checked)}
            className="rounded"
          />
          Show system accounts
        </label>
        {kindFilter && (
          <button onClick={() => setKindFilter('')} className="text-sm text-red-500 hover:text-red-700">
            Clear filter
          </button>
        )}
      </div>

      <ResourceTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        total={total}
        page={page}
        pageSize={50}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search by name or namespace..."
        getRowKey={(s) => `${s.kind}-${s.namespace}-${s.name}`}
        emptyMessage="No identity subjects found"
      />
    </div>
  )
}
