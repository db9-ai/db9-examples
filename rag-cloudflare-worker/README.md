# RAG Cloudflare Worker

Document indexing and search API using db9's `CHUNK_TEXT` + GIN full-text search.

## Live Demo

https://db9-rag.db9.workers.dev

## Features

- **Smart chunking** with `CHUNK_TEXT` (QMD algorithm)
- **GIN full-text search** with `tsvector` + `ts_rank`
- **Highlighted results** with `ts_headline`
- **Auto embedding ready** (when `EMBED_TEXT` available)

## API

### Index a URL

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/docs"}' \
  https://db9-rag.db9.workers.dev/index
```

### Full-Text Search (GIN)

```bash
# Simple search (words joined with AND)
curl "https://db9-rag.db9.workers.dev/search?q=postgres+agents"

# OR search
curl "https://db9-rag.db9.workers.dev/search?q=postgres|tikv"
```

Response includes ranking and highlighted snippets:
```json
{
  "query": "postgres agents",
  "tsquery": "postgres & agents",
  "search_type": "GIN_FTS",
  "results": [
    {
      "path": "/web/db9.ai",
      "chunk_idx": 0,
      "rank": 0.094,
      "highlight": "db9 — **Postgres** but for **agents**..."
    }
  ]
}
```

## Schema

```sql
CREATE TABLE docs (
  id SERIAL PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  source_url TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE doc_chunks (
  id SERIAL PRIMARY KEY,
  doc_id INT REFERENCES docs(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  chunk_idx INT NOT NULL,
  content TEXT NOT NULL,
  tsv tsvector,                    -- GIN full-text search
  embedding vector(1024),          -- Vector search (future)
  UNIQUE(path, chunk_idx)
);

-- GIN index for full-text search
CREATE INDEX idx_chunks_tsv ON doc_chunks USING GIN(tsv);

-- HNSW index for vector search — NOT YET AVAILABLE.
-- HNSW index building is gated off server-side in the current release, so the
-- statement below fails with XX000 (internal error). Leave it commented out:
-- vector search still works without it, using an exact sequential scan.
--
-- CREATE INDEX idx_chunks_embedding ON doc_chunks
--   USING hnsw (embedding vector_cosine_ops);
```

## How It Works

```
Input URL/Content
      ↓
CHUNK_TEXT() → Smart chunking (900 tokens, 15% overlap)
      ↓
to_tsvector() → Index for GIN search
      ↓
EMBED_TEXT() → Vector embedding (when available)
```

## Deploy

```bash
# Set secrets
wrangler secret put DB9_API_TOKEN

# Update wrangler.toml with your database
# Deploy
wrangler deploy
```
