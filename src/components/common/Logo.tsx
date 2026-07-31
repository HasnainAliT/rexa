import { Link } from 'react-router-dom'
import { Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/routes/paths'

interface LogoProps {
  className?: string
  showText?: boolean
  collapsed?: boolean
}

export function Logo({ className, showText = true, collapsed = false }: LogoProps) {
  return (
    <Link
      to="/"
      className={cn(
        'flex items-center gap-2.5 font-semibold text-foreground transition-opacity hover:opacity-80',
        className,
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Brain className="h-4 w-4" />
      </div>
      {showText && !collapsed && (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-tight">{APP_NAME}</span>
          <span className="text-[10px] font-normal text-muted-foreground">
            Descriptive Answers
          </span>
        </div>
      )}
    </Link>
  )
}
