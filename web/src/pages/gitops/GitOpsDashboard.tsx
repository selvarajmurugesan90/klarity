import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { GitBranch, RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAge } from '@/lib/utils'

interface GitOpsStatus {
  argocd: { detected: boolean; version?: string }
  flux:   { detected: boolean; version?: string }
}

function SyncBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? ''
  if (s === 'synced' || s === 'ready' || s === 'true')
    return <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle size={10} /> {status}</span>
  if (s === 'outofsync' || s === 'not ready' || s === 'false')
    return <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><XCircle size={10} /> {status}</span>
  if (s === 'progressing' || s === 'reconciling')
    return <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full"><RefreshCw size={10} className="animate-spin" /> {status}</span>
  if (s === 'degraded' || s === 'failed')
    return <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><AlertTriangle size={10} /> {status}</span>
  return <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full"><Clock size={10} /> {status || 'Unknown'}</span>
}

function HealthBadge({ health }: { health: string }) {
  const h = health?.toLowerCase() ?? ''
  if (h === 'healthy')     return <span className="text-xs text-green-600">● Healthy</span>
  if (h === 'degraded')    return <span className="text-xs text-red-600">● Degraded</span>
  if (h === 'progressing') return <span className="text-xs text-blue-600">◌ Progressing</span>
  if (h === 'suspended')   return <span className="text-xs text-gray-500">◎ Suspended</span>
  return <span className="text-xs text-gray-400">● {health || 'Unknown'}</span>
}

