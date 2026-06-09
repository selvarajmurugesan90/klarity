import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ClusterState {
  currentCluster: string
  currentNamespace: string
  namespaces: string[]
  clusters: Array<{ name: string; current: boolean }>
  setCluster: (name: string) => void
  setNamespace: (ns: string) => void
  setNamespaces: (ns: string[]) => void
  setClusters: (clusters: ClusterState['clusters']) => void
}

export const useClusterStore = create<ClusterState>()(
  persist(
    (set) => ({
      currentCluster: '',
      currentNamespace: 'default',
      namespaces: ['default'],
      clusters: [],
      setCluster: (name) => set({ currentCluster: name }),
      setNamespace: (ns) => set({ currentNamespace: ns }),
      setNamespaces: (namespaces) => set({ namespaces }),
      setClusters: (clusters) => set({ clusters }),
    }),
    { name: 'kd-cluster' }
  )
)
