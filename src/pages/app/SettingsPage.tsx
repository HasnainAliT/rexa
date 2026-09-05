import { useEffect, useState } from 'react'
import { Cpu, Hash, Mail, Shield } from 'lucide-react'
import type { ModelVersion, Question } from '@/types'
import { modelsService, questionsService } from '@/services'
import { useAuth } from '@/hooks'
import { getInitials } from '@/utils'
import { isTeacherRole, roleLabel } from '@/lib/roles'
import {
  getReviewThresholds,
  saveReviewThresholds,
} from '@/lib/grading'
import { PageHeader } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/common'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

export function SettingsPage() {
  const { user } = useAuth()
  const isTeacher = isTeacherRole(user?.role)
  const [activeModel, setActiveModel] = useState<ModelVersion | null>(null)
  const [isLoadingModel, setIsLoadingModel] = useState(true)
  const [thresholds, setThresholds] = useState(() => getReviewThresholds())
  const [questions, setQuestions] = useState<Question[]>([])
  const [assignmentId, setAssignmentId] = useState('')

  const saveThresholds = (next: typeof thresholds) => {
    setThresholds(next)
    saveReviewThresholds(next, assignmentId || undefined)
  }

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

    questionsService
      .listQuestions({ pageSize: 100 })
      .then((response) => {
        if (mounted) setQuestions(response.data)
      })
      .catch(() => {
        if (mounted) setQuestions([])
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
              {user.rollNumber && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Hash className="h-3.5 w-3.5" />
                  Roll {user.rollNumber}
                </p>
              )}
              <Badge variant="secondary" className="capitalize">
                <Shield className="mr-1 h-3 w-3" />
                {roleLabel(user.role)}
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

        {isTeacher && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review thresholds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These flags decide when an answer is marked for a closer look.
              They do not change the star score — stars come from the answer
              itself (concept coverage, reasoning depth, roles, and support).
            </p>
            <div className="space-y-2">
              <Label htmlFor="assignmentThreshold">Assignment</Label>
              <Select
                id="assignmentThreshold"
                value={assignmentId}
                onChange={(event) => {
                  const id = event.target.value
                  setAssignmentId(id)
                  setThresholds(getReviewThresholds(id || undefined))
                }}
              >
                <option value="">Default (all assignments)</option>
                {questions.map((question) => (
                  <option key={question.id} value={question.id}>
                    {question.text}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="roleThreshold">Role coverage %</Label>
                <Input
                  id="roleThreshold"
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(thresholds.role * 100)}
                  onChange={(event) =>
                    saveThresholds({
                      ...thresholds,
                      role:
                        Math.min(100, Math.max(0, Number(event.target.value) || 0)) /
                        100,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conceptThreshold">Concept coverage %</Label>
                <Input
                  id="conceptThreshold"
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(thresholds.concept * 100)}
                  onChange={(event) =>
                    saveThresholds({
                      ...thresholds,
                      concept:
                        Math.min(100, Math.max(0, Number(event.target.value) || 0)) /
                        100,
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
        )}

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
