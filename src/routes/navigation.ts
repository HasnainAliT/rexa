import {
  BarChart3,
  BookOpen,
  Brain,
  FileText,
  GitCompare,
  LayoutDashboard,
  LineChart,
  Settings,
  Tags,
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
        title: 'Analysis',
        href: ROUTES.APP.ANALYSIS,
        icon: BarChart3,
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
      {
        title: 'Annotation Lab',
        href: ROUTES.APP.ANNOTATION,
        icon: Tags,
      },
      {
        title: 'Reports',
        href: ROUTES.APP.REPORTS,
        icon: FileText,
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        title: 'Settings',
        href: ROUTES.APP.SETTINGS,
        icon: Settings,
      },
    ],
  },
]

export const navbarLinks = [
  { title: 'Features', href: '#pillars' },
  { title: 'How it works', href: '#how-it-works' },
]
