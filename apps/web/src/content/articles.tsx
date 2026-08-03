import type { ReactNode } from 'react';

/**
 * The Learn section. Articles are plain components rather than markdown so
 * there's no parser and no dependency — the whole "content system" is this
 * file plus three helpers. Swap in MDX if these ever outgrow hand-written JSX.
 */

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 font-heading text-lg text-foreground">{children}</h2>;
}

function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-elevation-2 p-3 text-xs leading-relaxed text-foreground">
      <code>{children}</code>
    </pre>
  );
}

/** Points at the file in this repo that implements what the paragraph describes. */
function Where({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-elevation-1 p-3">
      <div className="font-mono text-[11px] uppercase tracking-widest text-primary-strong">
        {path}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export interface Article {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  body: () => ReactNode;
}

export const ARTICLES: Article[] = [
  {
    slug: 'what-is-rag',
    title: 'What RAG actually is',
    summary:
      'Retrieval-Augmented Generation is a search problem wearing an AI hat. Four steps, and only one of them involves a language model.',
    minutes: 4,
    body: () => (
      <>
        <P>
          A language model knows what was in its training data. It does not know what is in
          your documents, and when you ask it anyway, it will often produce something
          plausible and wrong. RAG fixes that in the dullest way possible: before asking the
          model anything, go find the relevant passages yourself and paste them into the
          prompt.
        </P>
        <P>
          That is the whole idea. "Retrieval-Augmented Generation" is three words for
          <em> look it up first, then answer</em>.
        </P>

        <H>The four steps</H>
        <Code>{`INGEST (once per document)
  document → split into chunks → embed each chunk → store vectors

QUERY (every question)
  question → embed → find nearest chunks → paste into prompt → model answers`}</Code>
        <P>
          Notice the split. Ingest is slow and costs money per document; you pay it once.
          Query is fast and costs one small embedding plus one model call. This is why the
          Dashboard shows chunk counts — chunks are the unit of everything downstream.
        </P>

        <H>Only step four is "AI"</H>
        <P>
          Steps one through three are chunking, an embedding API call, and a database query.
          When a RAG system gives a bad answer, the cause is almost always in those three
          steps, not in the model. The retrieved passage did not contain the answer, so the
          model had nothing to work with. That is why the Ask page shows you the retrieved
          chunks next to the answer: it turns "the AI is wrong" into a question you can
          actually debug.
        </P>

        <Where path="apps/api/app/main.py">
          The <code>_ingest</code> function is the top row; the <code>/api/query</code>{' '}
          handler is the bottom row. About sixty lines for the whole loop.
        </Where>

        <H>When not to bother</H>
        <P>
          If your documents fit in the model's context window, skip all of this and paste
          them in. A 1M-token context holds a lot of pages. RAG earns its complexity when the
          corpus is bigger than the window, changes often, or is large enough that sending
          all of it on every question would be wasteful.
        </P>
      </>
    ),
  },

  {
    slug: 'chunking',
    title: 'Chunking: why documents get cut up',
    summary:
      'You cannot retrieve half a document. Chunk size decides what "relevant" can even mean — and it is the setting most worth tuning.',
    minutes: 5,
    body: () => (
      <>
        <P>
          Retrieval returns whole units. If a unit is an entire 80-page PDF, then "relevant"
          means "this PDF is roughly on topic" — useless. If a unit is one sentence, you get
          a precise match with none of the surrounding context needed to understand it. Chunk
          size is the dial between those two failures.
        </P>

        <H>The tradeoff, concretely</H>
        <Code>{`small chunks (~200 chars)   sharp matches, but answers lose context
large chunks (~4000 chars)  full context, but the match is diluted
                            by everything else in the chunk`}</Code>
        <P>
          This repo defaults to 1200 characters with 200 characters of overlap — roughly a
          long paragraph. That is a reasonable starting point for prose, not a law. Dense
          reference material wants smaller; narrative wants larger.
        </P>

        <H>Why chunks overlap</H>
        <P>
          A hard cut at 1200 characters will eventually land in the middle of the one
          sentence that answers the question, splitting it across two chunks so that neither
          one matches well. Overlapping the chunks by 200 characters means every boundary
          appears intact inside a neighbouring chunk. You pay for it in storage and a little
          duplication in results — a cheap insurance premium.
        </P>

        <Where path="apps/api/app/rag.py">
          <code>chunk_text()</code> is a sliding window that backs off to the nearest space
          so it never splits a word. Twenty lines, no library. The tests in{' '}
          <code>apps/api/tests/test_rag.py</code> pin the two things that matter: it always
          makes progress, and it covers the whole text.
        </Where>

        <H>What to try when answers are bad</H>
        <P>
          Change <code>CHUNK_CHARS</code> in the API's environment, re-ingest, and ask the
          same question again. Watch the similarity scores on the Ask page. If the right
          passage climbs the ranking, the chunk size was the problem. Re-ingesting is
          required because embeddings are computed per chunk at ingest time — changing the
          size changes every vector.
        </P>
      </>
    ),
  },

  {
    slug: 'embeddings',
    title: 'Embeddings: turning meaning into coordinates',
    summary:
      'An embedding is a list of numbers that places a piece of text somewhere in space, so that similar text lands nearby. That is the trick the whole system rests on.',
    minutes: 5,
    body: () => (
      <>
        <P>
          Keyword search fails on "how do I cancel" versus "terminating your subscription" —
          zero shared words, same meaning. Embeddings fix that by mapping text to a point in
          a high-dimensional space where nearness means similar meaning rather than similar
          spelling.
        </P>

        <H>What one looks like</H>
        <Code>{`"how do I cancel"  →  [0.021, -0.118, 0.334, … ]   1536 numbers
"terminating my subscription" → [0.019, -0.101, 0.341, … ]   very close by
"the mitochondria is the powerhouse"  → [ … ]   far away`}</Code>
        <P>
          The model that produces these — here, OpenAI's{' '}
          <code>text-embedding-3-small</code> — was trained so that this property holds. 1536
          numbers per chunk is the size it emits, which is why the database column is
          declared <code>VECTOR(1536)</code>. Change the embedding model and that number
          changes with it.
        </P>

        <H>Measuring nearness</H>
        <P>
          Cosine similarity compares the <em>direction</em> of two vectors, ignoring their
          length. It runs from 1.00 (pointing the same way — near-identical meaning) down to
          0.00 (unrelated). Those are the numbers on the right of each chunk on the Ask page.
          In practice anything above ~0.4 is worth reading and anything below ~0.2 is noise,
          though the useful range shifts by model and by corpus.
        </P>

        <Where path="apps/api/app/db.py">
          The <code>chunks</code> table stores each vector in a <code>VECTOR</code> column
          from the pgvector extension. The <code>&lt;=&gt;</code> operator in the query
          handler is cosine distance; <code>1 - distance</code> is the similarity score you
          see in the UI.
        </Where>

        <H>Why Postgres and not a vector database</H>
        <P>
          pgvector puts vectors in a column next to your ordinary data, so a document's
          filename, its chunks, and their embeddings live in one place with one query
          language and one backup. A dedicated vector database becomes worth the extra
          service when you need heavy metadata filtering or hundreds of millions of vectors.
          For a corpus you can imagine, it is a service to run for no benefit.
        </P>

        <H>The index you do not have yet</H>
        <P>
          This repo scans every vector on every query. That sounds bad and is fine: exact
          scanning stays fast well past a hundred thousand chunks. When it stops being fast,
          add an HNSW index — a one-line migration that trades a little recall for a large
          speedup. It is marked with a <code>ponytail:</code> comment in{' '}
          <code>db.py</code> so you can find it when you need it.
        </P>
      </>
    ),
  },

  {
    slug: 'retrieval',
    title: 'Retrieval: where RAG usually breaks',
    summary:
      'Top-k, similarity thresholds, and why a confident wrong answer is nearly always a retrieval bug rather than a model bug.',
    minutes: 4,
    body: () => (
      <>
        <P>
          The retrieval step is one SQL query: embed the question, order every chunk by
          distance to it, take the first k. Everything the model will ever see about your
          corpus is decided right there.
        </P>

        <Code>{`SELECT text, 1 - (embedding <=> :question_vector) AS score
FROM chunks
ORDER BY embedding <=> :question_vector
LIMIT 5`}</Code>

        <H>Choosing k</H>
        <P>
          Too low and the answer is missing; too high and the genuinely relevant passage gets
          buried in four irrelevant ones, which measurably degrades the answer. Five is a
          sane default for focused questions. Raise it for questions that need to synthesise
          across sources, lower it when your chunks are large.
        </P>

        <H>The diagnostic that matters</H>
        <P>
          When an answer is wrong, look at the retrieved chunks before touching the prompt:
        </P>
        <Code>{`Is the answer present in the retrieved chunks?
  no  → retrieval problem. Fix chunking, k, or the corpus itself.
  yes → generation problem. Fix the prompt.`}</Code>
        <P>
          Most people skip this check and spend a day rewriting prompts to extract an answer
          from text that was never retrieved. The Ask page puts the chunks directly under the
          answer specifically so this check takes five seconds.
        </P>

        <Where path="apps/api/app/main.py">
          The <code>query</code> handler. Note it embeds only the question — one short API
          call — because the chunks were embedded back at ingest.
        </Where>

        <H>What to reach for next</H>
        <P>
          Two upgrades earn their complexity, in this order. <strong>Hybrid search</strong>{' '}
          runs keyword search alongside vector search and merges the results, which rescues
          exact identifiers — error codes, part numbers, surnames — that embeddings blur
          together. <strong>Reranking</strong> retrieves ~20 candidates and has a small model
          re-score them against the question, buying precision for one extra call. Neither is
          here yet, and neither is worth adding before you have a question this system
          demonstrably gets wrong.
        </P>
      </>
    ),
  },

  {
    slug: 'generation',
    title: 'Generation: chunks in, grounded answer out',
    summary:
      'The last step is one model call. What matters is what you put in the prompt, and what you tell it to do when the answer is not there.',
    minutes: 4,
    body: () => (
      <>
        <P>
          After retrieval you have five passages and a question. Generation is assembling
          them into a prompt and making a single call. There is no chain, no agent, no
          framework — a string and an API call.
        </P>

        <Code>{`system: Answer using only the numbered sources below. Cite them as [1], [2].
        If the sources don't contain the answer, say so — do not guess.

user:   [1] (handbook.pdf) Employees accrue 1.5 days per month…
        [2] (policy.md) Unused leave expires at year end…

        Question: how much leave do I get?`}</Code>

        <H>The two instructions doing the work</H>
        <P>
          <strong>"Only the sources"</strong> is what makes the answer grounded — without it
          the model happily blends in half-remembered training data, and you lose the one
          property RAG exists to provide.{' '}
          <strong>"Say so if the answer is not there"</strong> gives it a permitted way to
          fail. Without an escape hatch, a model asked a question its context cannot answer
          will construct something anyway. "I don't see that in these documents" is a correct
          answer, and you have to explicitly allow it.
        </P>

        <H>Citations are not decoration</H>
        <P>
          Asking for <code>[1]</code>-style markers gives every claim a traceable origin, so
          a reader can check the specific chunk rather than trusting the paragraph wholesale.
          It also tends to make the answer more faithful — a claim that has to name its
          source is harder to invent.
        </P>

        <Where path="apps/api/app/rag.py">
          The <code>SYSTEM</code> constant and <code>answer()</code>. It runs at{' '}
          <code>effort: "low"</code> — pulling a fact out of provided text does not need deep
          reasoning, and low effort is faster and cheaper. Raise it if answers start missing
          things spread across several chunks.
        </Where>

        <H>Where the types come from</H>
        <P>
          The shape of the answer — <code>QueryResponse</code>, with its answer string and
          its list of sources — is declared once, in Python, in{' '}
          <code>apps/api/app/models.py</code>. Running <code>npm run codegen</code> turns
          FastAPI's OpenAPI schema into TypeScript types that the dashboard imports. Add a
          field on the Python side, re-run it, and the frontend sees the field. There is no
          second definition to drift.
        </P>
      </>
    ),
  },
];

export const articleBySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug);
