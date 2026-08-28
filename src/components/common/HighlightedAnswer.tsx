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
  const present = new Set(sentences.map((s) => s.role))
  const legendRoles = showAllRoles
    ? ALL_ROLES
    : ALL_ROLES.filter((role) => present.has(role))

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap gap-2" aria-label="Role color legend">
        {legendRoles.map((role) => (
          <RoleBadge key={role} role={role} />
        ))}
      </div>
      <TooltipProvider delayDuration={150}>
        <p className="text-sm leading-loose">
          {sentences.map((sentence) => (
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
