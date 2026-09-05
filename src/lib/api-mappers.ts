/**
 * Maps backend (snake_case / RexaResult) payloads to frontend domain types.
 */
import type {
  AnalysisResult,
  ConceptCoverage,
  DashboardData,
  DimensionScore,
  Explanation,
  ModelVersion,
  Question,
  QuestionInput,
  ReasoningDepth,
  SentenceRole,
  SentenceRoleLabel,
  SupportPair,
  SupportRelation,
} from '@/types'

const ROLE_MAP: Record<string, SentenceRoleLabel> = {
  claim: 'claim',
  evidence: 'evidence',
  explanation: 'reasoning',
  reasoning: 'reasoning',
  elaboration: 'elaboration',
  counterargument: 'counterargument',
  conclusion: 'conclusion',
  other: 'irrelevant',
  irrelevant: 'irrelevant',
}

const RELATION_MAP: Record<string, SupportRelation> = {
  supports: 'support',
  support: 'support',
  contradicts: 'contradiction',
  contradiction: 'contradiction',
  neutral: 'neutral',
}

export function mapRole(role: string): SentenceRoleLabel {
  return ROLE_MAP[String(role ?? '').trim().toLowerCase()] ?? 'irrelevant'
}

function mapRelation(relation: string): SupportRelation {
  return RELATION_MAP[relation.toLowerCase()] ?? 'neutral'
}

function depthFromScore(score: number): ReasoningDepth {
  if (score >= 0.75) {
    return {
      level: 4,
      label: 'Deep reasoning',
      description: 'Clear claim–evidence–explanation chains with strong depth.',
    }
  }
  if (score >= 0.5) {
    return {
      level: 3,
      label: 'Solid reasoning',
      description: 'Multiple reasoning elements present with moderate depth.',
    }
  }
  if (score >= 0.25) {
    return {
      level: 2,
      label: 'Developing reasoning',
      description: 'Some structure, but limited explanation or support.',
    }
  }
  return {
    level: 1,
    label: 'Shallow reasoning',
    description: 'Little evidence of structured argumentation.',
  }
}

function mapDimensions(scores: Record<string, number> | undefined): DimensionScore[] {
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
    score: typeof score === 'number' ? score : 0,
  }))
}

function mapConceptCoverage(raw: unknown): ConceptCoverage[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as {
    covered?: string[]
    missing?: string[]
  }
  const covered = (obj.covered ?? []).map((concept) => ({
    concept,
    covered: true,
  }))
  const missing = (obj.missing ?? []).map((concept) => ({
    concept,
    covered: false,
  }))
  return [...covered, ...missing]
}

function mapSentenceRoles(highlights: unknown[]): SentenceRole[] {
  return (highlights ?? []).map((item, index) => {
    const h = item as {
      index?: number
      text?: string
      role?: string
      confidence?: number
      reason?: string
    }
    return {
      index: h.index ?? index,
      text: h.text ?? '',
      role: mapRole(h.role ?? 'Other'),
      confidence: h.confidence ?? 0.8,
      reason: h.reason,
    }
  })
}

function mapSupportPairs(pairs: unknown[]): SupportPair[] {
  return (pairs ?? []).map((item) => {
    const p = item as {
      source_index?: number
      target_index?: number
      source_text?: string
      target_text?: string
      relation?: string
      studentSentenceIndex?: number
      referenceSentenceIndex?: number
      studentText?: string
      referenceText?: string
      confidence?: number
    }
    return {
      studentSentenceIndex: p.source_index ?? p.studentSentenceIndex ?? 0,
      referenceSentenceIndex: p.target_index ?? p.referenceSentenceIndex ?? 0,
      studentText: p.source_text ?? p.studentText ?? '',
      referenceText: p.target_text ?? p.referenceText ?? '',
      relation: mapRelation(p.relation ?? 'Neutral'),
      confidence: p.confidence ?? 0.75,
    }
  })
}

function mapExplanations(items: unknown[]): Explanation[] {
  return (items ?? []).map((item, index) => {
    const e = item as {
      type?: string
      message?: string
      id?: string
      category?: string
    }
    return {
      id: e.id ?? `exp-${index}`,
      message: e.message ?? '',
      category: e.category ?? e.type,
    }
  })
}

type BackendRexaResult = {
  stars?: number
  dimension_scores?: Record<string, number>
  concept_coverage?: unknown
  highlights?: unknown[]
  support_pairs?: unknown[]
  reasoning_depth?: number
  explanations?: unknown[]
  model_version?: string
  question_text?: string
  reference_answer?: string
  student_answer?: string
}

