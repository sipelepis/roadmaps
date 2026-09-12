import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { Button, Chip, EmptyState, PageHeader } from '@boost/ui';

import { articleBySlug } from '../content/articles';
import { stepById, stepsInLane } from '../content/steps';
import { api } from '../lib/api';

/** One step of the pipeline, explained. Reached by clicking any box on /flow. */
export function FlowStepPage() {
  const { id } = useParams();
  const step = id ? stepById(id) : undefined;
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats });

  if (!step) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="No such step"
          description="That link does not match anything in the pipeline."
          action={
            <Button variant="outline" asChild>
              <Link to="/flow">Back to Flow</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const lane = stepsInLane(step.lane);
  const index = lane.indexOf(step);
  const previous = lane[index - 1];
  const next = lane[index + 1];
  const article = step.learn ? articleBySlug(step.learn) : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link to="/flow">
          <ArrowLeft />
          Flow
        </Link>
      </Button>

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Chip variant="primary">
          {step.lane === 'ingest' ? 'Ingest' : 'Query'} · step {index + 1} of {lane.length}
        </Chip>
        <span className="font-mono text-xs text-muted-foreground">{step.where}</span>
      </div>

      <PageHeader title={step.title} description={step.summary} />

      {/* The map's own label for this step, with whatever the live config says
          — so the page and the box you clicked agree. */}
      <div className="mb-5 rounded-md border border-border bg-elevation-1 p-3">
        <div className="font-mono text-sm text-foreground [font-variant-ligatures:none]">
          {step.label}
        </div>
        <div className="text-xs text-muted-foreground">{step.detail(stats.data)}</div>
      </div>

      <article className="space-y-4">{step.body()}</article>

      {article && (
        <div className="mt-8 rounded-md border border-border bg-elevation-1 p-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground/70">
            The concept behind this step
          </div>
          <Button variant="link" className="-ml-4 mt-1 font-heading text-base" asChild>
            <Link to={`/learn/${article.slug}`}>
              <BookOpen />
              {article.title}
              <span className="text-xs text-muted-foreground">{article.minutes} min</span>
            </Link>
          </Button>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        {previous ? (
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link to={`/flow/${previous.id}`}>
              <ArrowLeft />
              {previous.label}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next && (
          <Button variant="ghost" size="sm" className="-mr-2" asChild>
            <Link to={`/flow/${next.id}`}>
              {next.label}
              <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
