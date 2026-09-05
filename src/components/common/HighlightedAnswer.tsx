import { useMemo, useState } from 'react'
import type { SentenceRole, SentenceRoleLabel } from '@/types'
import { sentenceWhy } from '@/lib/grading'
import { ALL_ROLES, RoleBadge, ROLE_LABELS, getRoleHighlightStyles } from './RoleBadge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface HighlightedAnswerProps {
  sentences: SentenceRole[]
  showAllRoles?: boolean
  className?: string
}

export function HighlightedAnswer({
  sentences,
  showAllRoles = true,
  className,
}: HighlightedAnswerProps) {
  const [activeRole, setActiveRole] = useState<SentenceRoleLabel | null>(null)
  const present = new Set(sentences.map((s) => s.role))
  const legendRoles = showAllRoles
    ? ALL_ROLES
    : ALL_ROLES.filter((role) => present.has(role))

  const counts = useMemo(() => {
    const next: Partial<Record<SentenceRoleLabel, number>> = {}
    for (const sentence of sentences) {
      next[sentence.role] = (next[sentence.role] ?? 0) + 1
    }
    return next
  }, [sentences])

  const visible = activeRole
    ? sentences.filter((sentence) => sentence.role === activeRole)
    : sentences

  const toggleRole = (role: SentenceRoleLabel) => {
    setActiveRole((current) => (current === role ? null : role))
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap gap-2" aria-label="Role color legend">
        {legendRoles.map((role) => {
          const selected = activeRole === role
          const count = counts[role] ?? 0
          return (
            <button
              key={role}
              type="button"
              onClick={() => toggleRole(role)}
              aria-pressed={selected}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-indigo-500',
                selected && 'ring-2 ring-indigo-500 ring-offset-2',
                !selected && activeRole && 'opacity-50 hover:opacity-100',
              )}
            >
              <RoleBadge role={role} />
              <span className="tabular-nums text-xs text-muted-foreground">
                {count}
              </span>
            </button>
          )
        })}
      </div>
      {activeRole && (
        <p className="text-sm text-muted-foreground">
          Showing {visible.length} {ROLE_LABELS[activeRole].toLowerCase()}{' '}
          {visible.length === 1 ? 'sentence' : 'sentences'}. Click the role
          again to show all.
        </p>
      )}
      <TooltipProvider delayDuration={150}>
        <p className="text-sm leading-loose">
          {visible.map((sentence) => (
            <Tooltip key={sentence.index}>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className={cn(
                    'mr-1 inline rounded px-1.5 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    getRoleHighlightStyles(sentence.role),
                  )}
                >
                  {sentence.text}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-foreground text-background">
                <p className="font-medium">{ROLE_LABELS[sentence.role]}</p>
                <p className="mt-1 opacity-90">{sentenceWhy(sentence)}</p>
                {typeof sentence.confidence === 'number' &&
                  sentence.confidence > 0 && (
                    <p className="mt-1 text-[11px] opacity-80">
                      Confidence {(sentence.confidence * 100).toFixed(0)}%
                    </p>
                  )}
              </TooltipContent>
            </Tooltip>
          ))}
          {visible.length === 0 && (
            <span className="text-muted-foreground">
              No sentences with this role in this answer.
            </span>
          )}
        </p>
      </TooltipProvider>
    </div>
  )
}

export function MissingRolesList({ missing }: { missing: SentenceRoleLabel[] }) {
  if (missing.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        All core reasoning roles are present.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Missing core roles (each missing role lowers role-structure score):
      </p>
      <div className="flex flex-wrap gap-2">
        {missing.map((role) => (
          <RoleBadge key={role} role={role} />
        ))}
      </div>
    </div>
  )
}
