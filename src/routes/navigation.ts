import {
  BookOpen,
  Brain,
  GitCompare,
  LayoutDashboard,
  LineChart,
  PenLine,
} from 'lucide-react'
import type { NavGroup } from '@/types'
import { ROUTES } from './paths'

export const sidebarNavigation: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        href: ROUTES.APP.DASHBOARD,
        icon: LayoutDashboard,
      },
      {
        title: 'Evaluation',
        href: ROUTES.APP.EVALUATION,
        icon: LineChart,
      },
    ],
  },
  {
    label: 'Workspace',
    items: [
      {
        title: 'Questions',
        href: ROUTES.APP.QUESTIONS,
        icon: BookOpen,
      },
      {
        title: 'Analysis',
        href: ROUTES.APP.ANALYSIS,
        icon: PenLine,
      },
      {
        title: 'Compare',
        href: ROUTES.APP.COMPARE,
        icon: GitCompare,
      },
    ],
  },
  {
    label: 'Reasoning',
    items: [
      {
        title: 'Reasoning Engine',
        href: ROUTES.APP.REASONING,
        icon: Brain,
      },
    ],
  },
]

export const navbarLinks = [
  { title: 'Features', href: '#pillars' },
  { title: 'How it works', href: '#how-it-works' },
]
