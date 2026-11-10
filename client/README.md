# Adherium frontend

A Next.js App Router conversion of the saved respiratory-monitoring prototype. Its app shell, markup, styles, typography, icons, and transitions are based on the local prototype. Records and supported actions come from the existing Express API.

## Run locally

Start the backend in one PowerShell window:

```powershell
Set-Location C:\Users\Adi\Desktop\Adherium\backend
npm start
```

In another window:

```powershell
Set-Location C:\Users\Adi\Desktop\Adherium\client
Copy-Item .env.example .env.local
npm install
npm run dev
```

If `.env.local` already exists, keep it and set `BACKEND_API_URL=http://127.0.0.1:4000`. Browse to <http://localhost:3000/overview>. The backend health route is <http://127.0.0.1:4000/health>.

The backend URL is read by `next.config.ts` on the server and proxied through Next rewrites for `/api/*` and `/health`. 

## Prototype sources reused

- `reference/Adherium_ Respiratory Monitoring_files/saved_resource.html` contains the actual app markup, CSS, screen renderers, and interactions. Its app body and two app scripts are copied under `public/prototype/` and adapted to use the API.
- `reference/Adherium_ Respiratory Monitoring_files/css2` supplies the original Onest font-face CSS (font files are loaded from its original Google Fonts URLs).
- `reference/Adherium_ Respiratory Monitoring_files/gsap.min.js.download` supplies the original animation library.
- `reference/Adherium_ Respiratory Monitoring.html` and `frame-shell-CMZGLhA2.js.download` are the outer saved artifact host, not the application. The Next app does not embed that host or use an iframe.

## App Router screens

`src/app/` defines these screens and clean, hash-free paths:

| Screen | Path |
| --- | --- |
| Overview | `/overview` ( `/` redirects here ) |
| Patient Monitoring | `/patients` |
| Patient Health Profile | `/patient-profile` or `/patient-profile/:id` |
| Smart Inhaler Devices | `/devices` |
| Medication Adherence | `/medication-adherence` |
| Respiratory Analytics | `/analytics` |
| Alerts & Follow-up | `/alerts` |
| Care Team Workspace | `/care-team` |
| Reports & Insights | `/reports` |
| Data & Device Management | `/data-management` |

The shared root layout keeps the prototype shell mounted across navigation. The prototype navigation updates the pathname; the original hash-based navigation has been removed. Selecting a patient opens `/patient-profile/:id`.

## Frontend data and rendering

- The initial load requests only Overview data: patients, devices, alerts, and the last seven days of adherence. The shell appears immediately with a loading state while those requests complete.
- The Overview renders its recent data first. Six-week trend and cohort history loads in the background; those charts show a loading state until the history arrives.
- Other screens load their API resources the first time they are opened. The client keeps successful resource requests in memory for 60 seconds, shares in-flight requests, and clears that cache after successful API mutations.
- `src/lib/api.ts` fetches and adapts the backend records for the prototype screens. Cohorts are matched by stable cohort IDs, rather than object identity, so API-backed patients appear in cohort summaries and charts.
- Patient profile data is loaded before its screen is rendered. If a patient has no rescue-use events, the timeline remains empty without trying to animate missing SVG points.
- Adherence charts skip unrecorded days and show gaps where data is missing. Empty data ranges use safe chart bounds, preventing `NaN` SVG coordinates.
- GSAP entrance animations resolve their targets first and skip the animation when a screen has no matching elements. This keeps optional empty states from producing “target not found” console warnings.
- The Overview adherence figure is calculated from the API’s recorded adherence values. It is rendered immediately; its value can differ from a saved prototype screenshot because the live backend data is separate.

## API connections

The UI calls the existing `/api/v1` endpoints through Next rewrites:

- Overview: `/analytics/overview`, `/patients`, `/devices`, `/adherence`, `/alerts`, `/data/audit`.
- Patient Monitoring: `/patients`, `/adherence`; roster search, cohort, status, and sort controls operate on these fetched records.
- Patient Health Profile: `/patients/:id`, `/patients/:id/timeline`, plus the fetched notes and alerts.
- Smart Inhaler Devices: `/devices`, `/devices/:id/sync`, `/devices/sync`.
- Medication Adherence: `/adherence`.
- Respiratory Analytics: `/adherence`, `/events`.
- Alerts & Follow-up: `/alerts`, `PATCH /alerts/:id`, `POST /alerts/:id/acknowledge`.
- Care Team Workspace: `/alerts`, `/notes`, `POST /notes`.
- Reports & Insights: `/reports`, `POST /reports`, `DELETE /reports/:id`, `/reports/:id/export.csv`.
- Data & Device Management: `/data/imports`, `/data/imports/validate`, `/data/integrations`, `/data/firmware`, `/data/firmware/schedule`, `/data/audit`.

The app fetches API data only; it does not generate patient, adherence, event, alert, note, import, report, or device rows in the browser. Missing adherence samples remain unrecorded in the UI math. Symptom-free-day values are unavailable because the backend does not supply them.

Device sync and firmware scheduling are explicitly simulated by backend endpoints. CSV validation records a validation result only; it does not enroll or import patients. Integration statuses are display records and no external system is contacted. Authentication is not implemented; use this application only with the local synthetic-data backend.

## Checks

Run these from `client/`:

```powershell
npm run lint
npm run build
```

The prototype scripts can also be syntax-checked with:

```powershell
node --check public/prototype/core.js
node --check public/prototype/pages.js
```
