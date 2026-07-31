import type { BreadcrumbItem } from '@/types'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-b bg-background px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8',
        className,
      )}
    >
      <div className="space-y-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              {breadcrumbs.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-1">
                  {index > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {crumb.href ? (
                    <Link
                      to={crumb.href}
                      className="transition-colors hover:text-foreground"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-foreground">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
