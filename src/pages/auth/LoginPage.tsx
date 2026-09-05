import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks'
import { loginSchema, type LoginFormValues } from '@/utils'
import { canAccessPath, homePathForRole } from '@/lib/roles'
import { ROUTES } from '@/routes/paths'
import { FormField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', role: 'student' },
    mode: 'onBlur',
  })

  const role = watch('role')

  const from =
    (location.state as { from?: Location } | null)?.from?.pathname ?? null

  const onSubmit = async (values: LoginFormValues) => {
    setError(null)
    try {
      const user = await login(values)
      const next =
        from && canAccessPath(user.role, from)
          ? from
          : homePathForRole(user.role)
      navigate(next, { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please check your credentials.',
      )
    }
  }

  return (
    <div className="flex min-h-[28rem] flex-col justify-center space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in as a student or instructor to continue.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <p className="text-sm font-medium">Sign in as</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={role === 'teacher' ? 'default' : 'outline'}
              className={cn(role === 'teacher' && 'bg-indigo-600 text-white hover:bg-indigo-500')}
              onClick={() => setValue('role', 'teacher', { shouldValidate: true })}
            >
              Instructor
            </Button>
            <Button
              type="button"
              variant={role === 'student' ? 'default' : 'outline'}
              className={cn(role === 'student' && 'bg-indigo-600 text-white hover:bg-indigo-500')}
              onClick={() => setValue('role', 'student', { shouldValidate: true })}
            >
              Student
            </Button>
          </div>
        </div>

        <FormField control={control} name="email" label="Email">
          {(field) => (
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              name={field.name}
              onChange={field.onChange}
              onBlur={field.onBlur}
              value={(field.value as string) ?? ''}
            />
          )}
        </FormField>

        <FormField control={control} name="password" label="Password">
          {(field) => (
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                className="pr-10"
                name={field.name}
                onChange={field.onChange}
                onBlur={field.onBlur}
                value={(field.value as string) ?? ''}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((open) => !open)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          )}
        </FormField>

        <Button
          type="submit"
          className="h-10 w-full bg-indigo-600 text-white hover:bg-indigo-500"
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link
          to={ROUTES.AUTH.REGISTER}
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  )
}
