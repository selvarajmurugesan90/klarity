import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchApi } from '@/lib/api'
import { Search, Box, Globe, Server, Database, FileCode, Key, Layers, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAge } from '@/lib/utils'

const KIND_ICONS: Record<string, React.ReactNode> = {
  Pod: <Box size={14} className="text-green-400" />,
  Deployment: <Layers size={14} className="text-blue-400" />,
  Service: <Globe size={14} className="text-purple-400" />,
  Node: <Server size={14} className="text-orange-400" />,
  ConfigMap: <FileCode size={14} className="text-yellow-400" />,
  Secret: <Key size={14} className="text-red-400" />,
  StatefulSet: <Database size={14} className="text-cyan-400" />,
  Namespace: <Layers size={14} className="text-slate-400" />,
  default: <Box size={14} className="text-slate-400" />,
}

interface SearchResult {
  kind: string
  name: string
  namespace?: string
  age: string
  navPath: string
  apiVersion: string
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Open/close via keyboard event (Ctrl+K)
  useEffect(() => {
    const handler = () => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }
    const close = () => { setOpen(false); setQuery('') }
    window.addEventListener('kd:open-search', handler)
    window.addEventListener('kd:close-modal', close)
    return () => {
      window.removeEventListener('kd:open-search', handler)
      window.removeEventListener('kd:close-modal', close)
    }
  }, [])

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', query],
    queryFn: () => searchApi.search(query),
    enabled: query.length >= 2,
    staleTime: 5000,
  })

  const results = (data?.data as SearchResult[] | undefined) ?? []

  function navigate_to(path: string) {
    navigate(path)
    setOpen(false)
    setQuery('')
  }

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && results[selected]) {
      navigate_to(results[selected].navPath)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }, [results, selected])

  useEffect(() => { setSelected(0) }, [results.length])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center pt-[12vh]"
      onClick={() => { setOpen(false); setQuery('') }}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <Search size={18} className="text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search pods, deployments, services, configs..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm outline-none"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
          )}
          <kbd className="text-xs text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {query.length < 2 && (
            <div className="px-5 py-8 text-center text-slate-500 text-sm">
              Type at least 2 characters to search across all resources
            </div>
          )}

          {query.length >= 2 && isFetching && (
            <div className="px-5 py-6 text-center text-slate-500 text-sm">Searching...</div>
          )}

          {query.length >= 2 && !isFetching && results.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-500 text-sm">
              No resources found matching <span className="text-slate-300">"{query}"</span>
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {/* Group by kind */}
              {Array.from(new Set(results.map(r => r.kind))).map(kind => {
                const kindResults = results.filter(r => r.kind === kind)
                return (
                  <div key={kind}>
                    <div className="px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      {KIND_ICONS[kind] ?? KIND_ICONS.default}
                      {kind}
                    </div>
                    {kindResults.map((result, globalIdx) => {
                      const idx = results.indexOf(result)
                      return (
                        <button
                          key={`${result.kind}-${result.namespace}-${result.name}`}
                          onClick={() => navigate_to(result.navPath)}
                          className={cn(
                            'w-full flex items-center gap-4 px-5 py-2.5 text-left hover:bg-slate-800 transition-colors',
                            idx === selected && 'bg-slate-800'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{result.name}</p>
                            <p className="text-xs text-slate-500">
                              {result.namespace ? `${result.namespace} · ` : ''}{result.apiVersion}
                            </p>
                          </div>
                          <span className="text-xs text-slate-500 flex-shrink-0">{result.age}</span>
                          <ArrowRight size={14} className="text-slate-600 flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span><kbd className="border border-slate-700 rounded px-1">↑↓</kbd> navigate</span>
            <span><kbd className="border border-slate-700 rounded px-1">↵</kbd> open</span>
          </div>
          {results.length > 0 && (
            <span className="text-xs text-slate-500">{results.length} results</span>
          )}
        </div>
      </div>
    </div>
  )
}
