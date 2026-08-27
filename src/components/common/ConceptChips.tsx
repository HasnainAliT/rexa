import { Check, Minus } from 'lucide-react'
import type { ConceptCoverage } from '@/types'
import { cn } from '@/lib/utils'

interface ConceptChipsProps {
  concepts: ConceptCoverage[]
  className?: string
}

export function ConceptChips({ concepts, className }: ConceptChipsProps) {
  if (concepts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No key concepts were set for this question.
      </p>
    )
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {concepts.map((concept) => (
        <span
          key={concept.concept}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
            concept.covered
              ? 'border-indigo-300 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-500'
              : 'border-dashed border-orange-400 bg-orange-50 text-orange-950 dark:bg-orange-500/10 dark:text-orange-100',
          )}
        >
          {concept.covered ? (
            <Check className="h-3 w-3" aria-hidden />
          ) : (
            <Minus className="h-3 w-3" aria-hidden />
          )}
          <span>{concept.concept}</span>
          <span className="sr-only">
            {concept.covered ? 'covered' : 'missing'}
          </span>
        </span>
      ))}
    </div>
  )
}
