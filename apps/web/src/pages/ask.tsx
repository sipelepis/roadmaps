import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
  EmptyState,
  PageHeader,
  Textarea,
  toast,
} from '@boost/ui';
import type { Chunk } from '@rag/shared';

import { api } from '../lib/api';

export function AskPage() {
  const [question, setQuestion] = useState('');

  const ask = useMutation({
    mutationFn: (q: string) => api.query({ question: q, top_k: 5 }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Ask"
        description="Your question is embedded, matched against every chunk by vector distance, and the closest few are pasted into the prompt. The model only sees those — nothing else from your corpus."
      />

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3">
            <Textarea
              rows={3}
              placeholder="What do the documents say about…?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter is a newline. Matches every chat box.
                if (e.key === 'Enter' && !e.shiftKey && question.trim()) {
                  e.preventDefault();
                  ask.mutate(question.trim());
                }
              }}
            />
            <Button
              disabled={!question.trim()}
              loading={ask.isPending}
              loadingText="Retrieving…"
              onClick={() => ask.mutate(question.trim())}
            >
              <Search />
              Ask
            </Button>
          </CardContent>
        </Card>

        {!ask.data && !ask.isPending && (
          <EmptyState
            title="No answer yet"
            description="Ask something. You will get the answer and, below it, the exact chunks it was built from — so you can check whether a wrong answer came from bad retrieval or bad generation."
          />
        )}

        {ask.data && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">Answer</CardTitle>
                <CardDescription>
                  Generated from the {ask.data.sources.length} chunks below, and nothing else.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-foreground">{ask.data.answer}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">Retrieved context</CardTitle>
                <CardDescription>
                  Ranked by cosine similarity — 1.00 is identical, 0.00 unrelated. If the right
                  passage is missing here, no prompt tweak will fix the answer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {ask.data.sources.map((chunk, i) => (
                  <SourceCard key={chunk.id} chunk={chunk} rank={i + 1} />
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function SourceCard({ chunk, rank }: { chunk: Chunk; rank: number }) {
  return (
    <div className="rounded-lg border border-border bg-elevation-1 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Chip variant="primary">[{rank}]</Chip>
        <span className="font-medium text-foreground">{chunk.filename}</span>
        <span aria-hidden>·</span>
        <span>chunk {chunk.ordinal}</span>
        <span className="ml-auto font-heading tabular-nums text-foreground">
          {chunk.score.toFixed(3)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{chunk.text}</p>
    </div>
  );
}
