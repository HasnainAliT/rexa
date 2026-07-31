import { useEffect, useState } from 'react'
import { CheckCircle2, Cpu, Loader2, Zap } from 'lucide-react'
import type { ModelVersion } from '@/types'
import { modelsService } from '@/services'
import { useAuth } from '@/hooks'
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatDate } from '@/utils'

export function ModelsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [models, setModels] = useState<ModelVersion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const loadModels = () => {
    setIsLoading(true)
    setError(null)
    modelsService
      .listModels()
      .then(setModels)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load models.')
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadModels()
  }, [])

  const handleActivate = async (id: string) => {
    setActivatingId(id)
    setError(null)
    try {
      await modelsService.activateModel(id)
      loadModels()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to activate model.',
      )
    } finally {
      setActivatingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Models"
        description="Manage heuristic and trained REXA model versions."
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isAdmin && (
          <Alert>
            <AlertDescription>
              You have read-only access to model versions. Contact an
              administrator to activate a different model.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" label="Loading models…" />
          </div>
        ) : models.length === 0 ? (
          <EmptyState
            icon={Cpu}
            title="No models available"
            description="Model versions will appear here once configured on the backend."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <Card key={model.id} className={model.isActive ? 'border-primary' : ''}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">{model.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      v{model.version}
                    </p>
                  </div>
                  {model.isActive && (
                    <Badge className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={model.mode === 'trained' ? 'default' : 'secondary'}>
                      {model.mode === 'trained' ? (
                        <>
                          <Zap className="mr-1 h-3 w-3" />
                          Trained
                        </>
                      ) : (
                        'Heuristic'
                      )}
                    </Badge>
                    {typeof model.accuracy === 'number' && (
                      <span className="text-sm text-muted-foreground">
                        {Math.round(model.accuracy * 100)}% accuracy
                      </span>
                    )}
                  </div>

                  {model.description && (
                    <p className="text-sm text-muted-foreground">
                      {model.description}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Released {formatDate(model.createdAt)}
                  </p>

                  {isAdmin && !model.isActive && (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={activatingId === model.id}
                      onClick={() => handleActivate(model.id)}
                    >
                      {activatingId === model.id && (
                        <Loader2 className="animate-spin" />
                      )}
                      Activate
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