// ── ArgoCD section ─────────────────────────────────────────────────────────────
function ArgoCDSection() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['argocd-apps'],
    queryFn: () => api.get('/gitops/argocd/apps?pageSize=50').then(r => r.data?.data ?? []),
    refetchInterval: 30_000,
  })
  const apps = (data ?? []) as Array<Record<string, unknown>>

  const synced    = apps.filter(a => (a.status as Record<string, unknown>)?.sync?.['status'] === 'Synced').length
  const outOfSync = apps.filter(a => (a.status as Record<string, unknown>)?.sync?.['status'] === 'OutOfSync').length
  const healthy   = apps.filter(a => (a.status as Record<string, unknown>)?.health?.['status'] === 'Healthy').length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <GitBranch size={16} className="text-orange-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">ArgoCD</h2>
            <p className="text-xs text-gray-500">{apps.length} applications detected</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/gitops/argocd')}
          className="text-xs text-orange-600 hover:text-orange-800 flex items-center gap-1"
        >
          View all <ChevronRight size={12} />
        </button>
      </div>

      {/* Summary strip */}
      <div className="flex divide-x divide-gray-100 border-b border-gray-100">
        {[
          { label: 'Synced',      value: synced,    color: 'text-green-600' },
          { label: 'Out of Sync', value: outOfSync, color: 'text-red-600'   },
          { label: 'Healthy',     value: healthy,   color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="flex-1 px-4 py-3 text-center">
            <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* App list */}
      <div className="divide-y divide-gray-50">
        {isLoading && <div className="py-8 text-center text-gray-400 text-sm">Loading ArgoCD apps…</div>}
        {!isLoading && apps.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">No applications found</div>}
        {apps.slice(0, 8).map((app, i) => {
          const meta   = app.metadata as Record<string, unknown>
          const status = app.status  as Record<string, unknown>
          const spec   = app.spec    as Record<string, unknown>
          const sync   = status?.sync   as Record<string, string>  ?? {}
          const health = status?.health as Record<string, string>  ?? {}
          const src    = spec?.source   as Record<string, string>  ?? {}
          return (
            <div key={i} className="flex items-center px-5 py-3 hover:bg-gray-50 gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{meta?.name as string}</p>
                <p className="text-xs text-gray-400 truncate">{src?.repoURL as string} · {src?.path as string || src?.chart as string}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <HealthBadge health={health?.status ?? ''} />
                <SyncBadge  status={sync?.status ?? ''} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Flux CD section ────────────────────────────────────────────────────────────
function FluxSection() {
  const navigate = useNavigate()

  const { data: kData } = useQuery({
    queryKey: ['flux-kustomizations'],
    queryFn: () => api.get('/gitops/flux/kustomizations?pageSize=50').then(r => r.data?.data ?? []),
    refetchInterval: 30_000,
  })
  const { data: hData } = useQuery({
    queryKey: ['flux-helmreleases'],
    queryFn: () => api.get('/gitops/flux/helmreleases?pageSize=50').then(r => r.data?.data ?? []),
    refetchInterval: 30_000,
  })
  const { data: gData } = useQuery({
    queryKey: ['flux-gitrepos'],
    queryFn: () => api.get('/gitops/flux/gitrepositories?pageSize=50').then(r => r.data?.data ?? []),
    refetchInterval: 30_000,
  })

  const kustomizations = (kData ?? []) as Array<Record<string, unknown>>
  const helmReleases   = (hData ?? []) as Array<Record<string, unknown>>
  const gitRepos       = (gData ?? []) as Array<Record<string, unknown>>

  function getConditionReady(obj: Record<string, unknown>) {
    const conditions = ((obj.status as Record<string, unknown>)?.conditions as Array<{ type: string; status: string; message?: string }>) ?? []
    return conditions.find(c => c.type === 'Ready')
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <GitBranch size={16} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Flux CD</h2>
            <p className="text-xs text-gray-500">
              {kustomizations.length} kustomizations · {helmReleases.length} helm releases · {gitRepos.length} git repos
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/gitops/flux')}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          View all <ChevronRight size={12} />
        </button>
      </div>

      {/* Kustomizations */}
      {kustomizations.length > 0 && (
        <div>
          <div className="px-5 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Kustomizations
          </div>
          <div className="divide-y divide-gray-50">
            {kustomizations.slice(0, 5).map((k, i) => {
              const meta  = k.metadata as Record<string, unknown>
              const ready = getConditionReady(k)
              const spec  = k.spec as Record<string, unknown>
              return (
                <div key={i} className="flex items-center px-5 py-3 hover:bg-gray-50 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{meta?.name as string}</p>
                    <p className="text-xs text-gray-400">{meta?.namespace as string} · {spec?.path as string}</p>
                  </div>
                  <SyncBadge status={ready?.status === 'True' ? 'Ready' : ready?.status === 'False' ? 'Not Ready' : 'Unknown'} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Helm Releases */}
      {helmReleases.length > 0 && (
        <div>
          <div className="px-5 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Helm Releases
          </div>
          <div className="divide-y divide-gray-50">
            {helmReleases.slice(0, 5).map((h, i) => {
              const meta  = h.metadata as Record<string, unknown>
              const ready = getConditionReady(h)
              const spec  = h.spec as Record<string, unknown>
              const chart = (spec?.chart as Record<string, unknown>)?.spec as Record<string, unknown>
              return (
                <div key={i} className="flex items-center px-5 py-3 hover:bg-gray-50 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{meta?.name as string}</p>
                    <p className="text-xs text-gray-400">{chart?.chart as string} · v{chart?.version as string}</p>
                  </div>
                  <SyncBadge status={ready?.status === 'True' ? 'Ready' : ready?.status === 'False' ? 'Not Ready' : 'Unknown'} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Git repos */}
      {gitRepos.length > 0 && (
        <div>
          <div className="px-5 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Git Repositories
          </div>
          <div className="divide-y divide-gray-50">
            {gitRepos.slice(0, 4).map((g, i) => {
              const meta  = g.metadata as Record<string, unknown>
              const ready = getConditionReady(g)
              const spec  = g.spec as Record<string, unknown>
              return (
                <div key={i} className="flex items-center px-5 py-3 hover:bg-gray-50 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{meta?.name as string}</p>
                    <p className="text-xs text-gray-400 truncate">{spec?.url as string} @ {spec?.ref?.['branch'] as string}</p>
                  </div>
                  <SyncBadge status={ready?.status === 'True' ? 'Ready' : 'Not Ready'} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main GitOps Dashboard ──────────────────────────────────────────────────────
export default function GitOpsDashboard() {
  const { data: statusData, isLoading } = useQuery({
    queryKey: ['gitops-status'],
    queryFn:  () => api.get('/gitops/status').then(r => r.data?.data),
    refetchInterval: 60_000,
  })

  const status = statusData as GitOpsStatus | undefined
  const noneDetected = !isLoading && status && !status.argocd.detected && !status.flux.detected

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <GitBranch size={18} className="text-blue-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">GitOps</h1>
          <p className="text-sm text-gray-500">
            Continuously synced from your Git repositories
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40 text-gray-400">
          Detecting GitOps tools…
        </div>
      )}

      {noneDetected && (
        <div className="bg-white rounded-2xl border border-gray-200 border-dashed p-12 text-center">
          <GitBranch size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">No GitOps tools detected</p>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            Install <strong>ArgoCD</strong> or <strong>Flux CD</strong> in this cluster and they will
            appear here automatically — no configuration required.
          </p>
          <div className="flex justify-center gap-4 mt-5">
            <a href="https://argo-cd.readthedocs.io/en/stable/getting_started/" target="_blank" rel="noopener noreferrer"
              className="text-sm text-orange-600 hover:text-orange-800 underline">Install ArgoCD →</a>
            <a href="https://fluxcd.io/flux/installation/" target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 underline">Install Flux CD →</a>
          </div>
        </div>
      )}

      {status?.argocd.detected && <ArgoCDSection />}
      {status?.flux.detected   && <FluxSection />}
    </div>
  )
}