export function mapRexaResultToAnalysis(
  result: BackendRexaResult,
  meta: {
    id?: string | null
    questionId?: string | null
    createdAt?: string
    studentName?: string | null
    studentId?: string | null
  } = {},
): AnalysisResult {
  const depthScore =
    typeof result.reasoning_depth === 'number' ? result.reasoning_depth : 0

  return {
    id: meta.id ?? crypto.randomUUID(),
    questionId: meta.questionId ?? undefined,
    questionText: result.question_text ?? '',
    referenceAnswer: result.reference_answer ?? '',
    studentAnswer: result.student_answer ?? '',
    studentName: meta.studentName ?? undefined,
    studentId: meta.studentId ?? undefined,
    stars: result.stars ?? 0,
    dimensions: mapDimensions(result.dimension_scores),
    sentenceRoles: mapSentenceRoles(result.highlights ?? []),
    conceptCoverage: mapConceptCoverage(result.concept_coverage),
    supportPairs: mapSupportPairs(result.support_pairs ?? []),
    reasoningDepth: depthFromScore(depthScore),
    explanations: mapExplanations(result.explanations ?? []),
    createdAt: meta.createdAt ?? new Date().toISOString(),
    modelVersion: result.model_version,
  }
}

export function mapAnalyzeResponse(raw: unknown): AnalysisResult {
  const data = raw as {
    analysis_id?: string | null
    question_id?: string | null
    student_name?: string | null
    student_id?: string | null
    result?: BackendRexaResult
    // already flat AnalysisResult?
    id?: string
    stars?: number
  }

  if (data.result) {
    return mapRexaResultToAnalysis(data.result, {
      id: data.analysis_id,
      questionId: data.question_id,
      studentName: data.student_name,
      studentId: data.student_id,
    })
  }

  // Already shaped or AnalysisRunOut
  if (data.id && typeof data.stars === 'number' && 'sentenceRoles' in data) {
    return data as unknown as AnalysisResult
  }

  const run = raw as {
    id?: string
    question_id?: string
    result_json?: BackendRexaResult
    stars?: number
    model_version?: string
    created_at?: string
    student_name?: string | null
    student_id?: string | null
  }

  if (run.result_json) {
    return mapRexaResultToAnalysis(
      {
        ...run.result_json,
        stars: run.stars ?? run.result_json.stars,
        model_version: run.model_version ?? run.result_json.model_version,
      },
      {
        id: run.id,
        questionId: run.question_id,
        createdAt: run.created_at,
        studentName: run.student_name,
        studentId: run.student_id,
      },
    )
  }

  return mapRexaResultToAnalysis(data as BackendRexaResult, {
    id: data.analysis_id ?? data.id,
    questionId: data.question_id,
    studentName: data.student_name,
    studentId: data.student_id,
  })
}

export function mapQuestion(raw: unknown): Question {
  const q = raw as {
    id: string
    title?: string
    prompt?: string
    text?: string
    reference_answer?: string
    referenceAnswer?: string
    concepts?: string[]
    course?: string
    subject?: string
    difficulty?: Question['difficulty']
    created_at?: string
    createdAt?: string
    updated_at?: string
    updatedAt?: string
  }

  return {
    id: q.id,
    text: q.text ?? q.prompt ?? q.title ?? '',
    referenceAnswer: q.referenceAnswer ?? q.reference_answer ?? '',
    concepts: q.concepts ?? [],
    subject: q.subject ?? q.course,
    difficulty: q.difficulty,
    createdAt: q.createdAt ?? q.created_at ?? new Date().toISOString(),
    updatedAt: q.updatedAt ?? q.updated_at,
  }
}

export function toBackendQuestionPayload(input: QuestionInput): Record<string, unknown> {
  return {
    title: input.text.slice(0, 120),
    prompt: input.text,
    reference_answer: input.referenceAnswer ?? '',
    concepts: input.concepts,
    course: input.subject ?? null,
    difficulty: input.difficulty ?? 'medium',
  }
}

export function toBackendAnalyzePayload(payload: {
  questionId?: string
  questionText: string
  referenceAnswer?: string
  concepts?: string[]
  studentAnswer: string
  studentName?: string
  studentId?: string
}): Record<string, unknown> {
  return {
    question_id: payload.questionId ?? null,
    question_text: payload.questionText,
    reference_answer: payload.referenceAnswer ?? '',
    concepts: payload.concepts ?? [],
    student_answer: payload.studentAnswer,
    student_name: payload.studentName ?? null,
    student_id: payload.studentId ?? null,
    save: true,
  }
}

type RawRoleSentence = {
  analysisId?: string
  analysis_id?: string
  questionTitle?: string
  question_title?: string
  studentName?: string
  student_name?: string
  text?: string
  role?: string
  confidence?: number
  reason?: string
}

