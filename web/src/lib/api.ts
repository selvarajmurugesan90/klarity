import axios, { AxiosError } from 'axios'
import { useAuthStore } from '@/store/auth'

export const api = axios.create({ baseURL: '/api/v1', timeout: 30000 })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(err)
  }
)

export function apiUrl(path: string) {
  return `/api/v1${path}`
}

// ── Generic list helper ────────────────────────────────────────────────────────
export interface ListParams {
  namespace?: string
  page?: number
  pageSize?: number
  search?: string
  labelSelector?: string
  fieldSelector?: string
  sortBy?: string
  sortOrder?: string
  cluster?: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
  total?: number
  page?: number
  pageSize?: number
}

async function get<T>(path: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
  const r = await api.get<ApiResponse<T>>(path, { params })
  return r.data
}

async function del(path: string, params?: Record<string, unknown>) {
  const r = await api.delete<ApiResponse<unknown>>(path, { params })
  return r.data
}

async function post<T>(path: string, body?: unknown) {
  const r = await api.post<ApiResponse<T>>(path, body)
  return r.data
}

async function put<T>(path: string, body?: unknown) {
  const r = await api.put<ApiResponse<T>>(path, body)
  return r.data
}

async function patch<T>(path: string, body?: unknown) {
  const r = await api.patch<ApiResponse<T>>(path, body)
  return r.data
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  check: () => get('/auth/check'),
  login: (token: string) => post('/auth/login', { token }),
  logout: () => post('/auth/logout'),
}

// ── Internal Auth (username/password) ─────────────────────────────────────────
export const internalAuthApi = {
  login: (username: string, password: string) =>
    post<{ accessToken: string; user: SafeUser; mustChangePw: boolean; expiresIn: number }>(
      '/auth/internal/login', { username, password }
    ),
  refresh: () => post<{ accessToken: string }>('/auth/internal/refresh'),
  logout: () => post('/auth/internal/logout'),
  me: () => get<SafeUser>('/auth/me'),
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/me/password', { currentPassword, newPassword }).then(r => r.data),
}

// ── User Management ───────────────────────────────────────────────────────────
export const usersApi = {
  list: () => get<SafeUser[]>('/users'),
  get: (id: string) => get<SafeUser>(`/users/${id}`),
  create: (data: {
    username: string; displayName: string; email?: string; password: string; role: string
  }) => post<SafeUser>('/users', data),
  update: (id: string, data: Partial<{
    displayName: string; email: string; role: string; active: boolean; mustChangePassword: boolean
  }>) => put<SafeUser>(`/users/${id}`, data),
  delete: (id: string) => del(`/users/${id}`),
  changePassword: (id: string, currentPassword: string, newPassword: string) =>
    put(`/users/${id}/password`, { currentPassword, newPassword }),
  resetPassword: (id: string, newPassword: string) =>
    put(`/users/${id}/reset-password`, { newPassword }),
  unlock: (id: string) => post(`/users/${id}/unlock`),
}

export interface SafeUser {
  id: string
  username: string
  displayName: string
  email?: string
  role: 'admin' | 'editor' | 'viewer'
  active: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  mustChangePassword: boolean
  locked: boolean
}

// ── Cluster ───────────────────────────────────────────────────────────────────
export const clusterApi = {
  list: () => get<ClusterInfo[]>('/clusters'),
  switch: (name: string) => post('/clusters/switch', { name }),
  version: (params?: ListParams) => get<{ version: string }>('/version', params as never),
  overview: (params?: ListParams) => get('/overview', params as never),
  apiResources: (params?: ListParams) => get('/apiresources', params as never),
  apiGroups: (params?: ListParams) => get('/apigroups', params as never),
}

// ── Namespaces ────────────────────────────────────────────────────────────────
export const namespacesApi = {
  list: (p?: ListParams) => get('/namespaces', p as never),
  get: (name: string) => get(`/namespaces/${name}`),
  delete: (name: string) => del(`/namespaces/${name}`),
}

