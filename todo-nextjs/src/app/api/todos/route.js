import sql from '@/lib/db';

export async function GET() {
  try {
    const todos = await sql`SELECT * FROM todos ORDER BY created_at DESC`;
    return Response.json(todos);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { title } = await request.json();
    if (!title?.trim()) {
      return Response.json({ error: 'title is required' }, { status: 400 });
    }
    const [todo] = await sql`
      INSERT INTO todos (title) VALUES (${title.trim()}) RETURNING *
    `;
    return Response.json(todo, { status: 201 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
