import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Play, Scissors } from 'lucide-react';
import { Link } from 'react-router';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
  Input,
  PageHeader,
  Textarea,
  cn,
  toast,
} from '@boost/ui';
import type { Chunk, ChunkPreview, Document, IngestTrace, Stats, Trace } from '@rag/shared';

import { type Step, stepsInLane } from '../content/steps';
import { api } from '../lib/api';

/**
 * The pipeline, drawn from real runs rather than described. Every number on
 * this page came back from the API in the request you just made: the chunk
 * boundaries from the actual chunker, the vector from the actual embedding
 * call, the timings and the prompt from the actual query.
 */

/** Deliberately longer than the chunk window, or there would be one chunk and
 *  nothing to see. */
const SAMPLE = `Employees accrue 1.5 days of paid leave for each completed month of service, to a maximum of 18 days per calendar year. Leave accrued but not taken rolls over once, and expires at the end of the following calendar year. Requests are made in the console at least five working days ahead, except for sick leave, which is recorded on return. Part-time employees accrue pro rata against contracted hours, rounded up to the nearest half day at the end of each quarter.

Sick leave is separate from the annual allowance and is capped at 10 days per year. A medical certificate is required from the third consecutive day. Managers approve leave; where a manager is unavailable for more than two working days, their manager approves in their place. Approval is not required for statutory bereavement leave, which is three days for an immediate family member and one day otherwise, taken within a month of the death.

Parental leave runs alongside the statutory scheme and does not reduce the annual allowance. The company tops the statutory payment up to full salary for the first twelve weeks, and the balance of the period is paid at the statutory rate. Notice of at least eight weeks is expected where the date is known in advance.

Unused leave is paid out on termination at the employee's final daily rate, calculated as monthly salary divided by 21.75. Leave taken in advance of accrual is deducted from that payout. Public holidays falling inside a leave period are not counted against the allowance, and a holiday falling on a weekend is observed on the following Monday.`;

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

