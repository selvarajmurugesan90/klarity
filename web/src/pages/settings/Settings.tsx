import { useState, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { useClusterStore } from '@/store/cluster'
import { useSettingsStore } from '@/store/settings'
import { clusterApi, identityApi } from '@/lib/api'

const UserManagementPage = lazy(() => import('./UserManagement'))
import {
  Settings2, User, Shield, Palette, Server, GitBranch, Bell,
  Lock, Info, Save, RotateCcw, Plus, Trash2, Check, AlertTriangle,
  Eye, EyeOff, Copy, RefreshCw,
  ChevronRight, ExternalLink,
} from 'lucide-react'
import { cn, copyToClipboard } from '@/lib/utils'

// ── Reusable form components ──────────────────────────────────────────────────

function Section({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors',
        checked ? 'bg-blue-500' : 'bg-gray-200'
      )}
    >
      <span className={cn(
        'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
        checked ? 'translate-x-5' : 'translate-x-0'
      )} />
    </button>
  )
}

function Select({ value, onChange, options, className }: {
  value: string; onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn('border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500', className)}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function NumberInput({ value, onChange, min, max, step, suffix }: {
  value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number; suffix?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
        className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
    </div>
  )
}

// ── Tab definitions ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',      label: 'General',         icon: <Settings2 size={16} /> },
  { id: 'users',        label: 'User Management',  icon: <User size={16} /> },
  { id: 'auth',         label: 'Authentication',   icon: <Shield size={16} /> },
  { id: 'clusters',     label: 'Clusters',         icon: <Server size={16} /> },
  { id: 'appearance',   label: 'Appearance',       icon: <Palette size={16} /> },
  { id: 'security',     label: 'Security',         icon: <Lock size={16} /> },
  { id: 'helm',         label: 'Helm Repositories',icon: <GitBranch size={16} /> },
  { id: 'notifications',label: 'Notifications',    icon: <Bell size={16} /> },
  { id: 'about',        label: 'About',            icon: <Info size={16} /> },
] as const

type TabId = typeof TABS[number]['id']

// ── Individual tab content ─────────────────────────────────────────────────────

