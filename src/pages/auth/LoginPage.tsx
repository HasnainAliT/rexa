import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks'
import { loginSchema, type LoginFormValues } from '@/utils'
import { ROUTES } from '@/routes/paths'
import { FormField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const from =
    (location.state as { from?: Location } | null)?.from?.pathname ??
    ROUTES.APP.DASHBOARD

  const onSubmit = async (values: LoginFormValues) => {
    setError(null)
    try {
      await login(values)
      navigate(from, { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please check your credentials.',
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to continue to your RExA workspace.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={control} name="email" label="Email">
          {(field) => (
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              name={field.name}
              onChange={field.onChange}
              onBlur={field.onBlur}
              value={(field.value as string) ?? ''}
            />
          )}
        </FormField>

        <FormField control={control} name="password" label="Password">
          {(field) => (
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              name={field.name}
              onChange={field.onChange}
              onBlur={field.onBlur}
              value={(field.value as string) ?? ''}
            />
          )}
        </FormField>

        <div className="flex items-center justify-end">
          <Link
            to={ROUTES.AUTH.FORGOT_PASSWORD}
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          to={ROUTES.AUTH.REGISTER}
          className="font-medium text-primary hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  )
}
