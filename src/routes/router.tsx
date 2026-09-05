import { createBrowserRouter, Navigate } from 'react-router-dom'
import { GlobalLayout } from '@/layouts/GlobalLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { SidebarLayout } from '@/layouts/SidebarLayout'
import { NavbarLayout } from '@/layouts/NavbarLayout'
import { GuestRoute, HomeRedirect, ProtectedRoute, RoleRoute, TeacherRoute } from './guards'
import { ROUTES } from './paths'
import { LandingPage } from '@/pages/landing/LandingPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/app/DashboardPage'
import { AnalysisPage } from '@/pages/app/AnalysisPage'
import { ReasoningPage } from '@/pages/app/ReasoningPage'
import { ReportsPage } from '@/pages/app/ReportsPage'
import { ComparePage } from '@/pages/app/ComparePage'
import { SettingsPage } from '@/pages/app/SettingsPage'
import { QuestionsPage } from '@/pages/app/QuestionsPage'
import { AnnotationPage } from '@/pages/app/AnnotationPage'
import { BatchPage } from '@/pages/app/BatchPage'
import { EvaluationPage } from '@/pages/app/EvaluationPage'
import { UsersPage } from '@/pages/app/UsersPage'

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
            element: <RegisterPage />,
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
            element: <HomeRedirect />,
          },
          {
            path: 'dashboard',
            element: (
              <RoleRoute roles={['student', 'teacher', 'admin']}>
                <DashboardPage />
              </RoleRoute>
            ),
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
            element: (
              <TeacherRoute>
                <ReportsPage />
              </TeacherRoute>
            ),
          },
          {
            path: 'compare',
            element: (
              <TeacherRoute>
                <ComparePage />
              </TeacherRoute>
            ),
          },
          {
            path: 'batch',
            element: (
              <TeacherRoute>
                <BatchPage />
              </TeacherRoute>
            ),
          },
          {
            path: 'questions',
            element: (
              <TeacherRoute>
                <QuestionsPage />
              </TeacherRoute>
            ),
          },
          {
            path: 'annotation',
            element: (
              <TeacherRoute>
                <AnnotationPage />
              </TeacherRoute>
            ),
          },
          {
            path: 'evaluation',
            element: (
              <TeacherRoute>
                <EvaluationPage />
              </TeacherRoute>
            ),
          },
          {
            path: 'users',
            element: (
              <RoleRoute roles={['admin']}>
                <UsersPage />
              </RoleRoute>
            ),
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
