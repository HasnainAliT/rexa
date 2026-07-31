import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Brain } from 'lucide-react'
import { Logo } from '@/components/common'
import { APP_FULL_NAME } from '@/routes/paths'

export function AuthLayout() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Logo className="text-primary-foreground [&_div:first-child]:bg-primary-foreground [&_div:first-child]:text-primary" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/10">
            <Brain className="h-7 w-7" />
          </div>
          <blockquote className="space-y-2">
            <p className="text-lg font-medium leading-relaxed">
              &ldquo;Transparent reasoning analysis that helps instructors
              understand, validate, and trust every score.&rdquo;
            </p>
            <footer className="text-sm text-primary-foreground/70">
              — {APP_FULL_NAME}
            </footer>
          </blockquote>
        </motion.div>

        <p className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} RExA. All rights reserved.
        </p>
      </div>

      <div className="flex flex-col">
        <div className="flex justify-center p-6 lg:hidden">
          <Logo />
        </div>

        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-1 items-center justify-center p-6 sm:p-10"
        >
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </motion.main>
      </div>
    </div>
  )
}