export function FlowPage() {
  const qc = useQueryClient();
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats });

  const split = useMutation({
    mutationFn: api.chunkPreview,
    onError: (error: Error) => toast.error(error.message),
  });

  const index = useMutation({
    mutationFn: (input: { filename: string; text: string }) =>
      api.ingestText(input.filename, input.text, true),
    onSuccess: async (doc) => {
      toast.success(`Indexed ${doc.filename} into ${plural(doc.chunks, 'chunk')}`);
      // The map labels itself with the corpus size, so it should grow visibly.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['stats'] }),
        qc.invalidateQueries({ queryKey: ['documents'] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const run = useMutation({
    mutationFn: (question: string) => api.query({ question, top_k: 5, trace: true }),
    onError: (error: Error) => toast.error(error.message),
  });

  // A lane is lit while its half of the pipeline is in flight and stays lit
  // once that half has produced something.
  const ingestState =
    split.isPending || index.isPending
      ? 'running'
      : split.data || index.data
        ? 'done'
        : 'idle';
  const queryState = run.isPending ? 'running' : run.data ? 'done' : 'idle';
  const ingestTrace = index.data?.trace;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Flow"
        description="Both paths through this system, running on your data. Split some text and watch the chunker cut it; ask something and watch the question become a vector, the vector become five chunks, and those chunks become the prompt the model actually sees."
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">The two paths</CardTitle>
            <CardDescription>
              Ingest runs once per document and costs an embedding call per chunk. Query runs per
              question and embeds exactly one thing — the question. Everything the model knows at
              answer time arrived through the lower lane.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Lane
              title="Ingest"
              note="once per document · click any step"
              stages={stepsInLane('ingest')}
              stats={stats.data}
              state={ingestState}
              timings={
                ingestTrace
                  ? {
                      chunk: ingestTrace.ms_chunk,
                      'embed-chunks': ingestTrace.ms_embed,
                      // One transaction covers both inserts; charging it to the
                      // chunk insert beats double-counting it.
                      'insert-chunks': ingestTrace.ms_store,
                    }
                  : undefined
              }
            />
            <Lane
              title="Query"
              note="once per question · click any step"
              stages={stepsInLane('query')}
              stats={stats.data}
              state={queryState}
              timings={
                run.data?.trace
                  ? {
                      'embed-question': run.data.trace.ms_embed,
                      search: run.data.trace.ms_search,
                      generate: run.data.trace.ms_answer,
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              <Scissors className="mr-2 inline size-4 text-primary-strong" />
              Watch a document reach the vector store
            </CardTitle>
            <CardDescription>
              Two buttons, two different things. Splitting is a dry run of the chunker — nothing
              embedded, nothing stored — and highlights the overlap, the tail of one chunk
              repeated at the head of the next so a sentence split across the boundary still lands
              whole in one of them. Indexing runs the real thing: chunk, embed, insert, and the
              text is in the corpus afterwards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChunkDemo split={split} index={index} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              <Play className="mr-2 inline size-4 text-primary-strong" />
              Watch a query run
            </CardTitle>
            <CardDescription>
              A real traced query against your corpus — {plural(stats.data?.chunks ?? 0, 'chunk')}{' '}
              from {plural(stats.data?.documents ?? 0, 'document')}. Every panel below is what came
              back, not an illustration of what could come back.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <QueryDemo run={run} empty={stats.data?.chunks === 0} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── the map ───────────────────────────────────────── */

function Lane({
  title,
  note,
  stages,
  stats,
  state,
  timings,
}: {
  title: string;
  note: string;
  stages: Step[];
  stats?: Stats;
  state: 'idle' | 'running' | 'done';
  timings?: Record<string, number>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-heading text-sm text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{note}</span>
      </div>
      {/* Numbered grid rather than one scrolling row: seven steps in a row
          would push the last ones off-screen, and a step you have to scroll to
          find is a step you will not read. The order carries the flow. */}
      <ol className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage, i) => (
          <li key={stage.id}>
            <Node
              stage={stage}
              step={i + 1}
              stats={stats}
              state={state}
              ms={timings ? timings[stage.id] : undefined}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Node({
  stage,
  step,
  stats,
  state,
  ms,
}: {
  stage: Step;
  step: number;
  stats?: Stats;
  state: 'idle' | 'running' | 'done';
  ms?: number;
}) {
  // Every box goes somewhere: /flow/:id explains that step in full, with the
  // code that implements it. A step you cannot click is a step you cannot ask
  // about.
  return (
    <Link to={`/flow/${stage.id}`} className="block h-full">
      <div
        className={cn(
          'flex h-full flex-col rounded-md border p-2 transition-colors duration-200',
          'hover:border-primary/60 hover:bg-primary/10',
          state === 'idle' && 'border-border bg-elevation-1',
          state === 'running' && 'animate-pulse border-primary/40 bg-primary/5',
          state === 'done' && 'border-primary/30 bg-primary/5',
        )}
      >
        {/* Ligatures off: the mono face draws `<=>` as a single arrow glyph, and
            the operator is the whole point of that node. */}
        <div className="flex items-baseline gap-1.5">
          <span className="font-heading text-[10px] tabular-nums text-muted-foreground/70">
            {String(step).padStart(2, '0')}
          </span>
          <span className="truncate font-mono text-xs text-foreground [font-variant-ligatures:none]">
            {stage.label}
          </span>
        </div>
        <div className="mt-1 text-[11px] leading-tight text-muted-foreground">
          {stage.detail(stats)}
        </div>
        {/* Filename and line only — the full path is a tooltip, so four nodes fit
            across without any label ellipsing. The measured time shares this row
            rather than the label's, where it would crowd out `ORDER BY <=>`. */}
        <div className="mt-auto flex items-baseline justify-between gap-1 pt-1.5 font-mono text-[10px]">
          <span className="truncate text-muted-foreground/70" title={stage.where}>
            {stage.where.split('/').pop()}
          </span>
          {ms !== undefined && (
            <span className="shrink-0 font-heading tabular-nums text-primary-strong">{ms} ms</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ── ingest, live ──────────────────────────────────── */

type SplitMutation = ReturnType<
  typeof useMutation<Awaited<ReturnType<typeof api.chunkPreview>>, Error, string>
>;

type IndexMutation = ReturnType<
  typeof useMutation<Document, Error, { filename: string; text: string }>
>;

function ChunkDemo({ split, index }: { split: SplitMutation; index: IndexMutation }) {
  const [text, setText] = useState(SAMPLE);
  const [filename, setFilename] = useState('leave-policy-extended.md');

  return (
    <>
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={!text.trim()}
          loading={split.isPending}
          loadingText="Splitting…"
          onClick={() => split.mutate(text)}
        >
          <Scissors />
          Split it (dry run)
        </Button>
        <Input
          className="w-56"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          aria-label="Filename to index it under"
        />
        <Button
          disabled={!text.trim() || !filename.trim()}
          loading={index.isPending}
          loadingText="Embedding…"
          onClick={() => index.mutate({ filename: filename.trim(), text })}
        >
          <Database />
          Index it for real
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {text.length.toLocaleString()} characters in
        </span>
      </div>

      {split.data && <ChunkResult data={split.data} />}
      {index.data?.trace && <IngestResult document={index.data} trace={index.data.trace} />}
    </>
  );
}

function IngestResult({ document, trace }: { document: Document; trace: IngestTrace }) {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <Step
        n={1}
        title="What was written"
        note={`Stored as document ${document.id}, "${document.filename}". Those rows are in the corpus now — delete them from the Dashboard if this was only a demonstration.`}
      >
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Figure label="characters" value={trace.chars.toLocaleString()} hint="text extracted" />
          <Figure label="chunks" value={trace.chunks} hint="from chunk_text()" />
          <Figure
            label="embedding calls"
            value={trace.embed_calls}
            hint={`${plural(trace.chunks, 'chunk')}, one request`}
          />
          <Figure
            label="rows inserted"
            value={trace.rows_inserted}
            hint={`VECTOR(${trace.dims}) each`}
          />
        </div>
      </Step>

      <Step
        n={2}
        title="Where the time went"
        note="Chunking is string slicing and costs nothing. The embedding call is the whole bill of ingest — and it is paid once here, never again at query time."
      >
        <Waterfall
          rows={[
            { label: 'chunk_text()', ms: trace.ms_chunk, hint: 'local — string slicing' },
            { label: 'embed()', ms: trace.ms_embed, hint: 'network — embedding API' },
            { label: 'INSERT', ms: trace.ms_store, hint: 'local — one transaction' },
          ]}
        />
      </Step>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-md border border-border bg-elevation-1 p-2">
      <div className="font-heading text-lg tabular-nums text-foreground">{value}</div>
      <div className="text-[11px] text-foreground">{label}</div>
      <div className="text-[11px] leading-tight text-muted-foreground">{hint}</div>
    </div>
  );
}

function ChunkResult({ data }: { data: ChunkPreview }) {
  const { chunks, shared, chunk_chars, chunk_overlap } = data;

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-heading tabular-nums text-foreground">{chunks.length}</span> chunks
        </span>
        <span>
          window <span className="tabular-nums text-foreground">{chunk_chars}</span> chars
        </span>
        <span>
          overlap <span className="tabular-nums text-foreground">{chunk_overlap}</span> chars
        </span>
        <span>
          → <span className="tabular-nums text-foreground">{chunks.length}</span> embedding calls
          at ingest, 0 at query time
        </span>
      </div>

      {chunks.map((chunk, i) => {
        // Measured server-side by the same code that cut the text — see
        // rag.shared_prefix. head repeats the chunk before, tail is repeated
        // by the chunk after.
        const head = shared[i] ?? 0;
        const tail = shared[i + 1] ?? 0;
        return (
          <div key={i} className="rounded-md border border-border bg-elevation-1 p-3">
            <div className="mb-1.5 flex items-center gap-2 text-xs">
              <Chip variant="primary">chunk {i}</Chip>
              <span className="tabular-nums text-muted-foreground">{chunk.length} chars</span>
              {head > 0 && (
                <span className="tabular-nums text-muted-foreground">
                  · {head} shared with chunk {i - 1}
                </span>
              )}
            </div>
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              <mark className="bg-primary/15 text-foreground">{chunk.slice(0, head)}</mark>
              {chunk.slice(head, chunk.length - tail)}
              <mark className="bg-primary/15 text-foreground">
                {chunk.slice(chunk.length - tail)}
              </mark>
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ── query, live ───────────────────────────────────── */

type RunMutation = ReturnType<
  typeof useMutation<Awaited<ReturnType<typeof api.query>>, Error, string>
>;

function QueryDemo({ run, empty }: { run: RunMutation; empty?: boolean }) {
  const [question, setQuestion] = useState('How much leave do I get?');
  const trace = run.data?.trace;

  return (
    <>
      <Textarea
        rows={2}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && question.trim()) {
            e.preventDefault();
            run.mutate(question.trim());
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!question.trim()}
          loading={run.isPending}
          loadingText="Running…"
          onClick={() => run.mutate(question.trim())}
        >
          <Play />
          Run it traced
        </Button>
        {empty && (
          <span className="text-xs text-muted-foreground">
            Nothing indexed yet — there is nothing to retrieve.{' '}
            <Link to="/" className="text-primary-strong underline-offset-4 hover:underline">
              Add a document
            </Link>
            .
          </span>
        )}
      </div>

      {trace && run.data && (
        <div className="space-y-4 border-t border-border pt-4">
          <Step
            n={1}
            title="The question becomes a vector"
            note={`${trace.embedding_dims} numbers, ${trace.embedding_preview.length} of them drawn. This is the only thing the database gets to compare against — no keywords, no text matching.`}
          >
            <VectorStrip values={trace.embedding_preview} />
          </Step>

          <Step
            n={2}
            title="Every chunk is compared to it"
            note={`${plural(trace.chunks_scanned, 'chunk')} scanned exactly, ${run.data.sources.length} kept. Cosine similarity: 1.00 is identical direction, 0.00 unrelated. If the answer is not in these, no prompt change will save it.`}
          >
            <ScoreBars sources={run.data.sources} />
          </Step>

          <Step
            n={3}
            title="Those chunks become the prompt"
            note={`${trace.prompt.length.toLocaleString()} characters sent, of which your question is ${question.trim().length}. The rest is retrieved text — this is the whole of what the model knows.`}
          >
            <PromptPanel trace={trace} />
          </Step>

          <Step
            n={4}
            title="The model answers from those alone"
            note="Citations point back at the numbered sources above. An answer that cites nothing is a hint the retrieval missed."
          >
            <p className="whitespace-pre-wrap rounded-md border border-border bg-elevation-1 p-3 text-sm text-foreground">
              {run.data.answer}
            </p>
          </Step>

          <Step
            n={5}
            title="Where the time went"
            note="Embedding and generation are network calls to someone else's GPUs; the vector search is local. At this corpus size the search is not what you would optimise."
          >
            <Waterfall
              rows={[
                { label: 'embed question', ms: trace.ms_embed, hint: 'network — embedding API' },
                {
                  label: 'vector search',
                  ms: trace.ms_search,
                  hint: 'local — Postgres exact scan',
                },
                { label: 'generate answer', ms: trace.ms_answer, hint: 'network — Claude' },
              ]}
            />
          </Step>
        </div>
      )}
    </>
  );
}

function Step({
  n,
  title,
  note,
  children,
}: {
  n: number;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-xs tabular-nums text-muted-foreground/70">
          {String(n).padStart(2, '0')}
        </span>
        <h3 className="font-heading text-sm text-foreground">{title}</h3>
      </div>
      <p className="mb-2 ml-6 text-xs leading-relaxed text-muted-foreground">{note}</p>
      <div className="ml-6">{children}</div>
    </div>
  );
}

function VectorStrip({ values }: { values: number[] }) {
  const max = Math.max(...values.map(Math.abs)) || 1;

  return (
    <div className="rounded-md border border-border bg-elevation-1 p-3">
      <div className="flex h-16 items-stretch gap-px" aria-hidden>
        {values.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col" title={v.toFixed(4)}>
            <div className="flex flex-1 items-end">
              {v > 0 && (
                <div
                  className="w-full rounded-t-xs bg-primary"
                  style={{ height: `${(v / max) * 100}%` }}
                />
              )}
            </div>
            <div className="h-px bg-border" />
            <div className="flex flex-1 items-start">
              {v < 0 && (
                <div
                  className="w-full rounded-b-xs bg-primary/40"
                  style={{ height: `${(-v / max) * 100}%` }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
        [{values.slice(0, 8).map((v) => v.toFixed(4)).join(', ')}, … ]
      </p>
    </div>
  );
}

function ScoreBars({ sources }: { sources: Chunk[] }) {
  if (!sources.length) {
    return (
      <p className="rounded-md border border-border bg-elevation-1 p-3 text-xs text-muted-foreground">
        Nothing came back — the corpus is empty.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {sources.map((chunk, i) => (
        <div key={chunk.id} className="rounded-md border border-border bg-elevation-1 p-2">
          <div className="flex items-center gap-2 text-xs">
            <Chip variant="primary">[{i + 1}]</Chip>
            <span className="truncate font-medium text-foreground">{chunk.filename}</span>
            <span className="shrink-0 text-muted-foreground">chunk {chunk.ordinal}</span>
            <span className="ml-auto shrink-0 font-heading tabular-nums text-foreground">
              {chunk.score.toFixed(3)}
            </span>
          </div>
          {/* Scores cluster in the top half of the range, so the bar is drawn
              over 0–1 to keep the absolute value honest. */}
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevation-2">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(0, Math.min(1, chunk.score)) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PromptPanel({ trace }: { trace: Trace }) {
  return (
    <div className="space-y-2">
      <Labelled label="system">{trace.system}</Labelled>
      <Labelled label="user">{trace.prompt}</Labelled>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: string }) {
  return (
    <div className="rounded-md border border-border bg-elevation-2">
      <div className="border-b border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary-strong">
        {label} · {children.length.toLocaleString()} chars
      </div>
      <pre className="max-h-56 overflow-auto p-3 text-[11px] leading-relaxed text-foreground">
        <code className="whitespace-pre-wrap">{children}</code>
      </pre>
    </div>
  );
}

function Waterfall({ rows }: { rows: { label: string; ms: number; hint: string }[] }) {
  const total = rows.reduce((sum, r) => sum + r.ms, 0) || 1;

  return (
    <div className="space-y-2 rounded-md border border-border bg-elevation-1 p-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-foreground">{row.label}</span>
            <span className="text-muted-foreground">{row.hint}</span>
            <span className="ml-auto font-heading tabular-nums text-foreground">{row.ms} ms</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevation-2">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(row.ms / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <div className="border-t border-border pt-2 text-xs text-muted-foreground">
        <span className="font-heading tabular-nums text-foreground">{total}</span> ms total
      </div>
    </div>
  );
}
