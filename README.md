# Adherium

Adherium is split into two Node.js applications:

- `backend/` is an Express API backed by MongoDB. It can run locally or as a Vercel Function.
- `client/` is the Next.js web app. It proxies API requests to the backend.

## Deploy to Vercel

Deploy the two folders as separate Vercel projects from the same repository. Vercel's monorepo setup uses each project's root directory to build the matching app.

### 1. Deploy the backend

Create a Vercel project with **Root Directory** set to `backend`. Vercel detects the Express app in `src/index.js`. Add these environment variables to the backend project for Production and Preview:

- `MONGODB_URI`: a reachable MongoDB connection string. The database must allow connections from the Vercel deployment.
- `AUTH_EMAIL`: the sign-in email.
- `AUTH_PASSWORD_HASH`: generate with `npm run auth:hash` from `backend/`.
- `AUTH_SECRET`: generate a random 32-byte secret as described in [Authentication setup](backend/README.md#authentication-setup).

Keep those values in Vercel's Environment Variables settings; do not commit them. Seed the database once if you want the sample workspace records, using the documented opt-in seed command from a trusted local environment.

### 2. Deploy the frontend

Create another Vercel project from the same repository with **Root Directory** set to `client`. Next.js is detected automatically. Set `BACKEND_API_URL` to the backend deployment's origin, for example `https://your-api.vercel.app` (no trailing slash and no `/api/v1` suffix), for Production and Preview. The frontend routes `/api/*` and `/health` through this origin, so browser requests stay on the frontend domain and the session cookie works across the proxy.

Deploy the backend first, then set `BACKEND_API_URL` and deploy the frontend. For isolated Preview data, use a separate preview backend and database and set the Preview value to that backend's origin.

The API uses MongoDB as persistent storage; Vercel function instances are not persistent storage. For local development, the existing `npm start` backend and `BACKEND_API_URL=http://127.0.0.1:4000` setup still apply.

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

Before starting the backend, configure `AUTH_EMAIL`, `AUTH_PASSWORD_HASH`, and `AUTH_SECRET` in the same file. Generate the password hash with `npm run auth:hash` from `backend/`, and generate a random 32-byte `AUTH_SECRET` as described in [backend/README.md](backend/README.md#authentication-setup). Keep credentials private and do not commit `.env.local`. The backend does not seed the database on startup; it serves the records already present in the configured database.

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

Open <http://localhost:3000/login> and sign in with the configured account. The other screens are available at `/overview`, `/patients`, `/patient-profile`, `/devices`, `/medication-adherence`, `/analytics`, `/alerts`, `/care-team`, `/reports`, and `/data-management` after authentication.

For the default local setup, no client environment file is needed: `client/next.config.ts` proxies `/api/*` and `/health` to `http://127.0.0.1:4000`. If the backend listens at another origin, create `client/.env.local` with the backend origin (without `/api/v1`), for example:

```dotenv
BACKEND_API_URL=http://127.0.0.1:4000
```

Restart the Next.js dev server after changing this value.

## Stop the applications

Press `Ctrl+C` in each terminal. The backend stays bound to localhost by default; all page-data APIs require an authenticated session.

For API details and backend-specific notes, see [backend/README.md](backend/README.md). For frontend architecture and screen details, see [client/README.md](client/README.md).
