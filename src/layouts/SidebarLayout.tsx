import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSidebar } from '@/hooks'
import { AppNavbar, AppSidebar } from '@/components/common'
import { Sheet, SheetContent } from '@/components/ui/sheet'

export function SidebarLayout() {
  const { isOpen, isCollapsed, isMobile, toggle, close } = useSidebar()

  return (
    <div className="flex min-h-svh">
      {!isMobile && (
        <AppSidebar collapsed={isCollapsed} onToggle={toggle} />
      )}

      {isMobile && (
        <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
          <SheetContent side="left" className="w-64 p-0">
            <AppSidebar onNavigate={close} />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <AppNavbar variant="app" onMenuClick={isMobile ? toggle : undefined} />

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-y-auto"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  )
}
