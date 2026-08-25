import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ListTree,
  Scale,
  Sparkles,
  Star,
  Target,
  Waves,
} from 'lucide-react'
import { ROUTES } from '@/routes/paths'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import heroImage from '@/assets/hero.png'

const pillars = [
  {
    icon: ListTree,
    title: 'Sentence Roles',
    description:
      'Every sentence is classified as a claim, evidence, reasoning, elaboration, counterargument, or conclusion — surfacing the structure behind an answer.',
  },
  {
    icon: Target,
    title: 'Concept Coverage',
    description:
      'REXA checks each required concept against the student response, flagging what is covered, partially covered, or entirely missing.',
  },
  {
    icon: Scale,
    title: 'Support & Contradiction',
    description:
      'Sentence-level alignment against the reference answer detects supporting statements and direct contradictions.',
  },
  {
    icon: Waves,
    title: 'Reasoning Depth',
    description:
      'A depth meter measures how far the response moves beyond recall into explanation, inference, and synthesis.',
  },
  {
    icon: Star,
    title: 'Star Prediction',
    description:
      'All signals are combined into an explainable 1–5 star score, with the reasoning behind every point fully visible.',
  },
]

const steps = [
  {
    title: 'Provide the question',
    description:
      'Pick a question from your bank or paste a custom question with its reference answer and key concepts.',
  },
  {
    title: 'Run the analysis',
    description:
      'REXA parses the student answer sentence by sentence and evaluates it against every reasoning dimension.',
  },
  {
    title: 'Explore the reasoning',
    description:
      'Drill into roles, coverage, contradictions, and depth — every score comes with a transparent explanation.',
  },
]

export function LandingPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Final Year Project · Descriptive answer analysis
            </div>

            <h1 className="text-6xl font-extrabold tracking-tight text-foreground sm:text-7xl">
              RExA
            </h1>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Explainable Reasoning Analysis of Descriptive Answers
            </h2>

            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              RExA grades free-text answers the way a thoughtful examiner
              would — tracing claims, evidence, and reasoning depth instead of
              matching keywords.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to={ROUTES.AUTH.LOGIN}>
                  Sign in
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="hidden justify-self-end lg:block"
          >
            <div className="relative">
              <div className="absolute -inset-8 -z-10 rounded-full bg-primary/10 blur-3xl" />
              <img
                src={heroImage}
                alt="RExA reasoning analysis illustration"
                className="w-full max-w-md rounded-2xl border bg-card shadow-xl"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              How it works
            </h3>
            <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              From answer to explainable score in three steps
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-8 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="space-y-3 text-center sm:text-left">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground sm:mx-0">
                  {index + 1}
                </div>
                <h4 className="font-semibold">{step.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pillars" className="bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              The five REXA pillars
            </h3>
            <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Every dimension of reasoning, made visible
            </p>
            <p className="mt-3 text-muted-foreground">
              REXA (Reasoning Explanation & eXplainable Assessment) breaks
              down every response into signals a human evaluator would
              actually look for.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((pillar, index) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <Card className="h-full">
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <pillar.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">{pillar.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {pillar.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to see reasoning-based grading in action?
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Sign in to run an analysis and inspect the explainable reasoning
            output.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="secondary" asChild>
              <Link to={ROUTES.AUTH.LOGIN}>Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
