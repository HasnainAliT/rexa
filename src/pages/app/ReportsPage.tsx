import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react'
import type { AnalysisResult } from '@/types'
import { analysisService, reportsService } from '@/services'
import { ROUTES } from '@/routes/paths'
import {
  EmptyState,
  LoadingSpinner,
  PageHeader,
  StarRating,
} from '@/components/common'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

const PAGE_SIZE = 10

export function ReportsPage() {
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    setError(null)

    analysisService
      .listAnalyses({ page, pageSize: PAGE_SIZE })
      .then((response) => {
        if (!mounted) return
        setAnalyses(response.data)
        setTotalPages(Math.max(1, response.totalPages))
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load reports.',
          )
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [page])

  const handleDownload = async (id: string, format: 'markdown' | 'pdf') => {
    setDownloadingId(`${id}-${format}`)
    try {
      if (format === 'markdown') {
        await reportsService.downloadMarkdown(id)
      } else {
        await reportsService.downloadPdf(id)
      }
    } catch {
      setError('Failed to download report. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Browse analysis history and export reports."
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <LoadingSpinner size="lg" label="Loading reports…" />
              </div>
            ) : analyses.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No reports yet"
                description="Run an analysis to generate your first report."
                className="border-0"
                action={
                  <Button asChild>
                    <Link to={ROUTES.APP.ANALYSIS}>Run analysis</Link>
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Stars</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analyses.map((analysis) => (
                    <TableRow key={analysis.id}>
                      <TableCell className="max-w-sm truncate font-medium">
                        <Link
                          to={`${ROUTES.APP.REASONING}?id=${analysis.id}`}
                          className="hover:underline"
                        >
                          {analysis.questionText}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StarRating value={analysis.stars} size="sm" />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(analysis.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={downloadingId === `${analysis.id}-markdown`}
                            onClick={() => handleDownload(analysis.id, 'markdown')}
                          >
                            <Download />
                            Markdown
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={downloadingId === `${analysis.id}-pdf`}
                            onClick={() => handleDownload(analysis.id, 'pdf')}
                          >
                            <Download />
                            PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {!isLoading && analyses.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
