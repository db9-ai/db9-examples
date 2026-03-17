# RAG Cloudflare Worker

Document indexing and search API using db9's `CHUNK_TEXT` function.

## Live Demo

https://db9-rag.db9.workers.dev

## Features

- Index URLs (via r.jina.ai markdown conversion)
- Index markdown content directly
- Smart chunking with QMD algorithm
- Full-text search

## API

### Index a URL

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/docs"}' \
  https://db9-rag.db9.workers.dev/index
```

### Index content

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"path":"/docs/guide.md","content":"# Guide\n\nContent..."}' \
  https://db9-rag.db9.workers.dev/index
```

### Search

```bash
curl "https://db9-rag.db9.workers.dev/search?q=keyword"
```

### List documents

```bash
curl "https://db9-rag.db9.workers.dev/docs"
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
  embedding vector(1024),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(path, chunk_idx)
);
```

## Deploy

1. Set secrets:
```bash
wrangler secret put DB9_API_TOKEN
```

2. Update `wrangler.toml` with your database ID

3. Deploy:
```bash
wrangler deploy
```

## Vector Search (when EMBED_TEXT is available)

```sql
-- Index with embeddings
INSERT INTO doc_chunks (path, chunk_idx, content, embedding)
SELECT '/docs/guide.md', c.chunk_index, c.chunk_text,
       EMBED_TEXT('titan-v2', c.chunk_text)
FROM CHUNK_TEXT(fs9_read('/docs/guide.md')) c;

-- Vector search
SELECT path, content,
       1 - (embedding <=> EMBED_TEXT('titan-v2', 'query')) AS score
FROM doc_chunks
ORDER BY embedding <=> EMBED_TEXT('titan-v2', 'query')
LIMIT 10;
```
