import { Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { navbarLinks } from '@/routes/navigation'
import { ROUTES } from '@/routes/paths'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { Button } from '@/components/ui/button'

interface AppNavbarProps {
  variant?: 'marketing' | 'app'
  onMenuClick?: () => void
  className?: string
}

export function AppNavbar({
  variant = 'marketing',
  onMenuClick,
  className,
}: AppNavbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onMenuClick}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <Logo />
        </div>

        {variant === 'marketing' && (
          <nav className="hidden items-center gap-6 md:flex">
            {navbarLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.title}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {variant === 'marketing' ? (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link to={ROUTES.AUTH.LOGIN}>Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to={ROUTES.AUTH.REGISTER}>Get started</Link>
              </Button>
            </>
          ) : (
            <UserMenu />
          )}
        </div>
      </div>
    </header>
  )
}
