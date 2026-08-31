import {
  BookOpen,
  Brain,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  LineChart,
  PenLine,
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
        title: 'Batch upload',
        href: ROUTES.APP.BATCH,
        icon: FileSpreadsheet,
      },
      {
        title: 'Class report',
        href: ROUTES.APP.REPORTS,
        icon: ClipboardList,
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
    ],
  },
]

export const navbarLinks = [
  { title: 'Features', href: '#pillars' },
  { title: 'How it works', href: '#how-it-works' },
]
