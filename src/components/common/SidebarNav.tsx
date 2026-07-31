import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { NavGroup } from '@/types'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SidebarNavProps {
  groups: NavGroup[]
  collapsed?: boolean
  onNavigate?: () => void
}

export function SidebarNav({
  groups,
  collapsed = false,
  onNavigate,
}: SidebarNavProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-6">
          {groups.map((group, groupIndex) => (
            <div key={group.label ?? groupIndex}>
              {group.label && !collapsed && (
                <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const link = (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-primary'
                            : 'text-sidebar-foreground/80',
                          item.disabled && 'pointer-events-none opacity-50',
                          collapsed && 'justify-center px-2',
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.title}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {item.badge}
                            </Badge>
                          )}
                        </>
                      )}
                    </NavLink>
                  )

                  if (collapsed) {
                    return (
                      <li key={item.href}>
                        <Tooltip>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right">{item.title}</TooltipContent>
                        </Tooltip>
                      </li>
                    )
                  }

                  return <li key={item.href}>{link}</li>
                })}
              </ul>
              {groupIndex < groups.length - 1 && !collapsed && (
                <Separator className="mt-4" />
              )}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </TooltipProvider>
  )
}
