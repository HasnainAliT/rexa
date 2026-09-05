import type {
  ApiResponse,
  BatchAnalyzeRequest,
  BatchAnalyzeResult,
  DimensionScore,
} from '@/types'
import { apiClient } from './api'

function dimensionsFromScores(
  scores: Record<string, number> | undefined,
): DimensionScore[] {
  if (!scores) return []
  const labels: Record<string, string> = {
    concept_coverage: 'Concept coverage',
    reasoning_depth: 'Reasoning depth',
    support_quality: 'Support quality',
    role_structure: 'Role structure',
  }
  return Object.entries(scores).map(([key, score]) => ({
    key,
    label: labels[key] ?? key,
    score,
  }))
}

export const batchService = {
  async runBatch(payload: BatchAnalyzeRequest): Promise<BatchAnalyzeResult> {
    const response = await apiClient.post<
      ApiResponse<
        Array<{
          analysis_id?: string
          result?: {
            stars?: number
            student_answer?: string
            dimension_scores?: Record<string, number>
            question_text?: string
          }
        }>
      >
    >('/batch/analyze', {
      question_id: payload.questionId ?? null,
      question_text: payload.questionText,
      reference_answer: payload.referenceAnswer ?? '',
      concepts: payload.concepts ?? [],
      answers: payload.studentAnswers.map((studentAnswer) => ({
        student_answer: studentAnswer,
      })),
      save: true,
    })

    const items = (response.data ?? []).map((item, index) => ({
      index,
      studentAnswer:
        item.result?.student_answer ?? payload.studentAnswers[index] ?? '',
      analysisId: item.analysis_id ?? `batch-${index}`,
      stars: item.result?.stars ?? 0,
      dimensions: dimensionsFromScores(item.result?.dimension_scores),
    }))

    return {
      id: crypto.randomUUID(),
      questionText: payload.questionText,
      items,
      createdAt: new Date().toISOString(),
    }
  },

  async parseUpload(file: File): Promise<{
    filename: string
    columns: string[]
    rows: Record<string, string>[]
    row_count: number
  }> {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.postForm<
      ApiResponse<{
        filename: string
        columns: string[]
        rows: Record<string, string>[]
        row_count: number
      }>
    >('/batch/parse-upload', form)
    if (!response.data?.rows?.length) {
      throw new Error('No data rows found in this file.')
    }
    return response.data
  },
}
