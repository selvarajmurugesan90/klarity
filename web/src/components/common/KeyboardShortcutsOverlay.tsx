import { useEffect, useState } from 'react'
import { X, Keyboard } from 'lucide-react'
import { SHORTCUTS_HELP } from '@/hooks/useKeyboardShortcuts'


function KeyBadge({ k }: { k: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 bg-slate-700 border border-slate-600 rounded text-xs font-mono text-slate-200 shadow-sm">
      {k}
    </kbd>
  )
}

export default function KeyboardShortcutsOverlay() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(o => !o)
    const close = () => setOpen(false)
    window.addEventListener('kd:toggle-shortcuts', handler)
    window.addEventListener('kd:close-modal', close)
    return () => {
      window.removeEventListener('kd:toggle-shortcuts', handler)
      window.removeEventListener('kd:close-modal', close)
    }
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-blue-400" />
            <h2 className="font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {SHORTCUTS_HELP.map(group => (
            <div key={group.group}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                {group.group}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map(s => (
                  <div key={s.keys.join('+')} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{s.desc}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <KeyBadge k={k} />
                          {i < s.keys.length - 1 && (
                            <span className="text-slate-600 text-xs">then</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-5 text-center">
          <p className="text-xs text-slate-600">Press <KeyBadge k="?" /> to toggle · <KeyBadge k="Esc" /> to close</p>
        </div>
      </div>
    </div>
  )
}
