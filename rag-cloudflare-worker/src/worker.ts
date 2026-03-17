/**
 * db9-rag-worker - Document indexing and search API
 * 
 * Features:
 * - Smart chunking with CHUNK_TEXT
 * - GIN full-text search with tsvector
 * - Auto embedding ready (when EMBED_TEXT available)
 * 
 * Endpoints:
 * POST /index   - Index URL or markdown content
 * GET  /search  - Full-text search
 * GET  /docs    - List indexed documents
 */

import postgres from 'postgres';

interface Env {
  DB9_API_TOKEN: string;
  DB9_DATABASE: string;
  DB9_API_URL?: string;
}

interface ConnectTokenResponse {
  host: string;
  port: number;
  database: string;
  user: string;
  token: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function getConnection(env: Env) {
  const apiUrl = env.DB9_API_URL || 'https://api.staging.db9.ai';
  const res = await fetch(`${apiUrl}/customer/databases/${env.DB9_DATABASE}/connect-token`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.DB9_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error('Database connection failed');
  const ct: ConnectTokenResponse = await res.json();
  return postgres(`postgresql://${ct.user}:${encodeURIComponent(ct.token)}@${ct.host}:${ct.port}/${ct.database}`, {
    ssl: 'require', max: 1, idle_timeout: 5, connect_timeout: 10,
  });
}

async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`);
  if (!res.ok) throw new Error(`Failed to fetch: ${url}`);
  return res.text();
}

const landingPage = `<!DOCTYPE html>
<html>
<head>
  <title>db9 RAG API</title>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; background: #0d1117; color: #c9d1d9; }
    h1 { color: #58a6ff; }
    h2 { color: #8b949e; margin-top: 30px; }
    code { background: #161b22; padding: 2px 6px; border-radius: 3px; color: #7ee787; }
    pre { background: #161b22; padding: 15px; border-radius: 6px; overflow-x: auto; }
    a { color: #58a6ff; }
    .badge { background: #238636; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px; }
    input, button { padding: 10px; margin: 5px 0; border-radius: 5px; border: 1px solid #30363d; }
    input { background: #161b22; color: #c9d1d9; width: 300px; }
    button { background: #238636; color: white; cursor: pointer; border: none; }
    button:hover { background: #2ea043; }
    #result { margin-top: 20px; padding: 15px; background: #161b22; border-radius: 6px; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
    .tag { background: #388bfd26; color: #58a6ff; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 5px; }
  </style>
</head>
<body>
  <h1>📚 db9 RAG API <span class="badge">CHUNK_TEXT</span> <span class="tag">GIN FTS</span> <span class="tag">VECTOR</span></h1>
  
  <h2>Index URL</h2>
  <input type="text" id="url" placeholder="https://example.com/docs" />
  <button onclick="indexUrl()">Index</button>
  
  <h2>Full-Text Search</h2>
  <input type="text" id="query" placeholder="search query (supports AND/OR)" />
  <button onclick="search()">Search</button>
  
  <div id="result"></div>
  
  <h2>API</h2>
  <pre>
# Index a URL
POST /index
{"url": "https://example.com/page"}

# Index markdown content  
POST /index
{"path": "/docs/guide.md", "content": "# Guide..."}

# Hybrid search (FTS + Vector with RRF)
GET /search?q=postgres+agents

# Vector-only search
GET /search?q=postgres+agents&mode=vector

# FTS-only search  
GET /search?q=postgres+agents&mode=fts

# List docs
GET /docs</pre>

  <script>
    async function indexUrl() {
      const url = document.getElementById('url').value;
      document.getElementById('result').textContent = 'Indexing...';
      const res = await fetch('/index', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({url})
      });
      document.getElementById('result').textContent = JSON.stringify(await res.json(), null, 2);
    }
    async function search() {
      const q = document.getElementById('query').value;
      const res = await fetch('/search?q=' + encodeURIComponent(q));
      document.getElementById('result').textContent = JSON.stringify(await res.json(), null, 2);
    }
  </script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(landingPage, { headers: { 'Content-Type': 'text/html' } });
    }
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    const sql = await getConnection(env);
    
    try {
      // POST /index - Index URL or content
      if (url.pathname === '/index' && request.method === 'POST') {
        const body = await request.json() as { url?: string; path?: string; content?: string };
        
        let path: string;
        let content: string;
        let sourceUrl: string | null = null;
        
        if (body.url) {
          content = await fetchUrl(body.url);
          path = '/web/' + body.url.replace(/^https?:\/\//, '').replace(/\//g, '_');
          sourceUrl = body.url;
        } else if (body.path && body.content) {
          path = body.path;
          content = body.content;
        } else {
          return Response.json({ error: 'Provide url or path+content' }, { status: 400, headers: corsHeaders });
        }
        
        // Insert doc
        if (sourceUrl) {
          await sql`
            INSERT INTO docs (path, content, source_url)
            VALUES (${path}, ${content}, ${sourceUrl})
            ON CONFLICT (path) DO UPDATE SET content = ${content}, source_url = ${sourceUrl}
          `;
        } else {
          await sql`
            INSERT INTO docs (path, content)
            VALUES (${path}, ${content})
            ON CONFLICT (path) DO UPDATE SET content = ${content}
          `;
        }
        
        // Get doc_id
        const docResult = await sql`SELECT id FROM docs WHERE path = ${path}`;
        const docId = docResult[0]?.id;
        
        if (!docId) {
          throw new Error('Failed to get doc_id');
        }
        
        // Delete old chunks
        await sql`DELETE FROM doc_chunks WHERE path = ${path}`;
        
        // Chunk content
        const escapedContent = content.replace(/'/g, "''");
        const chunkResult = await sql.unsafe(`SELECT chunk_index, chunk_text FROM CHUNK_TEXT('${escapedContent}')`);
        
        // Insert chunks with tsvector + embedding
        let insertedCount = 0;
        for (const chunk of chunkResult) {
          const chunkText = chunk.chunk_text?.trim();
          if (!chunkText) continue; // Skip empty chunks
          
          const escapedText = chunkText.replace(/'/g, "''");
          const escapedPath = path.replace(/'/g, "''");
          
          await sql.unsafe(`
            INSERT INTO doc_chunks (doc_id, path, chunk_idx, content, tsv, embedding)
            VALUES (
              ${docId}, 
              '${escapedPath}', 
              ${chunk.chunk_index}, 
              '${escapedText}',
              to_tsvector('english', '${escapedText}'),
              embedding('${escapedText}')
            )
            ON CONFLICT (path, chunk_idx) DO UPDATE 
            SET content = EXCLUDED.content,
                tsv = EXCLUDED.tsv,
                embedding = EXCLUDED.embedding
          `);
          insertedCount++;
        }
        
        await sql.end();
        
        return Response.json({
          success: true,
          path,
          chunks: insertedCount,
          source: sourceUrl,
          features: ['CHUNK_TEXT', 'GIN_FTS'],
        }, { headers: corsHeaders });
      }
      
      // GET /search - Hybrid search (FTS + Vector)
      if (url.pathname === '/search' && request.method === 'GET') {
        const query = url.searchParams.get('q') || '';
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const mode = url.searchParams.get('mode') || 'hybrid'; // hybrid, fts, vector
        
        const escapedQuery = query.replace(/'/g, "''");
        
        let results;
        let searchType;
        
        if (mode === 'vector') {
          // Pure vector search
          results = await sql.unsafe(`
            SELECT 
              path, 
              chunk_idx,
              1 - (embedding <=> embedding('${escapedQuery}')) as similarity,
              left(content, 200) as preview
            FROM doc_chunks
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> embedding('${escapedQuery}')
            LIMIT ${limit}
          `);
          searchType = 'VECTOR';
        } else if (mode === 'fts') {
          // Pure FTS search
          const tsQuery = query.trim().split(/\s+/).filter(w => w.length > 0).join(' & ');
          results = await sql.unsafe(`
            SELECT 
              path, 
              chunk_idx,
              ts_rank(tsv, to_tsquery('english', '${tsQuery.replace(/'/g, "''")}')) as rank,
              ts_headline('english', content, to_tsquery('english', '${tsQuery.replace(/'/g, "''")}'), 
                         'MaxFragments=2,MaxWords=30,StartSel=**,StopSel=**') as highlight
            FROM doc_chunks
            WHERE tsv @@ to_tsquery('english', '${tsQuery.replace(/'/g, "''")}')
            ORDER BY rank DESC
            LIMIT ${limit}
          `);
          searchType = 'GIN_FTS';
        } else {
          // Hybrid: RRF (Reciprocal Rank Fusion)
          const tsQuery = query.trim().split(/\s+/).filter(w => w.length > 0).join(' & ');
          results = await sql.unsafe(`
            WITH fts AS (
              SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank(tsv, to_tsquery('english', '${tsQuery.replace(/'/g, "''")}')) DESC) as fts_rank
              FROM doc_chunks
              WHERE tsv @@ to_tsquery('english', '${tsQuery.replace(/'/g, "''")}')
              LIMIT 50
            ),
            vec AS (
              SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> embedding('${escapedQuery}')) as vec_rank
              FROM doc_chunks
              WHERE embedding IS NOT NULL
              LIMIT 50
            ),
            combined AS (
              SELECT 
                COALESCE(fts.id, vec.id) as id,
                COALESCE(1.0 / (60 + fts.fts_rank), 0) + COALESCE(1.0 / (60 + vec.vec_rank), 0) as rrf_score
              FROM fts
              FULL OUTER JOIN vec ON fts.id = vec.id
            )
            SELECT 
              c.path,
              c.chunk_idx,
              combined.rrf_score as score,
              ts_headline('english', c.content, to_tsquery('english', '${tsQuery.replace(/'/g, "''")}'), 
                         'MaxFragments=2,MaxWords=30,StartSel=**,StopSel=**') as highlight
            FROM combined
            JOIN doc_chunks c ON c.id = combined.id
            ORDER BY combined.rrf_score DESC
            LIMIT ${limit}
          `);
          searchType = 'HYBRID_RRF';
        }
        
        await sql.end();
        
        return Response.json({ 
          query, 
          results,
          search_type: searchType
        }, { headers: corsHeaders });
      }
      
      // GET /docs - List indexed documents
      if (url.pathname === '/docs' && request.method === 'GET') {
        const docs = await sql`
          SELECT d.path, d.source_url, length(d.content) as size,
                 (SELECT COUNT(*) FROM doc_chunks c WHERE c.doc_id = d.id) as chunks,
                 d.created_at
          FROM docs d
          ORDER BY d.created_at DESC
        `;
        
        await sql.end();
        
        return Response.json({ docs }, { headers: corsHeaders });
      }
      
      await sql.end();
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
      
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
    }
  }
};
