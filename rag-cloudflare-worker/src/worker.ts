/**
 * db9-rag-worker - Document indexing and search API
 * 
 * POST /index   - Index URL or markdown content
 * GET  /search  - Search indexed documents
 * GET  /docs    - List indexed documents
 */

import postgres from 'postgres';

interface Env {
  DB9_API_TOKEN: string;
  DB9_DATABASE: string;
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
  const res = await fetch(`https://api.staging.db9.ai/customer/databases/${env.DB9_DATABASE}/connect-token`, {
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
    #result { margin-top: 20px; padding: 15px; background: #161b22; border-radius: 6px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>📚 db9 RAG API <span class="badge">CHUNK_TEXT</span></h1>
  
  <h2>Index URL</h2>
  <input type="text" id="url" placeholder="https://example.com/docs" />
  <button onclick="indexUrl()">Index</button>
  
  <h2>Search</h2>
  <input type="text" id="query" placeholder="search query" />
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

# Search
GET /search?q=keyword

# List docs
GET /docs</pre>

  <script>
    async function indexUrl() {
      const url = document.getElementById('url').value;
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
        
        // Delete old chunks
        await sql`DELETE FROM doc_chunks WHERE path = ${path}`;
        
        // Get doc_id
        const docResult = await sql`SELECT id FROM docs WHERE path = ${path}`;
        const docId = docResult[0]?.id;
        
        if (!docId) {
          throw new Error('Failed to get doc_id');
        }
        
        // Chunk first, then insert (workaround for parameter issue)
        // Use unsafe to avoid parameter type issues with table functions
        const escapedContent = content.replace(/'/g, "''");
        const chunkResult = await sql.unsafe(`SELECT chunk_index, chunk_text FROM CHUNK_TEXT('${escapedContent}')`);
        
        let insertedCount = 0;
        for (const chunk of chunkResult) {
          await sql`
            INSERT INTO doc_chunks (doc_id, path, chunk_idx, content)
            VALUES (${docId}, ${path}, ${chunk.chunk_index}, ${chunk.chunk_text})
            ON CONFLICT (path, chunk_idx) DO UPDATE SET content = ${chunk.chunk_text}
          `;
          insertedCount++;
        }
        
        const chunks = { length: insertedCount };
        
        await sql.end();
        
        return Response.json({
          success: true,
          path,
          chunks: chunks.length,
          source: sourceUrl,
        }, { headers: corsHeaders });
      }
      
      // GET /search - Search documents
      if (url.pathname === '/search' && request.method === 'GET') {
        const query = url.searchParams.get('q') || '';
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        const results = await sql`
          SELECT path, chunk_idx, 
                 substring(content, 1, 300) as preview
          FROM doc_chunks 
          WHERE content ILIKE ${'%' + query + '%'}
          LIMIT ${limit}
        `;
        
        await sql.end();
        
        return Response.json({ query, results }, { headers: corsHeaders });
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
