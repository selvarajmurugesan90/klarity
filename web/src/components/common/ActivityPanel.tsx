import { useState } from 'react'
import { useActivityStore, Activity } from '@/store/activities'
import LogViewer from './LogViewer'
import Terminal from './Terminal'
import {
  X, Minus, Maximize2, Minimize2, Terminal as TermIcon,
  FileText, Network, ChevronLeft, ChevronRight, Activity as ActivityIcon,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Activity type icon + colour ────────────────────────────────────────────────
function typeIcon(type: string) {
  if (type === 'log')         return <FileText  size={13} className="text-blue-400" />
  if (type === 'terminal')    return <TermIcon  size={13} className="text-green-400" />
  if (type === 'portforward') return <Network   size={13} className="text-purple-400" />
  return <ActivityIcon size={13} className="text-gray-400" />
}

// ── Port-forward activity view ─────────────────────────────────────────────────
function PortForwardView({ activity }: { activity: Activity }) {
  const proxyUrl = activity.proxyPath
    ? `${window.location.origin}${activity.proxyPath}`
    : null

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-center p-8">
      <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
        <Network size={28} className="text-purple-400" />
      </div>
      <div>
        <p className="text-white font-semibold text-lg">{activity.title}</p>
        <p className="text-slate-400 text-sm mt-0.5">{activity.subtitle}</p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 w-full text-left">
        <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Tunnel active</p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Remote port</span>
            <span className="text-white font-mono">{activity.remotePort}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Local port</span>
            <span className="text-white font-mono">{activity.localPort}</span>
          </div>
        </div>
      </div>

      {proxyUrl && (
        <a
          href={proxyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-500 transition-colors w-full justify-center"
        >
          <ExternalLink size={15} /> Open in browser tab
        </a>
      )}

      <div className="bg-slate-800 rounded-xl px-4 py-3 w-full text-left">
        <p className="text-xs text-slate-500 mb-1.5">Or access via dashboard proxy:</p>
        <code className="text-xs text-green-400 font-mono break-all">
          {proxyUrl ?? '/api/v1/portforward/proxy/' + activity.pfId + '/'}
        </code>
      </div>
    </div>
  )
}

// ── Single activity content ────────────────────────────────────────────────────
function ActivityContent({ activity }: { activity: Activity }) {
  if (activity.minimized) return null

  if (activity.type === 'log') {
    return (
      <div className="flex-1 min-h-0">
        <LogViewer
          namespace={activity.namespace}
          pod={activity.pod!}
          container={activity.container}
        />
      </div>
    )
  }

  if (activity.type === 'terminal') {
    return (
      <div className="flex-1 min-h-0">
        <Terminal
          namespace={activity.namespace}
          pod={activity.pod!}
          container={activity.container!}
        />
      </div>
    )
  }

  if (activity.type === 'portforward') {
    return (
      <div className="flex-1 min-h-0 overflow-auto">
        <PortForwardView activity={activity} />
      </div>
    )
  }

  return null
}

// ── Activity tab in the tab bar ────────────────────────────────────────────────
function ActivityTab({
  activity, active, onSelect, onRemove,
}: {
  activity: Activity
  active: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-all flex-shrink-0 max-w-[160px]',
        active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
      )}
    >
      {typeIcon(activity.type)}
      <span className="truncate">{activity.title}</span>
      <span
        role="button"
        onClick={e => { e.stopPropagation(); onRemove() }}
        className="ml-1 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity flex-shrink-0"
      >
        <X size={11} />
      </span>
    </button>
  )
}

// ── Main Activities Panel ──────────────────────────────────────────────────────
export default function ActivityPanel() {
  const {
    activities, panelOpen, activeId,
    closePanel, remove, setActive,
  } = useActivityStore()

  const [width, setWidth] = useState(520)
  const [resizing, setResizing] = useState(false)

  const active = activities.find(a => a.id === activeId) ?? activities[0]

  if (!panelOpen || activities.length === 0) return null

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    setResizing(true)
    const startX = e.clientX
    const startW = width
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      setWidth(Math.max(320, Math.min(900, startW + delta)))
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className="fixed right-0 top-0 bottom-0 z-40 flex shadow-2xl"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className={cn(
          'w-1 bg-slate-700 hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors',
          resizing && 'bg-blue-400'
        )}
      />

      {/* Panel body */}
      <div className="flex-1 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 flex-shrink-0 bg-slate-900/80">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ActivityIcon size={13} />
            <span className="font-medium">Activities</span>
            <span className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full text-xs">
              {activities.length}
            </span>
          </div>
          <button
            onClick={closePanel}
            className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-800 flex-shrink-0 overflow-x-auto scrollbar-thin">
          {activities.map(a => (
            <ActivityTab
              key={a.id}
              activity={a}
              active={a.id === active?.id}
              onSelect={() => setActive(a.id)}
              onRemove={() => remove(a.id)}
            />
          ))}
        </div>

        {/* Active activity header */}
        {active && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              {typeIcon(active.type)}
              <div>
                <p className="text-sm text-white font-medium leading-none">{active.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{active.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => remove(active.id)}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                title="Close"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {active && <ActivityContent activity={active} />}
        </div>
      </div>
    </div>
  )
}

// ── Activity Panel Toggle Button (shown in header/layout) ─────────────────────
export function ActivityPanelToggle() {
  const { activities, panelOpen, togglePanel } = useActivityStore()
  if (activities.length === 0) return null

  return (
    <button
      onClick={togglePanel}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
        panelOpen
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      )}
      title="Toggle Activities Panel"
    >
      <ActivityIcon size={13} />
      <span>{activities.length} active</span>
    </button>
  )
}
