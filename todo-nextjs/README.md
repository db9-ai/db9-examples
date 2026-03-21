# Todo App - Next.js + db9

A simple todo app with a web UI, built with [Next.js](https://nextjs.org/) and [db9](https://db9.ai) as the PostgreSQL-compatible database.

Deployable to [Vercel](https://vercel.com) in one click.

## Features

- Add, complete, and delete todos
- Clean, responsive UI
- Server-side API routes with `postgres.js`
- Auto-creates the `todos` table on first load

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file:

```bash
cp .env.example .env.local
```

3. Edit `.env.local` with your db9 connection string:

```
DB9_CONNECTION_STRING=postgresql://username:password@pg.db9.io:5433/postgres
```

4. Run the dev server:

```bash
npm run dev
```

Visit http://localhost:3000

## Deploy to Vercel

1. Push this directory to a GitHub repo (or use the db9-examples repo)
2. Import the project in [Vercel](https://vercel.com/new)
3. Set the **Root Directory** to `todo-nextjs`
4. Add the environment variable `DB9_CONNECTION_STRING` in Vercel project settings
5. Deploy

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/init` | Create the todos table |
| GET | `/api/todos` | List all todos |
| POST | `/api/todos` | Create a todo (`{"title": "..."}`) |
| PATCH | `/api/todos/:id` | Update a todo (`{"completed": true}` or `{"title": "..."}`) |
| DELETE | `/api/todos/:id` | Delete a todo |

## Tech Stack

- **Frontend**: Next.js App Router + React
- **Backend**: Next.js API Routes
- **Database**: db9 (PostgreSQL-compatible, powered by TiKV)
- **Driver**: `postgres` (porsager/postgres) - works in both Node.js and edge runtimes
