import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppNavbar } from '@/components/common'

export function NavbarLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppNavbar variant="marketing" />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex-1"
      >
        <Outlet />
      </motion.main>

      <footer className="border-t py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
          © {new Date().getFullYear()} RExA — Explainable Reasoning Analysis of
          Descriptive Answers
          Analysis System
        </div>
      </footer>
    </div>
  )
}
