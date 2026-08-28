import type { AnalysisResult, SentenceRole, SentenceRoleLabel } from '@/types'

/** Core roles used for the role-coverage pass line (50%). */
export const CORE_ROLES: SentenceRoleLabel[] = [
  'claim',
  'evidence',
  'reasoning',
  'conclusion',
]

export const ROLE_COVERAGE_THRESHOLD = 0.5
export const CONCEPT_COVERAGE_THRESHOLD = 0.5
export const MIN_STARS_THRESHOLD = 3
export const GRADING_STORAGE_KEY = 'rexa-grading-thresholds'

export type GradingThresholds = {
  role: number
  concept: number
  minStars: number
}

function readStoredThresholds(key: string): Partial<GradingThresholds> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as Partial<GradingThresholds>
  } catch {
    return null
  }
}

export function assignmentThresholdKey(questionId: string) {
  return `${GRADING_STORAGE_KEY}:${questionId}`
}

export function getGradingThresholds(questionId?: string): GradingThresholds {
  const defaults: GradingThresholds = {
    role: ROLE_COVERAGE_THRESHOLD,
    concept: CONCEPT_COVERAGE_THRESHOLD,
    minStars: MIN_STARS_THRESHOLD,
  }
  const global = readStoredThresholds(GRADING_STORAGE_KEY)
  const assignment = questionId
    ? readStoredThresholds(assignmentThresholdKey(questionId))
    : null
  const merged = { ...defaults, ...global, ...assignment }
  return {
    role: typeof merged.role === 'number' ? merged.role : defaults.role,
    concept: typeof merged.concept === 'number' ? merged.concept : defaults.concept,
    minStars: typeof merged.minStars === 'number' ? merged.minStars : defaults.minStars,
  }
}

export function saveGradingThresholds(
  values: GradingThresholds,
  questionId?: string,
) {
  if (typeof window === 'undefined') return
  const key = questionId ? assignmentThresholdKey(questionId) : GRADING_STORAGE_KEY
  localStorage.setItem(key, JSON.stringify(values))
}

export const ROLE_REASONS: Record<SentenceRoleLabel, string> = {
  claim: 'States a main idea or assertion the rest of the answer should support.',
  evidence: 'Gives an example, fact, or concrete instance.',
  reasoning: 'Explains why, using causal or inferential language.',
  elaboration: 'Adds detail that expands a previous point without a new claim.',
  counterargument: 'Acknowledges an opposing view or limitation.',
  conclusion: 'Closes the argument and restates the overall point.',
  irrelevant: 'Does not contribute to answering the question.',
}

const ROLE_CUES: Record<SentenceRoleLabel, string[]> = {
  claim: ['i believe', 'i think', 'it is clear', 'the main idea', 'should', 'must', 'argue'],
  evidence: ['for example', 'for instance', 'such as', 'according to', 'data', 'research', 'shows that', 'evidence'],
  reasoning: ['because', 'since', 'therefore', 'this means', 'as a result', 'due to', 'this implies'],
  elaboration: ['in addition', 'furthermore', 'also', 'more specifically'],
  counterargument: ['however', 'although', 'on the other hand', 'despite', 'nevertheless'],
  conclusion: ['in conclusion', 'overall', 'in summary', 'to conclude', 'ultimately', 'in short'],
  irrelevant: [],
}

export function sentenceWhy(sentence: SentenceRole): string {
  if (sentence.reason?.trim()) return sentence.reason.trim()
  const lowered = sentence.text.toLowerCase()
  const cues = ROLE_CUES[sentence.role].filter((cue) => lowered.includes(cue)).slice(0, 3)
  if (cues.length) {
    const quoted = cues.map((cue) => `"${cue}"`).join(', ')
    return `Labeled ${sentence.role} because it contains ${quoted}.`
  }
  return ROLE_REASONS[sentence.role]
}

export const STAR_WEIGHTS = [
  { key: 'concept_coverage', label: 'Concept coverage', weight: 0.4 },
  { key: 'reasoning_depth', label: 'Reasoning depth', weight: 0.25 },
  { key: 'role_structure', label: 'Role structure', weight: 0.15 },
  { key: 'support_quality', label: 'Support quality', weight: 0.15 },
] as const

export function toPercent(score: number): number {
  if (!Number.isFinite(score)) return 0
  return score <= 1 ? Math.round(score * 100) : Math.round(score)
}

export function roleCoverage(sentences: SentenceRole[], questionId?: string) {
  const present = new Set(
    sentences.filter((s) => s.role !== 'irrelevant').map((s) => s.role),
  )
  const covered = CORE_ROLES.filter((role) => present.has(role))
  const missing = CORE_ROLES.filter((role) => !present.has(role))
  const ratio = CORE_ROLES.length ? covered.length / CORE_ROLES.length : 0
  const threshold = getGradingThresholds(questionId).role
  return {
    covered,
    missing,
    ratio,
    percent: Math.round(ratio * 100),
    passed: ratio >= threshold,
  }
}

export function conceptCoverageStats(analysis: AnalysisResult) {
  const total = analysis.conceptCoverage.length
  const covered = analysis.conceptCoverage.filter((c) => c.covered).length
  const ratio = total ? covered / total : 1
  const threshold = getGradingThresholds(analysis.questionId).concept
  return {
    covered,
    total,
    ratio,
    percent: Math.round(ratio * 100),
    passed: ratio >= threshold,
  }
}

export function overallStatus(analysis: AnalysisResult) {
  const roles = roleCoverage(analysis.sentenceRoles, analysis.questionId)
  const concepts = conceptCoverageStats(analysis)
  const minStars = getGradingThresholds(analysis.questionId).minStars
  const passed = roles.passed && concepts.passed && analysis.stars >= minStars
  return { roles, concepts, passed, minStars }
}
