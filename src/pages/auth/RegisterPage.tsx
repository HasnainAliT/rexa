import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks'
import { registerSchema, type RegisterFormValues } from '@/utils'
import { ROUTES } from '@/routes/paths'
import { FormField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = async (values: RegisterFormValues) => {
    setError(null)
    try {
      await register(values)
      navigate(ROUTES.APP.DASHBOARD, { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create your account. Please try again.',
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Start evaluating descriptive answers with RExA.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={control} name="name" label="Full name">
          {(field) => (
            <Input
              id="name"
              type="text"
              placeholder="Jane Doe"
              autoComplete="name"
              name={field.name}
              onChange={field.onChange}
              onBlur={field.onBlur}
              value={(field.value as string) ?? ''}
            />
          )}
        </FormField>

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

        <FormField
          control={control}
          name="password"
          label="Password"
          description="At least 8 characters, one uppercase letter and one number."
        >
          {(field) => (
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              name={field.name}
              onChange={field.onChange}
              onBlur={field.onBlur}
              value={(field.value as string) ?? ''}
            />
          )}
        </FormField>

        <FormField
          control={control}
          name="confirmPassword"
          label="Confirm password"
        >
          {(field) => (
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              name={field.name}
              onChange={field.onChange}
              onBlur={field.onBlur}
              value={(field.value as string) ?? ''}
            />
          )}
        </FormField>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          to={ROUTES.AUTH.LOGIN}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
