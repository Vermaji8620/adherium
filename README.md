# Adherium

Adherium is split into two local Node.js applications:

- `backend/` is an Express API backed by MongoDB.
- `client/` is the Next.js web app. It proxies API requests to the backend.

## Prerequisites

- Git, Node.js 20.9 or newer, and npm.
- A MongoDB instance that the backend can reach. Use a local MongoDB service or a MongoDB URI provided for your development environment.

## Clone and configure

```sh
git clone <repository-url> Adherium
cd Adherium
```

Configure the backend first. From `backend/`, create `.env.local` from the example if you do not already have a local environment file:

```sh
# macOS / Linux
cd backend
test -f .env.local || cp .env.example .env.local
cd ..
```

```powershell
# Windows PowerShell
Set-Location backend
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
Set-Location ..
```

Edit `backend/.env.local` and replace the placeholder `MONGODB_URI` with a URI for your MongoDB instance. For a local MongoDB service without authentication, it can look like this:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/adherium
PORT=4000
NODE_ENV=development
```

Keep credentials private and do not commit `.env.local`. The backend does not seed the database on startup; it serves the records already present in the configured database.

## Start the backend

In a terminal, from the repository root:

```sh
cd backend
npm ci
npm start
```

The API listens on `http://127.0.0.1:4000`. Check that it started and can reach MongoDB at <http://127.0.0.1:4000/health>.

## Start the client

Keep the backend running. Open a second terminal from the repository root:

```sh
cd client
npm ci
npm run dev
```

Open <http://localhost:3000/overview>. The other screens are available at `/patients`, `/patient-profile`, `/devices`, `/medication-adherence`, `/analytics`, `/alerts`, `/care-team`, `/reports`, and `/data-management`.

For the default local setup, no client environment file is needed: `client/next.config.ts` proxies `/api/*` and `/health` to `http://127.0.0.1:4000`. If the backend listens at another origin, create `client/.env.local` with the backend origin (without `/api/v1`), for example:

```dotenv
BACKEND_API_URL=http://127.0.0.1:4000
```

Restart the Next.js dev server after changing this value.

## Stop the applications

Press `Ctrl+C` in each terminal. Keep the backend bound to localhost; authentication is not implemented.

For API details and backend-specific notes, see [backend/README.md](backend/README.md). For frontend architecture and screen details, see [client/README.md](client/README.md).
