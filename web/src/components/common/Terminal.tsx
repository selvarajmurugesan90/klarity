import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { WSClient, execWSUrl } from '@/lib/websocket'
import { Loader2, Terminal as TermIcon, WifiOff, RefreshCw, AlertCircle, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

type ConnStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

interface Props {
  namespace: string
  pod: string
  container: string
  shell?: string
}

export default function Terminal({ namespace, pod, container, shell = 'sh' }: Props) {
  const termRef  = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const wsRef    = useRef<WSClient | null>(null)
  const fitRef   = useRef<FitAddon | null>(null)

  const [status, setStatus]     = useState<ConnStatus>('connecting')
  const [errMsg, setErrMsg]     = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (!termRef.current) return
    setStatus('connecting')
    setErrMsg(null)

    // ── Init xterm ────────────────────────────────────────────────────────
    const term = new XTerm({
      theme: {
        background:          '#111827',
        foreground:          '#d1d5db',
        cursor:              '#60a5fa',
        cursorAccent:        '#111827',
        selectionBackground: '#374151',
        black:    '#374151', brightBlack:   '#6b7280',
        red:      '#f87171', brightRed:     '#ef4444',
        green:    '#4ade80', brightGreen:   '#22c55e',
        yellow:   '#fbbf24', brightYellow:  '#f59e0b',
        blue:     '#60a5fa', brightBlue:    '#3b82f6',
        magenta:  '#c084fc', brightMagenta: '#a855f7',
        cyan:     '#22d3ee', brightCyan:    '#06b6d4',
        white:    '#e5e7eb', brightWhite:   '#f9fafb',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.open(termRef.current)
    fitAddon.fit()
    xtermRef.current = term
    fitRef.current   = fitAddon

    // Show connecting hint inside the terminal
    term.write('\x1b[90mConnecting to \x1b[36m' + pod + (container ? ':' + container : '') + '\x1b[90m…\x1b[0m')

    // ── WebSocket ─────────────────────────────────────────────────────────
    const url = execWSUrl(namespace, pod, container, shell)
    const ws  = new WSClient(url, (data) => {
      // Detect server-side error messages
      if (data.startsWith('ERROR:')) {
        const msg = data.replace(/^ERROR:\s*/, '')
        setErrMsg(msg)
        setStatus('error')
        return
      }
      term.write(data)
    }, {
      onOpen: () => {
        setStatus('connected')
        setErrMsg(null)
        // Clear the "connecting…" line
        term.write('\r\x1b[2K')
        fitAddon.fit()
        ws.sendResize(term.cols, term.rows)
      },
      onClose: () => {
        setStatus(prev => (prev === 'error' ? 'error' : 'reconnecting'))
        setAttempts(a => a + 1)
      },
      onError: () => {
        setStatus('error')
        setErrMsg('WebSocket connection failed. Check that the pod is running and the dashboard has exec permissions.')
      },
    })
    ws.connect()
    wsRef.current = ws
    term.onData(d => ws.send(d))

    // ── Resize observer ───────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      try { fitAddon.fit(); ws.sendResize(term.cols, term.rows) } catch {}
    })
    ro.observe(termRef.current)

    return () => { ro.disconnect(); term.dispose(); ws.close() }
  }, [namespace, pod, container, shell])

  // ── Manual retry ─────────────────────────────────────────────────────────
  function handleRetry() {
    setStatus('connecting')
    setErrMsg(null)
    setAttempts(0)
    wsRef.current?.close()
    if (xtermRef.current) {
      xtermRef.current.clear()
      xtermRef.current.write('\x1b[90mReconnecting…\x1b[0m')
    }
    const url = execWSUrl(namespace, pod, container, shell)
    const ws  = new WSClient(url, (data) => { xtermRef.current?.write(data) }, {
      onOpen: () => {
        setStatus('connected')
        setErrMsg(null)
        xtermRef.current?.write('\r\x1b[2K')
        fitRef.current?.fit()
        ws.sendResize(xtermRef.current?.cols ?? 80, xtermRef.current?.rows ?? 24)
      },
      onClose: () => setStatus('reconnecting'),
      onError: () => { setStatus('error'); setErrMsg('Connection failed.') },
    })
    ws.connect()
    wsRef.current = ws
    if (xtermRef.current) xtermRef.current.onData(d => ws.send(d))
  }

  // ── Status config ─────────────────────────────────────────────────────────
  const badge: Record<ConnStatus, { icon: React.ReactNode; label: string; cls: string }> = {
    connecting:   { icon: <Loader2 size={11} className="animate-spin" />, label: 'Connecting…',            cls: 'text-blue-400 bg-blue-950/80 border-blue-800'    },
    connected:    { icon: <Wifi size={11} />,                              label: 'Connected',                   cls: 'text-green-400 bg-green-950/80 border-green-800'  },
    disconnected: { icon: <WifiOff size={11} />,                           label: 'Disconnected',                cls: 'text-gray-400 bg-gray-900 border-gray-700'       },
    reconnecting: { icon: <RefreshCw size={11} className="animate-spin" />,label: 'Reconnecting (' + attempts + ')…', cls: 'text-yellow-400 bg-yellow-950/80 border-yellow-800' },
    error:        { icon: <AlertCircle size={11} />,                       label: 'Error',                       cls: 'text-red-400 bg-red-950/80 border-red-800'       },
  }
  const b = badge[status]

  return (
    <div className="flex flex-col h-full bg-[#111827] rounded-xl overflow-hidden border border-gray-700">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TermIcon size={13} className="text-gray-500" />
          <span className="text-xs font-mono text-gray-400">
            {pod}{container ? ':' + container : ''}
          </span>
          <span className="text-xs text-gray-700">({shell})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border', b.cls)}>
            {b.icon} {b.label}
          </span>
          {(status === 'error' || status === 'disconnected') && (
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 px-2 py-1 text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
            >
              <RefreshCw size={10} /> Retry
            </button>
          )}
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative overflow-hidden">

        {/* Connecting overlay */}
        {status === 'connecting' && (
          <div className="absolute inset-0 bg-[#111827]/80 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
            <div className="flex items-center gap-3 bg-gray-900/80 px-5 py-3.5 rounded-2xl border border-gray-700 shadow-xl">
              <Loader2 size={18} className="text-blue-400 animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Connecting to container…</p>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{namespace}/{pod}{container ? ':'+container : ''}</p>
              </div>
            </div>
          </div>
        )}

        {/* Reconnecting banner */}
        {status === 'reconnecting' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 bg-yellow-950/90 border border-yellow-800 rounded-xl text-xs text-yellow-300 shadow-xl backdrop-blur-sm">
            <RefreshCw size={11} className="animate-spin flex-shrink-0" />
            <span>Session lost — reconnecting (attempt {attempts})…</span>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div className="absolute inset-0 bg-[#111827]/95 flex flex-col items-center justify-center gap-5 z-10 p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle size={26} className="text-red-400" />
            </div>
            <div>
              <p className="text-base font-bold text-red-300 mb-2">Terminal unavailable</p>
              <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
                {errMsg ?? 'Could not establish a terminal session with this container.'}
              </p>
            </div>
            <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-4 text-left max-w-sm w-full">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Common causes</p>
              <ul className="space-y-1.5 text-xs text-gray-500">
                {[
                  'Pod is not in Running phase (check pod status)',
                  'Image has no shell — distroless or scratch containers',
                  'RBAC: missing pods/exec permission',
                  'Container already exited or restarting',
                ].map(r => (
                  <li key={r} className="flex items-start gap-1.5">
                    <span className="text-gray-700 flex-shrink-0 mt-0.5">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-sm font-medium border border-gray-700 transition-colors shadow-lg"
            >
              <RefreshCw size={14} /> Retry Connection
            </button>
          </div>
        )}

        {/* xterm canvas — always mounted so it doesn't re-init */}
        <div ref={termRef} className="h-full p-1" />
      </div>
    </div>
  )
}
