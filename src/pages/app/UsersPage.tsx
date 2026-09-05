import { useEffect, useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import type { ManagedUser, UserRole } from '@/types'
import { usersService } from '@/services/users.service'
import { useAuth } from '@/hooks'
import { roleLabel } from '@/lib/roles'
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/utils'

const ROLE_OPTIONS: UserRole[] = ['student', 'teacher', 'admin']

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = () => {
    setIsLoading(true)
    usersService
      .listUsers({ pageSize: 100 })
      .then((page) => {
        setUsers(page.data)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load users.')
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const onRoleChange = async (target: ManagedUser, role: UserRole) => {
    if (role === target.role) return
    const confirmed = window.confirm(
      `Change ${target.name}'s role from ${roleLabel(target.role)} to ${roleLabel(role)}?`,
    )
    if (!confirmed) return
    setSavingId(target.id)
    setError(null)
    try {
      const updated = await usersService.updateRole(target.id, role)
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update role.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Change account roles. You cannot change your own role or demote the last admin."
      />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner label="Loading users…" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users"
            description="Accounts will appear here after people sign up."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roll number</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((person) => {
                    const isSelf = person.id === currentUser?.id
                    return (
                      <TableRow key={person.id}>
                        <TableCell className="font-medium">{person.name}</TableCell>
                        <TableCell>{person.email}</TableCell>
                        <TableCell>{person.rollNumber || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(person.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={person.role}
                              disabled={isSelf || savingId === person.id}
                              onChange={(event) =>
                                onRoleChange(person, event.target.value as UserRole)
                              }
                              aria-label={`Role for ${person.name}`}
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {roleLabel(role)}
                                </option>
                              ))}
                            </Select>
                            {savingId === person.id && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            {isSelf && (
                              <span className="text-xs text-muted-foreground">You</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          Refresh
        </Button>
      </div>
    </div>
  )
}
