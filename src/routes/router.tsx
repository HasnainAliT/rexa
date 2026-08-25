import { createBrowserRouter, Navigate } from 'react-router-dom'
import { GlobalLayout } from '@/layouts/GlobalLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { SidebarLayout } from '@/layouts/SidebarLayout'
import { NavbarLayout } from '@/layouts/NavbarLayout'
import { GuestRoute, ProtectedRoute } from './guards'
import { ROUTES } from './paths'
import { LandingPage } from '@/pages/landing/LandingPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/app/DashboardPage'
import { AnalysisPage } from '@/pages/app/AnalysisPage'
import { ReasoningPage } from '@/pages/app/ReasoningPage'
import { ReportsPage } from '@/pages/app/ReportsPage'
import { SettingsPage } from '@/pages/app/SettingsPage'
import { QuestionsPage } from '@/pages/app/QuestionsPage'
import { AnnotationPage } from '@/pages/app/AnnotationPage'
import { ComparePage } from '@/pages/app/ComparePage'
import { EvaluationPage } from '@/pages/app/EvaluationPage'

export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <GlobalLayout />,
    children: [
      {
        element: <NavbarLayout />,
        children: [
          {
            index: true,
            element: <LandingPage />,
          },
        ],
      },
      {
        path: 'auth',
        element: (
          <GuestRoute>
            <AuthLayout />
          </GuestRoute>
        ),
        children: [
          {
            index: true,
            element: <Navigate to={ROUTES.AUTH.LOGIN} replace />,
          },
          {
            path: 'login',
            element: <LoginPage />,
          },
          {
            path: 'register',
            element: <Navigate to={ROUTES.AUTH.LOGIN} replace />,
          },
          {
            path: 'forgot-password',
            element: <Navigate to={ROUTES.AUTH.LOGIN} replace />,
          },
        ],
      },
      {
        path: 'app',
        element: (
          <ProtectedRoute>
            <SidebarLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <Navigate to={ROUTES.APP.DASHBOARD} replace />,
          },
          {
            path: 'dashboard',
            element: <DashboardPage />,
          },
          {
            path: 'analysis',
            element: <AnalysisPage />,
          },
          {
            path: 'reasoning',
            element: <ReasoningPage />,
          },
          {
            path: 'reports',
            element: <ReportsPage />,
          },
          {
            path: 'questions',
            element: <QuestionsPage />,
          },
          {
            path: 'annotation',
            element: <AnnotationPage />,
          },
          {
            path: 'compare',
            element: <ComparePage />,
          },
          {
            path: 'evaluation',
            element: <EvaluationPage />,
          },
          {
            path: 'settings',
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to={ROUTES.HOME} replace />,
  },
])