// ── Nodes ─────────────────────────────────────────────────────────────────────
export const nodesApi = {
  list: (p?: ListParams) => get('/nodes', p as never),
  get: (name: string) => get(`/nodes/${name}`),
  pods: (name: string) => get(`/nodes/${name}/pods`),
  metrics: (name: string) => get(`/nodes/${name}/metrics`),
  cordon: (name: string, cordon: boolean) => patch(`/nodes/${name}/cordon`, { cordon }),
}

// ── Pods ──────────────────────────────────────────────────────────────────────
export const podsApi = {
  list: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/pods`, p as never),
  listAll: (p?: ListParams) => get('/pods', p as never),
  get: (ns: string, name: string) => get(`/namespaces/${ns}/pods/${name}`),
  delete: (ns: string, name: string) => del(`/namespaces/${ns}/pods/${name}`),
  logs: (ns: string, name: string, p?: { container?: string; previous?: boolean; timestamps?: boolean; tailLines?: number }) =>
    api.get(`/namespaces/${ns}/pods/${name}/logs`, { params: p, responseType: 'text' }).then(r => r.data as string),
  yaml: (ns: string, name: string) => api.get(`/namespaces/${ns}/pods/${name}/yaml`, { responseType: 'text' }).then(r => r.data as string),
  events: (ns: string, name: string) => get(`/namespaces/${ns}/pods/${name}/events`),
}

// ── Deployments ───────────────────────────────────────────────────────────────
export const deploymentsApi = {
  list: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/deployments`, p as never),
  listAll: (p?: ListParams) => get('/deployments', p as never),
  get: (ns: string, name: string) => get(`/namespaces/${ns}/deployments/${name}`),
  scale: (ns: string, name: string, replicas: number) => put(`/namespaces/${ns}/deployments/${name}/scale`, { replicas }),
  restart: (ns: string, name: string) => post(`/namespaces/${ns}/deployments/${name}/restart`),
  delete: (ns: string, name: string) => del(`/namespaces/${ns}/deployments/${name}`),
  yaml: (ns: string, name: string) => api.get(`/namespaces/${ns}/deployments/${name}/yaml`, { responseType: 'text' }).then(r => r.data as string),
  events: (ns: string, name: string) => get(`/namespaces/${ns}/deployments/${name}/events`),
}

// ── StatefulSets ──────────────────────────────────────────────────────────────
export const statefulSetsApi = {
  list: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/statefulsets`, p as never),
  listAll: (p?: ListParams) => get('/statefulsets', p as never),
  get: (ns: string, name: string) => get(`/namespaces/${ns}/statefulsets/${name}`),
  scale: (ns: string, name: string, replicas: number) => put(`/namespaces/${ns}/statefulsets/${name}/scale`, { replicas }),
  delete: (ns: string, name: string) => del(`/namespaces/${ns}/statefulsets/${name}`),
}

// ── DaemonSets ────────────────────────────────────────────────────────────────
export const daemonSetsApi = {
  list: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/daemonsets`, p as never),
  listAll: (p?: ListParams) => get('/daemonsets', p as never),
  get: (ns: string, name: string) => get(`/namespaces/${ns}/daemonsets/${name}`),
  delete: (ns: string, name: string) => del(`/namespaces/${ns}/daemonsets/${name}`),
}

// ── ReplicaSets ───────────────────────────────────────────────────────────────
export const replicaSetsApi = {
  list: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/replicasets`, p as never),
  listAll: (p?: ListParams) => get('/replicasets', p as never),
  get: (ns: string, name: string) => get(`/namespaces/${ns}/replicasets/${name}`),
  delete: (ns: string, name: string) => del(`/namespaces/${ns}/replicasets/${name}`),
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/jobs`, p as never),
  listAll: (p?: ListParams) => get('/jobs', p as never),
  get: (ns: string, name: string) => get(`/namespaces/${ns}/jobs/${name}`),
  yaml: (ns: string, name: string) => api.get(`/namespaces/${ns}/jobs/${name}/yaml`, { responseType: 'text' }).then(r => r.data as string),
  delete: (ns: string, name: string) => del(`/namespaces/${ns}/jobs/${name}`),
}

