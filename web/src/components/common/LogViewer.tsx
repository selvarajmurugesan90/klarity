import { useEffect, useRef, useState } from 'react'
import { WSClient, logsWSUrl } from '@/lib/websocket'
import { Download, Search, X, ArrowDown, Filter } from 'lucide-react'
import { downloadText } from '@/lib/utils'
import { cn } from '@/lib/utils'

type Severity = 'all' | 'error' | 'warn' | 'info' | 'debug'

interface Props {
  namespace: string
  pod: string
  container?: string
  previous?: boolean
  timestamps?: boolean
}

// ── Line severity detection ────────────────────────────────────────────────────
function detectSeverity(line: string): Severity {
  const l = line.toLowerCase()
  if (/\b(error|err|fatal|critical|exception|panic|fail)\b/.test(l)) return 'error'
  if (/\b(warn|warning)\b/.test(l))  return 'warn'
  if (/\b(debug|trace|verbose)\b/.test(l)) return 'debug'
  return 'info'
}

function lineStyle(sev: Severity): string {
  switch (sev) {
    case 'error': return 'text-red-400'
    case 'warn':  return 'text-yellow-400'
    case 'debug': return 'text-slate-500'
    default:      return 'text-slate-300'
  }
}

const SEVERITY_LEVELS: { value: Severity; label: string; dot: string }[] = [
  { value: 'all',   label: 'All',   dot: 'bg-slate-400' },
  { value: 'error', label: 'Error', dot: 'bg-red-500'   },
  { value: 'warn',  label: 'Warn',  dot: 'bg-yellow-500'},
  { value: 'info',  label: 'Info',  dot: 'bg-blue-400'  },
  { value: 'debug', label: 'Debug', dot: 'bg-slate-600' },
]

export default function LogViewer({ namespace, pod, container, previous, timestamps }: Props) {
  const [lines, setLines]       = useState<string[]>([])
  const [filter, setFilter]     = useState('')
  const [severity, setSeverity] = useState<Severity>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [showSev, setShowSev]   = useState(false)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const wsRef       = useRef<WSClient | null>(null)

  useEffect(() => {
    setLines([])
    const url = logsWSUrl(namespace, pod, {
      container,
      previous:   previous   ? 'true' : undefined,
      timestamps: timestamps ? 'true' : undefined,
    })
    const ws = new WSClient(url, (data) => {
      setLines(prev => {
        const newLines = data.split('\n').filter(Boolean)
        const combined = [...prev, ...newLines]
        // Keep last 10 000 lines max
        return combined.length > 10_000
          ? combined.slice(combined.length - 10_000)
          : combined
      })
    })
    ws.connect()
    wsRef.current = ws
    return () => ws.close()
  }, [namespace, pod, container, previous, timestamps])

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, autoScroll])

  const visible = lines.filter(line => {
    if (severity !== 'all' && detectSeverity(line) !== severity) return false
    if (filter && !line.toLowerCase().includes(filter.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-lg overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0 flex-wrap">

        {/* Severity picker */}
        <div className="relative">
          <button
            onClick={() => setShowSev(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors',
              severity !== 'all'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            )}
          >
            <Filter size={11} />
            {SEVERITY_LEVELS.find(s => s.value === severity)?.label ?? 'All'}
          </button>
          {showSev && (
            <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 p-1 min-w-[110px]">
              {SEVERITY_LEVELS.map(lev => (
                <button
                  key={lev.value}
                  onClick={() => { setSeverity(lev.value); setShowSev(false) }}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-1.5 text-xs rounded-lg transition-colors',
                    severity === lev.value
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'text-slate-300 hover:bg-slate-700'
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', lev.dot)} />
                  {lev.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[140px]">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter logs…"
            className="w-full pl-7 pr-7 py-1.5 text-xs bg-slate-800 text-slate-200 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Stats */}
        <span className="text-xs text-slate-500 flex-shrink-0">
          {visible.length} / {lines.length}
        </span>

        {/* Auto-scroll */}
        <button
          onClick={() => setAutoScroll(v => !v)}
          className={cn(
            'flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border transition-colors flex-shrink-0',
            autoScroll
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
          )}
        >
          <ArrowDown size={11} />
          Auto
        </button>

        {/* Download */}
        <button
          onClick={() => downloadText(`${pod}-${container ?? 'logs'}.txt`, lines.join('\n'))}
          className="flex items-center gap-1 px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-400 rounded-lg hover:bg-slate-700 hover:text-slate-200 transition-colors flex-shrink-0"
        >
          <Download size={11} />
        </button>
      </div>

      {/* Log output */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin p-3 font-mono text-xs leading-5"
        onScroll={(e) => {
          const el = e.currentTarget
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
          setAutoScroll(atBottom)
        }}
      >
        {visible.length === 0 ? (
          <div className="text-slate-600 text-center mt-12">
            {lines.length === 0 ? 'Waiting for logs…' : 'No lines match the current filter'}
          </div>
        ) : (
          visible.map((line, i) => (
            <div
              key={i}
              className={cn('whitespace-pre-wrap break-all hover:bg-slate-900/50 px-1 rounded', lineStyle(detectSeverity(line)))}
            >
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
