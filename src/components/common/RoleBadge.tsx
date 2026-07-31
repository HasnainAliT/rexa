import type { SentenceRoleLabel } from '@/types'
import { cn } from '@/lib/utils'

const ROLE_STYLES: Record<SentenceRoleLabel, string> = {
  claim: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  evidence:
    'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  reasoning:
    'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400',
  elaboration:
    'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  counterargument:
    'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400',
  conclusion:
    'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400',
  irrelevant:
    'bg-muted text-muted-foreground border-border',
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
