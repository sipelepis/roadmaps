import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useParams } from 'react-router';

import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from '@boost/ui';

import { ARTICLES, articleBySlug } from '../content/articles';

export function LearnPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Learn RAG"
        description="The concepts behind this console, in the order they run — each one pointing at the file in this repo that implements it. Read them in sequence the first time."
      />

      <div className="space-y-3">
        {ARTICLES.map((article, i) => (
          <Link key={article.slug} to={`/learn/${article.slug}`} className="block">
            <Card className="transition-colors duration-150 hover:bg-subtle">
              <CardHeader>
                <div className="flex items-baseline gap-3">
                  <span className="font-heading text-sm tabular-nums text-muted-foreground/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1">
                    <CardTitle className="font-heading text-lg">{article.title}</CardTitle>
                    <CardDescription className="mt-1">{article.summary}</CardDescription>
                  </div>
                  <span className="text-xs text-muted-foreground">{article.minutes} min</span>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ArticlePage() {
  const { slug } = useParams();
  const article = slug ? articleBySlug(slug) : undefined;

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="No such article"
          description="That link does not match anything in the Learn section."
          action={
            <Button variant="outline" asChild>
              <Link to="/learn">Back to Learn</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const index = ARTICLES.indexOf(article);
  const next = ARTICLES[index + 1];

  return (
    <div className="mx-auto max-w-2xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link to="/learn">
          <ArrowLeft />
          Learn
        </Link>
      </Button>

      <PageHeader title={article.title} description={article.summary} />

      <article className="space-y-4">{article.body()}</article>

      {next && (
        <div className="mt-10 border-t border-border pt-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground/70">Next</div>
          <Button variant="link" className="-ml-4 mt-1 font-heading text-base" asChild>
            <Link to={`/learn/${next.slug}`}>
              {next.title}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
