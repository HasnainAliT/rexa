import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes'
import { TooltipProvider } from '@/components/ui/tooltip'

function App() {
  return (
    <TooltipProvider delayDuration={150}>
      <RouterProvider router={router} />
    </TooltipProvider>
  )
}

export default App
