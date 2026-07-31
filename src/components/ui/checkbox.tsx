import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange'> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <label
        className={cn(
          'group relative inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-primary shadow',
          checked ? 'bg-primary' : 'bg-transparent',
          props.disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          {...props}
        />
        {checked && (
          <Check className="pointer-events-none h-3 w-3 text-primary-foreground" />
        )}
      </label>
    )
  },
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
