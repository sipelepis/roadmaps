# Product: RAG Roadmap

<!-- impeccable:product-schema 1 -->

App-specific record for `apps/rag-roadmap`. Users, positioning, principles, brand voice, and constraints are shared with the other roadmaps and live in the root `PRODUCT.md`. This file holds only what differs.

## Platform

web

## Users

Same as root, one step further along: a developer who can already write Python and wants to understand how a document becomes a grounded answer. The articles assume comfort with lists, dicts, and functions, and explain everything about retrieval from scratch.

## Product Purpose

Teach RAG and OCR in dependency order, from a page that is a picture to an answer that cites its sources, with every step runnable in the browser and a capstone that assembles the whole pipeline.

## Operating Context

- 16 modules, each with a playground, 54 exercises. Stages in graph order: Foundations, From documents to chunks, Vectors and search, Answers you can trust, In practice.
- Module labels: What RAG actually is, Documents to text, OCR: pages as pictures, Cleaning extracted text, Chunking, Structure & metadata, Embeddings, Storing vectors, Keyword search & BM25, Retrieval, Grounded prompts, Reranking & diversity, Evaluating retrieval, Injection & limits, At 10 million documents, Build the OCR → RAG pipeline.
- Runtime: the Python roadmap's shell unchanged. Pyodide from jsDelivr on first run; Monaco with Python highlighting; `test_*` functions with `assert`.
- Source material: `apps/rag-pet`. The articles restate its Learn section and Flow steps; the exercises reimplement its pipeline functions. Its live console at `https://rag-pet.fly.dev` is the place to see the real thing run.
- Not yet deployed. No Vercel project exists for this app.

## Capabilities and Constraints

- Exercises must run offline with the standard library only. Embeddings are a deterministic hashed bag of words (`zlib.crc32`), OCR is a function passed in, the vector store is a list. The article for each says so.
- Brand mark: white "RAG" on violet (#7c3aed). The only colour that differs from the other roadmaps.
- Undecided: whether the capstone should also drive the real rag-pet API from the page, and whether a Tesseract-in-WebAssembly demo belongs in the OCR module.

## Evidence on Hand

- 16 articles under `src/content/`, each with starter and test blocks, all verified against reference solutions.
- No usage data. Do not invent completion rates or learner counts.
