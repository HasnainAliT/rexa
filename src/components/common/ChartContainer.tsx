import { ResponsiveContainer, type ResponsiveContainerProps } from 'recharts'
import { cn } from '@/lib/utils'

interface ChartContainerProps extends ResponsiveContainerProps {
  className?: string
  children: React.ReactElement
}

export function ChartContainer({
  className,
  children,
  ...props
}: ChartContainerProps) {
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height="100%" {...props}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}
