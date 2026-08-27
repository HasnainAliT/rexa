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

export function getGradingThresholds() {
  const defaults = {
    role: ROLE_COVERAGE_THRESHOLD,
    concept: CONCEPT_COVERAGE_THRESHOLD,
    minStars: MIN_STARS_THRESHOLD,
  }
  if (typeof window === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(GRADING_STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<typeof defaults>
    return {
      role:
        typeof parsed.role === 'number' ? parsed.role : defaults.role,
      concept:
        typeof parsed.concept === 'number' ? parsed.concept : defaults.concept,
      minStars:
        typeof parsed.minStars === 'number' ? parsed.minStars : defaults.minStars,
    }
  } catch {
    return defaults
  }
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

export function roleCoverage(sentences: SentenceRole[]) {
  const present = new Set(
    sentences.filter((s) => s.role !== 'irrelevant').map((s) => s.role),
  )
  const covered = CORE_ROLES.filter((role) => present.has(role))
  const missing = CORE_ROLES.filter((role) => !present.has(role))
  const ratio = CORE_ROLES.length ? covered.length / CORE_ROLES.length : 0
  const threshold = getGradingThresholds().role
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
  const threshold = getGradingThresholds().concept
  return {
    covered,
    total,
    ratio,
    percent: Math.round(ratio * 100),
    passed: ratio >= threshold,
  }
}

export function overallStatus(analysis: AnalysisResult) {
  const roles = roleCoverage(analysis.sentenceRoles)
  const concepts = conceptCoverageStats(analysis)
  const minStars = getGradingThresholds().minStars
  const passed = roles.passed && concepts.passed && analysis.stars >= minStars
  return { roles, concepts, passed, minStars }
}
