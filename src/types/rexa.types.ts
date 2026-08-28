export type SentenceRoleLabel =
  | 'claim'
  | 'evidence'
  | 'reasoning'
  | 'elaboration'
  | 'counterargument'
  | 'conclusion'
  | 'irrelevant'

export interface SentenceRole {
  index: number
  text: string
  role: SentenceRoleLabel
  confidence: number
  reason?: string
}

export interface ConceptCoverage {
  concept: string
  covered: boolean
  confidence?: number
  evidenceText?: string
}

export type SupportRelation = 'support' | 'contradiction' | 'neutral'

export interface SupportPair {
  studentSentenceIndex: number
  referenceSentenceIndex: number
  studentText: string
  referenceText: string
  relation: SupportRelation
  confidence: number
}

export interface DimensionScore {
  key: string
  label: string
  score: number
}

export interface ReasoningDepth {
  level: number
  label: string
  description?: string
}

export interface Explanation {
  id: string
  message: string
  category?: string
}

export interface AnalysisResult {
  id: string
  questionId?: string
  questionText: string
  referenceAnswer?: string
  studentAnswer: string
  studentName?: string
  studentId?: string
  stars: number
  dimensions: DimensionScore[]
  sentenceRoles: SentenceRole[]
  conceptCoverage: ConceptCoverage[]
  supportPairs: SupportPair[]
  reasoningDepth: ReasoningDepth
  explanations: Explanation[]
  createdAt: string
  modelVersion?: string
}

export type QuestionDifficulty = 'easy' | 'medium' | 'hard'

export interface Question {
  id: string
  text: string
  referenceAnswer: string
  concepts: string[]
  subject?: string
  difficulty?: QuestionDifficulty
  createdAt: string
  updatedAt?: string
}

export interface QuestionInput {
  text: string
  referenceAnswer: string
  concepts: string[]
  subject?: string
  difficulty?: QuestionDifficulty
}

export interface AnalyzeRequest {
  questionId?: string
  questionText: string
  referenceAnswer: string
  concepts?: string[]
  studentAnswer: string
  studentName?: string
  studentId?: string
}

export interface BatchAnalyzeRequest {
  questionId?: string
  questionText: string
  referenceAnswer: string
  concepts?: string[]
  studentAnswers: string[]
}

export interface BatchAnalyzeResultItem {
  index: number
  studentAnswer: string
  analysisId: string
  stars: number
  dimensions: DimensionScore[]
}

export interface BatchAnalyzeResult {
  id: string
  questionText: string
  items: BatchAnalyzeResultItem[]
  createdAt: string
}

export interface CompareRequest {
  questionId?: string
  questionText: string
  referenceAnswer: string
  concepts?: string[]
  answerA: string
  answerB: string
}

export interface CompareResult {
  questionText: string
  resultA: AnalysisResult
  resultB: AnalysisResult
}

export interface AnnotationInput {
  analysisId: string
  sentenceRoles: SentenceRole[]
  conceptCoverage: ConceptCoverage[]
  reasoningDepthLevel: number
  stars: number
  notes?: string
}

export interface Annotation extends AnnotationInput {
  id: string
  annotatorId: string
  annotatorName?: string
  createdAt: string
}

export type ModelMode = 'heuristic' | 'trained'

export interface ModelVersion {
  id: string
  name: string
  version: string
  mode: ModelMode
  isActive: boolean
  accuracy?: number
  createdAt: string
  description?: string
}

export interface DashboardStats {
  totalAnalyses: number
  avgStars: number
  avgCoverage: number
  avgDepth?: number
}

export interface CoverageTrendPoint {
  date: string
  avgCoverage: number
  avgStars?: number
}

export interface RoleDistributionPoint {
  role: SentenceRoleLabel
  count: number
}

export interface DashboardData {
  stats: DashboardStats
  coverageTrend: CoverageTrendPoint[]
  roleDistribution: RoleDistributionPoint[]
  recentAnalyses: AnalysisResult[]
}
