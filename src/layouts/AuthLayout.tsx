import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Logo } from '@/components/common'
import { APP_FULL_NAME } from '@/routes/paths'
import loginArt from '@/assets/rexa-login-panel.png'

export function AuthLayout() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-indigo-700 text-white lg:flex lg:flex-col">
        <img
          src={loginArt}
          alt="Instructor reviewing a color-coded student answer in RExA"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-indigo-950/55" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10">
          <Logo className="text-white [&_div:first-child]:bg-white [&_div:first-child]:text-indigo-700" />
          <motion.blockquote
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md space-y-2"
          >
            <p className="text-xl font-medium leading-relaxed">
              See claims, evidence, and gaps in every descriptive answer —
              surfaced through a transparent 1–5 star diagnostic indicator.
            </p>
            <footer className="text-sm text-white/80">{APP_FULL_NAME}</footer>
          </motion.blockquote>
          <p className="relative z-10 text-xs text-white/70">
            © {new Date().getFullYear()} RExA. All rights reserved.
          </p>
        </div>
      </div>

      <div className="flex flex-col bg-background">
        <div className="flex justify-center p-6 lg:hidden">
          <Logo />
        </div>
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-1 items-center justify-center p-6 sm:p-10"
        >
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </motion.main>
      </div>
    </div>
  )
}
