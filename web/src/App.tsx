import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Layout from '@/components/layout/Layout'
import Overview from '@/pages/Overview'
import Login from '@/pages/auth/Login'
import Pods from '@/pages/workloads/Pods'
import PodDetail from '@/pages/workloads/PodDetail'
import Deployments from '@/pages/workloads/Deployments'
import DeploymentDetail from '@/pages/workloads/DeploymentDetail'
import JobDetail from '@/pages/workloads/JobDetail'
import CronJobDetail from '@/pages/workloads/CronJobDetail'
import StatefulSetDetail from '@/pages/workloads/StatefulSetDetail'
import DaemonSetDetail from '@/pages/workloads/DaemonSetDetail'
import StatefulSets from '@/pages/workloads/StatefulSets'
import DaemonSets from '@/pages/workloads/DaemonSets'
import ReplicaSets from '@/pages/workloads/ReplicaSets'
import Jobs from '@/pages/workloads/Jobs'
import CronJobs from '@/pages/workloads/CronJobs'
import Services from '@/pages/networking/Services'
import Ingresses from '@/pages/networking/Ingresses'
import NetworkPolicies from '@/pages/networking/NetworkPolicies'
import PersistentVolumes from '@/pages/storage/PersistentVolumes'
import PersistentVolumeClaims from '@/pages/storage/PersistentVolumeClaims'
import StorageClasses from '@/pages/storage/StorageClasses'
import ConfigMaps from '@/pages/config/ConfigMaps'
import Secrets from '@/pages/config/Secrets'
import ServiceAccounts from '@/pages/config/ServiceAccounts'
import Roles from '@/pages/rbac/Roles'
import ClusterRoles from '@/pages/rbac/ClusterRoles'
import RoleBindings from '@/pages/rbac/RoleBindings'
import ClusterRoleBindings from '@/pages/rbac/ClusterRoleBindings'
import Nodes from '@/pages/nodes/Nodes'
import NodeDetail from '@/pages/nodes/NodeDetail'
import Namespaces from '@/pages/namespaces/Namespaces'
import Events from '@/pages/events/Events'
import CustomResources from '@/pages/crd/CustomResources'
import HPAs from '@/pages/policy/HPAs'
import PDBs from '@/pages/policy/PDBs'
import PriorityClasses from '@/pages/policy/PriorityClasses'
import RuntimeClasses from '@/pages/policy/RuntimeClasses'
import Webhooks from '@/pages/policy/Webhooks'
import CertificateSigningRequests from '@/pages/policy/CertificateSigningRequests'
import FlowControl from '@/pages/policy/FlowControl'
import Settings from '@/pages/settings/Settings'
import AuditLog from '@/pages/audit/AuditLog'
import IdentityManagement from '@/pages/identity/IdentityManagement'
import ClusterHealthReport from '@/pages/reports/ClusterHealthReport'
import TopConsumers from '@/pages/monitoring/TopConsumers'
import PortForwarding from '@/pages/portforward/PortForwarding'
import GitOpsDashboard from '@/pages/gitops/GitOpsDashboard'
import ArgoCD from '@/pages/gitops/ArgoCD'
import FluxCD from '@/pages/gitops/FluxCD'
import { useAuthStore } from '@/store/auth'
import { useClusterStore } from '@/store/cluster'
import { namespacesApi, clusterApi } from '@/lib/api'

// Auth config is handled in Login.tsx

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authenticated, authMode } = useAuthStore()
  if (authMode === 'none' || authenticated) return <>{children}</>
  return <Navigate to="/login" replace />
}

