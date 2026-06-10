import { create } from 'zustand'

export type ActivityType = 'log' | 'terminal' | 'portforward'

export interface Activity {
  id: string
  type: ActivityType
  title: string
  subtitle: string
  namespace: string
  pod?: string
  container?: string
  // portforward specific
  pfId?: string
  localPort?: number
  remotePort?: number
  proxyPath?: string
  // ui state
  minimized: boolean
  createdAt: number
}

interface ActivityState {
  activities: Activity[]
  panelOpen: boolean
  activeId: string | null

  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void

  addLog: (opts: { namespace: string; pod: string; container: string }) => string
  addTerminal: (opts: { namespace: string; pod: string; container: string }) => string
  addPortForward: (opts: {
    namespace: string; pod: string; remotePort: number
    pfId: string; localPort: number; proxyPath: string
  }) => string

  remove: (id: string) => void
  setActive: (id: string) => void
  toggleMinimize: (id: string) => void
  clear: () => void
}

let nextId = 1

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  panelOpen: false,
  activeId: null,

  openPanel:   () => set({ panelOpen: true }),
  closePanel:  () => set({ panelOpen: false }),
  togglePanel: () => set(s => ({ panelOpen: !s.panelOpen })),

  addLog: ({ namespace, pod, container }) => {
    const id = `log-${nextId++}`
    const activity: Activity = {
      id, type: 'log',
      title: pod,
      subtitle: container ? `${namespace} / ${container}` : namespace,
      namespace, pod, container,
      minimized: false,
      createdAt: Date.now(),
    }
    set(s => ({ activities: [...s.activities, activity], panelOpen: true, activeId: id }))
    return id
  },

  addTerminal: ({ namespace, pod, container }) => {
    const id = `term-${nextId++}`
    const activity: Activity = {
      id, type: 'terminal',
      title: pod,
      subtitle: `${namespace} / ${container}`,
      namespace, pod, container,
      minimized: false,
      createdAt: Date.now(),
    }
    set(s => ({ activities: [...s.activities, activity], panelOpen: true, activeId: id }))
    return id
  },

  addPortForward: ({ namespace, pod, remotePort, pfId, localPort, proxyPath }) => {
    const id = `pf-${nextId++}`
    const activity: Activity = {
      id, type: 'portforward',
      title: `${pod}:${remotePort}`,
      subtitle: namespace,
      namespace, pod, remotePort,
      pfId, localPort, proxyPath,
      minimized: false,
      createdAt: Date.now(),
    }
    set(s => ({ activities: [...s.activities, activity], panelOpen: true, activeId: id }))
    return id
  },

  remove: (id) => {
    set(s => {
      const remaining = s.activities.filter(a => a.id !== id)
      const newActive = s.activeId === id ? (remaining[0]?.id ?? null) : s.activeId
      return {
        activities: remaining,
        activeId: newActive,
        panelOpen: remaining.length > 0 ? s.panelOpen : false,
      }
    })
  },

  setActive: (id) => set({ activeId: id, panelOpen: true }),

  toggleMinimize: (id) => set(s => ({
    activities: s.activities.map(a =>
      a.id === id ? { ...a, minimized: !a.minimized } : a
    ),
  })),

  clear: () => set({ activities: [], panelOpen: false, activeId: null }),
}))
