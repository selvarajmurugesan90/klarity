import { cn } from '@/lib/utils'

interface Props {
  status: string
  className?: string
}

const variants: Record<string, string> = {
  Running: 'bg-green-100 text-green-700 border-green-200',
  Succeeded: 'bg-blue-100 text-blue-700 border-blue-200',
  Pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Failed: 'bg-red-100 text-red-700 border-red-200',
  Unknown: 'bg-gray-100 text-gray-600 border-gray-200',
  Active: 'bg-green-100 text-green-700 border-green-200',
  Terminating: 'bg-orange-100 text-orange-700 border-orange-200',
  Bound: 'bg-green-100 text-green-700 border-green-200',
  Available: 'bg-green-100 text-green-700 border-green-200',
  Released: 'bg-gray-100 text-gray-600 border-gray-200',
  Deployed: 'bg-green-100 text-green-700 border-green-200',
  Superseded: 'bg-gray-100 text-gray-600 border-gray-200',
  True: 'bg-green-100 text-green-700 border-green-200',
  False: 'bg-red-100 text-red-700 border-red-200',
  Ready: 'bg-green-100 text-green-700 border-green-200',
  NotReady: 'bg-red-100 text-red-700 border-red-200',
  Warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Normal: 'bg-gray-100 text-gray-600 border-gray-200',
  Complete: 'bg-blue-100 text-blue-700 border-blue-200',
}

export function StatusBadge({ status, className }: Props) {
  const variant = variants[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      variant, className
    )}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full mr-1.5',
        status === 'Running' || status === 'Active' || status === 'Bound' || status === 'Available' || status === 'Deployed' || status === 'Ready' || status === 'True'
          ? 'bg-green-500' : status === 'Pending' ? 'bg-yellow-500' : status === 'Failed' || status === 'False' || status === 'NotReady' ? 'bg-red-500' : 'bg-gray-400'
      )} />
      {status}
    </span>
  )
}

export function ConditionBadge({ condition }: { condition: boolean }) {
  return <StatusBadge status={condition ? 'True' : 'False'} />
}
