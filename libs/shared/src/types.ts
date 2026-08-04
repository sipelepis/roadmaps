/**
 * Readable names for the generated schemas. This file is the entire hand-written
 * surface of @rag/shared — everything it points at comes from the FastAPI
 * pydantic models via `nx run shared:codegen`. Adding a field on the Python side
 * and re-running codegen makes it appear here for free; there is no second
 * definition to keep in sync.
 */
import type { components } from './api.gen.ts';

type Schemas = components['schemas'];

export type Health = Schemas['Health'];
export type Document = Schemas['Document'];
export type Chunk = Schemas['Chunk'];
export type IngestText = Schemas['IngestText'];
export type QueryRequest = Schemas['QueryRequest'];
export type QueryResponse = Schemas['QueryResponse'];
export type Trace = Schemas['Trace'];
export type ChunkPreview = Schemas['ChunkPreviewResponse'];
export type Stats = Schemas['Stats'];
