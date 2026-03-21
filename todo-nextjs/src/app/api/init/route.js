import sql from '@/lib/db';

export async function POST() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        completed BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    return Response.json({ status: 'ok', message: 'Table "todos" created' });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