function DataBootstrap({ children }: { children: React.ReactNode }) {
  const { setNamespaces, setClusters } = useClusterStore()

  useQuery({
    queryKey: ['namespaces'],
    queryFn: async () => {
      const r = await namespacesApi.list({ pageSize: 500 })
      const ns = (r.data as Array<{ metadata: { name: string } }>).map(n => n.metadata.name)
      setNamespaces(ns)
      return ns
    },
    staleTime: 60_000,
  })

  useQuery({
    queryKey: ['clusters'],
    queryFn: async () => {
      const r = await clusterApi.list()
      setClusters(r.data)
      return r.data
    },
    staleTime: 60_000,
  })

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <DataBootstrap>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Overview />} />

                    {/* Workloads */}
                    <Route path="/pods" element={<Pods />} />
                    <Route path="/pods/:namespace/:name" element={<PodDetail />} />
                    <Route path="/deployments" element={<Deployments />} />
                    <Route path="/deployments/:namespace/:name" element={<DeploymentDetail />} />
                    <Route path="/jobs/:namespace/:name" element={<JobDetail />} />
                    <Route path="/cronjobs/:namespace/:name" element={<CronJobDetail />} />
                    <Route path="/statefulsets/:namespace/:name" element={<StatefulSetDetail />} />
                    <Route path="/daemonsets/:namespace/:name" element={<DaemonSetDetail />} />
                    <Route path="/statefulsets" element={<StatefulSets />} />
                    <Route path="/daemonsets" element={<DaemonSets />} />
                    <Route path="/replicasets" element={<ReplicaSets />} />
                    <Route path="/jobs" element={<Jobs />} />
                    <Route path="/cronjobs" element={<CronJobs />} />

                    {/* Networking */}
                    <Route path="/services" element={<Services />} />
                    <Route path="/ingresses" element={<Ingresses />} />
                    <Route path="/networkpolicies" element={<NetworkPolicies />} />

                    {/* Storage */}
                    <Route path="/persistentvolumes" element={<PersistentVolumes />} />
                    <Route path="/persistentvolumeclaims" element={<PersistentVolumeClaims />} />
                    <Route path="/storageclasses" element={<StorageClasses />} />

                    {/* Configuration */}
                    <Route path="/configmaps" element={<ConfigMaps />} />
                    <Route path="/secrets" element={<Secrets />} />
                    <Route path="/serviceaccounts" element={<ServiceAccounts />} />

                    {/* RBAC */}
                    <Route path="/roles" element={<Roles />} />
                    <Route path="/clusterroles" element={<ClusterRoles />} />
                    <Route path="/rolebindings" element={<RoleBindings />} />
                    <Route path="/clusterrolebindings" element={<ClusterRoleBindings />} />

                    {/* Cluster */}
                    <Route path="/nodes" element={<Nodes />} />
                    <Route path="/nodes/:name" element={<NodeDetail />} />
                    <Route path="/namespaces" element={<Namespaces />} />
                    <Route path="/events" element={<Events />} />

                    {/* Policy & Scheduling */}
                    <Route path="/horizontalpodautoscalers" element={<HPAs />} />
                    <Route path="/poddisruptionbudgets" element={<PDBs />} />
                    <Route path="/priorityclasses" element={<PriorityClasses />} />
                    <Route path="/runtimeclasses" element={<RuntimeClasses />} />
                    <Route path="/webhooks" element={<Webhooks />} />
                    <Route path="/certificatesigningrequests" element={<CertificateSigningRequests />} />
                    <Route path="/flowcontrol" element={<FlowControl />} />

                    {/* Custom Resources */}
                    <Route path="/customresources" element={<CustomResources />} />
                    <Route path="/customresources/:group/:version/:resource" element={<CustomResources />} />

                    {/* Settings */}
                    <Route path="/settings" element={<Settings />} />

                    {/* Observability & Ops */}
                    <Route path="/audit" element={<AuditLog />} />
                    <Route path="/identity" element={<IdentityManagement />} />
                    <Route path="/reports" element={<ClusterHealthReport />} />
                    <Route path="/portforward" element={<PortForwarding />} />
                    <Route path="/top" element={<TopConsumers />} />

                    {/* GitOps */}
                    <Route path="/gitops" element={<GitOpsDashboard />} />
                    <Route path="/gitops/argocd" element={<ArgoCD />} />
                    <Route path="/gitops/flux" element={<FluxCD />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </DataBootstrap>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
