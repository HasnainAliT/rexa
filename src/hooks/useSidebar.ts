import { useCallback, useState } from 'react'
import { useIsMobile } from './useMediaQuery'

export function useSidebar(defaultOpen = true) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const toggle = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen((prev) => !prev)
    } else {
      setIsOpen((prev) => !prev)
    }
  }, [isMobile])

  const close = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen(false)
    }
  }, [isMobile])

  const open = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen(true)
    } else {
      setIsOpen(true)
    }
  }, [isMobile])

  return {
    isOpen: isMobile ? isMobileOpen : isOpen,
    isCollapsed: !isMobile && !isOpen,
    isMobile,
    toggle,
    close,
    open,
    setIsOpen: isMobile ? setIsMobileOpen : setIsOpen,
  }
}
