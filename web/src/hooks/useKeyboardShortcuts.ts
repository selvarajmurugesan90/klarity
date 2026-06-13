import { useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

interface ShortcutMap {
  [key: string]: () => void
}

// Two-key chord state: e.g. pressing 'g' then 'p' navigates to pods
let pendingKey: string | null = null
let pendingTimer: ReturnType<typeof setTimeout> | null = null

export function useKeyboardShortcuts(extraShortcuts?: ShortcutMap) {
  const navigate = useNavigate()

  const navigationChords: Record<string, Record<string, string>> = useMemo(() => ({
    g: {
      o: '/',
      p: '/pods',
      d: '/deployments',
      s: '/statefulsets',
      j: '/jobs',
      c: '/cronjobs',
      v: '/services',
      i: '/ingresses',
      n: '/namespaces',
      N: '/nodes',
      e: '/events',
      r: '/roles',
      C: '/clusterroles',
      m: '/configmaps',
      S: '/secrets',
      q: '/customresources',
      a: '/audit',
      I: '/identity',
      h: '/reports',
      '/': '/search',
    },
  }), [])

  const singleKeyActions: Record<string, () => void> = useMemo(() => ({
    '?': () => {
      window.dispatchEvent(new CustomEvent('kd:toggle-shortcuts'))
    },
    Escape: () => {
      window.dispatchEvent(new CustomEvent('kd:close-modal'))
    },
  }), [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when typing in inputs, textareas, or contenteditable
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement).isContentEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key

      // Handle Ctrl+K / Cmd+K for global search
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('kd:open-search'))
        return
      }

      // Single-key shortcuts
      if (singleKeyActions[key]) {
        singleKeyActions[key]()
        return
      }

      // Check extra shortcuts
      if (extraShortcuts?.[key]) {
        extraShortcuts[key]()
        return
      }

      // Two-key chord: wait for second key
      if (navigationChords[key]) {
        if (pendingTimer) clearTimeout(pendingTimer)
        pendingKey = key
        pendingTimer = setTimeout(() => {
          pendingKey = null
        }, 1500)
        return
      }

      // Second key of chord
      if (pendingKey && navigationChords[pendingKey]?.[key]) {
        const route = navigationChords[pendingKey][key]
        if (pendingTimer) clearTimeout(pendingTimer)
        pendingKey = null
        navigate(route)
        return
      }

      pendingKey = null
    },
    [navigate, extraShortcuts, navigationChords, singleKeyActions]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// All shortcuts documentation for the help overlay
export const SHORTCUTS_HELP = [
  { group: 'Navigation', shortcuts: [
    { keys: ['g', 'o'], desc: 'Overview' },
    { keys: ['g', 'p'], desc: 'Pods' },
    { keys: ['g', 'd'], desc: 'Deployments' },
    { keys: ['g', 's'], desc: 'StatefulSets' },
    { keys: ['g', 'j'], desc: 'Jobs' },
    { keys: ['g', 'c'], desc: 'CronJobs' },
    { keys: ['g', 'v'], desc: 'Services' },
    { keys: ['g', 'i'], desc: 'Ingresses' },
    { keys: ['g', 'n'], desc: 'Namespaces' },
    { keys: ['g', 'N'], desc: 'Nodes' },
    { keys: ['g', 'e'], desc: 'Events' },
    { keys: ['g', 'm'], desc: 'ConfigMaps' },
    { keys: ['g', 'S'], desc: 'Secrets' },
    { keys: ['g', 'r'], desc: 'Roles' },
    { keys: ['g', 'C'], desc: 'Cluster Roles' },
    { keys: ['g', 'q'], desc: 'Custom Resources' },
    { keys: ['g', 'a'], desc: 'Audit Log' },
    { keys: ['g', 'I'], desc: 'Identity' },
    { keys: ['g', 'h'], desc: 'Health Report' },
  ]},
  { group: 'Actions', shortcuts: [
    { keys: ['Ctrl', 'K'], desc: 'Global Search' },
    { keys: ['?'], desc: 'Show this help' },
    { keys: ['Esc'], desc: 'Close modal/overlay' },
  ]},
]
