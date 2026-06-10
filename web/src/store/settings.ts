import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface HelmRepository {
  name: string
  url: string
  username?: string
  password?: string
  insecure?: boolean
}

export interface NotificationWebhook {
  id: string
  name: string
  url: string
  events: string[]   // warning | error | all
  enabled: boolean
}

export interface AppSettings {
  // General
  defaultNamespace: string
  refreshInterval: number      // seconds
  defaultPageSize: number
  maxLogLines: number
  dateFormat: string           // relative | absolute
  timezone: string

  // Appearance
  theme: 'light' | 'dark' | 'system'
  sidebarCollapsed: boolean
  tableDensity: 'comfortable' | 'compact' | 'spacious'
  language: string

  // Auth (mirrors server but kept in UI for display)
  authMode: 'none' | 'token' | 'oidc'
  sessionTimeoutMinutes: number

  // Security
  allowedNamespaces: string[]  // empty = all
  requireNamespaceContext: boolean
  confirmDestructiveActions: boolean
  maskSecretValues: boolean

  // Helm
  helmRepos: HelmRepository[]

  // Notifications
  webhooks: NotificationWebhook[]
  notifyOnWarningEvents: boolean
  warningEventThreshold: number  // events per minute threshold

  // Actions
  setGeneral: (p: Partial<AppSettings>) => void
  addHelmRepo: (repo: HelmRepository) => void
  removeHelmRepo: (name: string) => void
  addWebhook: (wh: NotificationWebhook) => void
  removeWebhook: (id: string) => void
  toggleWebhook: (id: string) => void
  resetToDefaults: () => void
}

const DEFAULTS: Omit<AppSettings, 'setGeneral' | 'addHelmRepo' | 'removeHelmRepo' | 'addWebhook' | 'removeWebhook' | 'toggleWebhook' | 'resetToDefaults'> = {
  defaultNamespace: 'default',
  refreshInterval: 30,
  defaultPageSize: 50,
  maxLogLines: 10000,
  dateFormat: 'relative',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  theme: 'light',
  sidebarCollapsed: false,
  tableDensity: 'comfortable',
  language: 'en',
  authMode: 'token',
  sessionTimeoutMinutes: 1440,
  allowedNamespaces: [],
  requireNamespaceContext: false,
  confirmDestructiveActions: true,
  maskSecretValues: true,
  helmRepos: [
    { name: 'stable', url: 'https://charts.helm.sh/stable' },
    { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
  ],
  webhooks: [],
  notifyOnWarningEvents: false,
  warningEventThreshold: 10,
}

export const useSettingsStore = create<AppSettings>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setGeneral: (partial) => set(partial),

      addHelmRepo: (repo) => set((s) => ({
        helmRepos: [...s.helmRepos.filter(r => r.name !== repo.name), repo],
      })),

      removeHelmRepo: (name) => set((s) => ({
        helmRepos: s.helmRepos.filter(r => r.name !== name),
      })),

      addWebhook: (wh) => set((s) => ({
        webhooks: [...s.webhooks.filter(w => w.id !== wh.id), wh],
      })),

      removeWebhook: (id) => set((s) => ({
        webhooks: s.webhooks.filter(w => w.id !== id),
      })),

      toggleWebhook: (id) => set((s) => ({
        webhooks: s.webhooks.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w),
      })),

      resetToDefaults: () => set(DEFAULTS),
    }),
    { name: 'kd-settings' }
  )
)
