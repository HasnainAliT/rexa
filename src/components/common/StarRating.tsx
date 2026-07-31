import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
}

export function StarRating({
  value,
  max = 5,
  size = 'md',
  className,
}: StarRatingProps) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {Array.from({ length: max }, (_, index) => {
        const filled = index < Math.round(value)
        return (
          <Star
            key={index}
            className={cn(
              sizeClasses[size],
              filled
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-muted-foreground/30',
            )}
          />
        )
      })}
    </div>
  )
}
