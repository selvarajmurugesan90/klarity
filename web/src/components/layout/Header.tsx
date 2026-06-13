import { Bell, RefreshCw, User, LogOut, ChevronDown, Search, Keyboard, Settings, Shield, Eye, Crown } from 'lucide-react'
import { ActivityPanelToggle } from '@/components/common/ActivityPanel'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { useClusterStore } from '@/store/cluster'
import { useAuthStore } from '@/store/auth'
import { clusterApi, namespacesApi, internalAuthApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useState } from 'react'

// Pages where a namespace selector doesn't make sense
// Overview is cluster-wide — always shows all namespaces, selector is misleading
const NO_NAMESPACE_PATHS = [
  '/',              // Overview — cluster-wide, no namespace filter
  '/nodes',         // Nodes — cluster-scoped
  '/namespaces',    // Namespaces list — cluster-scoped
  '/identity',      // Identity — cluster-scoped RBAC
  '/settings',      // Settings — not resource browsing
  '/audit',         // Audit — cluster-wide log
  '/reports',       // Health report — cluster-wide
  '/persistentvolumes',
  '/storageclasses',
  '/clusterroles',
  '/clusterrolebindings',
  '/priorityclasses',
  '/runtimeclasses',
  '/webhooks',
  '/certificatesigningrequests',
  '/flowcontrol',
  '/customresources',
  '/gitops',
  '/top',           // Top Consumers — cluster-wide metrics
  '/portforward',   // Port forwarding — not namespace-filtered
]

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin:  <Crown size={11} className="text-red-400" />,
  editor: <Shield size={11} className="text-yellow-400" />,
  viewer: <Eye size={11} className="text-green-400" />,
}

const ROLE_COLORS: Record<string, string> = {
  admin:  'bg-red-500/10 text-red-400 border-red-500/20',
  editor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  viewer: 'bg-green-500/10 text-green-400 border-green-500/20',
}

export default function Header() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentNamespace, setNamespace, namespaces, currentCluster, setCluster, setClusters } = useClusterStore()
  const { user, logout, currentUser, authMode } = useAuthStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Hide namespace selector on cluster-wide pages
  // Exact match for '/' (overview), prefix match for everything else
  const showNsSelector = !NO_NAMESPACE_PATHS.some(p =>
    p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)
  )

  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: async () => {
      const r = await clusterApi.list()
      setClusters(r.data)
      return r.data
    },
    staleTime: 60_000,
  })

  const { data: nsData } = useQuery({
    queryKey: ['namespaces'],
    queryFn: async () => {
      const r = await namespacesApi.list({ pageSize: 500 })
      return (r.data as Array<{ metadata: { name: string } }>).map(n => n.metadata.name)
    },
    staleTime: 60_000,
  })

  const nsOptions = nsData ?? namespaces

  async function handleLogout() {
    try {
      if (authMode === 'internal') {
        await internalAuthApi.logout()
      }
    } catch {}
    logout()
    navigate('/login', { replace: true })
    setUserMenuOpen(false)
  }

  const displayName = currentUser?.displayName || user || 'User'
  const userRole = currentUser?.role ?? 'viewer'
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        {/* Cluster Selector */}
        {clusters && clusters.length > 1 && (
          <select
            value={currentCluster}
            onChange={async (e) => {
              await clusterApi.switch(e.target.value)
              setCluster(e.target.value)
              qc.invalidateQueries()
            }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {clusters.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        )}

        {/* Namespace Selector — hidden on cluster-wide pages */}
        {showNsSelector && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 hidden sm:block">Namespace:</span>
            <select
              value={currentNamespace}
              onChange={e => setNamespace(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Namespaces</option>
              {nsOptions.map(ns => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Global Search */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('kd:open-search'))}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          title="Global Search (Ctrl+K)"
        >
          <Search size={14} />
          <span className="hidden md:inline text-xs">Search...</span>
          <kbd className="hidden md:inline text-xs bg-white border border-gray-200 rounded px-1">⌘K</kbd>
        </button>

        {/* Keyboard Shortcuts */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('kd:toggle-shortcuts'))}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard size={16} />
        </button>

        {/* Refresh */}
        <button
          onClick={() => qc.invalidateQueries()}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh all data"
        >
          <RefreshCw size={16} />
        </button>

        {/* Activities Panel toggle */}
        <ActivityPanelToggle />

        {/* Notifications */}
        <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg relative">
          <Bell size={16} />
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(o => !o)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {/* Avatar */}
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0',
              userRole === 'admin' ? 'bg-gradient-to-br from-red-500 to-red-600' :
              userRole === 'editor' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
              'bg-gradient-to-br from-blue-500 to-blue-600'
            )}>
              {initials || <User size={14} />}
            </div>
            <div className="hidden md:flex flex-col items-start leading-none">
              <span className="text-sm font-medium text-gray-800">{displayName}</span>
              <div className="flex items-center gap-1 mt-0.5">
                {ROLE_ICONS[userRole]}
                <span className="text-xs text-gray-400 capitalize">{userRole}</span>
              </div>
            </div>
            <ChevronDown size={12} className="text-gray-400 hidden md:block" />
          </button>

          {userMenuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden"
              onMouseLeave={() => setUserMenuOpen(false)}
            >
              {/* Profile header */}
              <div className="px-4 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white',
                    userRole === 'admin' ? 'bg-gradient-to-br from-red-500 to-red-600' :
                    userRole === 'editor' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                    'bg-gradient-to-br from-blue-500 to-blue-600'
                  )}>
                    {initials || <User size={16} />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{displayName}</p>
                    {currentUser?.email && <p className="text-xs text-gray-500">{currentUser.email}</p>}
                    <span className={cn(
                      'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border mt-0.5',
                      ROLE_COLORS[userRole] ?? ROLE_COLORS.viewer
                    )}>
                      {ROLE_ICONS[userRole]}
                      <span className="capitalize">{userRole}</span>
                    </span>
                  </div>
                </div>
                {currentUser?.mustChangePassword && (
                  <div className="mt-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-1.5">
                    ⚠ Please change your default password
                  </div>
                )}
              </div>

              {/* Menu items */}
              <div className="py-1.5">
                <button
                  onClick={() => { navigate('/settings'); setUserMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings size={15} className="text-gray-400" />
                  Settings
                </button>

                {authMode === 'internal' && (
                  <button
                    onClick={() => { navigate('/settings?tab=auth'); setUserMenuOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Shield size={15} className="text-gray-400" />
                    Change Password
                  </button>
                )}

                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => { navigate('/settings?tab=users'); setUserMenuOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User size={15} className="text-gray-400" />
                    User Management
                  </button>
                )}
              </div>

              <div className="border-t border-gray-100 py-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
