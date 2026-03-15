# CRUD Cloudflare Worker with db9

A simple CRUD API built with [Cloudflare Workers](https://workers.cloudflare.com/) and [db9](https://db9.ai) as the PostgreSQL-compatible database backend.

Uses [`postgres`](https://github.com/porsager/postgres) (porsager/postgres) which natively supports Cloudflare Workers TCP Sockets API.

> **Note**: Do NOT use `pg` (node-postgres) in Cloudflare Workers - it depends on Node.js `net` module and will hang. Use `postgres` (porsager/postgres) instead.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.dev.vars` file from the example:

```bash
cp .dev.vars.example .dev.vars
```

3. Edit `.dev.vars` and set your db9 connection string:

```
DB9_CONNECTION_STRING=postgresql://username:password@pg.db9.io:5433/postgres
```

4. For production, set the secret via wrangler:

```bash
npx wrangler secret put DB9_CONNECTION_STRING
```

## Development

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Help text |
| GET | `/db` | Test db9 connection |
| GET | `/bench` | Latency breakdown |
| POST | `/init` | Create the items table |
| GET | `/items` | List all items (supports `?limit=&offset=`) |
| POST | `/items` | Create item |
| GET | `/items/:id` | Get item by id |
| PUT | `/items/:id` | Update item |
| DELETE | `/items/:id` | Delete item |

### Examples

```bash
# Initialize the table
curl -X POST https://your-worker.workers.dev/init

# Create an item
curl -X POST https://your-worker.workers.dev/items \
  -H 'Content-Type: application/json' \
  -d '{"name": "my item", "description": "hello from db9"}'

# List items
curl https://your-worker.workers.dev/items

# Update an item
curl -X PUT https://your-worker.workers.dev/items/1 \
  -H 'Content-Type: application/json' \
  -d '{"name": "updated name"}'

# Delete an item
curl -X DELETE https://your-worker.workers.dev/items/1
```
