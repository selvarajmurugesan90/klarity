import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { Copy, Download, Check, Loader2, FileCode } from 'lucide-react'
import { copyToClipboard, downloadText } from '@/lib/utils'

interface Props {
  yaml: string
  filename?: string
  readOnly?: boolean
  loading?: boolean   // show skeleton while YAML is being fetched
  error?: string      // show error message if fetch failed
}

export default function YamlEditor({
  yaml,
  filename = 'resource.yaml',
  loading = false,
  error,
}: Props) {
  const [value, setValue] = useState(yaml)
  const [copied, setCopied] = useState(false)

  // Sync prop → state whenever yaml changes (e.g. after async fetch resolves)
  useEffect(() => {
    if (yaml) setValue(yaml)
  }, [yaml])

  function handleCopy() {
    copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full border border-gray-700 rounded-xl overflow-hidden bg-[#1e1e1e]">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileCode size={13} className="text-gray-500" />
          <span className="text-xs text-gray-400 font-mono">{filename}</span>
          {loading && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <Loader2 size={11} className="animate-spin" />
              Loading…
            </span>
          )}
          {!loading && value && (
            <span className="text-xs text-gray-600">
              {value.split('\n').length} lines
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={loading || !value}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={() => downloadText(filename, value)}
            disabled={loading || !value}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={11} /> Download
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">

        {/* Loading skeleton */}
        {loading && (
          <div className="absolute inset-0 bg-[#1e1e1e] flex flex-col p-5 gap-2 z-10">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 size={16} className="text-blue-400 animate-spin flex-shrink-0" />
              <span className="text-sm text-gray-400">Loading YAML…</span>
            </div>
            {/* Animated skeleton lines mimicking YAML structure */}
            {[80, 55, 70, 45, 65, 30, 75, 50, 40, 68, 35, 60].map((w, i) => (
              <div
                key={i}
                className="h-3.5 rounded animate-pulse bg-gray-800"
                style={{
                  width: `${w}%`,
                  marginLeft: i > 1 && i < 5 ? '24px' : i > 5 && i < 8 ? '48px' : i > 8 ? '24px' : '0',
                  animationDelay: `${i * 80}ms`,
                  opacity: 0.4 + (i % 3) * 0.15,
                }}
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="absolute inset-0 bg-[#1e1e1e] flex flex-col items-center justify-center gap-3 text-center p-8 z-10">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <FileCode size={18} className="text-red-400" />
            </div>
            <p className="text-sm font-medium text-red-400">Failed to load YAML</p>
            <p className="text-xs text-gray-500 max-w-xs">{error}</p>
          </div>
        )}

        {/* Empty state — data fetched but came back empty */}
        {!loading && !error && !value && (
          <div className="absolute inset-0 bg-[#1e1e1e] flex flex-col items-center justify-center gap-2 text-center z-10">
            <FileCode size={32} className="text-gray-700" />
            <p className="text-sm text-gray-500">No YAML content available</p>
          </div>
        )}

        {/* Monaco Editor — always mounted so it doesn't flicker on load */}
        <div className={loading || error || !value ? 'invisible absolute inset-0' : 'h-full'}>
          <Editor
            height="100%"
            language="yaml"
            value={value}
            onChange={v => setValue(v ?? '')}
            theme="vs-dark"
            loading={
              <div className="flex items-center justify-center h-full bg-[#1e1e1e] gap-2 text-gray-500 text-sm">
                <Loader2 size={14} className="animate-spin text-blue-400" />
                Initializing editor…
              </div>
            }
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
              renderWhitespace: 'boundary',
              scrollbar: { vertical: 'visible', horizontal: 'visible' },
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>
      </div>
    </div>
  )
}
