import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sidebarNavigation } from '@/routes/navigation'
import { Logo } from './Logo'
import { SidebarNav } from './SidebarNav'
import { Button } from '@/components/ui/button'

interface AppSidebarProps {
  collapsed?: boolean
  onToggle?: () => void
  onNavigate?: () => void
  className?: string
}

export function AppSidebar({
  collapsed = false,
  onToggle,
  onNavigate,
  className,
}: AppSidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300',
        collapsed ? 'w-[68px]' : 'w-64',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b border-sidebar-border px-4',
          collapsed ? 'justify-center px-2' : 'justify-between',
        )}
      >
        <Logo collapsed={collapsed} showText={!collapsed} />
        {onToggle && !collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggle}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {collapsed && onToggle && (
        <div className="flex justify-center border-b border-sidebar-border py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggle}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>
      )}

      <SidebarNav
        groups={sidebarNavigation}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
    </aside>
  )
}