// ── CronJobs ──────────────────────────────────────────────────────────────────
export const cronJobsApi = {
  list: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/cronjobs`, p as never),
  listAll: (p?: ListParams) => get('/cronjobs', p as never),
  get: (ns: string, name: string) => get(`/namespaces/${ns}/cronjobs/${name}`),
  delete: (ns: string, name: string) => del(`/namespaces/${ns}/cronjobs/${name}`),
  trigger: (ns: string, name: string) => post(`/namespaces/${ns}/cronjobs/${name}/trigger`),
  suspend: (ns: string, name: string, suspend: boolean) => patch(`/namespaces/${ns}/cronjobs/${name}/suspend`, { suspend }),
}

// ── Services ──────────────────────────────────────────────────────────────────
export const servicesApi = {
  list: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/services`, p as never),
  listAll: (p?: ListParams) => get('/services', p as never),
  get: (ns: string, name: string) => get(`/namespaces/${ns}/services/${name}`),
  delete: (ns: string, name: string) => del(`/namespaces/${ns}/services/${name}`),
}

// ── Ingresses ─────────────────────────────────────────────────────────────────
export const ingressesApi = {
  list: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/ingresses`, p as never),
  listAll: (p?: ListParams) => get('/ingresses', p as never),
  get: (ns: string, name: string) => get(`/namespaces/${ns}/ingresses/${name}`),
  delete: (ns: string, name: string) => del(`/namespaces/${ns}/ingresses/${name}`),
}

// ── NetworkPolicies ───────────────────────────────────────────────────────────
export const networkPoliciesApi = {
  list: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/networkpolicies`, p as never),
  listAll: (p?: ListParams) => get('/networkpolicies', p as never),
  get: (ns: string, name: string) => get(`/namespaces/${ns}/networkpolicies/${name}`),
  delete: (ns: string, name: string) => del(`/namespaces/${ns}/networkpolicies/${name}`),
}

// ── Storage ───────────────────────────────────────────────────────────────────
export const storageApi = {
  listPVs: (p?: ListParams) => get('/persistentvolumes', p as never),
  getPV: (name: string) => get(`/persistentvolumes/${name}`),
  deletePV: (name: string) => del(`/persistentvolumes/${name}`),
  listPVCs: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/persistentvolumeclaims`, p as never),
  listAllPVCs: (p?: ListParams) => get('/persistentvolumeclaims', p as never),
  getPVC: (ns: string, name: string) => get(`/namespaces/${ns}/persistentvolumeclaims/${name}`),
  deletePVC: (ns: string, name: string) => del(`/namespaces/${ns}/persistentvolumeclaims/${name}`),
  listStorageClasses: (p?: ListParams) => get('/storageclasses', p as never),
  getStorageClass: (name: string) => get(`/storageclasses/${name}`),
  listVolumeAttachments: () => get('/volumeattachments'),
  listCSIDrivers: () => get('/csidrivers'),
  listCSINodes: () => get('/csinodes'),
}

// ── Config ────────────────────────────────────────────────────────────────────
export const configApi = {
  listConfigMaps: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/configmaps`, p as never),
  listAllConfigMaps: (p?: ListParams) => get('/configmaps', p as never),
  getConfigMap: (ns: string, name: string) => get(`/namespaces/${ns}/configmaps/${name}`),
  deleteConfigMap: (ns: string, name: string) => del(`/namespaces/${ns}/configmaps/${name}`),
  listSecrets: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/secrets`, p as never),
  listAllSecrets: (p?: ListParams) => get('/secrets', p as never),
  getSecret: (ns: string, name: string, reveal = false) => get(`/namespaces/${ns}/secrets/${name}`, { reveal }),
  deleteSecret: (ns: string, name: string) => del(`/namespaces/${ns}/secrets/${name}`),
  listServiceAccounts: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/serviceaccounts`, p as never),
  listAllServiceAccounts: (p?: ListParams) => get('/serviceaccounts', p as never),
  deleteServiceAccount: (ns: string, name: string) => del(`/namespaces/${ns}/serviceaccounts/${name}`),
  listResourceQuotas: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/resourcequotas`, p as never),
  listLimitRanges: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/limitranges`, p as never),
}

