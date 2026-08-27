import type { SentenceRoleLabel } from '@/types'
import { cn } from '@/lib/utils'

const ROLE_STYLES: Record<SentenceRoleLabel, string> = {
  claim:
    'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-400/40',
  evidence:
    'bg-teal-200 text-teal-950 border-teal-500 dark:bg-teal-400/25 dark:text-teal-100 dark:border-teal-300/50',
  reasoning:
    'bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-500/20 dark:text-violet-200 dark:border-violet-400/40',
  elaboration:
    'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40',
  counterargument:
    'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/40',
  conclusion:
    'bg-indigo-100 text-indigo-950 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/40',
  irrelevant:
    'bg-orange-100 text-orange-950 border-orange-400 border-dashed dark:bg-orange-500/15 dark:text-orange-200 dark:border-orange-400/50',
}

const ROLE_HIGHLIGHT: Record<SentenceRoleLabel, string> = {
  claim: 'bg-blue-100 text-blue-950 dark:bg-blue-500/25 dark:text-blue-100',
  evidence: 'bg-teal-200 text-teal-950 dark:bg-teal-400/30 dark:text-teal-50',
  reasoning:
    'bg-violet-100 text-violet-950 dark:bg-violet-500/25 dark:text-violet-100',
  elaboration:
    'bg-amber-100 text-amber-950 dark:bg-amber-500/25 dark:text-amber-100',
  counterargument:
    'bg-rose-100 text-rose-950 dark:bg-rose-500/25 dark:text-rose-100',
  conclusion:
    'bg-indigo-100 text-indigo-950 dark:bg-indigo-500/25 dark:text-indigo-100',
  irrelevant:
    'bg-orange-100 text-orange-950 line-through decoration-orange-400/80 dark:bg-orange-500/20 dark:text-orange-100',
}

export const ROLE_LABELS: Record<SentenceRoleLabel, string> = {
  claim: 'Claim',
  evidence: 'Evidence',
  reasoning: 'Reasoning',
  elaboration: 'Elaboration',
  counterargument: 'Counterargument',
  conclusion: 'Conclusion',
  irrelevant: 'Irrelevant',
}

export const ALL_ROLES = Object.keys(ROLE_LABELS) as SentenceRoleLabel[]

interface RoleBadgeProps {
  role: SentenceRoleLabel
  className?: string
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        ROLE_STYLES[role],
        className,
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}

export function getRoleStyles(role: SentenceRoleLabel): string {
  return ROLE_STYLES[role]
}

export function getRoleHighlightStyles(role: SentenceRoleLabel): string {
  return ROLE_HIGHLIGHT[role]
}
