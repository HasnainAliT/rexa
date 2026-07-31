import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a <Tabs> root')
  }
  return context
}

interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}

function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '')
  const activeValue = value ?? internalValue

  const setValue = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternalValue(next)
      onValueChange?.(next)
    },
    [value, onValueChange],
  )

  return (
    <TabsContext.Provider value={{ value: activeValue, setValue }}>
      <div className={cn('flex flex-col gap-2', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      'inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const { value: activeValue, setValue } = useTabsContext()
    const isActive = activeValue === value

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => setValue(value)}
        className={cn(
          'inline-flex h-7 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors',
          isActive
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
          className,
        )}
        {...props}
      />
    )
  },
)
TabsTrigger.displayName = 'TabsTrigger'

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { value: activeValue } = useTabsContext()
    if (activeValue !== value) return null

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn('outline-none', className)}
        {...props}
      />
    )
  },
)
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
