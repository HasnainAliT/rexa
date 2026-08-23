import { useEffect, useState } from 'react'
import { Cpu, Mail, Shield } from 'lucide-react'
import type { ModelVersion } from '@/types'
import { modelsService } from '@/services'
import { useAuth } from '@/hooks'
import { getInitials } from '@/utils'
import { PageHeader } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/common'

export function SettingsPage() {
  const { user } = useAuth()
  const [activeModel, setActiveModel] = useState<ModelVersion | null>(null)
  const [isLoadingModel, setIsLoadingModel] = useState(true)

  useEffect(() => {
    let mounted = true

    modelsService
      .listModels()
      .then((models) => {
        if (mounted) setActiveModel(models.find((m) => m.isActive) ?? null)
      })
      .catch(() => {
        if (mounted) setActiveModel(null)
      })
      .finally(() => {
        if (mounted) setIsLoadingModel(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  if (!user) return null

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your profile, appearance, and model preferences."
      />

      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback className="text-lg">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="text-lg font-semibold">{user.name}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </p>
              <Badge variant="secondary" className="capitalize">
                <Shield className="mr-1 h-3 w-3" />
                {user.role}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">
                Choose how RExA looks on this device.
              </p>
            </div>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Model</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingModel ? (
              <p className="text-sm text-muted-foreground">
                Loading model status…
              </p>
            ) : activeModel ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Cpu className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {activeModel.name}{' '}
                      <span className="text-muted-foreground">
                        v{activeModel.version}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activeModel.mode === 'trained'
                        ? 'Trained model — learns from annotated data'
                        : 'Heuristic model — rule-based reasoning engine'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active model configured yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