function mapRoleSentences(items: RawRoleSentence[] | undefined) {
  return (items ?? []).flatMap((item) => {
    const text = String(item.text ?? '').trim()
    if (!text) return []
    return [
      {
        analysisId: item.analysisId ?? item.analysis_id ?? '',
        questionTitle: item.questionTitle ?? item.question_title ?? 'Question',
        studentName: item.studentName ?? item.student_name,
        text,
        role: mapRole(item.role ?? 'other'),
        confidence: item.confidence,
        reason: item.reason,
      },
    ]
  })
}

export function mapDashboard(raw: unknown): DashboardData {
  const root = (raw ?? {}) as Record<string, unknown>
  const nested =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : null
  const d = (
    nested &&
    (nested.roleDistribution ||
      nested.roleSentences ||
      nested.role_sentences ||
      nested.totalAnalyses != null)
      ? nested
      : root
  ) as {
    totalAnalyses?: number
    avgStars?: number
    avgCoverage?: number
    avgDepth?: number
    totalQuestions?: number
    totalSubmissions?: number
    analysesThisWeek?: number
    starBands?: DashboardData['stats']['starBands']
    coverageBands?: DashboardData['stats']['coverageBands']
    coverageTrend?: Array<{ date: string; avg_coverage?: number; avgCoverage?: number; avg_stars?: number; avgStars?: number; avg_depth?: number; avgDepth?: number; count?: number }>
    roleDistribution?: Array<{ role: string; count: number }>
    roleSentences?: RawRoleSentence[]
    role_sentences?: RawRoleSentence[]
    recentAnalyses?: unknown[]
    stats?: DashboardData['stats']
  }

  const trend = (d.coverageTrend ?? []).map((point) => ({
    date: point.date,
    avgCoverage: point.avgCoverage ?? point.avg_coverage ?? 0,
    avgStars: point.avgStars ?? point.avg_stars,
    avgDepth: point.avgDepth ?? point.avg_depth,
    count: point.count,
  }))

  const avgCoverage =
    typeof d.avgCoverage === 'number'
      ? d.avgCoverage
      : trend.length > 0
        ? trend.reduce((sum, point) => sum + point.avgCoverage, 0) / trend.length
        : 0

  const recentAnalyses = (d.recentAnalyses ?? []).map((item) => {
    const r = item as {
      id: string
      question_title?: string
      stars?: number
      coverage?: number
      depth?: number
      created_at?: string
      student_name?: string
    }
    const coverageScore =
      typeof r.coverage === 'number'
        ? r.coverage > 1
          ? r.coverage / 100
          : r.coverage
        : undefined
    const depthScore = typeof r.depth === 'number' ? r.depth : 0.5
    // Lightweight stub AnalysisResult for dashboard tables
    return {
      id: r.id,
      questionText: r.question_title ?? 'Analysis',
      studentAnswer: r.student_name ? `Student: ${r.student_name}` : '',
      stars: r.stars ?? 0,
      dimensions:
        typeof coverageScore === 'number'
          ? [
              {
                key: 'coverage',
                label: 'Concept coverage',
                score: coverageScore,
              },
            ]
          : [],
      sentenceRoles: [],
      conceptCoverage: [],
      supportPairs: [],
      reasoningDepth: depthFromScore(depthScore),
      explanations: [],
      createdAt: r.created_at ?? new Date().toISOString(),
    } satisfies AnalysisResult
  })

  return {
    stats: {
      totalAnalyses: d.totalAnalyses ?? 0,
      avgStars: d.avgStars,
      avgCoverage,
      avgDepth: d.avgDepth,
      totalQuestions: d.totalQuestions,
      totalSubmissions: d.totalSubmissions,
      analysesThisWeek: d.analysesThisWeek ?? 0,
      starBands: d.starBands ?? [],
      coverageBands: d.coverageBands ?? [],
      empty: Boolean((d as { empty?: boolean }).empty),
    },
    coverageTrend: trend,
    roleDistribution: (d.roleDistribution ?? []).map((item) => ({
      role: mapRole(item.role),
      count: item.count,
    })),
    roleSentences: mapRoleSentences(d.roleSentences ?? d.role_sentences),
    recentAnalyses,
  }
}

export function mapModelVersion(raw: unknown): ModelVersion {
  const m = raw as {
    id: string
    name: string
    version: string
    description?: string
    is_active?: boolean
    isActive?: boolean
    metrics_json?: { accuracy?: number; mode?: string }
    created_at?: string
    createdAt?: string
  }

  const mode =
    m.metrics_json?.mode === 'trained' ||
    m.name.toLowerCase().includes('trained') ||
    m.version.toLowerCase().includes('sklearn')
      ? 'trained'
      : 'heuristic'

  return {
    id: m.id,
    name: m.name,
    version: m.version,
    mode,
    isActive: m.isActive ?? m.is_active ?? false,
    accuracy: m.metrics_json?.accuracy,
    createdAt: m.createdAt ?? m.created_at ?? new Date().toISOString(),
    description: m.description,
  }
}
