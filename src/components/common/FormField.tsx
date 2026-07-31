import {
  type Control,
  type FieldPath,
  type FieldValues,
  useFormState,
  Controller,
} from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

interface FormFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
  className?: string
  children: (field: {
    value: unknown
    onChange: (...event: unknown[]) => void
    onBlur: () => void
    name: string
    ref: React.Ref<HTMLElement>
  }) => React.ReactNode
}

export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  children,
}: FormFieldProps<T>) {
  const { errors } = useFormState({ control, name })
  const error = errors[name]
  const errorMessage = error?.message as string | undefined

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={cn('space-y-2', className)}>
          <Label htmlFor={name}>{label}</Label>
          {children(field)}
          {description && !errorMessage && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {errorMessage && (
            <p className="text-xs text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      )}
    />
  )
}
