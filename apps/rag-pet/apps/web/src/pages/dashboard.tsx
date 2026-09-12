import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Trash2, Upload } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Input,
  ListingTable,
  PageHeader,
  Textarea,
  toast,
} from '@boost/ui';
import type { Document } from '@rag/shared';

import { QueryState } from '../components/query-state';
import { StatTile } from '../components/stat-tile';
import { api } from '../lib/api';

export function DashboardPage() {
  const qc = useQueryClient();
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats });
  const documents = useQuery({ queryKey: ['documents'], queryFn: api.documents });

  // Both counters and the table move on any ingest or delete.
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['stats'] }),
      qc.invalidateQueries({ queryKey: ['documents'] }),
    ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Corpus"
        description="Everything the assistant is allowed to answer from. Each document is split into overlapping chunks, embedded once at ingest, and searched by vector distance at query time."
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Documents"
            value={stats.data?.documents ?? '—'}
            hint="indexed sources"
          />
          <StatTile
            label="Chunks"
            value={stats.data?.chunks ?? '—'}
            hint="searchable vectors"
          />
        </div>

        {/* Models are configuration, not measurements — a stat tile would give
            two long strings the visual weight of the counts above. */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 text-xs text-muted-foreground">
          <span>
            text → vector{' '}
            <span className="font-mono text-foreground">
              {stats.data?.embedding_model ?? '—'}
            </span>
          </span>
          <span>
            chunks → prose{' '}
            <span className="font-mono text-foreground">{stats.data?.chat_model ?? '—'}</span>
          </span>
        </div>

        <IngestCard onIngested={refresh} />

        <QueryState isPending={documents.isPending} error={documents.error} rows={2}>
          {documents.data?.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              title="Nothing indexed yet"
              description="Add a document above, then head to Ask. With an empty corpus there is nothing to retrieve, so there is nothing to answer from."
            />
          ) : (
            <ListingTable
              data={documents.data ?? []}
              getRowKey={(d: Document) => d.id}
              columns={[
                { key: 'filename', header: 'Document', accessor: (d: Document) => d.filename },
                {
                  key: 'chunks',
                  header: 'Chunks',
                  accessor: (d: Document) => d.chunks,
                  className: 'tabular-nums',
                },
                {
                  key: 'chars',
                  header: 'Characters',
                  accessor: (d: Document) => d.chars.toLocaleString(),
                  className: 'tabular-nums',
                },
                {
                  key: 'actions',
                  header: '',
                  accessor: (d: Document) => (
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${d.filename}`}
                        >
                          <Trash2 />
                        </Button>
                      }
                      title={`Delete ${d.filename}?`}
                      description="Its chunks and embeddings go with it, and answers will stop citing this source. This cannot be undone."
                      confirmLabel="Delete"
                      confirmingLabel="Deleting…"
                      onConfirm={async () => {
                        await api.deleteDocument(d.id);
                        await refresh();
                      }}
                      errorFallback="Could not delete that document."
                    />
                  ),
                },
              ]}
            />
          )}
        </QueryState>
      </div>
    </div>
  );
}

function IngestCard({ onIngested }: { onIngested: () => Promise<unknown> }) {
  const [filename, setFilename] = useState('');
  const [text, setText] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const ingest = useMutation({
    mutationFn: (input: File | { filename: string; text: string }) =>
      input instanceof File ? api.upload(input) : api.ingestText(input.filename, input.text),
    onSuccess: async (doc) => {
      toast.success(`Indexed ${doc.filename} into ${doc.chunks} chunks`);
      setFilename('');
      setText('');
      await onIngested();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Add a source</CardTitle>
        <CardDescription>
          Upload a PDF or text file, or paste text directly. Ingest is where the cost is —
          every chunk is embedded once here so queries only ever embed the question.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.txt,.md,.json,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) ingest.mutate(file);
              e.target.value = '';
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileInput.current?.click()}
            loading={ingest.isPending}
            loadingText="Embedding…"
          >
            <Upload />
            Upload a file
          </Button>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <Input
            placeholder="Name this snippet, e.g. onboarding-notes.md"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
          <Textarea
            placeholder="…or paste the text here."
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            disabled={!filename.trim() || !text.trim() || ingest.isPending}
            onClick={() => ingest.mutate({ filename: filename.trim(), text })}
          >
            Index this text
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
