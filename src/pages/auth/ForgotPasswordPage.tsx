import { Link } from 'react-router-dom'
import { MailQuestion } from 'lucide-react'
import { ROUTES } from '@/routes/paths'
import { Button } from '@/components/ui/button'

export function ForgotPasswordPage() {
  return (
    <div className="space-y-6 text-center sm:text-left">
      <div className="flex justify-center sm:justify-start">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MailQuestion className="h-6 w-6 text-primary" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Forgot your password?
        </h1>
        <p className="text-sm text-muted-foreground">
          Contact your administrator to reset your password. Self-service
          password reset isn&apos;t available yet.
        </p>
      </div>

      <Button asChild className="w-full sm:w-auto">
        <Link to={ROUTES.AUTH.LOGIN}>Back to sign in</Link>
      </Button>
    </div>
  )
}
