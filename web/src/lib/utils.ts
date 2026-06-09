import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAge(timestamp: string | undefined): string {
  if (!timestamp) return '-'
  const diff = Date.now() - new Date(timestamp).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(mo / 12)}y`
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'Ki', 'Mi', 'Gi', 'Ti']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatCPU(milliCPU: string | undefined): string {
  if (!milliCPU) return '-'
  if (milliCPU.endsWith('m')) return milliCPU
  const n = parseFloat(milliCPU)
  if (n < 1) return `${Math.round(n * 1000)}m`
  return `${n}`
}

export function parseCPUMillis(cpu: string): number {
  if (!cpu) return 0
  if (cpu.endsWith('m')) return parseInt(cpu)
  return parseFloat(cpu) * 1000
}

export function parseMemoryBytes(mem: string): number {
  if (!mem) return 0
  const units: Record<string, number> = {
    Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4,
    K: 1000, M: 1000 ** 2, G: 1000 ** 3, T: 1000 ** 4,
  }
  for (const [unit, mul] of Object.entries(units)) {
    if (mem.endsWith(unit)) return parseFloat(mem) * mul
  }
  return parseInt(mem)
}

export function podPhaseColor(phase: string): string {
  switch (phase) {
    case 'Running': return 'text-green-500'
    case 'Pending': return 'text-yellow-500'
    case 'Succeeded': return 'text-blue-500'
    case 'Failed': return 'text-red-500'
    default: return 'text-gray-400'
  }
}

export function podPhaseBadge(phase: string): string {
  switch (phase) {
    case 'Running': return 'bg-green-500/10 text-green-400 border-green-500/20'
    case 'Pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    case 'Succeeded': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'Failed': return 'bg-red-500/10 text-red-400 border-red-500/20'
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }
}

export function nodeConditionReady(conditions: Array<{ type: string; status: string }>): boolean {
  return conditions?.some(c => c.type === 'Ready' && c.status === 'True') ?? false
}

export function truncate(s: string, max = 40): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

export function joinLabels(labels: Record<string, string> | undefined): string {
  if (!labels) return ''
  return Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(', ')
}

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
