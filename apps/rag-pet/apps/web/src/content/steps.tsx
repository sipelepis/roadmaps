import type { ReactNode } from 'react';

import type { Stats } from '@rag/shared';

import { Code, H, P, Where } from './prose';

/**
 * One entry per box on /flow. The list is the diagram *and* the pages behind
 * it: the node renders `label`, `detail` and `where`, and clicking it opens
 * `body()`. Keeping both in one record is what stops the map and the
 * explanations from disagreeing about what the pipeline does.
 *
 * `where` is the file that implements the step. Line numbers drift; the
 * function names in the snippets are the durable part.
 */

export interface Step {
  id: string;
  lane: 'ingest' | 'query';
  label: string;
  /** The one line under the label on the map. Real config where there is any. */
  detail: (s?: Stats) => string;
  where: string;
  /** Matching Learn article, where the concept has one. */
  learn?: string;
  title: string;
  summary: string;
  body: () => ReactNode;
}

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

export const STEPS: Step[] = [
  /* ── ingest ─────────────────────────────────────── */
  {
    id: 'source',
    lane: 'ingest',
    label: 'Upload or paste',
    detail: () => 'PDF, txt, md, csv, json',
    where: 'apps/api/app/main.py:93',
    title: 'A document arrives',
    summary: 'Two entry points, one path after the first few lines.',
    body: () => (
      <>
        <P>
          Everything the assistant can ever answer from enters here. There are two doors and they
          converge immediately: a multipart file upload, or a JSON body with a filename and a
          string. The dashboard offers both; the Flow page uses the second so it can show you the
          text going in.
        </P>
        <Code>{`@app.post("/api/documents/upload", response_model=Document)
async def ingest_upload(file: UploadFile) -> Document:
    raw = await file.read()
    name = file.filename or "upload"

@app.post("/api/documents/text", response_model=Document)
def ingest_text(body: IngestText) -> Document:
    return _ingest(body.filename, body.text, trace=body.trace)`}</Code>
        <P>
          The upload route reads the whole file into memory before doing anything with it. That is
          fine for the documents a pet project sees and wrong for a 400 MB PDF; the fix, when it
          matters, is to stream to a temporary file and hand the parser a path.
        </P>
        <H>What the filename is for</H>
        <P>
          It is not just a label. Every chunk carries its document's filename into the prompt, so
          the model can cite <em>which</em> source said the thing. Name a snippet
          <code> untitled</code> and the citations become useless to a reader even though retrieval
          works exactly as well.
        </P>
        <Where path="apps/api/app/main.py">
          Both routes are thin. All the shared work — chunk, embed, insert — lives in{' '}
          <code>_ingest()</code> at the bottom of the file, which is why the trace looks identical
          whichever door you came through.
        </Where>
      </>
    ),
  },
  {
    id: 'extract',
    lane: 'ingest',
    label: 'Extract text',
    detail: () => 'PdfReader per page, else utf-8',
    where: 'apps/api/app/main.py:96',
    title: 'Bytes become text',
    summary: 'A PDF is not text until someone makes it text — and sometimes nobody can.',
    body: () => (
      <>
        <P>
          Embeddings are computed over strings, so every format has to collapse to one first. The
          rule here is short enough to read in one go: if the name ends in <code>.pdf</code>, walk
          the pages and concatenate what the parser finds; otherwise decode the bytes as UTF-8 and
          replace anything that isn't.
        </P>
        <Code>{`if name.lower().endswith(".pdf"):
    text = "\\n".join(p.extract_text() or "" for p in PdfReader(BytesIO(raw)).pages)
else:
    text = raw.decode("utf-8", errors="replace")
if not text.strip():
    raise HTTPException(422, "No extractable text in that file")`}</Code>
        <H>Where this fails, and it does fail</H>
        <P>
          A scanned PDF — a photograph of a page — has no text layer at all.{' '}
          <code>extract_text()</code> returns empty for every page, the guard fires, and you get a
          422 rather than a document full of nothing. That guard is the difference between an
          obvious error at upload and a mysteriously useless corpus a week later.
        </P>
        <P>
          Fixing that case means OCR — Tesseract or a hosted equivalent — which is a real
          dependency and a real cost, so this project doesn't. Multi-column layouts are the subtler
          version of the same problem: the text extracts fine but arrives in reading order the
          parser guessed, and a table can come out interleaved.
        </P>
        <P>
          <code>errors="replace"</code> is the deliberate choice on the other branch. A file that
          is really Latin-1 produces a few replacement characters instead of a 500, and the rest of
          the document indexes normally.
        </P>
        <Where path="apps/api/app/main.py">
          The check is <code>if not text.strip()</code>, not <code>if not text</code> — a PDF that
          yields nothing but newlines is just as empty.
        </Where>
      </>
    ),
  },
  {
    id: 'chunk',
    lane: 'ingest',
    label: 'chunk_text()',
    detail: (s) => `${s?.chunk_chars ?? '—'} chars, ${s?.chunk_overlap ?? '—'} overlap`,
    where: 'apps/api/app/rag.py:18',
    learn: 'chunking',
    title: 'The document is cut into chunks',
    summary: 'A sliding window that backs off to whitespace, with a deliberate overlap.',
    body: () => (
      <>
        <P>
          Retrieval returns chunks, not documents, because a whole document is too big to paste
          into a prompt and too coarse to be precise. This is the function that decides what a
          chunk is — and it is plain string slicing, no tokenizer, no dependency.
        </P>
        <Code>{`while start < len(text):
    end = min(start + size, len(text))
    if end < len(text):
        space = text.rfind(" ", start + size // 2, end)
        if space > start:
            end = space
    piece = text[start:end].strip()
    if piece:
        chunks.append(piece)
    if end >= len(text):
        break
    start = max(end - overlap, start + 1)  # max() guarantees forward progress`}</Code>
        <H>The three decisions in there</H>
        <P>
          <strong>Back off to whitespace.</strong> A window that ends mid-word produces a chunk
          ending in <code>"the agreem"</code>, which embeds as something slightly wrong. The{' '}
          <code>rfind</code> searches backwards for a space, but only within the second half of the
          window, so a stretch of text with no spaces at all still makes progress instead of
          collapsing to tiny chunks.
        </P>
        <P>
          <strong>Overlap.</strong> Each chunk starts a fixed distance back from where the last one
          ended, so a sentence unlucky enough to straddle a boundary appears whole in one of the
          two. Without it, the answer to a question can be split across two chunks such that
          neither one retrieves.
        </P>
        <P>
          <strong>The <code>max()</code>.</strong> If <code>overlap</code> ever equalled{' '}
          <code>size</code>, <code>end - overlap</code> would return to where the loop started and
          it would spin forever. The guard makes that impossible; the constructor also rejects that
          configuration outright.
        </P>
        <P>
          Bigger chunks carry more context and dilute the match; smaller ones match sharply and
          answer thinly. The Flow page's dry run is the fastest way to feel that trade-off — change
          the numbers in <code>config.py</code>, split the same text, look at the difference.
        </P>
        <Where path="apps/api/app/rag.py">
          <code>chunk_text()</code>, with <code>chunk_chars</code> and <code>chunk_overlap</code>{' '}
          from settings. The overlap you see highlighted on /flow is measured afterwards by{' '}
          <code>shared_prefix()</code>, because backing off to whitespace means the real overlap is
          never exactly the configured number.
        </Where>
      </>
    ),
  },
  {
    id: 'embed-chunks',
    lane: 'ingest',
    label: 'embed()',
    detail: (s) => `one batched call → ${s?.embedding_dims ?? '—'} dims each`,
    where: 'apps/api/app/rag.py:51',
    learn: 'embeddings',
    title: 'Every chunk becomes a vector',
    summary: 'One network call for the whole document, and the only place ingest costs money.',
    body: () => (
      <>
        <P>
          An embedding model turns a string into a fixed-length list of floats positioned so that
          texts about the same thing land near each other. That is the entire trick retrieval rests
          on: no keyword matching, no stemming, just distance between points.
        </P>
        <Code>{`def embed(texts: list[str]) -> list[list[float]]:
    client = OpenAI(api_key=settings.embedding_api_key, base_url=settings.embedding_base_url)
    result = client.embeddings.create(model=settings.embedding_model, input=texts)
    return [d.embedding for d in result.data]`}</Code>
        <P>
          Note the plural. <code>input</code> takes the whole list, so a document of forty chunks is
          one HTTP request, not forty. The Flow page reports this as{' '}
          <strong>1 embedding call</strong> however many chunks came out, and it is the single
          biggest reason ingest of a large document is tolerable.
        </P>
        <H>The three settings that must agree</H>
        <P>
          <code>embedding_model</code> decides the meaning of the coordinates,{' '}
          <code>embedding_dims</code> must match the width of the database column, and{' '}
          <code>embedding_base_url</code> points at any OpenAI-compatible endpoint, api.openai.com by
          default.
        </P>
        <P>
          Change the model and every stored vector becomes meaningless: old chunks are coordinates
          in one space, new questions are coordinates in another, and the distances between them
          are noise. There is no migration for that beyond re-embedding the corpus. Change the
          dimensions too and Postgres will at least stop you — the column is declared at a fixed
          width.
        </P>
        <Where path="apps/api/app/rag.py">
          This is also the step that fails when <code>EMBEDDING_API_KEY</code> is missing: the
          console loads and lists documents happily, but ingest and query both die here, because
          they are the two calls that leave the machine.
        </Where>
      </>
    ),
  },
  {
    id: 'insert-document',
    lane: 'ingest',
    label: 'INSERT documents',
    detail: () => 'filename + length → id',
    where: 'apps/api/app/main.py:199',
    title: 'The document row is written',
    summary: 'One row per source, and the id every chunk will point back at.',
    body: () => (
      <>
        <P>
          Chunks are useless on their own — a passage with no idea where it came from can't be
          cited and can't be deleted. So the document row goes in first, and the id it returns
          becomes the foreign key on every chunk that follows.
        </P>
        <Code>{`row = conn.execute(
    "INSERT INTO documents (filename, chars) VALUES (%s, %s) RETURNING id, created_at",
    (filename, len(text)),
).fetchone()
document_id, created_at = row`}</Code>
        <P>
          <code>RETURNING</code> avoids the second round trip a <code>SELECT currval()</code> would
          cost, and hands back <code>created_at</code> from the database's own clock rather than
          the application's — one source of time, no drift between rows.
        </P>
        <P>
          <code>chars</code> is the length of the extracted text, not the size of the file. A 2 MB
          PDF that is mostly images might store 4,000 characters; the number the dashboard shows is
          how much text actually made it in, which is the number you want when a document retrieves
          badly.
        </P>
        <H>Nothing here deduplicates</H>
        <P>
          Upload the same file twice and you get two documents and two full sets of chunks, both of
          which will match the same questions. Retrieval will then happily fill the top five slots
          with two copies of the same passage. A unique constraint on the filename, or a hash of
          the text, is the small fix — this project skips it and lets you delete the duplicate from
          the dashboard.
        </P>
        <Where path="apps/api/app/main.py">
          Inside <code>_ingest()</code>, in the same connection block as the chunk insert below, so
          a failure between the two cannot leave a document with no chunks.
        </Where>
      </>
    ),
  },
  {
    id: 'insert-chunks',
    lane: 'ingest',
    label: 'INSERT chunks',
    detail: () => 'executemany: ordinal, text, vector',
    where: 'apps/api/app/main.py:215',
    title: 'The chunks and their vectors are written',
    summary: 'One statement, every chunk, one transaction.',
    body: () => (
      <>
        <P>
          Each chunk row carries four things: which document it belongs to, its position in that
          document, the text itself, and the vector. The text is stored alongside the vector
          because retrieval has to return something readable — a coordinate cannot be pasted into a
          prompt.
        </P>
        <Code>{`with conn.cursor() as cur:
    cur.executemany(
        "INSERT INTO chunks (document_id, ordinal, text, embedding) VALUES (%s, %s, %s, %s)",
        [(document_id, i, p, v) for i, (p, v) in enumerate(zip(pieces, vectors))],
    )`}</Code>
        <P>
          <code>executemany</code> sends the batch in one go rather than paying a round trip per
          chunk. Everything above runs inside a single connection block, so the document row and
          all of its chunks commit together: an interrupted ingest leaves nothing behind rather
          than a document with half its content.
        </P>
        <H>Why the ordinal matters</H>
        <P>
          <code>ordinal</code> is the chunk's index within its document, and it is the only reason
          you can tell "chunk 0" from "chunk 7" in a citation. It also leaves the door open for a
          useful trick this project doesn't do yet: fetching the neighbours of a matched chunk to
          widen context before prompting.
        </P>
        <P>
          The <code>zip(pieces, vectors)</code> pairs each chunk with its embedding positionally —
          which is safe precisely because the embedding API returns results in input order.
        </P>
        <Where path="apps/api/app/main.py">
          The <code>rowcount</code> from this statement is what the Flow page reports as{' '}
          <strong>rows inserted</strong>, so the number you see is the database's count, not a
          length computed in Python.
        </Where>
      </>
    ),
  },
  {
    id: 'stored',
    lane: 'ingest',
    label: 'VECTOR column',
    detail: (s) => `${plural(s?.chunks ?? 0, 'vector')} in pgvector`,
    where: 'apps/api/app/db.py:8',
    title: 'It lives in pgvector now',
    summary: 'An ordinary Postgres table with one extraordinary column type.',
    body: () => (
      <>
        <P>
          There is no separate vector database here. The <code>vector</code> extension adds a
          column type and a set of distance operators to Postgres, and that is the whole of the
          infrastructure — chunks sit in a normal table, next to normal columns, covered by normal
          transactions and normal backups.
        </P>
        <Code>{`CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chunks (
    id          SERIAL PRIMARY KEY,
    document_id INT  NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ordinal     INT  NOT NULL,
    text        TEXT NOT NULL,
    embedding   VECTOR({dims}) NOT NULL
);`}</Code>
        <P>
          <code>ON DELETE CASCADE</code> is doing real work: deleting a document from the dashboard
          removes its chunks in the same statement. Without it, deleted sources would keep
          answering questions — the worst kind of bug, because the console would show an empty
          corpus while the model kept citing a document nobody can see.
        </P>
        <H>The index that isn't here</H>
        <P>
          The only index is on <code>document_id</code>. There is no approximate-nearest-neighbour
          index on the vector column, which means every query compares the question against every
          chunk — an exact scan. That is a deliberate choice: exact search has no recall loss, no
          tuning parameters, and stays fast well past a hundred thousand chunks.
        </P>
        <Code>{`-- when queries start to drag:
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);`}</Code>
        <P>
          Adding that index trades a little accuracy for a lot of speed and is the right move at a
          scale this project does not have. The comment marking that trade-off sits directly above
          the pool in <code>db.py</code>.
        </P>
        <Where path="apps/api/app/db.py">
          The schema is created on boot by <code>startup()</code>, with <code>{'{dims}'}</code>{' '}
          formatted in from settings — which is why the embedding dimensions and the column width
          can never disagree on a fresh database.
        </Where>
      </>
    ),
  },

  /* ── query ──────────────────────────────────────── */
  {
    id: 'question',
    lane: 'query',
    label: 'Question',
    detail: () => 'plain text from you',
    where: 'apps/web/src/pages/ask.tsx',
    title: 'A question comes in',
    summary: 'Validated at the edge, and nothing about it is searched as text.',
    body: () => (
      <>
        <P>
          The question arrives as JSON and is checked before it reaches any code that costs money.
          Pydantic enforces the bounds, so an empty question or a request for a thousand chunks is
          a 422 rather than an expensive mistake.
        </P>
        <Code>{`class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)
    trace: bool = False`}</Code>
        <P>
          <code>top_k</code> is how many chunks retrieval keeps. It is capped at 20 because
          everything retrieved gets pasted into the prompt: raising it raises cost and latency on
          every single query, and past a point it lowers answer quality by burying the good passage
          among mediocre ones.
        </P>
        <P>
          <code>trace</code> is what this page runs on. It is off by default, so the Ask page's
          responses stay small — a full trace carries the question's vector and the entire prompt
          back over the wire, which is exactly what you want here and pure waste there.
        </P>
        <H>Nothing here searches for words</H>
        <P>
          Worth saying plainly, because it is the most common wrong mental model: the question text
          is never matched against the chunk text. No keywords, no LIKE, no full-text index. The
          only thing that gets compared is the vector produced in the next step, which is why a
          question phrased completely differently from the document can still retrieve it — and why
          an exact quotation sometimes doesn't.
        </P>
        <Where path="apps/api/app/models.py">
          These models are the only definition of the wire contract; the TypeScript the console
          uses is generated from them. Add a field here and it appears in the frontend after{' '}
          <code>nx run shared:codegen</code>.
        </Where>
      </>
    ),
  },
  {
    id: 'embed-question',
    lane: 'query',
    label: 'embed()',
    detail: (s) => `same model, same ${s?.embedding_dims ?? '—'} dims`,
    where: 'apps/api/app/rag.py:51',
    learn: 'embeddings',
    title: 'The question becomes a vector',
    summary: 'The same function that embedded the chunks, called with a list of one.',
    body: () => (
      <>
        <P>
          Retrieval compares coordinates, so the question has to become a coordinate in the same
          space the chunks live in. That means the same model and the same dimensions — this is
          literally the same function ingest called, handed a single-element list.
        </P>
        <Code>{`vector = rag.embed([body.question])[0]`}</Code>
        <P>
          Because it is one string, it is one API call regardless of corpus size. Querying a
          million chunks costs exactly the same embedding request as querying three: the expensive
          half of RAG was already paid at ingest. That asymmetry is the reason the architecture is
          shaped this way.
        </P>
        <H>Why a mismatch is silent</H>
        <P>
          If the chunks were embedded with one model and questions are embedded with another, every
          call still succeeds and every query still returns five chunks. They are simply the wrong
          five, forever, with plausible-looking scores. Nothing errors, so the only way to catch it
          is to notice that retrieval got vague — which is precisely what the score column on this
          page is for.
        </P>
        <P>
          The Flow page draws the leading dimensions of the vector as bars. There is no meaning in
          any individual bar; the point is that the question has become 1,536 numbers and nothing
          about the original words survives into the search.
        </P>
        <Where path="apps/api/app/rag.py">
          Same <code>embed()</code> as the ingest step. One function, two callers, no chance of the
          question and the chunks being embedded differently.
        </Where>
      </>
    ),
  },
  {
    id: 'search',
    lane: 'query',
    label: 'ORDER BY <=>',
    detail: (s) => `cosine over ${plural(s?.chunks ?? 0, 'chunk')}`,
    where: 'apps/api/app/main.py:116',
    learn: 'retrieval',
    title: 'Every chunk is compared to it',
    summary: 'One SQL statement is the entire search engine.',
    body: () => (
      <>
        <P>
          This is the step people expect to be complicated. It is a single query, and the whole of
          the retrieval logic is in the <code>ORDER BY</code>.
        </P>
        <Code>{`SELECT c.id, c.document_id, d.filename, c.ordinal, c.text,
       1 - (c.embedding <=> %s::vector) AS score
FROM chunks c JOIN documents d ON d.id = c.document_id
ORDER BY c.embedding <=> %s::vector
LIMIT %s`}</Code>
        <P>
          <code>{'<=>'}</code> is pgvector's cosine distance operator: 0 when two vectors point the
          same way, 2 when they point opposite. Ordering ascending by it puts the closest chunks
          first. The <code>1 - distance</code> in the select list flips that into the similarity
          score the console shows, where 1.00 is identical and 0.00 is unrelated.
        </P>
        <H>What "exact scan" means here</H>
        <P>
          With no ANN index, Postgres computes the distance between the question and{' '}
          <em>every</em> chunk before applying the LIMIT — which is why the trace reports how many
          chunks were scanned. Nothing is skipped and nothing is approximate, so the top five are
          genuinely the top five.
        </P>
        <P>
          There is also no score threshold. If the corpus contains nothing relevant, this still
          returns the five least-irrelevant chunks with low scores, and the model is then asked to
          answer from them. The instruction to say so plainly when the sources don't contain the
          answer is what covers that case — a threshold here would be the other way to do it.
        </P>
        <H>This is where RAG usually breaks</H>
        <P>
          If the right passage is not in these rows, no amount of prompt engineering downstream can
          recover it — the model never sees it. When an answer is wrong, read the retrieved chunks
          first: the answer being absent from them is a retrieval problem (chunking, embeddings,
          top_k), and the answer being present but ignored is a generation problem.
        </P>
        <Where path="apps/api/app/main.py">
          The vector is passed as a parameter twice — once for the score, once for the ordering —
          because the planner evaluates them in different clauses.
        </Where>
      </>
    ),
  },
  {
    id: 'prompt',
    lane: 'query',
    label: 'build_prompt()',
    detail: () => 'top-k pasted in, numbered',
    where: 'apps/api/app/rag.py:57',
    title: 'The chunks become the prompt',
    summary: 'String concatenation. That is the whole of "augmented generation".',
    body: () => (
      <>
        <P>
          The retrieved chunks are numbered, tagged with their filename, and glued together above
          the question. There is no framework and no template engine — the augmentation in
          "retrieval-augmented generation" is this f-string.
        </P>
        <Code>{`def build_prompt(question: str, sources: list[Chunk]) -> str:
    context = "\\n\\n".join(
        f"[{i}] ({c.filename}) {c.text}" for i, c in enumerate(sources, 1)
    )
    return f"{context}\\n\\nQuestion: {question}"`}</Code>
        <P>
          The numbering exists so the model has something to cite. <code>enumerate(sources, 1)</code>{' '}
          starts at 1 because <code>[1]</code> reads like a citation and <code>[0]</code> reads like
          a bug. The filename rides along so a citation can name its source rather than just a
          number.
        </P>
        <H>The system prompt does the rest</H>
        <P>
          Two of its instructions are load-bearing. "Using only the numbered sources" is what makes
          the answer grounded rather than a general-knowledge guess. "If the sources don't contain
          the answer, say so plainly" is what turns an empty retrieval into an honest{' '}
          <em>I don't know</em> instead of a fluent invention.
        </P>
        <P>
          The third instruction is unglamorous and entirely practical: write plain prose, no
          markdown. The console renders the answer as text, so asking the model not to emit{' '}
          <code>**bold**</code> was cheaper than shipping a markdown renderer.
        </P>
        <P>
          This function exists separately from <code>answer()</code> for one reason: so the traced
          run on /flow can show you the exact string that was sent, rather than a description of
          it.
        </P>
        <Where path="apps/api/app/rag.py">
          <code>build_prompt()</code>, called both by <code>answer()</code> and by the trace, so
          what the page displays cannot drift from what the model received.
        </Where>
      </>
    ),
  },
  {
    id: 'generate',
    lane: 'query',
    label: 'Claude',
    detail: (s) => s?.chat_model ?? '—',
    where: 'apps/api/app/rag.py:66',
    learn: 'generation',
    title: 'The model writes the answer',
    summary: 'One call, no tools, no memory — everything it knows arrived in the prompt.',
    body: () => (
      <>
        <P>
          A single messages request. No conversation history, no tool use, no retrieval loop: the
          model sees the system prompt and one user message containing the chunks and the question,
          and writes prose.
        </P>
        <Code>{`response = client.messages.create(
    model=settings.chat_model,
    max_tokens=2048,
    system=SYSTEM,
    output_config={"effort": "low"},
    messages=[{"role": "user", "content": build_prompt(question, sources)}],
)
return "".join(b.text for b in response.content if b.type == "text")`}</Code>
        <P>
          <code>effort: low</code> is a deliberate setting. This task is grounded extraction —
          find the relevant lines in five passages and restate them accurately — which does not
          need deep reasoning. Raising it costs latency on every query; the note in the source says
          to raise it if answers start missing things spread across several sources.
        </P>
        <P>
          The response is assembled by filtering for text blocks, which is what makes the call
          robust to a response that contains anything else.
        </P>
        <H>The short-circuit above it</H>
        <Code>{`if not sources:
    return "Nothing indexed yet — upload a document first."`}</Code>
        <P>
          With an empty corpus there is nothing to ground an answer in, so the model is never
          called at all. It saves a pointless request, and more importantly it prevents the one
          case where an ungrounded model would answer from its own training and look exactly like a
          working RAG system.
        </P>
        <Where path="apps/api/app/rag.py">
          <code>answer()</code>. This and <code>embed()</code> are the only two calls in the whole
          project that leave the machine.
        </Where>
      </>
    ),
  },
  {
    id: 'answer',
    lane: 'query',
    label: 'Cited answer',
    detail: () => 'prose + the chunks behind it',
    where: 'apps/web/src/pages/ask.tsx',
    title: 'You get the answer and its receipts',
    summary: 'The chunks are shown with their scores, which is what makes the thing debuggable.',
    body: () => (
      <>
        <P>
          The response carries both halves — the prose and the exact chunks it was built from —
          and the console shows both. That is a deliberate product decision, not a debug view: a
          RAG answer you cannot check is a claim you have to take on faith.
        </P>
        <Code>{`class QueryResponse(BaseModel):
    answer: str
    sources: list[Chunk]
    trace: Trace | None = None`}</Code>
        <P>
          Each source is rendered with its filename, its ordinal and its similarity score, in the
          same order the model saw them — so <code>[2]</code> in the prose is the second card on
          the page.
        </P>
        <H>How to read a wrong answer</H>
        <P>
          The scores turn a vague "the AI got it wrong" into a two-branch diagnosis, and you can
          run it in about ten seconds:
        </P>
        <Code>{`Is the answer present in the retrieved chunks?
  no  → retrieval problem. Chunking, embeddings, top_k.
  yes → generation problem. Fix the prompt.`}</Code>
        <P>
          Those two failures look identical from the outside and have nothing in common as fixes.
          Rewriting a prompt to repair bad retrieval is the most common wasted afternoon in this
          field, and showing the chunks is what prevents it.
        </P>
        <Where path="apps/web/src/pages/ask.tsx">
          The Ask page renders exactly this, minus the trace. If a passage that should have matched
          is missing from the list, start at the retrieval step, not here.
        </Where>
      </>
    ),
  },
];

export const stepById = (id: string) => STEPS.find((s) => s.id === id);
export const stepsInLane = (lane: Step['lane']) => STEPS.filter((s) => s.lane === lane);
