import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  badge?: string
  disabled?: boolean
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export interface BreadcrumbItem {
  label: string
  href?: string
}
