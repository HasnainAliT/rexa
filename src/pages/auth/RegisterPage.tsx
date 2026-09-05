import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks'
import { registerSchema, type RegisterFormValues } from '@/utils'
import { homePathForRole } from '@/lib/roles'
import { ROUTES } from '@/routes/paths'
import { FormField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'student',
      rollNumber: '',
      institutionCode: '',
    },
  })

  const role = watch('role')

  const onSubmit = async (values: RegisterFormValues) => {
    setError(null)
    try {
      const user = await register(values)
      navigate(homePathForRole(user.role), { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create your account. Please try again.',
      )
    }
  }

  return (
    <div className="flex min-h-[28rem] flex-col justify-center space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Instructors grade answers. Students write, see the reasoning map, and
          revise.
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
          <p className="text-sm font-medium">I am a</p>
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
          {errors.role && (
            <p className="text-xs text-destructive" role="alert">
              {errors.role.message}
            </p>
          )}
        </div>

        <FormField control={control} name="name" label="Full name">
          {(field) => (
            <Input
              id="name"
              type="text"
              placeholder="Jane Doe"
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
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
              aria-invalid={Boolean(errors.email)}
              name={field.name}
              onChange={field.onChange}
              onBlur={field.onBlur}
              value={(field.value as string) ?? ''}
            />
          )}
        </FormField>

        {role === 'student' && (
          <FormField control={control} name="rollNumber" label="Roll number">
            {(field) => (
              <Input
                id="rollNumber"
                type="text"
                placeholder="CS-2022-041"
                autoComplete="off"
                aria-invalid={Boolean(errors.rollNumber)}
                name={field.name}
                onChange={field.onChange}
                onBlur={field.onBlur}
                value={(field.value as string) ?? ''}
              />
            )}
          </FormField>
        )}

        {role === 'teacher' && (
          <FormField
            control={control}
            name="institutionCode"
            label="Institution code"
            description="Ask your department for the instructor sign-up code."
          >
            {(field) => (
              <Input
                id="institutionCode"
                type="text"
                placeholder="Institution code"
                autoComplete="off"
                aria-invalid={Boolean(errors.institutionCode)}
                name={field.name}
                onChange={field.onChange}
                onBlur={field.onBlur}
                value={(field.value as string) ?? ''}
              />
            )}
          </FormField>
        )}

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
              aria-invalid={Boolean(errors.password)}
              name={field.name}
              onChange={field.onChange}
              onBlur={field.onBlur}
              value={(field.value as string) ?? ''}
            />
          )}
        </FormField>

        <FormField control={control} name="confirmPassword" label="Confirm password">
          {(field) => (
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              name={field.name}
              onChange={field.onChange}
              onBlur={field.onBlur}
              value={(field.value as string) ?? ''}
            />
          )}
        </FormField>

        <Button
          type="submit"
          className="h-10 w-full bg-indigo-600 text-white hover:bg-indigo-500"
          disabled={isSubmitting}
        >
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