function GeneralTab() {
  const s = useSettingsStore()
  const { currentNamespace, setNamespace, namespaces } = useClusterStore()
  const [saved, setSaved] = useState(false)

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <Section title="Default Context" description="Controls default namespace and behaviour on load">
        <Field label="Default Namespace" hint="Namespace pre-selected when opening the dashboard">
          <Select
            value={currentNamespace || 'default'}
            onChange={setNamespace}
            className="w-48"
            options={[
              { value: '', label: 'All Namespaces' },
              ...namespaces.map(n => ({ value: n, label: n })),
            ]}
          />
        </Field>
      </Section>

      <Section title="Data & Refresh" description="Control how often data is fetched from the cluster">
        <Field label="Auto-refresh Interval" hint="How often list pages reload (0 = disabled)">
          <NumberInput value={s.refreshInterval} onChange={v => s.setGeneral({ refreshInterval: v })} min={0} max={300} step={5} suffix="seconds" />
        </Field>
        <Field label="Default Page Size" hint="Number of items per page on list views">
          <Select value={String(s.defaultPageSize)} onChange={v => s.setGeneral({ defaultPageSize: parseInt(v) })} options={[
            { value: '25', label: '25' }, { value: '50', label: '50' },
            { value: '100', label: '100' }, { value: '200', label: '200' },
          ]} />
        </Field>
        <Field label="Max Log Lines" hint="Maximum number of log lines buffered per pod">
          <NumberInput value={s.maxLogLines} onChange={v => s.setGeneral({ maxLogLines: v })} min={1000} max={100000} step={1000} suffix="lines" />
        </Field>
      </Section>

      <Section title="Display" description="Time and locale preferences">
        <Field label="Date Format">
          <Select value={s.dateFormat} onChange={v => s.setGeneral({ dateFormat: v })} options={[
            { value: 'relative', label: 'Relative (5m ago)' },
            { value: 'absolute', label: 'Absolute (2026-01-15 14:30)' },
          ]} />
        </Field>
        <Field label="Timezone">
          <input
            value={s.timezone}
            onChange={e => s.setGeneral({ timezone: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. America/New_York"
          />
        </Field>
      </Section>

      <div className="flex justify-end">
        <button
          onClick={save}
          className="flex items-center gap-2 px-5 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          {saved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
        </button>
      </div>
    </div>
  )
}

function AuthTab() {
  const { authMode, setAuthMode } = useAuthStore()
  const s = useSettingsStore()
  const [oidcSettings, setOidc] = useState({
    issuerURL: '', clientID: '', redirectURL: '', scopes: 'openid,profile,email',
  })

  return (
    <div className="space-y-6">
      <Section title="Authentication Mode" description="Controls how users authenticate to the dashboard">
        <Field label="Auth Mode" hint="Changes take effect after server restart">
          <div className="space-y-3">
            {[
              { value: 'none', label: 'None', desc: 'No authentication — anyone with access can use the dashboard. Development only.', color: 'text-red-500', badge: 'Insecure' },
              { value: 'token', label: 'Token', desc: 'Users authenticate with a Kubernetes ServiceAccount token. Recommended.', color: 'text-green-600', badge: 'Recommended' },
              { value: 'oidc', label: 'OIDC', desc: 'Enterprise SSO via OpenID Connect (Google, GitHub, Okta, etc.)', color: 'text-blue-500', badge: 'Enterprise' },
            ].map(opt => (
              <label key={opt.value} className={cn(
                'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors',
                authMode === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              )}>
                <input type="radio" value={opt.value} checked={authMode === opt.value}
                  onChange={() => setAuthMode(opt.value as 'none' | 'token' | 'oidc')}
                  className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{opt.label}</span>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded border', {
                      'bg-red-50 text-red-600 border-red-200': opt.value === 'none',
                      'bg-green-50 text-green-600 border-green-200': opt.value === 'token',
                      'bg-blue-50 text-blue-600 border-blue-200': opt.value === 'oidc',
                    })}>
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </Field>
      </Section>

      {authMode === 'oidc' && (
        <Section title="OIDC Configuration" description="Configure your OpenID Connect provider">
          {[
            { key: 'issuerURL', label: 'Issuer URL', hint: 'e.g. https://accounts.google.com', placeholder: 'https://your-oidc-provider.com' },
            { key: 'clientID', label: 'Client ID', hint: 'OAuth2 client ID', placeholder: 'klarity' },
            { key: 'redirectURL', label: 'Redirect URL', hint: 'Must match your OIDC app settings', placeholder: 'https://dashboard.example.com/callback' },
            { key: 'scopes', label: 'Scopes', hint: 'Comma-separated OIDC scopes', placeholder: 'openid,profile,email' },
          ].map(f => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <input
                value={oidcSettings[f.key as keyof typeof oidcSettings]}
                onChange={e => setOidc(o => ({ ...o, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>
          ))}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex gap-2">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            OIDC settings are applied server-side. Update the Helm values or environment variables and restart the pod for changes to take effect.
          </div>
        </Section>
      )}

      <Section title="Session" description="Control session lifetime">
        <Field label="Session Timeout" hint="How long before idle sessions expire">
          <Select
            value={String(s.sessionTimeoutMinutes)}
            onChange={v => s.setGeneral({ sessionTimeoutMinutes: parseInt(v) })}
            options={[
              { value: '60', label: '1 hour' }, { value: '240', label: '4 hours' },
              { value: '480', label: '8 hours' }, { value: '1440', label: '24 hours' },
              { value: '10080', label: '7 days' },
            ]}
          />
        </Field>
      </Section>
    </div>
  )
}

function ClustersTab() {
  const { clusters, setCluster } = useClusterStore()
  const { data: versionData } = useQuery({
    queryKey: ['version'],
    queryFn: () => clusterApi.version(),
  })

  return (
    <div className="space-y-6">
      <Section title="Connected Clusters" description="Kubernetes clusters available to this dashboard instance">
        {clusters.length === 0 ? (
          <div className="text-gray-400 text-sm text-center py-6">
            No additional clusters configured. The dashboard uses in-cluster config.
          </div>
        ) : (
          <div className="space-y-3">
            {clusters.map(c => (
              <div key={c.name} className={cn(
                'flex items-center justify-between p-4 rounded-xl border transition-colors',
                c.current ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    c.current ? 'bg-green-500' : 'bg-gray-300'
                  )} />
                  <div>
                    <p className="font-medium text-sm text-gray-900">{c.name}</p>
                    {c.current && (
                      <p className="text-xs text-blue-600">
                        Active · {versionData?.data?.version ?? '—'}
                      </p>
                    )}
                  </div>
                </div>
                {!c.current && (
                  <button
                    onClick={async () => {
                      await clusterApi.switch(c.name)
                      setCluster(c.name)
                    }}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Switch
                  </button>
                )}
                {c.current && (
                  <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                    <Check size={12} /> Current
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Add Cluster" description="Mount additional kubeconfig files as Kubernetes Secrets">
        <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm text-green-400 space-y-1">
          <p className="text-slate-400 text-xs"># Create a multi-cluster secret</p>
          <p>kubectl create secret generic multi-cluster-configs \</p>
          <p className="pl-4">--from-file=production=~/.kube/prod.yaml \</p>
          <p className="pl-4">--from-file=staging=~/.kube/staging.yaml \</p>
          <p className="pl-4">-n klarity</p>
          <p className="mt-2 text-slate-400 text-xs"># Then update Helm values:</p>
          <p>helm upgrade klarity ... \</p>
          <p className="pl-4">--set existingMultiClusterSecret=multi-cluster-configs</p>
        </div>
      </Section>
    </div>
  )
}

function AppearanceTab() {
  const s = useSettingsStore()
  return (
    <div className="space-y-6">
      <Section title="Theme" description="Visual theme for the dashboard">
        <Field label="Color Theme">
          <div className="flex gap-3">
            {[
              { value: 'light', label: '☀️ Light', bg: 'bg-white border-gray-300' },
              { value: 'dark',  label: '🌙 Dark', bg: 'bg-gray-900 border-gray-600 text-white' },
              { value: 'system',label: '💻 System', bg: 'bg-gradient-to-r from-white to-gray-800' },
            ].map(t => (
              <button
                key={t.value}
                onClick={() => s.setGeneral({ theme: t.value as 'light' | 'dark' | 'system' })}
                className={cn(
                  'px-4 py-2 rounded-xl border-2 text-sm transition-colors',
                  t.bg,
                  s.theme === t.value ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Dark mode coming soon — applying light theme for now</p>
        </Field>
      </Section>

      <Section title="Layout" description="Configure sidebar and table density">
        <Field label="Table Density" hint="Controls row height in resource tables">
          <Select value={s.tableDensity} onChange={v => s.setGeneral({ tableDensity: v as never })} options={[
            { value: 'compact',     label: 'Compact (small rows)' },
            { value: 'comfortable', label: 'Comfortable (medium rows)' },
            { value: 'spacious',    label: 'Spacious (large rows)' },
          ]} />
        </Field>
        <Field label="Sidebar" hint="Default sidebar state on load">
          <Toggle checked={!s.sidebarCollapsed} onChange={v => s.setGeneral({ sidebarCollapsed: !v })} />
          <span className="text-xs text-gray-500 ml-2">{s.sidebarCollapsed ? 'Collapsed' : 'Expanded'}</span>
        </Field>
      </Section>

      <Section title="Language" description="Interface language">
        <Field label="Language">
          <Select value={s.language} onChange={v => s.setGeneral({ language: v })} options={[
            { value: 'en', label: '🇺🇸 English' },
            { value: 'zh', label: '🇨🇳 中文 (Coming soon)' },
            { value: 'es', label: '🇪🇸 Español (Coming soon)' },
            { value: 'de', label: '🇩🇪 Deutsch (Coming soon)' },
            { value: 'ja', label: '🇯🇵 日本語 (Coming soon)' },
          ]} />
        </Field>
      </Section>
    </div>
  )
}

function SecurityTab() {
  const s = useSettingsStore()
  const { namespaces } = useClusterStore()
  const [nsInput, setNsInput] = useState('')

  function addNs() {
    if (!nsInput.trim()) return
    const updated = [...new Set([...s.allowedNamespaces, nsInput.trim()])]
    s.setGeneral({ allowedNamespaces: updated })
    setNsInput('')
  }

  return (
    <div className="space-y-6">
      <Section title="Access Control" description="Restrict what users can see and do in the dashboard">
        <Field label="Confirm Destructive Actions"
          hint="Show confirmation dialog before delete, rollback, and drain operations">
          <Toggle checked={s.confirmDestructiveActions}
            onChange={v => s.setGeneral({ confirmDestructiveActions: v })} />
        </Field>
        <Field label="Mask Secret Values"
          hint="Always mask secret data values — users must explicitly reveal them">
          <Toggle checked={s.maskSecretValues}
            onChange={v => s.setGeneral({ maskSecretValues: v })} />
        </Field>
        <Field label="Require Namespace Context"
          hint="Require a namespace to be selected before showing resources (prevents all-namespace queries)">
          <Toggle checked={s.requireNamespaceContext}
            onChange={v => s.setGeneral({ requireNamespaceContext: v })} />
        </Field>
      </Section>

      <Section title="Namespace Allowlist"
        description="Restrict the dashboard to specific namespaces. Leave empty to allow all namespaces.">
        <div className="flex items-center gap-2 mb-3">
          <select
            value={nsInput}
            onChange={e => setNsInput(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a namespace...</option>
            {namespaces.filter(n => !s.allowedNamespaces.includes(n)).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button
            onClick={addNs}
            disabled={!nsInput}
            className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-40"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {s.allowedNamespaces.length === 0 ? (
          <div className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">
            All namespaces allowed
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {s.allowedNamespaces.map(ns => (
              <span key={ns} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-sm">
                {ns}
                <button onClick={() => s.setGeneral({ allowedNamespaces: s.allowedNamespaces.filter(n => n !== ns) })}
                  className="hover:text-red-500">
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Audit Log Retention"
        description="The audit log is stored in memory and reset on pod restart">
        <Field label="Max Audit Events" hint="Ring buffer size — oldest events are discarded">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertTriangle size={12} className="text-orange-500" />
            </span>
            2,000 events (in-memory, not persisted)
          </div>
        </Field>
        <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 border border-gray-100">
          To persist audit logs, consider deploying a log aggregation solution (Loki, Elasticsearch) and shipping pod logs.
          The dashboard emits structured JSON logs for every mutating operation.
        </div>
      </Section>
    </div>
  )
}

function HelmTab() {
  const s = useSettingsStore()
  const [form, setForm] = useState({ name: '', url: '', username: '', password: '', insecure: false })
  const [adding, setAdding] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function save() {
    if (!form.name || !form.url) return
    s.addHelmRepo({ name: form.name, url: form.url, username: form.username, password: form.password, insecure: form.insecure })
    setForm({ name: '', url: '', username: '', password: '', insecure: false })
    setAdding(false)
  }

  return (
    <div className="space-y-6">
      <Section title="Helm Repositories"
        description="Manage Helm chart repositories for browsing and installing charts">
        <div className="space-y-3">
          {s.helmRepos.map(repo => (
            <div key={repo.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <GitBranch size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">{repo.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{repo.url}</p>
                  {repo.username && <p className="text-xs text-gray-400">Auth: {repo.username} / ***</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {repo.insecure && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded">Insecure</span>
                )}
                <button
                  onClick={() => s.removeHelmRepo(repo.name)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {s.helmRepos.length === 0 && !adding && (
            <div className="text-sm text-gray-400 text-center py-6 border border-dashed rounded-xl">
              No Helm repositories configured
            </div>
          )}

          {adding && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
              <h4 className="font-medium text-sm text-gray-900">Add Repository</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    placeholder="my-repo" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">URL *</label>
                  <input value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))}
                    placeholder="https://charts.example.com" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Username</label>
                  <input value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))}
                    placeholder="optional" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={form.password}
                      onChange={e => setForm(f => ({...f, password: e.target.value}))}
                      placeholder="optional"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={() => setShowPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.insecure} onChange={e => setForm(f => ({...f, insecure: e.target.checked}))} className="rounded" />
                Skip TLS verification (insecure)
              </label>
              <div className="flex gap-2">
                <button onClick={save} disabled={!form.name || !form.url}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-40 flex items-center gap-1">
                  <Save size={13} /> Add Repository
                </button>
                <button onClick={() => setAdding(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {!adding && (
          <button onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors mt-3">
            <Plus size={16} /> Add Helm Repository
          </button>
        )}
      </Section>
    </div>
  )
}

function NotificationsTab() {
  const s = useSettingsStore()
  const [form, setForm] = useState({
    name: '', url: '', events: ['warning'], enabled: true,
  })
  const [adding, setAdding] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  async function testWebhook(url: string) {
    setTestResult('Testing...')
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, source: 'Klarity' }),
      })
      setTestResult('✅ Webhook responded successfully')
    } catch {
      setTestResult('❌ Could not reach webhook URL')
    }
    setTimeout(() => setTestResult(null), 5000)
  }

  function addWebhook() {
    if (!form.name || !form.url) return
    s.addWebhook({ id: Date.now().toString(), ...form })
    setForm({ name: '', url: '', events: ['warning'], enabled: true })
    setAdding(false)
  }

  return (
    <div className="space-y-6">
      <Section title="Event Notifications"
        description="Get alerted when cluster warning events exceed a threshold">
        <Field label="Enable Warning Event Notifications">
          <Toggle checked={s.notifyOnWarningEvents}
            onChange={v => s.setGeneral({ notifyOnWarningEvents: v })} />
        </Field>
        {s.notifyOnWarningEvents && (
          <Field label="Warning Threshold"
            hint="Notify when warnings per minute exceed this number">
            <NumberInput value={s.warningEventThreshold}
              onChange={v => s.setGeneral({ warningEventThreshold: v })}
              min={1} max={1000} suffix="events/min" />
          </Field>
        )}
      </Section>

      <Section title="Outgoing Webhooks"
        description="Send notifications to Slack, Teams, Discord, or any HTTP endpoint">
        <div className="space-y-3">
          {s.webhooks.map(wh => (
            <div key={wh.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0',
                  wh.enabled ? 'bg-green-500' : 'bg-gray-300'
                )} />
                <div>
                  <p className="font-medium text-sm text-gray-900">{wh.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{wh.url.slice(0, 50)}{wh.url.length > 50 ? '…' : ''}</p>
                  <div className="flex gap-1 mt-1">
                    {wh.events.map(e => (
                      <span key={e} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded">{e}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => testWebhook(wh.url)}
                  className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                  <RefreshCw size={14} />
                </button>
                <Toggle checked={wh.enabled} onChange={() => s.toggleWebhook(wh.id)} />
                <button onClick={() => s.removeWebhook(wh.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {s.webhooks.length === 0 && !adding && (
            <div className="text-sm text-gray-400 text-center py-6 border border-dashed rounded-xl">
              No webhooks configured
            </div>
          )}

          {adding && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
              <h4 className="font-medium text-sm">Add Webhook</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    placeholder="Slack #alerts" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">URL *</label>
                  <input value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))}
                    placeholder="https://hooks.slack.com/..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Event Types</label>
                <div className="flex gap-3">
                  {['all', 'warning', 'error'].map(ev => (
                    <label key={ev} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox"
                        checked={form.events.includes(ev)}
                        onChange={e => setForm(f => ({
                          ...f,
                          events: e.target.checked ? [...f.events, ev] : f.events.filter(x => x !== ev)
                        }))}
                        className="rounded" />
                      {ev}
                    </label>
                  ))}
                </div>
              </div>
              {testResult && (
                <p className="text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2">{testResult}</p>
              )}
              <div className="flex gap-2">
                <button onClick={addWebhook} disabled={!form.name || !form.url}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-40">
                  Add Webhook
                </button>
                {form.url && (
                  <button onClick={() => testWebhook(form.url)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                    Test
                  </button>
                )}
                <button onClick={() => setAdding(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors mt-3">
            <Plus size={16} /> Add Webhook
          </button>
        )}
      </Section>
    </div>
  )
}

function AboutTab() {
  const { data: versionData } = useQuery({
    queryKey: ['version'],
    queryFn: () => clusterApi.version(),
  })
  const { data: overviewData } = useQuery({
    queryKey: ['overview'],
    queryFn: () => clusterApi.overview(),
  })

  const version = versionData?.data?.version
  const ov = overviewData?.data as Record<string, unknown> | undefined

  const info = [
    { label: 'Dashboard Version', value: '1.0.0' },
    { label: 'Kubernetes Version', value: version ?? '—' },
    { label: 'API Resources', value: String(ov?.apiResources ?? '—') },
    { label: 'Total Nodes', value: String((ov?.nodes as Record<string, number>)?.total ?? '—') },
    { label: 'Total Namespaces', value: String(ov?.namespaces ?? '—') },
    { label: 'Go Version', value: '1.22' },
    { label: 'React Version', value: '18' },
  ]

  return (
    <div className="space-y-6">
      <Section title="System Information">
        <dl className="space-y-3">
          {info.map(item => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <dt className="text-sm text-gray-500">{item.label}</dt>
              <dd className="text-sm font-medium text-gray-900 font-mono">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="License & Source">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <Info size={20} className="text-blue-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-gray-900">Apache License 2.0</p>
              <p className="text-xs text-gray-500 mt-0.5">Open source — free to use, modify, and distribute</p>
            </div>
          </div>
          <div className="flex gap-3">
            <a href="https://github.com/selvarajmurugesan90/klarity" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors">
              <GitBranch size={16} /> View on GitHub
            </a>
            <a href="https://github.com/selvarajmurugesan90/klarity/issues" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <AlertTriangle size={16} /> Report Issue
            </a>
          </div>
        </div>
      </Section>

      <Section title="Keyboard Shortcuts">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ['Ctrl+K', 'Global Search'],
            ['g + p', 'Go to Pods'],
            ['g + d', 'Go to Deployments'],
            ['g + a', 'Go to Audit Log'],
            ['g + I', 'Go to Identity'],
            ['?', 'Show all shortcuts'],
            ['Esc', 'Close modal/overlay'],
          ].map(([keys, desc]) => (
            <div key={keys} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">{desc}</span>
              <kbd className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5 font-mono">{keys}</kbd>
            </div>
          ))}
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('kd:toggle-shortcuts'))}
          className="mt-2 text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1"
        >
          View all shortcuts <ChevronRight size={14} />
        </button>
      </Section>

      <div className="flex justify-end">
        <button
          onClick={() => {
            if (confirm('Reset all settings to defaults? This cannot be undone.')) {
              useSettingsStore.getState().resetToDefaults()
            }
          }}
          className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm hover:bg-red-50 transition-colors"
        >
          <RotateCcw size={14} /> Reset All Settings to Defaults
        </button>
      </div>
    </div>
  )
}

// ── Main Settings Page ────────────────────────────────────────────────────────

const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  general: GeneralTab,
  users: UserManagementPage,
  auth: AuthTab,
  clusters: ClustersTab,
  appearance: AppearanceTab,
  security: SecurityTab,
  helm: HelmTab,
  notifications: NotificationsTab,
  about: AboutTab,
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const ActiveComponent = TAB_COMPONENTS[activeTab]

  return (
    <div className="flex gap-8 max-w-6xl">
      {/* Sidebar nav */}
      <aside className="w-56 flex-shrink-0">
        <div className="sticky top-0">
          <h1 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Settings2 size={20} className="text-blue-500" />
            Settings
          </h1>
          <nav className="space-y-0.5">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <span className={activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Suspense fallback={<div className="text-gray-400 text-sm p-8 text-center">Loading...</div>}>
          <ActiveComponent />
        </Suspense>
      </div>
    </div>
  )
}
