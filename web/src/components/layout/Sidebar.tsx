import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { useClusterStore } from '@/store/cluster'
import { api, internalAuthApi } from '@/lib/api'
import {
  LayoutDashboard,
  Layers, Database, Server, Cpu, Clock, Box, RotateCcw,
  Globe, GitBranch, ShieldCheck,
  HardDrive, Archive,
  FileCode, Key, Lock,
  ShieldAlert, Scale, Zap, FlaskConical, Webhook, BookOpen, Timer,
  Bell, AlignJustify,
  Code2,
  GitMerge,
  Cable, ClipboardList, FileText, Users, TrendingUp,
  Settings2, LogOut, ChevronRight, ChevronLeft, User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Nav structure ─────────────────────────────────────────────────────────────

interface Child { label: string; href: string; icon: React.ReactNode }
interface Section { id: string; sectionLabel: string; icon: React.ReactNode; children: Child[] }
interface Single  { id: string; label: string; href: string; icon: React.ReactNode }
type NavItem = Section | Single

const isSingle = (i: NavItem): i is Single => 'href' in i

const NAV_STRUCTURE: { divider: string; items: NavItem[] }[] = [
  {
    divider: '',
    items: [
      { id: 'overview', label: 'Overview', href: '/', icon: <LayoutDashboard size={15} /> },
    ],
  },
  {
    divider: 'Workloads',
    items: [
      {
        id: 'workloads', sectionLabel: 'Workloads', icon: <Layers size={15} />,
        children: [
          { label: 'Deployments',  href: '/deployments',  icon: <Layers size={13} /> },
          { label: 'StatefulSets', href: '/statefulsets', icon: <Database size={13} /> },
          { label: 'DaemonSets',   href: '/daemonsets',   icon: <Server size={13} /> },
          { label: 'ReplicaSets',  href: '/replicasets',  icon: <RotateCcw size={13} /> },
          { label: 'Jobs',         href: '/jobs',         icon: <Cpu size={13} /> },
          { label: 'CronJobs',     href: '/cronjobs',     icon: <Clock size={13} /> },
          { label: 'Pods',         href: '/pods',         icon: <Box size={13} /> },
        ],
      },
    ],
  },
  {
    divider: 'Networking',
    items: [
      {
        id: 'networking', sectionLabel: 'Networking', icon: <Globe size={15} />,
        children: [
          { label: 'Services',         href: '/services',        icon: <Globe size={13} /> },
          { label: 'Ingresses',        href: '/ingresses',       icon: <GitBranch size={13} /> },
          { label: 'Network Policies', href: '/networkpolicies', icon: <ShieldCheck size={13} /> },
        ],
      },
    ],
  },
  {
    divider: 'Storage',
    items: [
      {
        id: 'storage', sectionLabel: 'Storage', icon: <HardDrive size={15} />,
        children: [
          { label: 'Persistent Volumes', href: '/persistentvolumes',      icon: <HardDrive size={13} /> },
          { label: 'PV Claims',          href: '/persistentvolumeclaims', icon: <Archive size={13} /> },
          { label: 'Storage Classes',    href: '/storageclasses',         icon: <Layers size={13} /> },
        ],
      },
    ],
  },
  {
    divider: 'Configuration',
    items: [
      {
        id: 'config', sectionLabel: 'Configuration', icon: <FileCode size={15} />,
        children: [
          { label: 'ConfigMaps',       href: '/configmaps',      icon: <FileCode size={13} /> },
          { label: 'Secrets',          href: '/secrets',         icon: <Key size={13} /> },
          { label: 'Service Accounts', href: '/serviceaccounts', icon: <Lock size={13} /> },
        ],
      },
      {
        id: 'rbac', sectionLabel: 'Access Control', icon: <ShieldAlert size={15} />,
        children: [
          { label: 'Cluster Roles',         href: '/clusterroles',        icon: <ShieldAlert size={13} /> },
          { label: 'Roles',                 href: '/roles',               icon: <ShieldAlert size={13} /> },
          { label: 'Cluster Role Bindings', href: '/clusterrolebindings', icon: <Lock size={13} /> },
          { label: 'Role Bindings',         href: '/rolebindings',        icon: <Lock size={13} /> },
        ],
      },
    ],
  },
  {
    divider: 'Cluster',
    items: [
      {
        id: 'cluster', sectionLabel: 'Cluster', icon: <Server size={15} />,
        children: [
          { label: 'Nodes',      href: '/nodes',      icon: <Server size={13} /> },
          { label: 'Namespaces', href: '/namespaces', icon: <AlignJustify size={13} /> },
          { label: 'Events',     href: '/events',     icon: <Bell size={13} /> },
        ],
      },
      {
        id: 'policy', sectionLabel: 'Policy', icon: <Scale size={15} />,
        children: [
          { label: 'HPAs',                  href: '/horizontalpodautoscalers', icon: <Scale size={13} /> },
          { label: 'Pod Disruption Budgets',href: '/poddisruptionbudgets',     icon: <ShieldCheck size={13} /> },
          { label: 'Priority Classes',      href: '/priorityclasses',          icon: <Zap size={13} /> },
          { label: 'Runtime Classes',       href: '/runtimeclasses',           icon: <FlaskConical size={13} /> },
          { label: 'Webhooks',              href: '/webhooks',                 icon: <Webhook size={13} /> },
          { label: 'Cert Sign Requests',    href: '/certificatesigningrequests', icon: <BookOpen size={13} /> },
          { label: 'Flow Control',          href: '/flowcontrol',              icon: <Timer size={13} /> },
        ],
      },
    ],
  },
  {
    divider: 'Extensions',
    items: [
      { id: 'crd', label: 'Custom Resources', href: '/customresources', icon: <Code2 size={15} /> },
    ],
  },
  {
    divider: 'GitOps',
    items: [
      {
        id: 'gitops', sectionLabel: 'GitOps', icon: <GitMerge size={15} />,
        children: [
          { label: 'Overview', href: '/gitops',        icon: <GitMerge size={13} /> },
          { label: 'ArgoCD',   href: '/gitops/argocd', icon: <GitBranch size={13} /> },
          { label: 'Flux CD',  href: '/gitops/flux',   icon: <GitBranch size={13} /> },
        ],
      },
    ],
  },
  {
    divider: 'Operations',
    items: [
      {
        id: 'operations', sectionLabel: 'Operations', icon: <Cable size={15} />,
        children: [
          { label: 'Top Consumers',   href: '/top',         icon: <TrendingUp size={13} /> },
          { label: 'Port Forwarding', href: '/portforward', icon: <Cable size={13} /> },
          { label: 'Audit Log',       href: '/audit',       icon: <ClipboardList size={13} /> },
          { label: 'Health Report',   href: '/reports',     icon: <FileText size={13} /> },
        ],
      },
      { id: 'identity', label: 'Identity', href: '/identity', icon: <Users size={15} /> },
    ],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function getActiveSectionId(pathname: string): string | null {
  for (const group of NAV_STRUCTURE) {
    for (const item of group.items) {
      if (!isSingle(item)) {
        if (item.children.some(c =>
          pathname === c.href || pathname.startsWith(c.href + '/')
        )) return item.id
      }
    }
  }
  return null
}

// ── Sidebar component ─────────────────────────────────────────────────────────

export default function Sidebar() {
  const location = useLocation()
  const navigate  = useNavigate()
  const { currentUser, user, logout, authMode } = useAuthStore()
  const { currentCluster } = useClusterStore()

  const [collapsed, setCollapsed] = useState(false)

  // ACCORDION — only one section open at a time
  const [openId, setOpenId] = useState<string | null>(
    () => getActiveSectionId(location.pathname)
  )

  // Auto-open correct section when route changes
  useEffect(() => {
    const id = getActiveSectionId(location.pathname)
    if (id) setOpenId(id)
  }, [location.pathname])

  // Warning event count badge
  const { data: warnCount } = useQuery({
    queryKey: ['sidebar-warn-count'],
    queryFn: () => api.get('/api/v1/events?type=Warning&pageSize=1')
      .then(r => (r.data?.total as number) ?? 0),
    refetchInterval: 30_000,
  })

  function toggle(id: string) {
    // Accordion: same id → close, different id → open (closes previous)
    setOpenId(prev => (prev === id ? null : id))
  }

  async function handleLogout() {
    try { if (authMode === 'internal') await internalAuthApi.logout() } catch {}
    logout()
    navigate('/login', { replace: true })
  }

  const displayName = currentUser?.displayName || user || 'User'
  const role        = currentUser?.role ?? 'viewer'
  const initials    = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  const avatarColor =
    role === 'admin'  ? 'from-red-500 to-red-700'    :
    role === 'editor' ? 'from-yellow-500 to-orange-600' :
                        'from-blue-500 to-blue-700'

  const roleLabel =
    role === 'admin'  ? 'text-red-400'    :
    role === 'editor' ? 'text-yellow-400' : 'text-blue-400'

  return (
    <aside className={cn(
      'relative flex flex-col bg-[#0d1117] border-r border-slate-800 h-screen transition-[width] duration-200 ease-in-out flex-shrink-0 select-none',
      collapsed ? 'w-14' : 'w-56'
    )}>

      {/* ── Brand header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 h-14 border-b border-slate-800 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40 flex-shrink-0">
              <LayoutDashboard size={13} className="text-white" />
            </div>
            <div className="leading-none">
              <p className="text-[13px] font-bold text-white">Klarity</p>
              <p className="text-[10px] text-slate-600 mt-0.5">v1.0.0</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors ml-auto"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronLeft size={13} className={cn('transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* ── Cluster pill ──────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="mx-2.5 mt-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/40 rounded-lg border border-slate-700/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 shadow-sm shadow-emerald-500/50" />
            <span className="text-[11px] text-slate-400 truncate">{currentCluster || 'in-cluster'}</span>
          </div>
        </div>
      )}

      {/* ── Scrollable nav ────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-1.5 space-y-px scrollbar-thin">
        {NAV_STRUCTURE.map((group, gi) => (
          <div key={gi}>
            {/* Divider / section label */}
            {group.divider && (
              collapsed ? (
                <div className="my-1.5 mx-2 h-px bg-slate-800" />
              ) : (
                <div className="flex items-center gap-1.5 px-2 pt-3.5 pb-1">
                  <span className="text-[9.5px] font-semibold uppercase tracking-widest text-slate-600 whitespace-nowrap">
                    {group.divider}
                  </span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
              )
            )}

            {/* Items in this group */}
            {group.items.map(item => {
              if (isSingle(item)) {
                // Single nav link
                return (
                  <NavLink
                    key={item.id}
                    to={item.href}
                    end={item.href === '/'}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) => cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors',
                      isActive
                        ? 'bg-blue-500/10 text-blue-300 border-l-2 border-blue-500 pl-[9px]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    )}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                )
              }

              // Accordion section
              const isOpen = openId === item.id
              const hasActive = item.children.some(c =>
                location.pathname === c.href || location.pathname.startsWith(c.href + '/')
              )

              return (
                <div key={item.id}>
                  {/* Section toggle button */}
                  <button
                    onClick={() => toggle(item.id)}
                    title={collapsed ? item.sectionLabel : undefined}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors group',
                      isOpen || hasActive
                        ? 'text-slate-200'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    )}
                  >
                    <span className={cn(
                      'flex-shrink-0 transition-colors',
                      isOpen || hasActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'
                    )}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{item.sectionLabel}</span>
                        <ChevronRight
                          size={12}
                          className={cn(
                            'flex-shrink-0 text-slate-600 transition-transform duration-200',
                            isOpen && 'rotate-90 text-blue-400'
                          )}
                        />
                      </>
                    )}
                  </button>

                  {/* Children — accordion: only renders when open */}
                  {isOpen && !collapsed && (
                    <div className="mt-0.5 ml-2.5 pl-3 border-l border-slate-700/50 pb-1 space-y-px">
                      {item.children.map(child => (
                        <NavLink
                          key={child.href}
                          to={child.href}
                          end={child.href === '/'}
                          className={({ isActive }) => cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                            isActive
                              ? 'bg-blue-500/10 text-blue-300 border-l-2 border-blue-500 -ml-px pl-[7px]'
                              : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                          )}
                        >
                          <span className="flex-shrink-0 opacity-75">{child.icon}</span>
                          <span className="flex-1 truncate">{child.label}</span>
                          {/* Warning badge on Events */}
                          {child.href === '/events' && (warnCount ?? 0) > 0 && (
                            <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">
                              {(warnCount ?? 0) > 99 ? '99+' : warnCount}
                            </span>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── Bottom rail: settings + user + logout ─────────────────────────── */}
      <div className="flex-shrink-0 border-t border-slate-800 p-1.5 space-y-px">

        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) => cn(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors',
            isActive
              ? 'bg-blue-500/10 text-blue-300 border-l-2 border-blue-500 pl-[9px]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          )}
        >
          <Settings2 size={15} className="flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        {/* User row */}
        {!collapsed ? (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg group hover:bg-slate-800/60 transition-colors cursor-default">
            <div className={cn(
              'w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0',
              avatarColor
            )}>
              {initials || <User size={11} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-300 truncate leading-tight">{displayName}</p>
              <p className={cn('text-[10px] capitalize font-medium leading-tight', roleLabel)}>{role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            title="Sign out"
            className="w-full flex items-center justify-center py-2 text-slate-600 hover:text-red-400 hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </aside>
  )
}
