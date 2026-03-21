import sql from '@/lib/db';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const [todo] = await sql`
      UPDATE todos
      SET completed = COALESCE(${body.completed ?? null}, completed),
          title = COALESCE(${body.title ?? null}, title)
      WHERE id = ${id}
      RETURNING *
    `;
    if (!todo) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(todo);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const [todo] = await sql`DELETE FROM todos WHERE id = ${id} RETURNING *`;
    if (!todo) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ deleted: todo });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
