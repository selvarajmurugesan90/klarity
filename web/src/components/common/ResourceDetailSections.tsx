/**
 * ResourceDetailSections — reusable section components for resource detail pages.
 * Every resource detail page uses these building blocks to show a consistent,
 * comprehensive view of all available fields.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, XCircle, MinusCircle, Copy, Eye, EyeOff } from 'lucide-react'
import { cn, copyToClipboard } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface K8sContainer {
  name: string
  image: string
  command?: string[]
  args?: string[]
  ports?: Array<{ name?: string; containerPort: number; protocol?: string; hostPort?: number }>
  env?: Array<{ name: string; value?: string; valueFrom?: Record<string, unknown> }>
  envFrom?: Array<{ configMapRef?: { name: string }; secretRef?: { name: string }; prefix?: string }>
  resources?: {
    requests?: { cpu?: string; memory?: string; [k: string]: string | undefined }
    limits?:   { cpu?: string; memory?: string; [k: string]: string | undefined }
  }
  securityContext?: {
    runAsUser?: number; runAsGroup?: number; runAsNonRoot?: boolean
    allowPrivilegeEscalation?: boolean; privileged?: boolean
    readOnlyRootFilesystem?: boolean
    capabilities?: { add?: string[]; drop?: string[] }
    seccompProfile?: { type: string; localhostProfile?: string }
    procMount?: string
  }
  volumeMounts?: Array<{
    name: string; mountPath: string; subPath?: string; readOnly?: boolean
  }>
  livenessProbe?: Record<string, unknown>
  readinessProbe?: Record<string, unknown>
  startupProbe?: Record<string, unknown>
  lifecycle?: Record<string, unknown>
  terminationMessagePath?: string
  imagePullPolicy?: string
  stdin?: boolean; tty?: boolean
}

export interface K8sPodSpec {
  containers: K8sContainer[]
  initContainers?: K8sContainer[]
  ephemeralContainers?: K8sContainer[]
  volumes?: Array<{
    name: string
    persistentVolumeClaim?: { claimName: string; readOnly?: boolean }
    configMap?: { name: string }
    secret?: { secretName: string }
    emptyDir?: { medium?: string; sizeLimit?: string }
    hostPath?: { path: string; type?: string }
    projected?: Record<string, unknown>
    [key: string]: unknown
  }>
  nodeSelector?: Record<string, string>
  nodeName?: string
  serviceAccountName?: string
  restartPolicy?: string
  terminationGracePeriodSeconds?: number
  activeDeadlineSeconds?: number
  dnsPolicy?: string
  hostNetwork?: boolean; hostPID?: boolean; hostIPC?: boolean
  priorityClassName?: string; priority?: number
  affinity?: Record<string, unknown>
  tolerations?: Array<{ key?: string; operator?: string; value?: string; effect?: string; tolerationSeconds?: number }>
  topologySpreadConstraints?: Array<Record<string, unknown>>
  securityContext?: {
    runAsUser?: number; runAsGroup?: number; runAsNonRoot?: boolean
    fsGroup?: number; supplementalGroups?: number[]
    sysctls?: Array<{ name: string; value: string }>
    seccompProfile?: { type: string; localhostProfile?: string }
    appArmorProfile?: { type: string }
  }
  imagePullSecrets?: Array<{ name: string }>
  automountServiceAccountToken?: boolean
}

// ── Layout helpers ─────────────────────────────────────────────────────────────

export function InfoSection({
  title, icon, children, defaultOpen = true, badge
}: {
  title: string; icon?: React.ReactNode; children: React.ReactNode
  defaultOpen?: boolean; badge?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-400">{icon}</span>}
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
          {badge}
        </div>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100">{children}</div>}
    </div>
  )
}

export function InfoRow({
  label, value, mono = false, copy = false, className
}: {
  label: string; value: React.ReactNode; mono?: boolean; copy?: boolean; className?: string
}) {
  const strVal = typeof value === 'string' ? value : undefined
  return (
    <div className={cn('flex items-start gap-4 py-2 border-b border-gray-50 last:border-0', className)}>
      <dt className="text-xs text-gray-500 w-44 flex-shrink-0 pt-0.5 font-medium">{label}</dt>
      <dd className={cn('text-xs flex-1 flex items-start gap-1.5', mono ? 'font-mono text-gray-800' : 'text-gray-700')}>
        <span className="flex-1">{value ?? <span className="text-gray-300">—</span>}</span>
        {copy && strVal && (
          <button onClick={() => copyToClipboard(strVal)} className="flex-shrink-0 text-gray-300 hover:text-blue-500 transition-colors">
            <Copy size={11} />
          </button>
        )}
      </dd>
    </div>
  )
}

export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="py-2 pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

// ── Security context badges ────────────────────────────────────────────────────

function SecBadge({ label, value, _good, _warn, inverted = false }: {
  label: string; value: boolean | undefined | null; _good?: boolean; _warn?: boolean; inverted?: boolean
}) {
  const effective = inverted ? !value : value
  const isGood    = value === undefined || value === null ? null : effective
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium',
      isGood === true  ? 'bg-green-50 border-green-200 text-green-700' :
      isGood === false ? 'bg-red-50 border-red-200 text-red-700' :
                         'bg-gray-50 border-gray-200 text-gray-400'
    )}>
      {isGood === true  ? <CheckCircle size={11} /> :
       isGood === false ? <XCircle size={11} /> :
                          <MinusCircle size={11} />}
      {label}
      {value !== undefined && value !== null && (
        <span className={cn('ml-0.5 font-bold', isGood === true ? 'text-green-800' : 'text-red-800')}>
          {String(value)}
        </span>
      )}
    </div>
  )
}

export function SecurityContextSection({ podSpec, container }: {
  podSpec?: K8sPodSpec
  container?: K8sContainer
}) {
  const psc = podSpec?.securityContext ?? {}
  const csc = container?.securityContext ?? {}

  const hasPodSec = Object.keys(psc).length > 0
  const hasCtnSec = Object.keys(csc).length > 0

  if (!hasPodSec && !hasCtnSec) {
    return (
      <div className="pt-4 text-sm text-gray-400 italic">
        No security context configured
      </div>
    )
  }

  return (
    <div className="pt-4 space-y-4">
      {hasCtnSec && (
        <div>
          {container && <p className="text-xs font-semibold text-gray-500 mb-2">Container: {container.name}</p>}
          <div className="flex flex-wrap gap-2 mb-3">
            <SecBadge label="runAsNonRoot"               value={csc.runAsNonRoot} />
            <SecBadge label="readOnlyRootFilesystem"     value={csc.readOnlyRootFilesystem} />
            <SecBadge label="allowPrivilegeEscalation"   value={csc.allowPrivilegeEscalation} inverted />
            <SecBadge label="privileged"                 value={csc.privileged} inverted />
          </div>
          <dl className="space-y-1">
            {csc.runAsUser    !== undefined && <InfoRow label="runAsUser"    value={String(csc.runAsUser)} mono />}
            {csc.runAsGroup   !== undefined && <InfoRow label="runAsGroup"   value={String(csc.runAsGroup)} mono />}
            {csc.procMount    !== undefined && <InfoRow label="procMount"    value={csc.procMount} mono />}
            {csc.seccompProfile && (
              <InfoRow label="seccompProfile" value={`${csc.seccompProfile.type}${csc.seccompProfile.localhostProfile ? ` (${csc.seccompProfile.localhostProfile})` : ''}`} mono />
            )}
          </dl>
          {(csc.capabilities?.add?.length || csc.capabilities?.drop?.length) ? (
            <div className="mt-2">
              {csc.capabilities?.drop?.length ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-xs text-gray-500 w-16">DROP</span>
                  {csc.capabilities.drop.map(c => (
                    <span key={c} className="text-[10px] bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5 font-mono">{c}</span>
                  ))}
                </div>
              ) : null}
              {csc.capabilities?.add?.length ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-xs text-gray-500 w-16">ADD</span>
                  {csc.capabilities.add.map(c => (
                    <span key={c} className="text-[10px] bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5 font-mono">{c}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {hasPodSec && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Pod-level Security Context</p>
          <div className="flex flex-wrap gap-2 mb-2">
            <SecBadge label="runAsNonRoot" value={psc.runAsNonRoot} />
          </div>
          <dl className="space-y-1">
            {psc.runAsUser          !== undefined && <InfoRow label="runAsUser"    value={String(psc.runAsUser)} mono />}
            {psc.runAsGroup         !== undefined && <InfoRow label="runAsGroup"   value={String(psc.runAsGroup)} mono />}
            {psc.fsGroup            !== undefined && <InfoRow label="fsGroup"      value={String(psc.fsGroup)} mono />}
            {psc.seccompProfile && (
              <InfoRow label="seccompProfile" value={psc.seccompProfile.type} mono />
            )}
            {psc.appArmorProfile && (
              <InfoRow label="appArmor" value={psc.appArmorProfile.type} mono />
            )}
            {psc.supplementalGroups?.length ? (
              <InfoRow label="supplementalGroups" value={psc.supplementalGroups.join(', ')} mono />
            ) : null}
            {psc.sysctls?.length ? (
              <InfoRow label="sysctls" value={psc.sysctls.map(s => `${s.name}=${s.value}`).join(', ')} mono />
            ) : null}
          </dl>
        </div>
      )}
    </div>
  )
}

// ── Resource requests / limits ─────────────────────────────────────────────────

function ResourceBar({ label, used, limit, color }: { label: string; used: string; limit?: string; color: string }) {
  const pctNum = limit ? Math.min((parseCpuOrMem(used) / parseCpuOrMem(limit)) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-mono text-gray-700">
          {used}{limit ? <span className="text-gray-400"> / {limit}</span> : ''}
        </span>
      </div>
      {limit && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', color)} style={{ width: `${pctNum}%` }} />
        </div>
      )}
    </div>
  )
}

function parseCpuOrMem(s: string): number {
  if (!s) return 0
  if (s.endsWith('m')) return parseInt(s)
  if (s.endsWith('n')) return parseInt(s) / 1_000_000
  if (s.endsWith('Ki')) return parseInt(s) * 1024
  if (s.endsWith('Mi')) return parseInt(s) * 1024 ** 2
  if (s.endsWith('Gi')) return parseInt(s) * 1024 ** 3
  return parseFloat(s)
}

export function ContainerResourcesSection({ containers }: { containers: K8sContainer[] }) {
  const withRes = containers.filter(c => c.resources?.requests || c.resources?.limits)
  if (!withRes.length) {
    return (
      <div className="pt-4 text-sm text-gray-400 italic">No resource requests or limits configured</div>
    )
  }
  return (
    <div className="pt-4 space-y-5">
      {containers.map(c => {
        const req = c.resources?.requests ?? {}
        const lim = c.resources?.limits ?? {}
        const allKeys = [...new Set([...Object.keys(req), ...Object.keys(lim)])]
        if (!allKeys.length) return null
        return (
          <div key={c.name}>
            <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              {c.name}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 pl-3.5">
              {allKeys.map(key => (
                <div key={key} className="space-y-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">{key}</p>
                  <div className="space-y-1.5">
                    {req[key] && <ResourceBar label="Request" used={req[key]!} limit={lim[key]} color="bg-blue-400" />}
                    {lim[key] && !req[key] && <ResourceBar label="Limit" used={lim[key]!} color="bg-orange-400" />}
                    {!req[key] && !lim[key] && <p className="text-xs text-gray-300">—</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Environment variables ──────────────────────────────────────────────────────

function EnvValue({ name, v }: { name: string; v: { value?: string; valueFrom?: Record<string, unknown> } }) {
  const [show, setShow] = useState(false)
  const isSecret = JSON.stringify(v.valueFrom ?? {}).includes('secretKeyRef')
  const val = v.value ?? (
    v.valueFrom
      ? JSON.stringify(v.valueFrom).replace(/[{}"]/g, '').slice(0, 60)
      : '—'
  )
  return (
    <tr className="hover:bg-gray-50">
      <td className="py-1.5 pr-4 text-xs font-mono text-blue-700 font-medium align-top">{name}</td>
      <td className="py-1.5 text-xs font-mono text-gray-600 break-all">
        {isSecret ? (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">{show ? val : '••••••••'}</span>
            <button onClick={() => setShow(s => !s)} className="text-gray-300 hover:text-gray-600">
              {show ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          </div>
        ) : (
          <span className={cn(v.valueFrom ? 'text-purple-600' : '')}>{val}</span>
        )}
      </td>
      {v.valueFrom && (
        <td className="py-1.5 pl-2 text-[10px] text-gray-400 whitespace-nowrap">
          {(v.valueFrom as Record<string, Record<string, string>>).configMapKeyRef
            ? `cm: ${(v.valueFrom as Record<string, Record<string, string>>).configMapKeyRef?.name}/${(v.valueFrom as Record<string, Record<string, string>>).configMapKeyRef?.key}`
            : (v.valueFrom as Record<string, Record<string, string>>).secretKeyRef
            ? `secret: ${(v.valueFrom as Record<string, Record<string, string>>).secretKeyRef?.name}/${(v.valueFrom as Record<string, Record<string, string>>).secretKeyRef?.key}`
            : (v.valueFrom as Record<string, Record<string, string>>).fieldRef
            ? `field: ${(v.valueFrom as Record<string, Record<string, string>>).fieldRef?.fieldPath}`
            : 'ref'}
        </td>
      )}
    </tr>
  )
}

export function EnvVarsSection({ containers }: { containers: K8sContainer[] }) {
  const withEnv = containers.filter(c => (c.env?.length ?? 0) > 0 || (c.envFrom?.length ?? 0) > 0)
  if (!withEnv.length) {
    return <div className="pt-4 text-sm text-gray-400 italic">No environment variables configured</div>
  }
  return (
    <div className="pt-4 space-y-5">
      {withEnv.map(c => (
        <div key={c.name}>
          <p className="text-xs font-semibold text-gray-600 mb-2">{c.name}</p>
          {c.envFrom?.length ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {c.envFrom.map((ef, i) => (
                <span key={i} className={cn(
                  'text-[10px] px-2 py-0.5 rounded border font-mono',
                  ef.configMapRef ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                )}>
                  {ef.configMapRef ? `cm: ${ef.configMapRef.name}` : `secret: ${ef.secretRef?.name}`}
                  {ef.prefix ? ` (prefix: ${ef.prefix})` : ''}
                </span>
              ))}
            </div>
          ) : null}
          {c.env?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  {c.env.map(e => (
                    <EnvValue key={e.name} name={e.name} v={{ value: e.value, valueFrom: e.valueFrom as Record<string, unknown> | undefined }} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ── Volumes & Mounts ───────────────────────────────────────────────────────────

function volumeSource(v: Record<string, unknown>): string {
  if (v.persistentVolumeClaim) return `PVC: ${(v.persistentVolumeClaim as Record<string,string>).claimName}`
  if (v.configMap)             return `ConfigMap: ${(v.configMap as Record<string,string>).name}`
  if (v.secret)                return `Secret: ${(v.secret as Record<string,string>).secretName}`
  if (v.emptyDir)              return `EmptyDir${(v.emptyDir as Record<string,string>).medium ? ` (${(v.emptyDir as Record<string,string>).medium})` : ''}`
  if (v.hostPath)              return `HostPath: ${(v.hostPath as Record<string,string>).path}`
  if (v.projected)             return 'Projected'
  if (v.downwardAPI)           return 'DownwardAPI'
  if (v.nfs)                   return `NFS: ${(v.nfs as Record<string,string>).server}:${(v.nfs as Record<string,string>).path}`
  if (v.csi)                   return `CSI: ${(v.csi as Record<string,string>).driver}`
  const keys = Object.keys(v).filter(k => k !== 'name')
  return keys[0] ?? 'unknown'
}

export function VolumesSection({ podSpec }: { podSpec?: K8sPodSpec }) {
  const volumes = podSpec?.volumes ?? []
  const allContainers = [
    ...(podSpec?.containers ?? []),
    ...(podSpec?.initContainers ?? []),
  ]
  if (!volumes.length) {
    return <div className="pt-4 text-sm text-gray-400 italic">No volumes configured</div>
  }
  return (
    <div className="pt-4 space-y-3">
      {volumes.map(vol => {
        const mounts = allContainers.flatMap(c =>
          (c.volumeMounts ?? [])
            .filter(m => m.name === vol.name)
            .map(m => ({ container: c.name, mountPath: m.mountPath, readOnly: m.readOnly, subPath: m.subPath }))
        )
        return (
          <div key={vol.name} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="flex items-start justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-800 font-mono">{vol.name}</p>
              <span className="text-[10px] text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-0.5">
                {volumeSource(vol as Record<string, unknown>)}
              </span>
            </div>
            {mounts.length > 0 && (
              <div className="space-y-0.5">
                {mounts.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span className="text-blue-400">{m.container}</span>
                    <span>→</span>
                    <span className="font-mono text-gray-700">{m.mountPath}</span>
                    {m.subPath && <span className="text-gray-400">subPath: {m.subPath}</span>}
                    {m.readOnly && <span className="text-orange-500 bg-orange-50 border border-orange-100 rounded px-1">ro</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Container ports / networking ───────────────────────────────────────────────

export function NetworkingSection({ podSpec }: { podSpec?: K8sPodSpec }) {
  const allPorts = (podSpec?.containers ?? []).flatMap(c =>
    (c.ports ?? []).map(p => ({ container: c.name, ...p }))
  )
  return (
    <div className="pt-4 space-y-3">
      {allPorts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Container Ports</p>
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {['Container', 'Name', 'Port', 'Protocol', 'Host Port'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allPorts.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-blue-600">{(p as Record<string,unknown>).container as string}</td>
                  <td className="px-3 py-2 font-mono text-gray-600">{p.name ?? '—'}</td>
                  <td className="px-3 py-2 font-mono font-bold text-gray-900">{p.containerPort}</td>
                  <td className="px-3 py-2 text-gray-500">{p.protocol ?? 'TCP'}</td>
                  <td className="px-3 py-2 text-gray-400">{p.hostPort ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-8">
        <InfoRow label="DNS Policy"    value={podSpec?.dnsPolicy ?? '—'} />
        <InfoRow label="Host Network"  value={podSpec?.hostNetwork ? 'true' : 'false'} />
        <InfoRow label="Host PID"      value={podSpec?.hostPID     ? 'true' : 'false'} />
        <InfoRow label="Host IPC"      value={podSpec?.hostIPC     ? 'true' : 'false'} />
      </div>
    </div>
  )
}

// ── Scheduling ─────────────────────────────────────────────────────────────────

export function SchedulingSection({ podSpec }: { podSpec?: K8sPodSpec }) {
  const hasContent = podSpec?.nodeSelector || podSpec?.nodeName ||
    podSpec?.tolerations?.length || podSpec?.affinity ||
    podSpec?.priorityClassName || podSpec?.topologySpreadConstraints?.length

  if (!hasContent) {
    return <div className="pt-4 text-sm text-gray-400 italic">No scheduling constraints configured</div>
  }

  return (
    <div className="pt-4 space-y-2">
      {podSpec?.nodeName && <InfoRow label="Node" value={podSpec.nodeName} mono copy />}
      {podSpec?.priorityClassName && <InfoRow label="Priority Class" value={podSpec.priorityClassName} />}
      {podSpec?.serviceAccountName && <InfoRow label="Service Account" value={podSpec.serviceAccountName} mono />}
      {podSpec?.automountServiceAccountToken !== undefined && (
        <InfoRow label="Automount SA Token" value={String(podSpec.automountServiceAccountToken)} />
      )}
      {podSpec?.nodeSelector && Object.keys(podSpec.nodeSelector).length > 0 && (
        <div className="flex items-start gap-4 py-2">
          <dt className="text-xs text-gray-500 w-44 flex-shrink-0 font-medium">Node Selector</dt>
          <dd className="flex flex-wrap gap-1.5">
            {Object.entries(podSpec.nodeSelector).map(([k, v]) => (
              <span key={k} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 rounded px-2 py-0.5 font-mono">{k}={v}</span>
            ))}
          </dd>
        </div>
      )}
      {podSpec?.tolerations?.length ? (
        <div className="flex items-start gap-4 py-2">
          <dt className="text-xs text-gray-500 w-44 flex-shrink-0 font-medium">Tolerations</dt>
          <dd className="space-y-1">
            {podSpec.tolerations.map((t, i) => (
              <span key={i} className="block text-[10px] font-mono text-gray-600">
                {t.key ?? '*'}{t.operator ? ` ${t.operator}` : ''}{t.value ? ` ${t.value}` : ''}{t.effect ? ` : ${t.effect}` : ''}
                {t.tolerationSeconds !== undefined ? ` (${t.tolerationSeconds}s)` : ''}
              </span>
            ))}
          </dd>
        </div>
      ) : null}
      {podSpec?.imagePullSecrets?.length ? (
        <div className="flex items-start gap-4 py-2">
          <dt className="text-xs text-gray-500 w-44 flex-shrink-0 font-medium">Image Pull Secrets</dt>
          <dd className="flex flex-wrap gap-1.5">
            {podSpec.imagePullSecrets.map(s => (
              <span key={s.name} className="text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-100 rounded px-2 py-0.5 font-mono">{s.name}</span>
            ))}
          </dd>
        </div>
      ) : null}
    </div>
  )
}

// ── Labels & Annotations ───────────────────────────────────────────────────────

export function LabelsAnnotations({
  labels, annotations
}: {
  labels?: Record<string, string>
  annotations?: Record<string, string>
}) {
  const [showAnnotations, setShowAnnotations] = useState(false)
  const labelEntries = Object.entries(labels ?? {})
  const annotEntries = Object.entries(annotations ?? {}).filter(([k]) => !k.startsWith('kubectl.kubernetes.io/last-applied'))

  return (
    <div className="pt-4 space-y-4">
      {labelEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Labels ({labelEntries.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {labelEntries.map(([k, v]) => (
              <span key={k}
                className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 font-mono cursor-pointer hover:bg-blue-100"
                onClick={() => copyToClipboard(`${k}=${v}`)}
                title="Click to copy"
              >
                {k}={v}
              </span>
            ))}
          </div>
        </div>
      )}
      {annotEntries.length > 0 && (
        <div>
          <button
            onClick={() => setShowAnnotations(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800"
          >
            {showAnnotations ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Annotations ({annotEntries.length})
          </button>
          {showAnnotations && (
            <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
              {annotEntries.map(([k, v]) => (
                <div key={k} className="flex items-start gap-3 text-[10px] font-mono">
                  <span className="text-purple-600 flex-shrink-0 w-64 truncate" title={k}>{k}</span>
                  <span className="text-gray-600 break-all">{v.length > 120 ? v.slice(0, 120) + '…' : v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {labelEntries.length === 0 && annotEntries.length === 0 && (
        <p className="text-sm text-gray-400 italic">No labels or annotations</p>
      )}
    </div>
  )
}

// ── Owner References ───────────────────────────────────────────────────────────

export function OwnerReferences({ owners }: { owners?: Array<{ apiVersion: string; kind: string; name: string; uid: string; controller?: boolean }> }) {
  if (!owners?.length) return null
  return (
    <div className="pt-4">
      <div className="space-y-2">
        {owners.map((o, i) => (
          <div key={i} className="flex items-center gap-3 text-sm p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs bg-gray-200 text-gray-700 rounded px-1.5 py-0.5 font-mono">{o.kind}</span>
            <span className="font-medium text-gray-900">{o.name}</span>
            <span className="text-xs text-gray-400 font-mono flex-1 truncate">{o.uid}</span>
            {o.controller && <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 rounded px-1.5 py-0.5">controller</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Container summary card ─────────────────────────────────────────────────────

export function ContainerCard({ container, status, isInit = false }: {
  container: K8sContainer
  status?: { ready: boolean; restartCount: number; state?: Record<string, unknown> }
  isInit?: boolean
}) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-gray-900">{container.name}</p>
            {isInit && <span className="text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 rounded px-1.5 py-0.5">init</span>}
            {container.imagePullPolicy && (
              <span className="text-[10px] text-gray-400">{container.imagePullPolicy}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-mono mt-0.5 break-all">{container.image}</p>
        </div>
        <div className="flex-shrink-0 ml-3 text-right">
          {status && <StatusBadge status={status.ready ? 'Ready' : 'NotReady'} />}
          {status && <p className="text-xs text-gray-400 mt-1">Restarts: {status.restartCount}</p>}
        </div>
      </div>

      {/* Command / args */}
      {(container.command?.length || container.args?.length) ? (
        <div className="text-xs font-mono bg-slate-900 rounded-lg p-2 text-slate-300 overflow-x-auto">
          {container.command?.length && <span className="text-green-400">{container.command.join(' ')} </span>}
          {container.args?.length && <span className="text-slate-400">{container.args.join(' ')}</span>}
        </div>
      ) : null}

      {/* Resource badges */}
      {(container.resources?.requests || container.resources?.limits) ? (
        <div className="flex flex-wrap gap-1.5">
          {container.resources?.requests?.cpu    && <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5">req cpu: {container.resources.requests.cpu}</span>}
          {container.resources?.requests?.memory && <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5">req mem: {container.resources.requests.memory}</span>}
          {container.resources?.limits?.cpu    && <span className="text-[10px] font-mono bg-orange-50 text-orange-700 border border-orange-100 rounded px-1.5 py-0.5">lim cpu: {container.resources.limits.cpu}</span>}
          {container.resources?.limits?.memory && <span className="text-[10px] font-mono bg-orange-50 text-orange-700 border border-orange-100 rounded px-1.5 py-0.5">lim mem: {container.resources.limits.memory}</span>}
        </div>
      ) : null}

      {/* Probes */}
      {(container.livenessProbe || container.readinessProbe || container.startupProbe) ? (
        <div className="flex gap-2">
          {container.livenessProbe  && <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 rounded px-2 py-0.5">liveness</span>}
          {container.readinessProbe && <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 rounded px-2 py-0.5">readiness</span>}
          {container.startupProbe   && <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 rounded px-2 py-0.5">startup</span>}
        </div>
      ) : null}
    </div>
  )
}
