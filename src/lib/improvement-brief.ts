import type { AnalysisResult, SentenceRoleLabel } from '@/types'
import { CORE_ROLES } from '@/lib/grading'
import { truncate } from '@/utils'

export type ImprovementPriority = 'high' | 'medium' | 'low'

export interface ImprovementStep {
  title: string
  detail: string
  priority: ImprovementPriority
}

export interface ImprovementBrief {
  summary: string
  strengths: string[]
  steps: ImprovementStep[]
}

const ROLE_NAME: Record<SentenceRoleLabel, string> = {
  claim: 'a claim',
  evidence: 'evidence',
  reasoning: 'reasoning',
  elaboration: 'elaboration',
  counterargument: 'a counterargument',
  conclusion: 'a conclusion',
  irrelevant: 'off-topic sentences',
}

function sortSteps(steps: ImprovementStep[]) {
  const rank = { high: 0, medium: 1, low: 2 }
  return [...steps].sort((a, b) => rank[a.priority] - rank[b.priority])
}

export function buildImprovementBrief(
  analysis: AnalysisResult,
  options?: { omitStars?: boolean },
): ImprovementBrief {
  const missingConcepts = analysis.conceptCoverage
    .filter((item) => !item.covered)
    .map((item) => item.concept)
  const coveredConcepts = analysis.conceptCoverage
    .filter((item) => item.covered)
    .map((item) => item.concept)
  const presentRoles = new Set(
    analysis.sentenceRoles
      .filter((sentence) => sentence.role !== 'irrelevant')
      .map((sentence) => sentence.role),
  )
  const irrelevant = analysis.sentenceRoles.filter(
    (sentence) => sentence.role === 'irrelevant',
  )
  const contradictions = analysis.supportPairs.filter(
    (pair) => pair.relation === 'contradiction',
  )
  const supports = analysis.supportPairs.filter(
    (pair) => pair.relation === 'support',
  )
  const missingRoles = CORE_ROLES.filter((role) => !presentRoles.has(role))

  const strengths: string[] = []
  if (coveredConcepts.length) {
    const shown = coveredConcepts.slice(0, 5).join(', ')
    strengths.push(
      coveredConcepts.length > 5
        ? `You already covered ${shown}, and more.`
        : `You already covered: ${shown}.`,
    )
  }
  if (
    presentRoles.has('claim') &&
    presentRoles.has('evidence') &&
    presentRoles.has('reasoning')
  ) {
    strengths.push(
      'The answer already has a claim, evidence, and reasoning. Keep that chain.',
    )
  }
  if (supports.length) {
    strengths.push(
      `${supports.length} ${supports.length === 1 ? 'sentence supports' : 'sentences support'} the main point.`,
    )
  }

  const steps: ImprovementStep[] = []

  if (missingConcepts.length) {
    const listed = missingConcepts
      .slice(0, 6)
      .map((concept) => `"${concept}"`)
      .join(', ')
    steps.push({
      priority: 'high',
      title: 'Write the missing concepts into the answer',
      detail: `Add at least one sentence that explains ${listed}${
        missingConcepts.length > 6 ? ', and the other missing ideas' : ''
      }. Naming a term is not enough — say what it means for this question.`,
    })
  }

  if (!presentRoles.has('claim')) {
    steps.push({
      priority: 'high',
      title: 'Start with a clear claim',
      detail:
        'Open with one sentence that directly answers the question, for example: “X is … because …”.',
    })
  }
  if (!presentRoles.has('evidence')) {
    steps.push({
      priority: 'high',
      title: 'Support the claim with evidence',
      detail:
        'After the claim, add a concrete example, fact, or case. Phrases such as “for example” or “according to” help.',
    })
  }
  if (!presentRoles.has('reasoning')) {
    steps.push({
      priority: 'high',
      title: 'Explain why the evidence matters',
      detail:
        'Add a “because / therefore / this means” sentence that links the evidence back to your claim.',
    })
  }
  if (!presentRoles.has('conclusion') && analysis.sentenceRoles.length > 2) {
    steps.push({
      priority: 'medium',
      title: 'Close with a conclusion',
      detail:
        'End with one sentence that restates the main answer so the argument feels finished.',
    })
  }
  if (irrelevant.length >= 2) {
    steps.push({
      priority: 'medium',
      title: 'Cut or rewrite off-topic sentences',
      detail: `${irrelevant.length} sentences were marked as not helping this question. Remove them, or rewrite them so they support the claim.`,
    })
  }
  if (contradictions.length) {
    steps.push({
      priority: 'high',
      title: 'Fix conflicting statements',
      detail: `This part may clash with the expected answer: “${truncate(contradictions[0].studentText, 140)}”. Rewrite it so it agrees with your claim.`,
    })
  }
  if (analysis.reasoningDepth.level < 3) {
    steps.push({
      priority: 'medium',
      title: 'Go one step deeper',
      detail:
        'Do not stop at a definition. Add a second “because”, a consequence, or how the idea would be used.',
    })
  }

  if (steps.length === 0) {
    steps.push({
      priority: 'low',
      title: 'Polish a strong answer',
      detail:
        'Coverage and structure look solid. Add a second example or a short counterargument if you want to push it further.',
    })
  }

  const stars = analysis.stars
  let summary: string
  if (options?.omitStars) {
    const covered = analysis.conceptCoverage.filter((item) => item.covered).length
    const total = analysis.conceptCoverage.length
    const pct = total ? Math.round((100 * covered) / total) : null
    const depth = analysis.reasoningDepth.label.toLowerCase()
    if (pct == null) {
      summary = `This answer shows ${depth}. The notes below are what would make it stronger.`
    } else if (pct >= 80) {
      summary = `This answer covers ${pct}% of the required ideas and shows ${depth}. The notes below are polish, not repairs.`
    } else if (pct >= 50) {
      summary = `This answer covers ${pct}% of the required ideas. Follow the steps to fill the gaps.`
    } else {
      summary = `This answer covers ${pct}% of the required ideas and needs a rebuild. Start with step 1.`
    }
  } else if (stars >= 4.5) {
    summary = `This is a strong answer (${stars.toFixed(1)} / 5). The notes below are polish, not repairs.`
  } else if (stars >= 3.5) {
    summary = `This is a good answer (${stars.toFixed(1)} / 5) with a few gaps. Follow the steps to raise it.`
  } else if (stars >= 2.5) {
    summary = `This answer is partly there (${stars.toFixed(1)} / 5). The steps below are what would make it complete.`
  } else {
    summary = `This answer needs a rebuild (${stars.toFixed(1)} / 5). Start with step 1 and work down the list.`
  }

  if (missingRoles.length && (options?.omitStars || stars < 4.5)) {
    const labels = missingRoles.map((role) => ROLE_NAME[role])
    summary += ` RExA did not find: ${labels.join(', ')}.`
  }

  return {
    summary,
    strengths,
    steps: sortSteps(steps),
  }
}