// ── RBAC ──────────────────────────────────────────────────────────────────────
export const rbacApi = {
  listRoles: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/roles`, p as never),
  listAllRoles: (p?: ListParams) => get('/roles', p as never),
  getRole: (ns: string, name: string) => get(`/namespaces/${ns}/roles/${name}`),
  deleteRole: (ns: string, name: string) => del(`/namespaces/${ns}/roles/${name}`),
  listClusterRoles: (p?: ListParams) => get('/clusterroles', p as never),
  getClusterRole: (name: string) => get(`/clusterroles/${name}`),
  deleteClusterRole: (name: string) => del(`/clusterroles/${name}`),
  listRoleBindings: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/rolebindings`, p as never),
  listAllRoleBindings: (p?: ListParams) => get('/rolebindings', p as never),
  getRoleBinding: (ns: string, name: string) => get(`/namespaces/${ns}/rolebindings/${name}`),
  deleteRoleBinding: (ns: string, name: string) => del(`/namespaces/${ns}/rolebindings/${name}`),
  listClusterRoleBindings: (p?: ListParams) => get('/clusterrolebindings', p as never),
  getClusterRoleBinding: (name: string) => get(`/clusterrolebindings/${name}`),
  deleteClusterRoleBinding: (name: string) => del(`/clusterrolebindings/${name}`),
}

