import postgres from 'postgres';

function getSql(env) {
	return postgres(env.DB9_CONNECTION_STRING, {
		ssl: 'require',
		max: 1,
		idle_timeout: 5,
		connect_timeout: 10,
	});
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;

		if (path === '/') {
			return new Response(HELP_TEXT, { headers: { 'Content-Type': 'text/plain' } });
		}
		if (path === '/db') {
			return handleDbTest(env);
		}
		if (path === '/bench') {
			return handleBench(env);
		}
		if (path === '/init') {
			return handleInit(env);
		}
		if (path === '/items' && request.method === 'GET') {
			return handleList(env, url);
		}
		if (path === '/items' && request.method === 'POST') {
			return handleCreate(env, request);
		}
		if (path.startsWith('/items/') && request.method === 'GET') {
			return handleGet(env, path.split('/')[2]);
		}
		if (path.startsWith('/items/') && request.method === 'PUT') {
			return handleUpdate(env, path.split('/')[2], request);
		}
		if (path.startsWith('/items/') && request.method === 'DELETE') {
			return handleDelete(env, path.split('/')[2]);
		}

		return json({ error: 'Not found' }, 404);
	},
};

const HELP_TEXT = `Hello World + db9 CRUD Demo

Endpoints:
  GET  /db          - Test db9 connection
  GET  /bench       - Latency breakdown
  POST /init        - Create the items table
  GET  /items       - List all items
  POST /items       - Create item (JSON body: {"name": "...", "description": "..."})
  GET  /items/:id   - Get item by id
  PUT  /items/:id   - Update item (JSON body: {"name": "...", "description": "..."})
  DELETE /items/:id - Delete item
`;

function json(data, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function handleBench(env) {
	const t0 = Date.now();
	const sql = getSql(env);

	// First query includes connection setup (TCP + TLS + PG handshake)
	const t1 = Date.now();
	await sql`SELECT 1 AS ping`;
	const t2 = Date.now();

	// Second query reuses existing connection
	await sql`SELECT 1 AS ping`;
	const t3 = Date.now();

	// Third query - actual work
	await sql`SELECT version()`;
	const t4 = Date.now();

	await sql.end();

	return json({
		connect_plus_first_query_ms: t2 - t1,
		second_query_ms: t3 - t2,
		third_query_ms: t4 - t3,
		total_ms: t4 - t0,
		note: 'First query includes TCP + TLS + PG handshake. Subsequent queries reuse connection.',
	});
}

async function handleDbTest(env) {
	const sql = getSql(env);
	try {
		const start = Date.now();
		const version = await sql`SELECT version()`;
		const time = await sql`SELECT now() AS current_time`;
		return json({
			status: 'connected',
			latency_ms: Date.now() - start,
			version: version[0].version,
			server_time: time[0].current_time,
		});
	} catch (err) {
		return json({ status: 'error', message: err.message }, 500);
	} finally {
		await sql.end();
	}
}

async function handleInit(env) {
	const sql = getSql(env);
	try {
		await sql`
			CREATE TABLE IF NOT EXISTS items (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT DEFAULT '',
				created_at TIMESTAMPTZ DEFAULT now(),
				updated_at TIMESTAMPTZ DEFAULT now()
			)
		`;
		return json({ status: 'ok', message: 'Table "items" created' });
	} catch (err) {
		return json({ status: 'error', message: err.message }, 500);
	} finally {
		await sql.end();
	}
}

async function handleList(env, url) {
	const sql = getSql(env);
	try {
		const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const rows = await sql`
			SELECT * FROM items ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}
		`;
		const count = await sql`SELECT count(*)::int AS total FROM items`;
		return json({ total: count[0].total, items: rows });
	} catch (err) {
		return json({ status: 'error', message: err.message }, 500);
	} finally {
		await sql.end();
	}
}

async function handleCreate(env, request) {
	const sql = getSql(env);
	try {
		const body = await request.json();
		const { name, description } = body;
		if (!name) return json({ error: 'name is required' }, 400);
		const rows = await sql`
			INSERT INTO items (name, description)
			VALUES (${name}, ${description || ''})
			RETURNING *
		`;
		return json(rows[0], 201);
	} catch (err) {
		return json({ status: 'error', message: err.message }, 500);
	} finally {
		await sql.end();
	}
}

async function handleGet(env, id) {
	const sql = getSql(env);
	try {
		const rows = await sql`SELECT * FROM items WHERE id = ${id}`;
		if (rows.length === 0) return json({ error: 'Not found' }, 404);
		return json(rows[0]);
	} catch (err) {
		return json({ status: 'error', message: err.message }, 500);
	} finally {
		await sql.end();
	}
}

async function handleUpdate(env, id, request) {
	const sql = getSql(env);
	try {
		const body = await request.json();
		const { name, description } = body;
		const rows = await sql`
			UPDATE items
			SET name = COALESCE(${name ?? null}, name),
			    description = COALESCE(${description ?? null}, description),
			    updated_at = now()
			WHERE id = ${id}
			RETURNING *
		`;
		if (rows.length === 0) return json({ error: 'Not found' }, 404);
		return json(rows[0]);
	} catch (err) {
		return json({ status: 'error', message: err.message }, 500);
	} finally {
		await sql.end();
	}
}

async function handleDelete(env, id) {
	const sql = getSql(env);
	try {
		const rows = await sql`DELETE FROM items WHERE id = ${id} RETURNING *`;
		if (rows.length === 0) return json({ error: 'Not found' }, 404);
		return json({ status: 'deleted', item: rows[0] });
	} catch (err) {
		return json({ status: 'error', message: err.message }, 500);
	} finally {
		await sql.end();
	}
}
