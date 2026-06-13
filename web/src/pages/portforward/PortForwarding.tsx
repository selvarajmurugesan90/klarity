import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useActivityStore } from '@/store/activities'
import { useClusterStore } from '@/store/cluster'
import {
  Network, Plus, X, ExternalLink, CheckCircle, AlertCircle,
  Loader2, Link2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAge } from '@/lib/utils'

interface PFSession {
  id: string
  namespace: string
  podName: string
  remotePort: number
  localPort: number
  proxyPath: string
  status: string
  error?: string
  createdAt: string
}

export default function PortForwarding() {
  const qc = useQueryClient()
  const { namespaces } = useClusterStore()
  const { addPortForward } = useActivityStore()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ namespace: 'default', podName: '', port: '' })
  const [createError, setCreateError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['portforwards'],
    queryFn: () => api.get('/portforward').then(r => r.data?.data ?? []),
    refetchInterval: 10_000,
  })

  const sessions = (data ?? []) as PFSession[]

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/portforward', {
        namespace:  form.namespace,
        podName:    form.podName.trim(),
        remotePort: parseInt(form.port),
      }).then(r => r.data?.data),
    onSuccess: (session: PFSession) => {
      qc.invalidateQueries({ queryKey: ['portforwards'] })
      addPortForward({
        namespace:  session.namespace,
        pod:        session.podName,
        remotePort: session.remotePort,
        pfId:       session.id,
        localPort:  session.localPort,
        proxyPath:  session.proxyPath,
      })
      setShowCreate(false)
      setForm({ namespace: 'default', podName: '', port: '' })
      setCreateError('')
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setCreateError(msg ?? 'Failed to create port-forward')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/portforward/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portforwards'] }),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Network size={18} className="text-purple-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Port Forwarding</h1>
            <p className="text-sm text-gray-500">
              Tunnel pod ports through the dashboard — no kubectl needed
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateError('') }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-colors"
        >
          <Plus size={15} /> New Port-Forward
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Start Port-Forward</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Namespace</label>
              <select
                value={form.namespace}
                onChange={e => setForm(f => ({ ...f, namespace: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Pod Name</label>
              <input
                value={form.podName}
                onChange={e => setForm(f => ({ ...f, podName: e.target.value }))}
                placeholder="my-pod-xyz"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Remote Port</label>
              <input
                type="number"
                value={form.port}
                onChange={e => setForm(f => ({ ...f, port: e.target.value }))}
                placeholder="8080"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {createError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 mb-4">
              <AlertCircle size={14} />
              {createError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.podName || !form.port}
              className="px-5 py-2.5 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {createMutation.isPending
                ? <><Loader2 size={14} className="animate-spin" /> Starting…</>
                : <><Link2 size={14} /> Start Tunnel</>
              }
            </button>
            <button
              onClick={() => { setShowCreate(false); setCreateError('') }}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
            <strong>How it works:</strong> The dashboard creates a SPDY tunnel to the Kubernetes API,
            which forwards traffic to the pod. You access the service at the proxy URL above — no kubectl,
            no local tools needed.
          </div>
        </div>
      )}

      {/* Active sessions */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading…
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 border-dashed p-12 text-center">
          <Network size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No active port-forwards</p>
          <p className="text-sm text-gray-400 mt-1">
            Start a tunnel to access pod services directly in your browser
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-5">
              {/* Status icon */}
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                s.status === 'active' ? 'bg-green-100' : 'bg-red-100'
              )}>
                {s.status === 'active'
                  ? <CheckCircle size={18} className="text-green-600" />
                  : <AlertCircle size={18} className="text-red-500" />
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-gray-900">{s.podName}</p>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full border font-medium',
                    s.status === 'active'
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-red-100 text-red-700 border-red-200'
                  )}>
                    {s.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {s.namespace} · port {s.remotePort} → local {s.localPort}
                </p>
                {s.status === 'active' && (
                  <p className="text-xs text-purple-600 font-mono mt-1">
                    {window.location.origin}{s.proxyPath}
                  </p>
                )}
                {s.error && (
                  <p className="text-xs text-red-500 mt-0.5">{s.error}</p>
                )}
              </div>

              {/* Age */}
              <div className="text-xs text-gray-400 flex-shrink-0">
                {formatAge(s.createdAt)} ago
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {s.status === 'active' && (
                  <a
                    href={`${window.location.origin}${s.proxyPath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs hover:bg-purple-100 transition-colors"
                  >
                    <ExternalLink size={12} /> Open
                  </a>
                )}
                <button
                  onClick={() => deleteMutation.mutate(s.id)}
                  disabled={deleteMutation.isPending}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Stop tunnel"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info panel */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Network size={15} className="text-gray-500" /> About Port Forwarding
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <p className="font-medium text-gray-800 mb-1">How it works</p>
            <p>The dashboard creates a SPDY tunnel to the Kubernetes API Server, which forwards traffic to the pod container port.</p>
          </div>
          <div>
            <p className="font-medium text-gray-800 mb-1">HTTP Proxy</p>
            <p>HTTP services are accessible via the dashboard's proxy URL. Perfect for web UIs, REST APIs, and gRPC services.</p>
          </div>
          <div>
            <p className="font-medium text-gray-800 mb-1">Read-only</p>
            <p>Port forwarding is a diagnostic/observation tool. It does not modify any cluster resources or configuration.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