// ── Policy ────────────────────────────────────────────────────────────────────
export const policyApi = {
  listHPAs: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/horizontalpodautoscalers`, p as never),
  listAllHPAs: (p?: ListParams) => get('/horizontalpodautoscalers', p as never),
  getHPA: (ns: string, name: string) => get(`/namespaces/${ns}/horizontalpodautoscalers/${name}`),
  deleteHPA: (ns: string, name: string) => del(`/namespaces/${ns}/horizontalpodautoscalers/${name}`),
  listPDBs: (ns: string, p?: ListParams) => get(`/namespaces/${ns}/poddisruptionbudgets`, p as never),
  listAllPDBs: (p?: ListParams) => get('/poddisruptionbudgets', p as never),
  getPDB: (ns: string, name: string) => get(`/namespaces/${ns}/poddisruptionbudgets/${name}`),
  deletePDB: (ns: string, name: string) => del(`/namespaces/${ns}/poddisruptionbudgets/${name}`),
  listPriorityClasses: () => get('/priorityclasses'),
  listRuntimeClasses: () => get('/runtimeclasses'),
  listMutatingWebhooks: () => get('/mutatingwebhookconfigurations'),
  getMutatingWebhook: (name: string) => get(`/mutatingwebhookconfigurations/${name}`),
  deleteMutatingWebhook: (name: string) => del(`/mutatingwebhookconfigurations/${name}`),
  listValidatingWebhooks: () => get('/validatingwebhookconfigurations'),
  getValidatingWebhook: (name: string) => get(`/validatingwebhookconfigurations/${name}`),
  deleteValidatingWebhook: (name: string) => del(`/validatingwebhookconfigurations/${name}`),
  listCSRs: () => get('/certificatesigningrequests'),
  listLeases: (ns: string) => get(`/namespaces/${ns}/leases`),
  listFlowSchemas: () => get('/flowschemas'),
  listPriorityLevelConfigurations: () => get('/prioritylevelconfigurations'),
}

// ── Events ────────────────────────────────────────────────────────────────────
export const eventsApi = {
  list: (p?: ListParams & { type?: string; namespace?: string }) => get('/events', p as never),
  listNs: (ns: string, p?: ListParams & { type?: string }) => get(`/namespaces/${ns}/events`, p as never),
}

// ── Metrics ───────────────────────────────────────────────────────────────────
export const metricsApi = {
  available:        () => get<{ available: boolean }>('/metrics/available'),
  nodes:            () => get('/metrics/nodes'),
  pods:             (ns: string) => get(`/metrics/pods/${ns}`),
  allPods:          () => get('/metrics/all-pods'),
  namespaceSummary: () => get('/metrics/namespaces'),
  singleNode:       (name: string) => get(`/nodes/${name}/metrics`),
  singlePod:        (ns: string, name: string) => get(`/namespaces/${ns}/metrics/pods/${name}`),
}

// ── Metric types ───────────────────────────────────────────────────────────────
export interface PodMetricsSummary {
  name: string
  namespace: string
  cpuMillis: number
  memoryBytes: number
  cpuDisplay: string
  memDisplay: string
  containers: number
}

export interface NamespaceMetricsSummary {
  namespace: string
  cpuMillis: number
  memoryBytes: number
  cpuDisplay: string
  memDisplay: string
  podCount: number
}

export interface NodeMetrics {
  name: string
  cpuUsage: string
  memoryUsage: string
  cpuPercent: number
  memoryPercent: number
}

// ── CRDs ──────────────────────────────────────────────────────────────────────
export const crdsApi = {
  list: (p?: ListParams) => get('/customresourcedefinitions', p as never),
  get: (name: string) => get(`/customresourcedefinitions/${name}`),
  delete: (name: string) => del(`/customresourcedefinitions/${name}`),
}

// ── Dynamic / Custom Resources ────────────────────────────────────────────────
export const dynamicApi = {
  list: (group: string, version: string, resource: string, ns?: string, p?: ListParams) => {
    const base = ns
      ? `/dynamic/${group || 'core'}/${version}/namespaces/${ns}/${resource}`
      : `/dynamic/${group || 'core'}/${version}/${resource}`
    return get(base, p as never)
  },
  get: (group: string, version: string, resource: string, name: string, ns?: string) => {
    const base = ns
      ? `/dynamic/${group || 'core'}/${version}/namespaces/${ns}/${resource}/${name}`
      : `/dynamic/${group || 'core'}/${version}/${resource}/${name}`
    return get(base)
  },
  delete: (group: string, version: string, resource: string, name: string, ns?: string) => {
    const base = ns
      ? `/dynamic/${group || 'core'}/${version}/namespaces/${ns}/${resource}/${name}`
      : `/dynamic/${group || 'core'}/${version}/${resource}/${name}`
    return del(base)
  },
  apply: (yaml: string) =>
    api.post('/apply', yaml, { headers: { 'Content-Type': 'application/yaml' } }).then(r => r.data),
}

export interface ClusterInfo {
  name: string
  current: boolean
}

// ── Global Search ─────────────────────────────────────────────────────────────
export const searchApi = {
  search: (q: string, namespace?: string) =>
    get('/search', { q, namespace } as never),
}

// ── Audit Log ─────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (p?: ListParams & { action?: string; resource?: string }) => get('/audit', p as never),
  stats: () => get<Record<string, number>>('/audit/stats'),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  healthReportUrl: () => '/api/v1/reports/health',
}

// ── Identity ──────────────────────────────────────────────────────────────────
export const identityApi = {
  listSubjects: (p?: ListParams & { showSystem?: boolean }) => get('/identity/subjects', p as never),
  getPermissions: (kind: string, name: string) =>
    get(`/identity/subjects/${kind}/${name}/permissions`),
}


// ── Quota Summary ─────────────────────────────────────────────────────────────
export const quotaApi = {
  summary: (namespace: string) => get(`/namespaces/${namespace}/quota-summary`),
}

// ── Deployment History / Rollback ─────────────────────────────────────────────
export const deploymentHistoryApi = {
  history: (ns: string, name: string) => get(`/namespaces/${ns}/deployments/${name}/history`),
  rollback: (ns: string, name: string, revision: string, replicaSetName: string) =>
    post(`/namespaces/${ns}/deployments/${name}/rollback`, { revision, replicaSetName }),
}
